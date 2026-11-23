"""Issue #15: endpoint layanan crawler (PRD 8). Database dan crawl SINTA diganti tiruan."""
import os
import sys
import threading
import unittest
from unittest import mock

os.environ.setdefault("DATABASE_URL", "postgresql://tes")
os.environ.setdefault("INTERNAL_KEY", "tes")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "app"))

from fastapi.testclient import TestClient  # noqa: E402

import config  # noqa: E402
import main  # noqa: E402

KUNCI = {"X-Internal-Key": config.INTERNAL_KEY}
DOSEN = {"id": 1, "nama": "A", "sinta_id": "111", "sync_status": None, "last_synced_at": None}


def tunggu_kunci_lepas(test):
    """Thread background melepas kunci setelah selesai. Ambil lalu lepas untuk memastikan."""
    test.assertTrue(main.kunci_crawl.acquire(timeout=5), "kunci crawl tidak dilepas")
    main.kunci_crawl.release()


class SyncEndpointTest(unittest.TestCase):
    def setUp(self):
        # Tanpa `with`, lifespan (pembersihan IN_PROGRESS ke database) tidak dijalankan.
        self.client = TestClient(main.app)
        self.pilih = mock.patch.object(main.loader, "pilih_dosen", return_value=([DOSEN], [], True)).start()
        self.jalan = mock.patch.object(main.loader, "jalankan_sinkron").start()
        self.log = mock.patch.object(main.loader, "catat_log_aktivitas").start()
        self.addCleanup(mock.patch.stopall)

    def test_tanpa_kunci_401(self):
        r = self.client.post("/sync", json={"sinta_id": "111"})
        self.assertEqual(r.status_code, 401)
        self.assertEqual(r.json(), {"message": "Unauthorized"})
        self.pilih.assert_not_called()

    def test_kunci_salah_401(self):
        r = self.client.post("/sync", json={}, headers={"X-Internal-Key": "salah"})
        self.assertEqual(r.status_code, 401)
        self.pilih.assert_not_called()

    def test_permintaan_valid_202_tanpa_menunggu(self):
        r = self.client.post("/sync", json={"sinta_id": " 111 ", "pemicu_nama": "Staff"}, headers=KUNCI)
        self.assertEqual(r.status_code, 202)
        self.assertEqual(r.json()["data"], {"diproses": ["111"], "dilewati": []})
        self.pilih.assert_called_once_with("111")
        tunggu_kunci_lepas(self)
        self.jalan.assert_called_once_with([DOSEN], [], "111", None, "Staff")

    def test_tanpa_body_berarti_semua_dosen(self):
        r = self.client.post("/sync", headers=KUNCI)
        self.assertEqual(r.status_code, 202)
        self.pilih.assert_called_once_with(None)
        tunggu_kunci_lepas(self)

    def test_sinta_id_kosong_berarti_semua_dosen(self):
        self.client.post("/sync", json={"sinta_id": "  "}, headers=KUNCI)
        self.pilih.assert_called_once_with(None)
        tunggu_kunci_lepas(self)

    def test_sedang_berjalan_409_tidak_diantrekan(self):
        lanjut = threading.Event()
        self.jalan.side_effect = lambda *a: lanjut.wait(5)

        pertama = self.client.post("/sync", json={}, headers=KUNCI)
        kedua = self.client.post("/sync", json={"sinta_id": "222"}, headers=KUNCI)

        self.assertEqual(pertama.status_code, 202)
        self.assertEqual(kedua.status_code, 409)
        self.assertEqual(kedua.json(), {"message": "Sinkron sedang berjalan"})
        self.assertEqual(self.pilih.call_count, 1)

        lanjut.set()
        tunggu_kunci_lepas(self)
        self.assertEqual(self.client.post("/sync", json={}, headers=KUNCI).status_code, 202)
        tunggu_kunci_lepas(self)

    def test_semua_dilewati_200_dan_dicatat(self):
        lewat = dict(DOSEN, sync_status="SUCCESS")
        self.pilih.return_value = ([], [lewat], True)
        r = self.client.post("/sync", json={"sinta_id": "111"}, headers=KUNCI)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["data"], {"diproses": [], "dilewati": ["111"]})
        self.jalan.assert_not_called()
        self.log.assert_called_once()
        self.assertIn("Dilewati (aturan 7 hari): 111", self.log.call_args.args[2])
        tunggu_kunci_lepas(self)

    def test_sinta_id_tidak_terdaftar_404(self):
        self.pilih.return_value = ([], [], False)
        r = self.client.post("/sync", json={"sinta_id": "999"}, headers=KUNCI)
        self.assertEqual(r.status_code, 404)
        self.jalan.assert_not_called()
        tunggu_kunci_lepas(self)

    def test_galat_database_melepas_kunci(self):
        self.pilih.side_effect = RuntimeError("db mati")
        client = TestClient(main.app, raise_server_exceptions=False)
        self.assertEqual(client.post("/sync", json={}, headers=KUNCI).status_code, 500)
        tunggu_kunci_lepas(self)

    def test_pemicu_id_harus_uuid(self):
        r = self.client.post("/sync", json={"pemicu_id": "bukan-uuid"}, headers=KUNCI)
        self.assertEqual(r.status_code, 422)
        self.pilih.assert_not_called()


class HealthTest(unittest.TestCase):
    def test_health_200_tanpa_kunci(self):
        r = TestClient(main.app).get("/health")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json(), {"status": "ok"})


if __name__ == "__main__":
    unittest.main()
