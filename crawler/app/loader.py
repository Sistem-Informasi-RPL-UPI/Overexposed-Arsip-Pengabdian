"""
loader.py
Crawl SINTA lalu simpan ke Postgres (Neon). Dipanggil dari FastAPI (main.py) lewat pilih_dosen lalu
jalankan_sinkron, yang memanggil sync_dosen per dosen.

Memakai parser dari sinta.py.
Hanya meng-UPDATE baris dosen yang sudah ada (dibuat oleh Next.js saat sinta_id diisi).
Status IPRS disimpan apa adanya dari SINTA (hanya dirapikan spasinya). Kegiatan tidak punya status.
"""
import hashlib
import random
import re
import time
import unicodedata
from datetime import datetime, timedelta, timezone

import psycopg
from bs4 import BeautifulSoup
from psycopg.rows import dict_row

import config
import sinta

# view artikel -> nilai kolom publikasi_dosen.source
SOURCE = {
    "scopus": "sinta_scopus",
    "garuda": "sinta_garuda",
    "googlescholar": "sinta_googlescholar",
    "rama": "sinta_rama",
}


# ==========================================
# UTIL: KUNCI ANTI-DOBEL DAN NORMALISASI NAMA
# ==========================================
def norm(teks):
    return re.sub(r"[\W_]+", "", str(teks if teks is not None else "").lower())


def kunci(*bagian):
    """Hash anti-dobel. kunci(judul) sama persis dengan judul_hash yang dipakai sebelumnya."""
    return hashlib.md5("|".join(norm(b) for b in bagian).encode("utf-8")).hexdigest()


# Padanannya ada di src/lib/kunci.ts. Hasil keduanya dicek terhadap tests/fixtures/kunci.json.
def kunci_publikasi(judul):
    return kunci(nz(judul))


def kunci_kegiatan(jenis, judul, tahun):
    return kunci(jenis, nz(judul), tahun)


def kunci_iprs(nomor_permohonan, judul, tahun):
    nomor = nz(nomor_permohonan, 100)
    return kunci(nomor) if nomor else kunci(nz(judul), tahun)


def kunci_buku(isbn, judul, tahun):
    nomor = nz(isbn, 50)
    return kunci(nomor) if nomor else kunci(nz(judul), tahun)


GELAR_DEPAN = {"prof", "dr", "drs", "dra", "ir", "h", "hj"}

# Gelar belakang bertitik: s.kom. / m.t. / m.sc / s.pd.i / ph.d. Tiap segmen maksimal 4 huruf
# supaya inisial panjang seperti "m.iqbal" tidak ikut terbuang.
GELAR_BELAKANG = re.compile(r"[a-z]{1,4}(?:\.[a-z]{1,4})+\.?")


def norm_nama(nama):
    """
    Huruf kecil, tanpa aksen, hanya gelar akademik yang dibuang, tanda baca dibuang, spasi dirapikan.
    'Dr. Mochamad Iqbal Ardimansyah, S.Kom., M.T.' -> 'mochamad iqbal ardimansyah'
    'Nama, Nama' -> 'nama nama'
    """
    t = unicodedata.normalize("NFKD", nama or "")
    t = "".join(c for c in t if not unicodedata.combining(c)).lower()
    kata = t.replace(",", " ").split()
    while kata and kata[0].strip(".") in GELAR_DEPAN:
        kata.pop(0)
    # Kata pertama tidak diperiksa: "M.Ali Rahman" adalah nama, bukan gelar.
    kata = kata[:1] + [k for k in kata[1:] if not GELAR_BELAKANG.fullmatch(k)]
    t = re.sub(r"[^a-z0-9\s]", " ", " ".join(kata))
    return re.sub(r"\s+", " ", t).strip()


def gabung(tabel, kolom, teks=True):
    """
    Ekspresi SET untuk ON CONFLICT (PRD 5.3).
    Baris manual: hanya kolom yang kosong yang diisi dari SINTA. Baris SINTA: nilai SINTA terbaru dipakai bila ada.
    Kolom sumber sengaja tidak diubah saat ON CONFLICT, jadi baris manual tetap manual dan isiannya terlindungi
    di setiap crawl (PRD 12 nomor 21). Nama tabel dan kolom berasal dari kode ini sendiri, bukan dari input.
    """
    lama = f"NULLIF({tabel}.{kolom}, '')" if teks else f"{tabel}.{kolom}"
    return (f"{kolom} = CASE WHEN {tabel}.sumber = 'manual' "
            f"THEN COALESCE({lama}, EXCLUDED.{kolom}) "
            f"ELSE COALESCE(EXCLUDED.{kolom}, {tabel}.{kolom}) END")


def nz(v, panjang=None):
    """Kosong -> None. Teks dipotong sesuai panjang kolom supaya tidak error."""
    if v is None:
        return None
    if isinstance(v, str):
        v = v.strip()
        if not v:
            return None
        if panjang:
            v = v[:panjang]
    return v


def tiny(v):
    return None if v is None else max(0, min(int(v), 127))


# ==========================================
# CRAWL KE MEMORI (pakai komponen dari sinta.py)
# ==========================================
def crawl_ke_memori(sinta_id):
    base = sinta.BASE_URL.format(sinta_id)

    html_main = sinta.fetch(base, None)
    if html_main is None:
        raise ConnectionError(f"Gagal menghubungi SINTA untuk ID {sinta_id}")
    if 'type="password"' in html_main.lower():
        raise PermissionError(f"Profil {sinta_id} meminta login")

    profil = sinta.parse_profile_overview(BeautifulSoup(html_main, "html.parser"))
    if not profil["nama"]:
        raise ValueError(f"SINTA ID {sinta_id} tidak ditemukan (profil kosong)")

    views = {}
    for _kategori, view, _suffix in sinta.VIEWS_CONFIG:
        html = sinta.fetch(base, view)
        if html is None or 'type="password"' in html.lower():
            views[view] = {"ok": False, "rows": []}
        else:
            soup = BeautifulSoup(html, "html.parser")
            rows = [sinta.PARSERS[view](it) for it in soup.select("div.ar-list-item")]
            views[view] = {"ok": True, "rows": rows}
        time.sleep(config.DELAY_CATEGORY)

    return {"profil": profil, "views": views}


# ==========================================
# SIMPAN: PROFIL
# ==========================================
def simpan_profil(cur, dosen_id, p):
    cur.execute(
        """UPDATE dosen SET
             nama        = COALESCE(%s, nama),
             nama_normal = COALESCE(%s, nama_normal),
             afiliasi    = COALESCE(%s, afiliasi),
             departemen  = COALESCE(%s, departemen),
             updated_at  = NOW()
           WHERE id = %s""",
        (nz(p["nama"], 200), nz(norm_nama(p["nama"]), 200),
         nz(p["afiliasi"], 200), nz(p["departemen"], 200), dosen_id),
    )
    for label, nilai in p["skor"].items():
        cur.execute(
            """INSERT INTO sinta_skor (dosen_id, label, nilai) VALUES (%s, %s, %s)
               ON CONFLICT (dosen_id, label) DO UPDATE SET nilai = EXCLUDED.nilai""",
            (dosen_id, label, nilai),
        )
    for label, v in p["metrik"].items():
        cur.execute(
            """INSERT INTO sinta_metrik (dosen_id, label, scopus, gscholar, wos)
               VALUES (%s, %s, %s, %s, %s)
               ON CONFLICT (dosen_id, label) DO UPDATE SET
                 scopus = EXCLUDED.scopus, gscholar = EXCLUDED.gscholar, wos = EXCLUDED.wos""",
            (dosen_id, label, v.get("scopus", 0), v.get("google_scholar", 0), v.get("wos", 0)),
        )


# ==========================================
# SIMPAN: PUBLIKASI (scopus, garuda, googlescholar, rama)
# ==========================================
def simpan_publikasi(cur, dosen_id, view, rows):
    source = SOURCE[view]
    n = 0
    for r in rows:
        judul = nz(r.get("judul"))
        if not judul:
            continue
        h = kunci_publikasi(judul)

        # publikasi: kalau sudah ada (dari sumber/dosen lain atau manual) tidak dobel, cuma dilengkapi.
        # Aturan ini sama untuk baris SINTA dan manual, jadi tidak perlu gabung().
        cur.execute(
            """INSERT INTO publikasi
                 (judul_hash, judul, tahun, penulis, jurnal, sitasi, link,
                  kuartil, jenis, penerbit, doi, akreditasi, sumber)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'sinta')
               ON CONFLICT (judul_hash) DO UPDATE SET
                 tahun      = COALESCE(publikasi.tahun, EXCLUDED.tahun),
                 penulis    = COALESCE(NULLIF(publikasi.penulis, ''), EXCLUDED.penulis),
                 jurnal     = COALESCE(NULLIF(publikasi.jurnal, ''), EXCLUDED.jurnal),
                 sitasi     = GREATEST(publikasi.sitasi, EXCLUDED.sitasi),
                 link       = COALESCE(NULLIF(publikasi.link, ''), EXCLUDED.link),
                 kuartil    = COALESCE(NULLIF(publikasi.kuartil, ''), EXCLUDED.kuartil),
                 jenis      = COALESCE(NULLIF(publikasi.jenis, ''), EXCLUDED.jenis),
                 penerbit   = COALESCE(NULLIF(publikasi.penerbit, ''), EXCLUDED.penerbit),
                 doi        = COALESCE(NULLIF(publikasi.doi, ''), EXCLUDED.doi),
                 akreditasi = COALESCE(NULLIF(publikasi.akreditasi, ''), EXCLUDED.akreditasi),
                 updated_at = NOW()
               RETURNING id""",
            (h, judul, r.get("tahun"), nz(r.get("penulis") or r.get("creator")), nz(r.get("jurnal")),
             r.get("sitasi") or 0, nz(r.get("link")),
             nz(r.get("kuartil"), 10), nz(r.get("jenis"), 50), nz(r.get("penerbit"), 200),
             nz(r.get("doi"), 150), nz(r.get("akreditasi"), 50)),
        )
        pub_id = cur.fetchone()["id"]

        # hubungan dosen - publikasi untuk sumber ini
        cur.execute(
            """INSERT INTO publikasi_dosen
                 (publikasi_id, dosen_id, source, urutan_penulis, total_penulis,
                  sitasi_sumber, link_sumber)
               VALUES (%s, %s, %s, %s, %s, %s, %s)
               ON CONFLICT (publikasi_id, dosen_id, source) DO UPDATE SET
                 urutan_penulis = COALESCE(EXCLUDED.urutan_penulis, publikasi_dosen.urutan_penulis),
                 total_penulis  = COALESCE(EXCLUDED.total_penulis, publikasi_dosen.total_penulis),
                 sitasi_sumber  = COALESCE(EXCLUDED.sitasi_sumber, publikasi_dosen.sitasi_sumber),
                 link_sumber    = COALESCE(EXCLUDED.link_sumber, publikasi_dosen.link_sumber)""",
            (pub_id, dosen_id, source, tiny(r.get("urutan_penulis")),
             tiny(r.get("total_penulis")), r.get("sitasi"), nz(r.get("link"))),
        )
        n += 1
    return n


# ==========================================
# SIMPAN: KEGIATAN (penelitian / pengabdian) + ANGGOTA
# ==========================================
def muat_peta_dosen(cur):
    """nama_normal -> dosen_id, hanya untuk nama yang unik (kalau kembar, tidak dicocokkan)."""
    cur.execute("SELECT id, nama_normal FROM dosen WHERE nama_normal IS NOT NULL AND nama_normal <> ''")
    peta = {}
    for r in cur.fetchall():
        peta.setdefault(r["nama_normal"], []).append(r["id"])
    return {k: v[0] for k, v in peta.items() if len(v) == 1}


def simpan_kegiatan(cur, dosen_id, jenis, rows):
    peta = muat_peta_dosen(cur)
    n, tanpa_diri = 0, 0
    for r in rows:
        judul = nz(r.get("judul"))
        if not judul:
            continue
        k = kunci_kegiatan(jenis, judul, r.get("tahun"))

        cur.execute(
            f"""INSERT INTO kegiatan
                 (kunci, jenis, judul, tahun, skema, dana_nominal, sumber_dana, sumber)
               VALUES (%s, %s, %s, %s, %s, %s, %s, 'sinta')
               ON CONFLICT (kunci) DO UPDATE SET
                 {gabung("kegiatan", "skema")},
                 dana_nominal = CASE WHEN kegiatan.sumber = 'manual' AND kegiatan.dana_nominal > 0
                                     THEN kegiatan.dana_nominal
                                     WHEN EXCLUDED.dana_nominal > 0 THEN EXCLUDED.dana_nominal
                                     ELSE kegiatan.dana_nominal END,
                 {gabung("kegiatan", "sumber_dana")},
                 updated_at   = NOW()
               RETURNING id""",
            (k, jenis, judul, r.get("tahun"), nz(r.get("skema"), 255),
             r.get("dana_nominal") or 0, nz(r.get("sumber_dana"), 100)),
        )
        kegiatan_id = cur.fetchone()["id"]

        orang = []
        if nz(r.get("ketua")):
            orang.append((r["ketua"], "ketua"))
        orang += [(a, "anggota") for a in (r.get("anggota") or [])]

        diri_cocok = False
        for nama, peran in orang:
            nm = norm_nama(nama)
            if not nm:
                continue
            did = peta.get(nm)
            if did == dosen_id:
                diri_cocok = True
            cur.execute(
                """INSERT INTO kegiatan_anggota (kegiatan_id, nama, nama_normal, peran, dosen_id)
                   VALUES (%s, %s, %s, %s, %s)
                   ON CONFLICT (kegiatan_id, nama_normal) DO UPDATE SET
                     peran    = CASE WHEN EXCLUDED.peran = 'ketua' THEN EXCLUDED.peran
                                     ELSE kegiatan_anggota.peran END,
                     dosen_id = COALESCE(EXCLUDED.dosen_id, kegiatan_anggota.dosen_id)""",
                (kegiatan_id, nz(nama, 200), nm[:200], peran, did),
            )
        if not diri_cocok:
            tanpa_diri += 1
        n += 1

    if tanpa_diri:
        print(f"    [!] {tanpa_diri} {jenis}: nama dosen ini tidak ketemu di daftar anggota "
              f"(cek penulisan nama di SINTA vs kolom nama_normal)")
    return n


# ==========================================
# SIMPAN: IPR dan BUKU
# ==========================================
def simpan_iprs(cur, dosen_id, rows):
    n = 0
    for r in rows:
        judul = nz(r.get("judul"))
        if not judul:
            continue
        nomor = nz(r.get("nomor_permohonan"), 100)
        k = kunci_iprs(nomor, judul, r.get("tahun"))

        # status selalu mengikuti SINTA, termasuk saat baris manual digabung (PRD 5.3).
        cur.execute(
            f"""INSERT INTO iprs
                 (kunci, judul, jenis, tahun, nomor_permohonan, status, pemegang, inventor, sumber)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'sinta')
               ON CONFLICT (kunci) DO UPDATE SET
                 {gabung("iprs", "jenis")},
                 {gabung("iprs", "tahun", teks=False)},
                 {gabung("iprs", "nomor_permohonan")},
                 status           = COALESCE(EXCLUDED.status, iprs.status),
                 {gabung("iprs", "pemegang")},
                 {gabung("iprs", "inventor")},
                 updated_at       = NOW()
               RETURNING id""",
            (k, judul, nz(r.get("jenis"), 100), r.get("tahun"), nomor,
             nz(r.get("status"), 100), nz(r.get("pemegang"), 255), nz(r.get("inventor"))),
        )
        iprs_id = cur.fetchone()["id"]
        cur.execute(
            "INSERT INTO iprs_dosen (iprs_id, dosen_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
            (iprs_id, dosen_id),
        )
        n += 1
    return n


def simpan_buku(cur, dosen_id, rows):
    n = 0
    for r in rows:
        judul = nz(r.get("judul"))
        if not judul:
            continue
        isbn = nz(r.get("isbn"), 50)
        k = kunci_buku(isbn, judul, r.get("tahun"))

        cur.execute(
            f"""INSERT INTO buku
                 (kunci, judul, kategori, penulis, penerbit, tahun, tempat_terbit, isbn, sumber)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'sinta')
               ON CONFLICT (kunci) DO UPDATE SET
                 {gabung("buku", "kategori")},
                 {gabung("buku", "penulis")},
                 {gabung("buku", "penerbit")},
                 {gabung("buku", "tahun", teks=False)},
                 {gabung("buku", "tempat_terbit")},
                 {gabung("buku", "isbn")},
                 updated_at    = NOW()
               RETURNING id""",
            (k, judul, nz(r.get("kategori"), 100), nz(r.get("penulis")),
             nz(r.get("penerbit"), 200), r.get("tahun"),
             nz(r.get("tempat_terbit"), 200), isbn),
        )
        buku_id = cur.fetchone()["id"]
        cur.execute(
            "INSERT INTO buku_dosen (buku_id, dosen_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
            (buku_id, dosen_id),
        )
        n += 1
    return n


# ==========================================
# STATUS SINKRONISASI DAN LOG
# ==========================================
def set_status(conn, dosen_id, status, synced=False):
    """Selalu di-commit langsung, terpisah dari transaksi penyimpanan data."""
    with conn.cursor() as cur:
        if synced:
            cur.execute(
                "UPDATE dosen SET sync_status = %s, last_synced_at = NOW(), updated_at = NOW() WHERE id = %s",
                (status, dosen_id),
            )
        else:
            cur.execute(
                "UPDATE dosen SET sync_status = %s, updated_at = NOW() WHERE id = %s",
                (status, dosen_id),
            )
    conn.commit()


def catat_log(cur, dosen_id, kategori, ok, jumlah):
    cur.execute(
        """INSERT INTO crawl_log (dosen_id, kategori, jumlah_item, terpotong, status)
           VALUES (%s, %s, %s, %s, %s)""",
        (dosen_id, kategori, jumlah, jumlah >= 10, "ok" if ok else "gagal"),
    )


def backfill_anggota(conn):
    """Sambungkan anggota lama yang belum cocok ke dosen yang baru masuk, tanpa crawling ulang."""
    with conn.cursor() as cur:
        cur.execute(
            """UPDATE kegiatan_anggota a
               SET dosen_id = d.id
               FROM dosen d
               WHERE d.nama_normal = a.nama_normal AND a.dosen_id IS NULL"""
        )
    conn.commit()


# ==========================================
# ATURAN SINKRON (logika murni, PRD 5.3)
# ==========================================
def tentukan_status(views):
    """SUCCESS bila semua tab berhasil, PARTIAL bila sebagian gagal, FAILED bila semua gagal."""
    gagal = sum(1 for r in views.values() if not r["ok"])
    if not views or gagal == len(views):
        return "FAILED"
    return "PARTIAL" if gagal else "SUCCESS"


def perlu_sinkron(sync_status, last_synced_at, sekarang):
    """
    Aturan 7 hari dengan pengecualian FAILED dan PARTIAL. IN_PROGRESS ikut diproses karena di luar
    crawl yang sedang berjalan, status itu berarti baris sudah dipesan Next.js (PRD 8 langkah 3)
    setelah aturan yang sama dicek di sana. Sisa IN_PROGRESS lama dibersihkan saat layanan menyala.
    """
    if sync_status in (None, "FAILED", "PARTIAL", "IN_PROGRESS") or last_synced_at is None:
        return True
    return sekarang - last_synced_at > timedelta(days=config.SYNC_ULANG_SETELAH_HARI)


# ==========================================
# PROSES SATU DOSEN
# ==========================================
def proses_dosen(conn, d):
    dosen_id = d["id"]
    sinta_id = str(d["sinta_id"]).strip()

    status_akhir = "FAILED"
    try:
        hasil = crawl_ke_memori(sinta_id)

        with conn.cursor() as cur:
            simpan_profil(cur, dosen_id, hasil["profil"])
            print(f"    profil: {hasil['profil']['nama']} | {hasil['profil']['afiliasi']}")

            for _kategori, view, _suffix in sinta.VIEWS_CONFIG:
                r = hasil["views"][view]
                jumlah = len(r["rows"])
                catat_log(cur, dosen_id, view, r["ok"], jumlah)

                if not r["ok"]:
                    print(f"    [{view}] GAGAL diambil, dilewati (data lama tidak diubah)")
                    continue

                if view in SOURCE:
                    simpan_publikasi(cur, dosen_id, view, r["rows"])
                elif view == "researches":
                    simpan_kegiatan(cur, dosen_id, "penelitian", r["rows"])
                elif view == "services":
                    simpan_kegiatan(cur, dosen_id, "pengabdian", r["rows"])
                elif view == "iprs":
                    simpan_iprs(cur, dosen_id, r["rows"])
                elif view == "books":
                    simpan_buku(cur, dosen_id, r["rows"])

                catatan = " (kemungkinan terpotong, batas SINTA publik)" if jumlah >= 10 else ""
                print(f"    [{view}] {jumlah} item{catatan}")
        conn.commit()
        status_akhir = tentukan_status(hasil["views"])

    except Exception as e:
        conn.rollback()
        print(f"    [GAGAL] {type(e).__name__}: {e}")
        try:
            with conn.cursor() as cur:
                catat_log(cur, dosen_id, "profile", False, 0)
            conn.commit()
        except Exception:
            conn.rollback()
    finally:
        set_status(conn, dosen_id, status_akhir, synced=(status_akhir == "SUCCESS"))

    return status_akhir


# ==========================================
# ENTRY POINT UNTUK FASTAPI
# ==========================================
def _connect():
    return psycopg.connect(config.DATABASE_URL, row_factory=dict_row, sslmode="require")


def pilih_dosen(sinta_id=None):
    """
    Pilih dosen yang lolos aturan 7 hari (satu sinta_id, atau semua bila None), lalu tandai
    IN_PROGRESS dalam satu transaksi. Hanya meng-UPDATE baris dosen yang sudah ada.
    Mengembalikan (diproses, dilewati, ditemukan). `ditemukan` False bila sinta_id tidak terdaftar.
    """
    sekarang = datetime.now(timezone.utc)
    with _connect() as conn:
        with conn.cursor() as cur:
            sql = """SELECT id, nama, sinta_id, sync_status, last_synced_at FROM dosen
                     WHERE sinta_id IS NOT NULL AND sinta_id <> ''"""
            args = ()
            if sinta_id:
                sql += " AND sinta_id = %s"
                args = (sinta_id,)
            cur.execute(sql + " ORDER BY id FOR UPDATE", args)
            semua = cur.fetchall()

            diproses = [d for d in semua if perlu_sinkron(d["sync_status"], d["last_synced_at"], sekarang)]
            dilewati = [d for d in semua if d not in diproses]
            if diproses:
                cur.execute(
                    "UPDATE dosen SET sync_status = 'IN_PROGRESS', updated_at = NOW() WHERE id = ANY(%s)",
                    ([d["id"] for d in diproses],),
                )
        conn.commit()
    return diproses, dilewati, bool(semua)


def sync_dosen(d):
    """Sinkronkan satu dosen hasil pilih_dosen dengan koneksi sendiri. Mengembalikan status akhir."""
    with _connect() as conn:
        print(f"{d['nama'] or 'Dosen #' + str(d['id'])} (SINTA ID {d['sinta_id']})")
        status = proses_dosen(conn, d)
        print(f"  => {status}")
        return status


def ringkasan_log(target, pemicu_nama, hasil, dilewati):
    """Teks kolom detail log_aktivitas untuk satu permintaan sinkron."""
    bagian = [
        f"Pemicu: {pemicu_nama or 'tidak diketahui'}",
        f"Target: {'sinta_id ' + target if target else 'semua dosen'}",
        "Hasil: " + (", ".join(f"{s} {st}" for s, st in hasil.items()) or "tidak ada yang diproses"),
    ]
    if dilewati:
        bagian.append("Dilewati (aturan 7 hari): " + ", ".join(dilewati))
    return ". ".join(bagian)


def catat_log_aktivitas(pemicu_id, pemicu_nama, detail):
    """Kegagalan menulis log hanya dicetak, supaya hasil sinkron tidak ikut batal (sama dengan catatLog)."""
    try:
        with _connect() as conn:
            conn.execute(
                """INSERT INTO log_aktivitas (user_id, user_nama, modul, aksi, objek, detail)
                   VALUES (%s, %s, '7', 'sinkron', 'dosen', %s)""",
                (pemicu_id, pemicu_nama, detail),
            )
    except Exception as e:
        print(f"[log] gagal mencatat log_aktivitas: {type(e).__name__}: {e}")


def jalankan_sinkron(diproses, dilewati, target=None, pemicu_id=None, pemicu_nama=None):
    """
    Dijalankan di thread background. Dosen yang belum selesai saat terjadi galat tak terduga
    ditandai FAILED, supaya tidak tertinggal IN_PROGRESS.
    """
    hasil = {}
    try:
        for i, d in enumerate(diproses):
            if i:
                time.sleep(random.uniform(config.DELAY_DOSEN_MIN, config.DELAY_DOSEN_MAX))
            try:
                hasil[d["sinta_id"]] = sync_dosen(d)
            except Exception as e:
                print(f"[sync] {d['sinta_id']} error: {type(e).__name__}: {e}")
                hasil[d["sinta_id"]] = "FAILED"
        with _connect() as conn:
            backfill_anggota(conn)
    except Exception as e:
        print(f"[sync] error: {type(e).__name__}: {e}")
    finally:
        sisa = [d["id"] for d in diproses if d["sinta_id"] not in hasil]
        for d in diproses:
            hasil.setdefault(d["sinta_id"], "FAILED")
        if sisa:
            try:
                with _connect() as conn:
                    conn.execute("UPDATE dosen SET sync_status = 'FAILED', updated_at = NOW() WHERE id = ANY(%s)", (sisa,))
            except Exception as e:
                print(f"[sync] gagal menandai FAILED: {type(e).__name__}: {e}")
        catat_log_aktivitas(pemicu_id, pemicu_nama,
                            ringkasan_log(target, pemicu_nama, hasil, [d["sinta_id"] for d in dilewati]))
    return hasil


def tandai_sisa_in_progress():
    """
    Dipanggil sekali saat layanan menyala: IN_PROGRESS yang lebih tua dari SISA_IN_PROGRESS_MENIT
    adalah sisa crawl yang mati di tengah jalan, jadi FAILED. Mengembalikan jumlah baris.
    """
    with psycopg.connect(config.DATABASE_URL, sslmode="require") as conn:
        return conn.execute(SQL_SISA_IN_PROGRESS, (config.SISA_IN_PROGRESS_MENIT,)).rowcount


SQL_SISA_IN_PROGRESS = """UPDATE dosen SET sync_status = 'FAILED', updated_at = NOW()
    WHERE sync_status = 'IN_PROGRESS' AND updated_at < NOW() - (%s * INTERVAL '1 minute')"""
