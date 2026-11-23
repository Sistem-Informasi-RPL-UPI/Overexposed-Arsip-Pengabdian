import inspect
import os
import re
import sys
import unittest
import uuid

# config.py membaca environment saat diimpor, nilainya tidak dipakai di tes unit.
os.environ.setdefault("DATABASE_URL", "postgresql://tes")
os.environ.setdefault("INTERNAL_KEY", "tes")
APP_DIR = os.path.join(os.path.dirname(__file__), "..", "app")
sys.path.insert(0, APP_DIR)

from bs4 import BeautifulSoup  # noqa: E402

import loader  # noqa: E402
import sinta  # noqa: E402

HTML_KEGIATAN = """
<div class="ar-list-item">
  <div class="ar-title"><a>Pengembangan Sistem Informasi Arsip</a></div>
  <div class="ar-meta">
    <a class="ar-pub">Penelitian Dasar</a>
    <a>Leader : Dr. Budi Santoso, M.T.</a>
    <a>Rp. 15.000.000</a>
    <a>Approved</a>
    <a>Source : Internal UPI</a>
    <a class="ar-year">2024</a>
  </div>
  <div class="ar-meta">Personils : Siti Aminah; Andi Wijaya; -</div>
</div>
"""


def html_iprs(status_teks):
    return f"""
<div class="ar-list-item">
  <div class="ar-title"><a>Aplikasi Arsip Digital</a></div>
  <div class="ar-meta">
    <a class="ar-pub">Universitas Pendidikan Indonesia</a>
    <a>Inventor : Budi Santoso, Siti Aminah</a>
    <a>Nomor Permohonan : EC00202312345</a>
    <a>{status_teks}</a>
    <a class="ar-quartile">Hak Cipta</a>
    <a class="ar-year">2023</a>
  </div>
</div>
"""


def item(html):
    return BeautifulSoup(html, "html.parser").select_one(".ar-list-item")


class FakeCursor:
    """Mencatat SQL yang dijalankan tanpa database."""

    def __init__(self):
        self.calls = []

    def execute(self, sql, params=None):
        self.calls.append((sql, params))

    def fetchone(self):
        return {"id": 1}

    def fetchall(self):
        return []


class ParserKegiatanTest(unittest.TestCase):
    def setUp(self):
        self.hasil = sinta.parse_researches_services(item(HTML_KEGIATAN))

    def test_hasil_tidak_memuat_status(self):
        self.assertNotIn("status", self.hasil)
        # Kolom "raw" memang berisi seluruh teks item, jadi tidak ikut diperiksa.
        tanpa_raw = {k: v for k, v in self.hasil.items() if k != "raw"}
        self.assertNotIn("Approved", str(tanpa_raw))

    def test_kolom_lain_tetap_terbaca(self):
        self.assertEqual(self.hasil["judul"], "Pengembangan Sistem Informasi Arsip")
        self.assertEqual(self.hasil["skema"], "Penelitian Dasar")
        self.assertEqual(self.hasil["ketua"], "Dr. Budi Santoso, M.T.")
        self.assertEqual(self.hasil["anggota"], ["Siti Aminah", "Andi Wijaya"])
        self.assertEqual(self.hasil["dana_nominal"], 15000000)
        self.assertEqual(self.hasil["sumber_dana"], "Source : Internal UPI")
        self.assertEqual(self.hasil["tahun"], 2024)


class ParserIprsTest(unittest.TestCase):
    def test_status_granted_apa_adanya(self):
        self.assertEqual(sinta.parse_iprs(item(html_iprs("Status : Granted")))["status"], "Granted")

    def test_status_diterima_apa_adanya(self):
        self.assertEqual(sinta.parse_iprs(item(html_iprs("Status : Diterima")))["status"], "Diterima")

    def test_spasi_di_awal_dan_akhir_dibuang(self):
        self.assertEqual(sinta.parse_iprs(item(html_iprs("Status :    Diterima   ")))["status"], "Diterima")

    def test_kolom_lain_tetap_terbaca(self):
        hasil = sinta.parse_iprs(item(html_iprs("Status : Granted")))
        self.assertEqual(hasil["nomor_permohonan"], "EC00202312345")
        self.assertEqual(hasil["jenis"], "Hak Cipta")
        self.assertEqual(hasil["tahun"], 2023)


class LoaderKegiatanTest(unittest.TestCase):
    def setUp(self):
        self.cur = FakeCursor()
        baris = sinta.parse_researches_services(item(HTML_KEGIATAN))
        loader.simpan_kegiatan(self.cur, 5, "penelitian", [baris])

    def insert_kegiatan(self):
        return next(c for c in self.cur.calls if "INSERT INTO kegiatan\n" in c[0] or "INSERT INTO kegiatan " in c[0])

    def test_sql_kegiatan_tidak_menyebut_status(self):
        sql, params = self.insert_kegiatan()
        self.assertNotIn("status", sql)
        self.assertEqual(len(params), 7)
        self.assertNotIn("Approved", params)

    def test_semua_sql_simpan_kegiatan_tanpa_status(self):
        for sql, _ in self.cur.calls:
            self.assertNotIn("status", sql)

    def test_crawler_menandai_baris_baru_sebagai_sinta(self):
        # Baris baru ditulis 'sinta'. Saat konflik, sumber tidak diubah (baris manual tetap manual).
        sql, _ = self.insert_kegiatan()
        self.assertIn("'sinta')", sql)
        self.assertNotRegex(sql, r"(?<![.\w])sumber\s*=")

    def test_kode_crawler_tidak_menyebut_status_kegiatan(self):
        for fungsi in (loader.simpan_kegiatan, sinta.parse_researches_services):
            self.assertNotIn("status", inspect.getsource(fungsi).lower(), fungsi.__name__)


class LoaderIprsTest(unittest.TestCase):
    def simpan(self, status_teks):
        cur = FakeCursor()
        loader.simpan_iprs(cur, 5, [sinta.parse_iprs(item(html_iprs(status_teks)))])
        return next(c for c in cur.calls if "INSERT INTO iprs\n" in c[0] or "INSERT INTO iprs " in c[0])

    def test_granted_disimpan_sebagai_granted(self):
        _, params = self.simpan("Status : Granted")
        self.assertEqual(params[5], "Granted")

    def test_diterima_disimpan_sebagai_diterima(self):
        _, params = self.simpan("Status : Diterima")
        self.assertEqual(params[5], "Diterima")

    def test_crawl_ulang_memperbarui_status(self):
        sql, _ = self.simpan("Status : Granted")
        self.assertRegex(sql, r"status\s*=\s*COALESCE\(EXCLUDED\.status,\s*iprs\.status\)")


URL_UJI = os.environ.get("CRAWLER_TEST_DATABASE_URL")


@unittest.skipUnless(URL_UJI, "set CRAWLER_TEST_DATABASE_URL untuk menjalankan tes ke database sungguhan")
class IntegrasiDatabaseTest(unittest.TestCase):
    """Menjalankan SQL loader ke Postgres sungguhan di dalam transaksi yang selalu di-rollback."""

    def setUp(self):
        import psycopg
        from psycopg.rows import dict_row

        self.conn = psycopg.connect(URL_UJI, row_factory=dict_row)
        self.cur = self.conn.cursor()
        tanda = uuid.uuid4().hex[:12]
        self.cur.execute(
            "INSERT INTO dosen (user_id, sinta_id) VALUES (gen_random_uuid(), %s) RETURNING id",
            (f"uji-{tanda}",),
        )
        self.dosen_id = self.cur.fetchone()["id"]
        self.tanda = tanda

    def tearDown(self):
        self.conn.rollback()
        self.conn.close()

    def test_iprs_crawl_ulang_memperbarui_status_apa_adanya(self):
        baris = {"judul": f"IPRS uji {self.tanda}", "nomor_permohonan": f"UJI-{self.tanda}", "status": "Diterima", "tahun": 2023}
        loader.simpan_iprs(self.cur, self.dosen_id, [baris])
        self.cur.execute("SELECT status, sumber FROM iprs WHERE nomor_permohonan = %s", (baris["nomor_permohonan"],))
        self.assertEqual(self.cur.fetchone(), {"status": "Diterima", "sumber": "sinta"})

        baris["status"] = "Granted"
        loader.simpan_iprs(self.cur, self.dosen_id, [baris])
        self.cur.execute("SELECT status FROM iprs WHERE nomor_permohonan = %s", (baris["nomor_permohonan"],))
        self.assertEqual(self.cur.fetchone()["status"], "Granted")

    def test_kegiatan_tersimpan_tanpa_kolom_status(self):
        baris = dict(sinta.parse_researches_services(item(HTML_KEGIATAN)), judul=f"Kegiatan uji {self.tanda}")
        loader.simpan_kegiatan(self.cur, self.dosen_id, "penelitian", [baris])
        self.cur.execute("SELECT sumber FROM kegiatan WHERE judul = %s", (baris["judul"],))
        self.assertEqual(self.cur.fetchone()["sumber"], "sinta")
        self.cur.execute(
            "SELECT count(*) AS n FROM information_schema.columns WHERE table_name = 'kegiatan' AND column_name = 'status'"
        )
        self.assertEqual(self.cur.fetchone()["n"], 0)


if __name__ == "__main__":
    unittest.main()
