import json
import os
import sys
import unittest

# config.py membaca environment saat diimpor, nilainya tidak dipakai di tes ini.
os.environ.setdefault("DATABASE_URL", "postgresql://tes")
os.environ.setdefault("INTERNAL_KEY", "tes")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "app"))

from loader import kunci_buku, kunci_iprs, kunci_kegiatan, kunci_publikasi, norm_nama  # noqa: E402

# Fixture yang sama dibaca tests/lib/kunci.test.ts, supaya Next.js dan crawler menghasilkan kunci yang sama.
with open(os.path.join(os.path.dirname(__file__), "fixtures", "kunci.json"), encoding="utf-8") as f:
    FIXTURE = json.load(f)


class KunciFixtureTest(unittest.TestCase):
    def test_publikasi(self):
        for c in FIXTURE["publikasi"]:
            with self.subTest(c["kasus"]):
                self.assertEqual(kunci_publikasi(c["judul"]), c["kunci"])

    def test_kegiatan(self):
        for c in FIXTURE["kegiatan"]:
            with self.subTest(c["kasus"]):
                self.assertEqual(kunci_kegiatan(c["jenis"], c["judul"], c["tahun"]), c["kunci"])

    def test_iprs(self):
        for c in FIXTURE["iprs"]:
            with self.subTest(c["kasus"]):
                self.assertEqual(kunci_iprs(c["nomor_permohonan"], c["judul"], c["tahun"]), c["kunci"])

    def test_buku(self):
        for c in FIXTURE["buku"]:
            with self.subTest(c["kasus"]):
                self.assertEqual(kunci_buku(c["isbn"], c["judul"], c["tahun"]), c["kunci"])

    def test_norm_nama(self):
        for c in FIXTURE["norm_nama"]:
            with self.subTest(c["kasus"]):
                self.assertEqual(norm_nama(c["nama"]), c["hasil"])


if __name__ == "__main__":
    unittest.main()
