"""Issue #15: aturan 7 hari, status akhir, pemilihan dosen, dan pembersihan IN_PROGRESS (PRD 5.3, 8)."""
import os
import sys
import unittest
import uuid
from datetime import datetime, timedelta, timezone
from unittest import mock

os.environ.setdefault("DATABASE_URL", "postgresql://tes")
os.environ.setdefault("INTERNAL_KEY", "tes")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "app"))

import loader  # noqa: E402

SEKARANG = datetime(2026, 11, 23, 12, 0, tzinfo=timezone.utc)
HARI = timedelta(days=1)


class PerluSinkronTest(unittest.TestCase):
    def test_belum_pernah_sinkron(self):
        self.assertTrue(loader.perlu_sinkron(None, None, SEKARANG))

    def test_success_dalam_7_hari_dilewati(self):
        self.assertFalse(loader.perlu_sinkron("SUCCESS", SEKARANG - HARI, SEKARANG))
        self.assertFalse(loader.perlu_sinkron("SUCCESS", SEKARANG - 7 * HARI, SEKARANG))

    def test_success_lebih_dari_7_hari_diproses(self):
        self.assertTrue(loader.perlu_sinkron("SUCCESS", SEKARANG - 7 * HARI - timedelta(seconds=1), SEKARANG))

    def test_failed_dan_partial_boleh_sebelum_7_hari(self):
        for status in ("FAILED", "PARTIAL"):
            with self.subTest(status):
                self.assertTrue(loader.perlu_sinkron(status, SEKARANG - HARI, SEKARANG))

    def test_in_progress_yang_dipesan_next_ikut_diproses(self):
        self.assertTrue(loader.perlu_sinkron("IN_PROGRESS", SEKARANG - HARI, SEKARANG))

    def test_success_tanpa_tanggal_diproses(self):
        self.assertTrue(loader.perlu_sinkron("SUCCESS", None, SEKARANG))


class TentukanStatusTest(unittest.TestCase):
    def views(self, *ok):
        return {f"tab{i}": {"ok": v, "rows": []} for i, v in enumerate(ok)}

    def test_semua_berhasil_success(self):
        self.assertEqual(loader.tentukan_status(self.views(True, True, True)), "SUCCESS")

    def test_sebagian_gagal_partial(self):
        self.assertEqual(loader.tentukan_status(self.views(True, False, True)), "PARTIAL")

    def test_semua_gagal_failed(self):
        self.assertEqual(loader.tentukan_status(self.views(False, False)), "FAILED")

    def test_tanpa_tab_failed(self):
        self.assertEqual(loader.tentukan_status({}), "FAILED")


class FakeCursor:
    def __init__(self, baris):
        self.baris, self.calls = baris, []

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def execute(self, sql, params=()):
        self.calls.append((" ".join(sql.split()), params))

    def fetchall(self):
        return self.baris


class FakeConn:
    def __init__(self, baris=()):
        self.cur = FakeCursor(list(baris))
        self.committed = False

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def cursor(self):
        return self.cur

    def execute(self, sql, params=()):
        self.cur.execute(sql, params)

    def commit(self):
        self.committed = True


def dosen(i, status=None, last=None):
    return {"id": i, "nama": f"D{i}", "sinta_id": str(100 + i), "sync_status": status, "last_synced_at": last}


class PilihDosenTest(unittest.TestCase):
    def jalankan(self, baris, sinta_id=None):
        conn = FakeConn(baris)
        with mock.patch.object(loader, "_connect", return_value=conn), \
             mock.patch.object(loader, "datetime", wraps=datetime) as dt:
            dt.now.return_value = SEKARANG
            hasil = loader.pilih_dosen(sinta_id)
        return hasil, conn

    def test_memisah_diproses_dan_dilewati_lalu_menandai_in_progress(self):
        baris = [dosen(1), dosen(2, "SUCCESS", SEKARANG - HARI), dosen(3, "PARTIAL", SEKARANG - HARI)]
        (diproses, dilewati, ditemukan), conn = self.jalankan(baris)

        self.assertEqual([d["id"] for d in diproses], [1, 3])
        self.assertEqual([d["id"] for d in dilewati], [2])
        self.assertTrue(ditemukan)
        select, update = conn.cur.calls
        self.assertIn("FOR UPDATE", select[0])
        self.assertNotIn("sinta_id = %s", select[0])
        self.assertIn("SET sync_status = 'IN_PROGRESS'", update[0])
        self.assertEqual(update[1], ([1, 3],))
        self.assertTrue(conn.committed)

    def test_satu_sinta_id_difilter(self):
        _, conn = self.jalankan([dosen(1)], "101")
        self.assertIn("sinta_id = %s", conn.cur.calls[0][0])
        self.assertEqual(conn.cur.calls[0][1], ("101",))

    def test_semua_dilewati_tidak_ada_update(self):
        (diproses, dilewati, _), conn = self.jalankan([dosen(2, "SUCCESS", SEKARANG - HARI)])
        self.assertEqual(diproses, [])
        self.assertEqual(len(dilewati), 1)
        self.assertEqual(len(conn.cur.calls), 1)

    def test_tidak_ditemukan(self):
        (_, _, ditemukan), _ = self.jalankan([], "999")
        self.assertFalse(ditemukan)

    def test_tidak_pernah_membuat_baris_dosen(self):
        _, conn = self.jalankan([dosen(1)])
        self.assertFalse(any("INSERT" in sql for sql, _ in conn.cur.calls))


class JalankanSinkronTest(unittest.TestCase):
    def setUp(self):
        self.conn = FakeConn()
        mock.patch.object(loader, "_connect", return_value=self.conn).start()
        mock.patch.object(loader, "backfill_anggota").start()
        mock.patch.object(loader.time, "sleep").start()
        self.log = mock.patch.object(loader, "catat_log_aktivitas").start()
        self.addCleanup(mock.patch.stopall)

    def test_hasil_per_dosen_dan_log_aktivitas(self):
        with mock.patch.object(loader, "sync_dosen", side_effect=["SUCCESS", "PARTIAL"]):
            hasil = loader.jalankan_sinkron([dosen(1), dosen(2)], [dosen(3)], None, "uuid-x", "Staff")

        self.assertEqual(hasil, {"101": "SUCCESS", "102": "PARTIAL"})
        pemicu_id, pemicu_nama, detail = self.log.call_args.args
        self.assertEqual((pemicu_id, pemicu_nama), ("uuid-x", "Staff"))
        self.assertEqual(
            detail,
            "Pemicu: Staff. Target: semua dosen. Hasil: 101 SUCCESS, 102 PARTIAL. Dilewati (aturan 7 hari): 103",
        )

    def test_galat_satu_dosen_jadi_failed_dan_lanjut(self):
        with mock.patch.object(loader, "sync_dosen", side_effect=[RuntimeError("x"), "SUCCESS"]):
            hasil = loader.jalankan_sinkron([dosen(1), dosen(2)], [], "101")
        self.assertEqual(hasil, {"101": "FAILED", "102": "SUCCESS"})
        self.assertIn("Target: sinta_id 101", self.log.call_args.args[2])

    def test_galat_tak_terduga_menandai_sisa_failed(self):
        with mock.patch.object(loader, "sync_dosen", return_value="SUCCESS"), \
             mock.patch.object(loader.random, "uniform", side_effect=KeyboardInterrupt):
            with self.assertRaises(KeyboardInterrupt):
                loader.jalankan_sinkron([dosen(1), dosen(2)], [])
        update = [c for c in self.conn.cur.calls if "SET sync_status = 'FAILED'" in c[0]]
        self.assertEqual(update[0][1], ([2],))
        self.assertIn("102 FAILED", self.log.call_args.args[2])


class SisaInProgressTest(unittest.TestCase):
    def test_hanya_yang_lama(self):
        sql = " ".join(loader.SQL_SISA_IN_PROGRESS.split())
        self.assertIn("WHERE sync_status = 'IN_PROGRESS' AND updated_at < NOW()", sql)

    def test_dipanggil_sekali_saat_menyala_bukan_tiap_request(self):
        import main

        with mock.patch.object(main.loader, "tandai_sisa_in_progress", return_value=0) as tandai, \
             mock.patch.object(main.loader, "pilih_dosen", return_value=([], [], True)), \
             mock.patch.object(main.loader, "catat_log_aktivitas"):
            from fastapi.testclient import TestClient

            with TestClient(main.app) as client:
                client.get("/health")
                client.post("/sync", json={}, headers={"X-Internal-Key": loader.config.INTERNAL_KEY})
        tandai.assert_called_once()


URL_UJI = os.environ.get("CRAWLER_TEST_DATABASE_URL")


@unittest.skipUnless(URL_UJI, "set CRAWLER_TEST_DATABASE_URL untuk menjalankan tes ke database sungguhan")
class IntegrasiSisaInProgressTest(unittest.TestCase):
    """SQL pembersihan dijalankan ke Postgres sungguhan di dalam transaksi yang selalu di-rollback."""

    def setUp(self):
        import psycopg
        from psycopg.rows import dict_row

        self.conn = psycopg.connect(URL_UJI, row_factory=dict_row)
        self.cur = self.conn.cursor()

    def tearDown(self):
        self.conn.rollback()
        self.conn.close()

    def buat(self, status, menit_lalu):
        self.cur.execute(
            """INSERT INTO dosen (user_id, sinta_id, sync_status, updated_at)
               VALUES (%s, %s, %s, NOW() - (%s * INTERVAL '1 minute')) RETURNING id""",
            (str(uuid.uuid4()), "uji-" + uuid.uuid4().hex[:12], status, menit_lalu),
        )
        return self.cur.fetchone()["id"]

    def status(self, i):
        self.cur.execute("SELECT sync_status FROM dosen WHERE id = %s", (i,))
        return self.cur.fetchone()["sync_status"]

    def test_in_progress_lama_jadi_failed_yang_baru_dibiarkan(self):
        lama, baru, sukses = self.buat("IN_PROGRESS", 60), self.buat("IN_PROGRESS", 1), self.buat("SUCCESS", 60)
        self.cur.execute(loader.SQL_SISA_IN_PROGRESS, (10,))
        self.assertEqual(self.status(lama), "FAILED")
        self.assertEqual(self.status(baru), "IN_PROGRESS")
        self.assertEqual(self.status(sukses), "SUCCESS")


if __name__ == "__main__":
    unittest.main()
