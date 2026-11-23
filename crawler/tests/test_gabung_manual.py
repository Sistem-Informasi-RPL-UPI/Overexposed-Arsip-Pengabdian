"""
Issue #13: aturan crawl terhadap data manual (PRD 5.3).
- Baris baru dari crawl: sumber = 'sinta'.
- Baris 'sinta' yang sudah ada: diperbarui seperti biasa.
- Baris 'manual' yang kuncinya sama: digabung. Kolom kosong diisi dari SINTA, kolom terisi tidak ditimpa,
  sumber tetap 'manual' sehingga isiannya terlindungi di setiap crawl (PRD 12 nomor 21), dan iprs.status
  mengikuti SINTA karena status tidak bisa diubah pengguna.
- Crawl tidak menghapus atau mengubah baris manual yang tidak ada di SINTA.
"""
import inspect
import os
import re
import sys
import unittest
import uuid

os.environ.setdefault("DATABASE_URL", "postgresql://tes")
os.environ.setdefault("INTERNAL_KEY", "tes")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "app"))

import loader  # noqa: E402


class FakeCursor:
    def __init__(self):
        self.calls = []

    def execute(self, sql, params=None):
        self.calls.append((sql, params))

    def fetchone(self):
        return {"id": 1}

    def fetchall(self):
        return []


def sql_insert(fungsi, tabel, *args):
    cur = FakeCursor()
    fungsi(cur, 5, *args)
    return next(sql for sql, _ in cur.calls if re.search(rf"INSERT INTO {tabel}\s*\n", sql))


class GabungTest(unittest.TestCase):
    def test_baris_manual_hanya_mengisi_yang_kosong(self):
        self.assertEqual(
            loader.gabung("buku", "penerbit"),
            "penerbit = CASE WHEN buku.sumber = 'manual' "
            "THEN COALESCE(NULLIF(buku.penerbit, ''), EXCLUDED.penerbit) "
            "ELSE COALESCE(EXCLUDED.penerbit, buku.penerbit) END",
        )

    def test_kolom_angka_tanpa_nullif(self):
        self.assertNotIn("NULLIF", loader.gabung("iprs", "tahun", teks=False))


class SqlLoaderTest(unittest.TestCase):
    """Bentuk SQL tiap tabel. Perilakunya diuji ke database sungguhan di IntegrasiGabungTest."""

    def setUp(self):
        self.sql = {
            "publikasi": sql_insert(loader.simpan_publikasi, "publikasi", "scopus", [{"judul": "P"}]),
            "kegiatan": sql_insert(loader.simpan_kegiatan, "kegiatan", "penelitian", [{"judul": "K"}]),
            "iprs": sql_insert(loader.simpan_iprs, "iprs", [{"judul": "I"}]),
            "buku": sql_insert(loader.simpan_buku, "buku", [{"judul": "B"}]),
        }

    def test_baris_baru_menjadi_sinta_dan_sumber_tidak_diubah_saat_konflik(self):
        for tabel, sql in self.sql.items():
            with self.subTest(tabel=tabel):
                self.assertIn("'sinta')", sql)
                # Kolom sumber tidak di-SET; "tabel.sumber = 'manual'" di dalam CASE hanya pembacaan.
                self.assertNotRegex(sql, r"(?<![.\w])sumber\s*=")

    def test_kegiatan_iprs_buku_membedakan_baris_manual(self):
        for tabel in ("kegiatan", "iprs", "buku"):
            with self.subTest(tabel=tabel):
                self.assertIn(f"{tabel}.sumber = 'manual'", self.sql[tabel])

    def test_status_iprs_selalu_ikut_sinta(self):
        self.assertRegex(self.sql["iprs"], r"status\s*=\s*COALESCE\(EXCLUDED\.status,\s*iprs\.status\)")

    def test_loader_tidak_pernah_menghapus(self):
        sumber_loader = inspect.getsource(loader)
        self.assertNotRegex(sumber_loader.upper(), r"\bDELETE\b|\bTRUNCATE\b")


URL_UJI = os.environ.get("CRAWLER_TEST_DATABASE_URL")


@unittest.skipUnless(URL_UJI, "set CRAWLER_TEST_DATABASE_URL untuk menjalankan tes ke database sungguhan")
class IntegrasiGabungTest(unittest.TestCase):
    """SQL loader dijalankan ke Postgres sungguhan di dalam transaksi yang selalu di-rollback."""

    def setUp(self):
        import psycopg
        from psycopg.rows import dict_row

        self.conn = psycopg.connect(URL_UJI, row_factory=dict_row)
        self.cur = self.conn.cursor()
        self.t = uuid.uuid4().hex[:10]
        self.cur.execute(
            "INSERT INTO dosen (user_id, sinta_id) VALUES (gen_random_uuid(), %s) RETURNING id",
            (f"uji-{self.t}",),
        )
        self.dosen_id = self.cur.fetchone()["id"]

    def tearDown(self):
        self.conn.rollback()
        self.conn.close()

    def ambil(self, sql, params):
        self.cur.execute(sql, params)
        return self.cur.fetchone()

    # Buku
    def test_buku_baris_baru_menjadi_sinta(self):
        loader.simpan_buku(self.cur, self.dosen_id, [{"judul": f"Buku baru {self.t}", "isbn": f"ISBN-B-{self.t}", "penerbit": "UPI Press"}])
        baris = self.ambil("SELECT sumber, penerbit FROM buku WHERE isbn = %s", (f"ISBN-B-{self.t}",))
        self.assertEqual(baris, {"sumber": "sinta", "penerbit": "UPI Press"})

    def test_buku_baris_sinta_diperbarui_seperti_biasa(self):
        data = {"judul": f"Buku sinta {self.t}", "isbn": f"ISBN-S-{self.t}", "penerbit": "Lama"}
        loader.simpan_buku(self.cur, self.dosen_id, [data])
        loader.simpan_buku(self.cur, self.dosen_id, [dict(data, penerbit="Baru")])
        baris = self.ambil("SELECT sumber, penerbit FROM buku WHERE isbn = %s", (data["isbn"],))
        self.assertEqual(baris, {"sumber": "sinta", "penerbit": "Baru"})

    def test_buku_manual_digabung(self):
        isbn = f"ISBN-M-{self.t}"
        self.cur.execute(
            """INSERT INTO buku (kunci, judul, penerbit, kategori, isbn, sumber)
               VALUES (%s, %s, %s, NULL, %s, 'manual')""",
            (loader.kunci(isbn), f"Buku manual {self.t}", "Penerbit Manual", isbn),
        )
        loader.simpan_buku(self.cur, self.dosen_id, [{
            "judul": f"Buku manual {self.t}", "isbn": isbn,
            "penerbit": "Penerbit SINTA", "kategori": "Buku Ajar", "tempat_terbit": "Bandung",
        }])
        baris = self.ambil("SELECT sumber, penerbit, kategori, tempat_terbit FROM buku WHERE isbn = %s", (isbn,))
        self.assertEqual(baris, {
            "sumber": "manual",
            "penerbit": "Penerbit Manual",   # terisi: tidak ditimpa
            "kategori": "Buku Ajar",          # kosong: diisi dari SINTA
            "tempat_terbit": "Bandung",
        })
        self.assertEqual(self.ambil("SELECT count(*)::int AS n FROM buku WHERE isbn = %s", (isbn,))["n"], 1)

    def test_buku_manual_teks_kosong_dianggap_kosong(self):
        isbn = f"ISBN-E-{self.t}"
        self.cur.execute(
            "INSERT INTO buku (kunci, judul, penerbit, isbn, sumber) VALUES (%s, %s, '', %s, 'manual')",
            (loader.kunci(isbn), f"Buku kosong {self.t}", isbn),
        )
        loader.simpan_buku(self.cur, self.dosen_id, [{"judul": f"Buku kosong {self.t}", "isbn": isbn, "penerbit": "Penerbit SINTA"}])
        self.assertEqual(self.ambil("SELECT penerbit FROM buku WHERE isbn = %s", (isbn,))["penerbit"], "Penerbit SINTA")

    def test_baris_manual_tetap_terlindungi_di_crawl_berikutnya(self):
        isbn = f"ISBN-G-{self.t}"
        self.cur.execute(
            "INSERT INTO buku (kunci, judul, penerbit, isbn, sumber) VALUES (%s, %s, 'Manual', %s, 'manual')",
            (loader.kunci(isbn), f"Buku gabung {self.t}", isbn),
        )
        data = {"judul": f"Buku gabung {self.t}", "isbn": isbn, "penerbit": "SINTA 1"}
        loader.simpan_buku(self.cur, self.dosen_id, [data])
        loader.simpan_buku(self.cur, self.dosen_id, [dict(data, penerbit="SINTA 2")])
        baris = self.ambil("SELECT sumber, penerbit FROM buku WHERE isbn = %s", (isbn,))
        self.assertEqual(baris, {"sumber": "manual", "penerbit": "Manual"})

    # IPRS
    def test_iprs_manual_digabung_status_ikut_sinta(self):
        nomor = f"UJI-{self.t}"
        self.cur.execute(
            """INSERT INTO iprs (kunci, judul, jenis, nomor_permohonan, status, pemegang, inventor, sumber)
               VALUES (%s, %s, 'Paten', %s, 'Diterima', 'UPI', NULL, 'manual')""",
            (loader.kunci(nomor), f"IPRS manual {self.t}", nomor),
        )
        loader.simpan_iprs(self.cur, self.dosen_id, [{
            "judul": f"IPRS manual {self.t}", "nomor_permohonan": nomor, "jenis": "Hak Cipta",
            "status": "Granted", "pemegang": "Pemegang SINTA", "inventor": "A, B", "tahun": 2023,
        }])
        baris = self.ambil("SELECT sumber, jenis, status, pemegang, inventor, tahun FROM iprs WHERE nomor_permohonan = %s", (nomor,))
        self.assertEqual(baris, {
            "sumber": "manual",
            "jenis": "Paten",          # terisi: tidak ditimpa
            "status": "Granted",       # status selalu mengikuti SINTA
            "pemegang": "UPI",         # terisi: tidak ditimpa
            "inventor": "A, B",        # kosong: diisi
            "tahun": 2023,             # kosong: diisi
        })

    def test_iprs_sinta_diperbarui_seperti_biasa(self):
        data = {"judul": f"IPRS sinta {self.t}", "nomor_permohonan": f"UJS-{self.t}", "jenis": "Paten", "pemegang": "Lama"}
        loader.simpan_iprs(self.cur, self.dosen_id, [data])
        loader.simpan_iprs(self.cur, self.dosen_id, [dict(data, pemegang="Baru")])
        baris = self.ambil("SELECT sumber, pemegang FROM iprs WHERE nomor_permohonan = %s", (data["nomor_permohonan"],))
        self.assertEqual(baris, {"sumber": "sinta", "pemegang": "Baru"})

    # Kegiatan
    def test_kegiatan_manual_digabung(self):
        judul = f"Kegiatan manual {self.t}"
        self.cur.execute(
            """INSERT INTO kegiatan (kunci, jenis, judul, tahun, skema, dana_nominal, sumber_dana, sumber)
               VALUES (%s, 'penelitian', %s, 2024, 'Skema Manual', 0, NULL, 'manual')""",
            (loader.kunci("penelitian", judul, 2024), judul),
        )
        loader.simpan_kegiatan(self.cur, self.dosen_id, "penelitian", [{
            "judul": judul, "tahun": 2024, "skema": "Skema SINTA", "dana_nominal": 5000000, "sumber_dana": "Source : UPI",
        }])
        baris = self.ambil("SELECT sumber, skema, dana_nominal, sumber_dana FROM kegiatan WHERE judul = %s", (judul,))
        self.assertEqual(baris["sumber"], "manual")
        self.assertEqual(baris["skema"], "Skema Manual")           # terisi: tidak ditimpa
        self.assertEqual(int(baris["dana_nominal"]), 5000000)      # 0 dianggap kosong: diisi
        self.assertEqual(baris["sumber_dana"], "Source : UPI")      # kosong: diisi

    def test_kegiatan_manual_dana_terisi_tidak_ditimpa(self):
        judul = f"Kegiatan dana {self.t}"
        self.cur.execute(
            """INSERT INTO kegiatan (kunci, jenis, judul, tahun, dana_nominal, sumber)
               VALUES (%s, 'pengabdian', %s, 2024, 1000000, 'manual')""",
            (loader.kunci("pengabdian", judul, 2024), judul),
        )
        loader.simpan_kegiatan(self.cur, self.dosen_id, "pengabdian", [{"judul": judul, "tahun": 2024, "dana_nominal": 9000000}])
        baris = self.ambil("SELECT dana_nominal FROM kegiatan WHERE judul = %s", (judul,))
        self.assertEqual(int(baris["dana_nominal"]), 1000000)

    def test_kegiatan_sinta_diperbarui_seperti_biasa(self):
        data = {"judul": f"Kegiatan sinta {self.t}", "tahun": 2024, "skema": "Lama"}
        loader.simpan_kegiatan(self.cur, self.dosen_id, "penelitian", [data])
        loader.simpan_kegiatan(self.cur, self.dosen_id, "penelitian", [dict(data, skema="Baru")])
        baris = self.ambil("SELECT sumber, skema FROM kegiatan WHERE judul = %s", (data["judul"],))
        self.assertEqual(baris, {"sumber": "sinta", "skema": "Baru"})

    # Publikasi
    def test_publikasi_manual_digabung(self):
        judul = f"Paper manual {self.t}"
        self.cur.execute(
            """INSERT INTO publikasi (judul_hash, judul, tahun, jurnal, sitasi, doi, sumber)
               VALUES (%s, %s, 2024, 'Jurnal Manual', 3, NULL, 'manual')""",
            (loader.kunci(judul), judul),
        )
        loader.simpan_publikasi(self.cur, self.dosen_id, "scopus", [{
            "judul": judul, "tahun": 2024, "jurnal": "Jurnal SINTA", "sitasi": 10, "doi": "10.1/uji",
        }])
        baris = self.ambil("SELECT sumber, jurnal, sitasi, doi FROM publikasi WHERE judul = %s", (judul,))
        self.assertEqual(baris, {
            "sumber": "manual",
            "jurnal": "Jurnal Manual",   # terisi: tidak ditimpa
            "sitasi": 10,                # sitasi memakai nilai tertinggi
            "doi": "10.1/uji",           # kosong: diisi
        })

    # Baris manual yang tidak ada di SINTA
    def test_crawl_tidak_mengubah_atau_menghapus_baris_manual_lain(self):
        manual = {
            "buku": ("INSERT INTO buku (kunci, judul, penerbit, sumber) VALUES (%s, %s, 'Tetap', 'manual')", loader.kunci(f"buku-sendiri-{self.t}")),
            "iprs": ("INSERT INTO iprs (kunci, judul, status, sumber) VALUES (%s, %s, 'Diterima', 'manual')", loader.kunci(f"iprs-sendiri-{self.t}")),
            "kegiatan": ("INSERT INTO kegiatan (kunci, jenis, judul, skema, sumber) VALUES (%s, 'penelitian', %s, 'Tetap', 'manual')", loader.kunci(f"keg-sendiri-{self.t}")),
            "publikasi": ("INSERT INTO publikasi (judul_hash, judul, jurnal, sumber) VALUES (%s, %s, 'Tetap', 'manual')", loader.kunci(f"pub-sendiri-{self.t}")),
        }
        kolom_kunci = {"buku": "kunci", "iprs": "kunci", "kegiatan": "kunci", "publikasi": "judul_hash"}
        sebelum = {}
        for tabel, (sql, k) in manual.items():
            self.cur.execute(sql, (k, f"Manual sendiri {tabel} {self.t}"))
            sebelum[tabel] = self.ambil(f"SELECT * FROM {tabel} WHERE {kolom_kunci[tabel]} = %s", (k,))

        loader.simpan_buku(self.cur, self.dosen_id, [{"judul": f"Lain buku {self.t}", "isbn": f"L-{self.t}"}])
        loader.simpan_iprs(self.cur, self.dosen_id, [{"judul": f"Lain iprs {self.t}", "nomor_permohonan": f"L-{self.t}", "status": "Granted"}])
        loader.simpan_kegiatan(self.cur, self.dosen_id, "penelitian", [{"judul": f"Lain keg {self.t}", "tahun": 2024}])
        loader.simpan_publikasi(self.cur, self.dosen_id, "garuda", [{"judul": f"Lain pub {self.t}"}])

        for tabel, (_, k) in manual.items():
            with self.subTest(tabel=tabel):
                sesudah = self.ambil(f"SELECT * FROM {tabel} WHERE {kolom_kunci[tabel]} = %s", (k,))
                self.assertEqual(sesudah, sebelum[tabel])
                self.assertEqual(sesudah["sumber"], "manual")


if __name__ == "__main__":
    unittest.main()
