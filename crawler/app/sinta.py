import csv
import json
import random
import re
import sys
import time
import requests
from bs4 import BeautifulSoup

# Pastikan output konsol aman di Windows (hindari UnicodeEncodeError)
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# ==========================================
# KONFIGURASI GLOBAL
# ==========================================
BASE_URL = "https://sinta.kemdiktisaintek.go.id/authors/profile/{}/"

# 8 Kategori yang diambil:
# 1. Articles (4 sub-kategori: scopus, garuda, googlescholar, rama)
# 2. Researches (Penelitian)
# 3. Community Services (Pengabdian)
# 4. IPRs (HKI)
# 5. Books (Buku)
VIEWS_CONFIG = [
    # (kategori_induk, view_param, file_suffix)
    ("articles", "scopus", "scopus"),
    ("articles", "garuda", "garuda"),
    ("articles", "googlescholar", "googlescholar"),
    ("articles", "rama", "rama"),
    ("researches", "researches", "researches"),
    ("community_services", "services", "services"),
    ("iprs", "iprs", "iprs"),
    ("books", "books", "books"),
]

DELAY_CATEGORY = 1.5  # Jeda antar kategori per dosen (detik)
DELAY_DOSEN_RANGE = (2.5, 5.0)  # Rentang jeda acak antar dosen (detik)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0 Safari/537.36"
    ),
    "Accept-Language": "id,en;q=0.9",
}

session = requests.Session()
session.headers.update(HEADERS)


# ==========================================
# UTILITAS
# ==========================================
def clean(text):
    return re.sub(r"\s+", " ", text or "").strip()


def to_int(val):
    digits = re.sub(r"[^\d]", "", val or "")
    return int(digits) if digits else 0


def fetch(base, view=None, retries=3):
    params = {}
    if view:
        params["view"] = view
    for attempt in range(retries):
        try:
            r = session.get(base, params=params, timeout=20)
            if r.status_code == 200:
                return r.text
            print(f"    [{view or 'profile'}] status {r.status_code}, percobaan ke-{attempt + 1}")
        except requests.RequestException as e:
            print(f"    [{view or 'profile'}] error koneksi: {e}, percobaan ke-{attempt + 1}")
        time.sleep(2 * (attempt + 1))
    return None


# ==========================================
# PARSER PROFIL (SKOR & METRIK SINTA)
# ==========================================
def parse_profile_overview(soup):
    """Ekstrak nama, afiliasi, departemen, skor SINTA, dan tabel metrik."""
    nama_tag = soup.find("h3")
    nama = clean(nama_tag.get_text(strip=True)) if nama_tag else ""

    # Afiliasi & Departemen
    afiliasi, departemen = "", ""
    meta_profile = soup.select_one(".meta-profile")
    if meta_profile:
        links = meta_profile.find_all("a")
        if len(links) >= 1:
            afiliasi = clean(links[0].get_text(strip=True))
        if len(links) >= 2:
            departemen = clean(links[1].get_text(strip=True))

    # Skor SINTA
    skor = {}
    for label in ["SINTA Score Overall", "SINTA Score 3Yr", "Affil Score 3Yr", "Affil Score"]:
        label_tag = soup.find(string=lambda t, l=label: t and t.strip() == l)
        nilai = 0.0
        if label_tag:
            parent = label_tag.find_parent()
            prev = parent.find_previous_sibling()
            if prev and prev.get_text(strip=True).replace(".", "").isdigit():
                val_txt = prev.get_text(strip=True)
                nilai = float(val_txt.replace(".", "")) if "." not in val_txt else float(val_txt)
            else:
                container = parent.find_parent()
                sisa = container.get_text(" ", strip=True).replace(label, "").strip()
                m = re.search(r"[\d\.]+", sisa)
                nilai = float(m.group()) if m else 0.0
        skor[label] = nilai

    # Metrik (Scopus, Google Scholar, WOS)
    metrik = {}
    tables = soup.find_all("table")
    target = ["Article", "Citation", "Cited Document", "H-Index", "i10-Index", "G-Index"]
    if tables:
        for tr in tables[0].find_all("tr"):
            kolom = [clean(k.get_text(strip=True)) for k in tr.find_all(["th", "td"])]
            if len(kolom) >= 4 and kolom[0] in target:
                metrik[kolom[0]] = {
                    "scopus": to_int(kolom[1]),
                    "google_scholar": to_int(kolom[2]),
                    "wos": to_int(kolom[3]),
                }

    return {
        "nama": nama,
        "afiliasi": afiliasi,
        "departemen": departemen,
        "skor": skor,
        "metrik": metrik,
    }


# ==========================================
# PARSER KLASIFIKASI PER KATEGORI
# ==========================================
def parse_scopus(it):
    """Parser artikel Scopus."""
    title_el = it.select_one(".ar-title")
    title_a = title_el.find("a") if title_el else None
    judul = clean(title_el.get_text(" ", strip=True)) if title_el else ""
    link = title_a["href"] if title_a and title_a.get("href") else ""

    q_el = it.select_one("a.ar-quartile")
    q_raw = clean(q_el.get_text(" ", strip=True)) if q_el else ""
    m_q = re.match(r"(Q[1-4]|no-Q)\s*(?:as\s+(.*))?", q_raw, re.I)
    kuartil = m_q.group(1) if m_q else ""
    jenis = clean(m_q.group(2)) if m_q and m_q.group(2) else ""

    pub_el = it.select_one("a.ar-pub")
    jurnal = clean(pub_el.get_text(" ", strip=True)) if pub_el else ""
    link_jurnal = pub_el["href"] if pub_el and pub_el.get("href") else ""

    urutan, total_penulis, creator = None, None, ""
    for a in it.select(".ar-meta a"):
        t = clean(a.get_text(" ", strip=True))
        m_o = re.match(r"Author Order\s*:\s*(\d+)\s*of\s*(\d+)", t, re.I)
        if m_o:
            urutan, total_penulis = int(m_o.group(1)), int(m_o.group(2))
        elif t.lower().startswith("creator"):
            creator = clean(t.split(":", 1)[1]) if ":" in t else ""

    year_el = it.select_one("a.ar-year")
    cited_el = it.select_one("a.ar-cited")
    m_y = re.search(r"\d{4}", year_el.get_text(" ", strip=True)) if year_el else None
    m_c = re.search(r"\d+", cited_el.get_text(" ", strip=True)) if cited_el else None

    return {
        "judul": judul,
        "link": link,
        "kuartil": kuartil,
        "jenis": jenis,
        "jurnal": jurnal,
        "link_jurnal": link_jurnal,
        "urutan_penulis": urutan,
        "total_penulis": total_penulis,
        "creator": creator,
        "tahun": int(m_y.group()) if m_y else None,
        "sitasi": int(m_c.group()) if m_c else 0,
        "raw": clean(it.get_text(" ", strip=True)),
    }


def parse_garuda(it):
    """Parser artikel Garuda."""
    title_el = it.select_one(".ar-title")
    title_a = title_el.find("a") if title_el else None
    judul = clean(title_el.get_text(" ", strip=True)) if title_el else ""
    link = title_a["href"] if title_a and title_a.get("href") else ""

    pub_el = it.select_one("a.ar-pub")
    jurnal = clean(pub_el.get_text(" ", strip=True)) if pub_el else ""
    link_jurnal = pub_el["href"] if pub_el and pub_el.get("href") else ""

    penerbit = ""
    meta_tags = it.select(".ar-meta")
    if meta_tags:
        for a in meta_tags[0].find_all("a"):
            if a != pub_el:
                penerbit = clean(a.get_text(" ", strip=True))
                break

    urutan, total_penulis, penulis = None, None, ""
    doi = ""
    akreditasi = ""

    for a in it.select(".ar-meta a"):
        t = clean(a.get_text(" ", strip=True))
        m_o = re.match(r"Author Order\s*:\s*(\d+)\s*of\s*(\d+)", t, re.I)
        if m_o:
            urutan, total_penulis = int(m_o.group(1)), int(m_o.group(2))
        elif "doi:" in t.lower():
            m_doi = re.search(r"10\.\d{4,9}/[-._;()/:A-Za-z0-9]+", t)
            doi = m_doi.group(0) if m_doi else clean(t.replace("DOI:", ""))
        elif "accred" in t.lower() or "sinta" in t.lower():
            akreditasi = clean(t.replace("Accred :", ""))
        elif ";" in t and not penulis:
            penulis = t

    year_el = it.select_one("a.ar-year")
    m_y = re.search(r"\d{4}", year_el.get_text(" ", strip=True)) if year_el else None

    return {
        "judul": judul,
        "link": link,
        "penerbit": penerbit,
        "jurnal": jurnal,
        "link_jurnal": link_jurnal,
        "urutan_penulis": urutan,
        "total_penulis": total_penulis,
        "penulis": penulis,
        "tahun": int(m_y.group()) if m_y else None,
        "doi": doi,
        "akreditasi": akreditasi,
        "raw": clean(it.get_text(" ", strip=True)),
    }


def parse_googlescholar(it):
    """Parser artikel Google Scholar."""
    title_el = it.select_one(".ar-title")
    title_a = title_el.find("a") if title_el else None
    judul = clean(title_el.get_text(" ", strip=True)) if title_el else ""
    link = title_a["href"] if title_a and title_a.get("href") else ""

    pub_el = it.select_one("a.ar-pub")
    jurnal = clean(pub_el.get_text(" ", strip=True)) if pub_el else ""

    penulis = ""
    for a in it.select(".ar-meta a"):
        t = clean(a.get_text(" ", strip=True))
        if t.lower().startswith("authors :"):
            penulis = clean(t.split(":", 1)[1])
            break

    year_el = it.select_one("a.ar-year")
    cited_el = it.select_one("a.ar-cited")
    m_y = re.search(r"\d{4}", year_el.get_text(" ", strip=True)) if year_el else None
    m_c = re.search(r"\d+", cited_el.get_text(" ", strip=True)) if cited_el else None

    return {
        "judul": judul,
        "link": link,
        "penulis": penulis,
        "jurnal": jurnal,
        "tahun": int(m_y.group()) if m_y else None,
        "sitasi": int(m_c.group()) if m_c else 0,
        "raw": clean(it.get_text(" ", strip=True)),
    }


def parse_rama(it):
    """Parser repositori RAMA."""
    title_el = it.select_one(".ar-title")
    title_a = title_el.find("a") if title_el else None
    judul = clean(title_el.get_text(" ", strip=True)) if title_el else ""
    link = title_a["href"] if title_a and title_a.get("href") else ""

    pub_el = it.select_one("a.ar-pub")
    instansi = clean(pub_el.get_text(" ", strip=True)) if pub_el else ""

    penulis = ""
    for a in it.select(".ar-meta a"):
        t = clean(a.get_text(" ", strip=True))
        if "author" in t.lower() or "creator" in t.lower():
            penulis = clean(t.split(":", 1)[-1])

    year_el = it.select_one("a.ar-year")
    m_y = re.search(r"\d{4}", year_el.get_text(" ", strip=True)) if year_el else None

    return {
        "judul": judul,
        "link": link,
        "instansi": instansi,
        "penulis": penulis,
        "tahun": int(m_y.group()) if m_y else None,
        "raw": clean(it.get_text(" ", strip=True)),
    }


def parse_researches_services(it):
    """Parser untuk Penelitian (Researches) dan Pengabdian (Community Services)."""
    title_el = it.select_one(".ar-title")
    judul = clean(title_el.get_text(" ", strip=True)) if title_el else ""

    ketua = ""
    anggota = []
    skema = ""
    dana = ""
    dana_nominal = 0
    status = ""
    sumber_dana = ""

    pub_el = it.select_one("a.ar-pub")
    if pub_el:
        skema = clean(pub_el.get_text(" ", strip=True))

    for a in it.select(".ar-meta a"):
        t = clean(a.get_text(" ", strip=True))
        if t.lower().startswith("leader :"):
            ketua = clean(t.split(":", 1)[1])
        elif "rp." in t.lower():
            dana = t
            digits = re.sub(r"[^\d]", "", t)
            dana_nominal = int(digits) if digits else 0
        elif t in ["Approved", "Rejected", "Draft"]:
            status = t
        elif "source" in t.lower():
            sumber_dana = t

    # Ekstrak Personils / Anggota
    for m in it.select(".ar-meta"):
        m_text = clean(m.get_text(" ", strip=True))
        if "personils :" in m_text.lower():
            part = m_text.split(":", 1)[1]
            anggota = [clean(p) for p in part.split(";") if clean(p) and clean(p) != "-"]

    year_el = it.select_one("a.ar-year")
    m_y = re.search(r"\d{4}", year_el.get_text(" ", strip=True)) if year_el else None

    return {
        "judul": judul,
        "skema": skema,
        "ketua": ketua,
        "anggota": anggota,
        "tahun": int(m_y.group()) if m_y else None,
        "dana": dana,
        "dana_nominal": dana_nominal,
        "status": status,
        "sumber_dana": sumber_dana,
        "raw": clean(it.get_text(" ", strip=True)),
    }


def parse_iprs(it):
    """Parser Kekayaan Intelektual (IPRs / HKI)."""
    title_el = it.select_one(".ar-title")
    judul = clean(title_el.get_text(" ", strip=True)) if title_el else ""

    inventor = ""
    pemegang = ""
    nomor_permohonan = ""
    status = ""
    jenis = ""

    pub_el = it.select_one("a.ar-pub")
    if pub_el:
        pemegang = clean(pub_el.get_text(" ", strip=True))

    for a in it.select(".ar-meta a"):
        t = clean(a.get_text(" ", strip=True))
        if t.lower().startswith("inventor :"):
            inventor = clean(t.split(":", 1)[1])
        elif t.lower().startswith("nomor permohonan :"):
            nomor_permohonan = clean(t.split(":", 1)[1])
        elif t.lower().startswith("status :"):
            status = clean(t.split(":", 1)[1])
        elif "ar-quartile" in a.get("class", []):
            jenis = t

    year_el = it.select_one("a.ar-year")
    m_y = re.search(r"\d{4}", year_el.get_text(" ", strip=True)) if year_el else None

    return {
        "judul": judul,
        "inventor": inventor,
        "pemegang": pemegang,
        "tahun": int(m_y.group()) if m_y else None,
        "nomor_permohonan": nomor_permohonan,
        "status": status,
        "jenis": jenis,
        "raw": clean(it.get_text(" ", strip=True)),
    }


def parse_books(it):
    """Parser Buku (Books)."""
    title_el = it.select_one(".ar-title")
    judul = clean(title_el.get_text(" ", strip=True)) if title_el else ""

    kategori = ""
    penulis = ""
    penerbit = ""
    tempat_terbit = ""
    isbn = ""

    pub_el = it.select_one("a.ar-pub")
    if pub_el:
        penerbit = clean(pub_el.get_text(" ", strip=True))

    for m in it.select(".ar-meta"):
        for a in m.find_all("a"):
            t = clean(a.get_text(" ", strip=True))
            if t.lower().startswith("category :"):
                kategori = clean(t.split(":", 1)[1])
            elif t.lower().startswith("isbn :"):
                isbn = clean(t.split(":", 1)[1])
            elif "ar-cited" in a.get("class", []):
                tempat_terbit = t
            elif (
                a != pub_el
                and not t.lower().startswith("category")
                and not t.lower().startswith("isbn")
                and "ar-" not in " ".join(a.get("class", []))
            ):
                if not penulis:
                    penulis = t

    year_el = it.select_one("a.ar-year")
    m_y = re.search(r"\d{4}", year_el.get_text(" ", strip=True)) if year_el else None

    return {
        "judul": judul,
        "kategori": kategori,
        "penulis": penulis,
        "penerbit": penerbit,
        "tahun": int(m_y.group()) if m_y else None,
        "tempat_terbit": tempat_terbit,
        "isbn": isbn,
        "raw": clean(it.get_text(" ", strip=True)),
    }


PARSERS = {
    "scopus": parse_scopus,
    "garuda": parse_garuda,
    "googlescholar": parse_googlescholar,
    "rama": parse_rama,
    "researches": parse_researches_services,
    "services": parse_researches_services,
    "iprs": parse_iprs,
    "books": parse_books,
}


# ==========================================
# FILE SAVER
# ==========================================
def save_file(sinta_id, suffix, rows):
    nama = f"sinta_{sinta_id}_{suffix}"
    with open(f"{nama}.json", "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)

    if rows:
        with open(f"{nama}.csv", "w", encoding="utf-8", newline="") as f:
            csv_rows = []
            for r in rows:
                row_copy = {}
                for k, v in r.items():
                    if isinstance(v, list):
                        row_copy[k] = "; ".join(str(x) for x in v)
                    else:
                        row_copy[k] = v
                csv_rows.append(row_copy)
            w = csv.DictWriter(f, fieldnames=csv_rows[0].keys())
            w.writeheader()
            w.writerows(csv_rows)


def save_profile_file(sinta_id, profile_data):
    """Simpan ringkasan profil (skor dan metrik) ke JSON & CSV."""
    nama = f"sinta_{sinta_id}_profile"
    with open(f"{nama}.json", "w", encoding="utf-8") as f:
        json.dump(profile_data, f, ensure_ascii=False, indent=2)

    csv_rows = []
    for indikator, vals in profile_data.get("metrik", {}).items():
        csv_rows.append({
            "Indikator": indikator,
            "Scopus": vals.get("scopus", 0),
            "Google Scholar": vals.get("google_scholar", 0),
            "WOS": vals.get("wos", 0),
        })
    if csv_rows:
        with open(f"{nama}_metrik.csv", "w", encoding="utf-8", newline="") as f:
            w = csv.DictWriter(f, fieldnames=["Indikator", "Scopus", "Google Scholar", "WOS"])
            w.writeheader()
            w.writerows(csv_rows)


# ==========================================
# FUNGSI MODULAR CRAWLING PER DOSEN
# ==========================================
def crawl_single_dosen(sinta_id, save_files=True, delay_category=DELAY_CATEGORY):
    """
    Mengambil data lengkap untuk 1 orang dosen berdasarkan sinta_id.
    
    Data yang diambil:
    - Informasi dasar (Nama, Afiliasi, Departemen)
    - Skor SINTA (Overall, 3Yr, Affil)
    - Metrik SINTA (Scopus, Google Scholar, WOS)
    - 8 Kategori data terstruktur (Scopus, Garuda, Google Scholar, RAMA, 
      Researches, Services, IPRs, Books)
      
    Returns:
        dict: Hasil crawling lengkap dan terstruktur.
    Raises:
        ConnectionError: Jika server SINTA tidak dapat dihubungi.
        ValueError: Jika ID tidak ditemukan (404).
        PermissionError: Jika halaman dialihkan ke halaman login.
    """
    sinta_id = str(sinta_id).strip()
    if not sinta_id:
        raise ValueError("SINTA ID tidak boleh kosong.")

    base = BASE_URL.format(sinta_id)

    # 1. Verifikasi halaman profil utama
    html_main = fetch(base, None)
    if html_main is None:
        raise ConnectionError(f"Gagal menghubungi SINTA untuk ID {sinta_id} (Timeout/Network Error).")

    if 'type="password"' in html_main.lower():
        raise PermissionError(f"Halaman SINTA {sinta_id} memerlukan autentikasi login.")

    soup_main = BeautifulSoup(html_main, "html.parser")
    nama_tag = soup_main.find("h3")
    nama_dosen = clean(nama_tag.get_text(strip=True)) if nama_tag else ""
    if not nama_dosen:
        raise ValueError(f"SINTA ID {sinta_id} tidak ditemukan di sistem SINTA (Profil kosong/404).")

    # 2. Ekstrak Skor dan Metrik Profil
    profile_info = parse_profile_overview(soup_main)

    data = {
        "success": True,
        "sinta_id": sinta_id,
        "nama": profile_info["nama"],
        "afiliasi": profile_info["afiliasi"],
        "departemen": profile_info["departemen"],
        "skor": profile_info["skor"],
        "metrik": profile_info["metrik"],
        "articles": {
            "scopus": [],
            "garuda": [],
            "googlescholar": [],
            "rama": [],
        },
        "researches": [],
        "community_services": [],
        "iprs": [],
        "books": [],
        "crawled_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "error": None,
    }

    if save_files:
        save_profile_file(sinta_id, profile_info)

    # 3. Ekstrak 8 Kategori Publikasi / Penelitian
    for kategori_induk, view, suffix in VIEWS_CONFIG:
        parser = PARSERS[view]
        html = fetch(base, view)

        if html:
            soup = BeautifulSoup(html, "html.parser")
            items = soup.select("div.ar-list-item")
            rows = [parser(it) for it in items]
        else:
            rows = []

        if save_files:
            save_file(sinta_id, suffix, rows)

        if kategori_induk == "articles":
            data["articles"][view] = rows
        else:
            data[kategori_induk] = rows

        time.sleep(delay_category)

    # 4. Simpan file gabungan lengkap
    if save_files:
        file_lengkap = f"sinta_{sinta_id}_lengkap.json"
        with open(file_lengkap, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    return data


# ==========================================
# FUNGSI BATCH CRAWLING BANYAK DOSEN
# ==========================================
def crawl_multiple_dosen(dosen_list, save_files=True, delay_range=DELAY_DOSEN_RANGE):
    """
    Crawling batch untuk banyak dosen dengan penanganan error terisolasi per dosen.
    
    Argumen:
        dosen_list: Bisa berupa:
            1. List ID string/int: ["6682222", "5980682", ...]
            2. List Dict (dari query DB): [{"id": 1, "nama": "Raditya", "sinta_id": "6682222"}, ...]
        save_files: Simpan hasil ke file lokal (JSON/CSV).
        delay_range: Tuple (min, max) detik jeda acak antar dosen.
        
    Returns:
        dict: Ringkasan hasil batch berisi total, sukses, gagal, dan detail hasil.
    """
    total = len(dosen_list)
    results = []
    success_list = []
    failed_list = []

    print("\n" + "=" * 65)
    print(f"MEMULAI BATCH CRAWLING SINTA ({total} DOSEN)")
    print("=" * 65)

    for index, item in enumerate(dosen_list, start=1):
        # Normalisasi input agar fleksibel (bisa string ID atau dict dari database)
        if isinstance(item, dict):
            sinta_id = str(item.get("sinta_id") or item.get("id") or "").strip()
            label_nama = item.get("nama", f"Dosen #{index}")
        else:
            sinta_id = str(item).strip()
            label_nama = f"Dosen #{index}"

        print(f"\n[{index}/{total}] Memproses: {label_nama} (SINTA ID: {sinta_id})")

        if not sinta_id:
            msg = "SINTA ID kosong atau tidak valid."
            print(f"  [GAGAL] {msg}")
            failed_entry = {"sinta_id": sinta_id, "label": label_nama, "error": msg}
            failed_list.append(failed_entry)
            results.append({"sinta_id": sinta_id, "success": False, "error": msg})
            continue

        # =======================================================
        # ISOLASI TRY-EXCEPT PER DOSEN
        # Jika satu dosen error, proses tetap lanjut ke berikutnya!
        # =======================================================
        try:
            data_dosen = crawl_single_dosen(sinta_id, save_files=save_files)

            print(f"  [OK] SUKSES: {data_dosen['nama']}")
            print(f"       Afiliasi : {data_dosen['afiliasi']}")
            print(f"       Skor     : Overall={data_dosen['skor'].get('SINTA Score Overall', 0)} | 3Yr={data_dosen['skor'].get('SINTA Score 3Yr', 0)}")
            
            success_list.append({"sinta_id": sinta_id, "nama": data_dosen["nama"]})
            results.append(data_dosen)

        except Exception as e:
            error_msg = str(e)
            print(f"  [GAGAL] memproses {label_nama} ({sinta_id}): {error_msg}")
            
            failed_entry = {
                "success": False,
                "sinta_id": sinta_id,
                "label": label_nama,
                "error": error_msg,
            }
            failed_list.append(failed_entry)
            results.append(failed_entry)

        # Jeda acak antar dosen agar pola request alami dan aman dari blokir
        if index < total:
            jeda = random.uniform(*delay_range)
            print(f"  [WAIT] Istirahat {jeda:.1f} detik sebelum dosen berikutnya...")
            time.sleep(jeda)

    # Ringkasan Akhir
    print("\n" + "=" * 65)
    print("RINGKASAN BATCH CRAWLING SINTA:")
    print(f"  Total Dosen : {total}")
    print(f"  Sukses      : {len(success_list)}")
    print(f"  Gagal       : {len(failed_list)}")
    if failed_list:
        print("\n  Daftar Gagal:")
        for f in failed_list:
            print(f"    - {f['sinta_id']} ({f.get('label', '')}): {f['error']}")
    print("=" * 65 + "\n")

    return {
        "total": total,
        "success_count": len(success_list),
        "failed_count": len(failed_list),
        "success_list": success_list,
        "failed_list": failed_list,
        "results": results,
    }


# ==========================================
# MAIN EXECUTION
# ==========================================
if __name__ == "__main__":
    # Contoh simulasi daftar dosen (bisa string ID atau dictionary dari database)
    # Kita masukkan 1 ID valid dan 1 ID invalid (untuk membuktikan isolasi try-except bekerja)
    DAFTAR_DOSEN_CONTOH = [
        {"id": 1, "nama": "Raditya Muhammad", "sinta_id": "6682222"},
        {"id": 2, "nama": "Dosen Uji Coba Error", "sinta_id": "999999999"},  # ID tidak ada
    ]

    # Jalankan crawling batch
    hasil_batch = crawl_multiple_dosen(DAFTAR_DOSEN_CONTOH, save_files=True)
