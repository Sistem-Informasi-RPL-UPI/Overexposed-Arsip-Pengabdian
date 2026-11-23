import hmac
import threading
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

import config
import loader

# Satu crawl pada satu waktu. Permintaan lain ditolak 409, tidak diantrekan (PRD 8).
# Kunci ini di memori karena Neon pooled (mode transaksi) tidak mendukung advisory lock sesi.
# Status per dosen tetap di database, dan sisa IN_PROGRESS dibersihkan saat layanan menyala.
kunci_crawl = threading.Lock()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    try:
        n = loader.tandai_sisa_in_progress()
        if n:
            print(f"[startup] {n} sisa IN_PROGRESS ditandai FAILED")
    except Exception as e:
        print(f"[startup] gagal membersihkan IN_PROGRESS: {type(e).__name__}: {e}")
    yield


app = FastAPI(lifespan=lifespan)


@app.exception_handler(HTTPException)
async def galat_http(_req: Request, exc: HTTPException):
    # Kunci "message" mengikuti konvensi respons galat aplikasi (PRD 6.7).
    return JSONResponse(status_code=exc.status_code, content={"message": exc.detail})


class SyncRequest(BaseModel):
    # Kosong atau tidak dikirim berarti semua dosen yang lolos aturan 7 hari.
    sinta_id: str | None = None
    # Pengguna yang menekan tombol, dikirim Next.js untuk log_aktivitas.
    pemicu_id: uuid.UUID | None = None
    pemicu_nama: str | None = None


def cek_kunci(x_internal_key: str | None):
    if not x_internal_key or not hmac.compare_digest(x_internal_key.encode(), config.INTERNAL_KEY.encode()):
        raise HTTPException(status_code=401, detail="Unauthorized")


def _jalankan_lalu_lepas(*args):
    try:
        loader.jalankan_sinkron(*args)
    finally:
        kunci_crawl.release()


@app.post("/sync", status_code=202)
def sync(body: SyncRequest | None = None, x_internal_key: str | None = Header(default=None)):
    cek_kunci(x_internal_key)
    body = body or SyncRequest()
    target = (body.sinta_id or "").strip() or None
    pemicu_id = str(body.pemicu_id) if body.pemicu_id else None

    if not kunci_crawl.acquire(blocking=False):
        raise HTTPException(status_code=409, detail="Sinkron sedang berjalan")

    try:
        diproses, dilewati, ditemukan = loader.pilih_dosen(target)
    except Exception:
        kunci_crawl.release()
        raise

    data = {"diproses": [d["sinta_id"] for d in diproses], "dilewati": [d["sinta_id"] for d in dilewati]}

    if target and not ditemukan:
        kunci_crawl.release()
        raise HTTPException(status_code=404, detail="sinta_id belum terdaftar")

    if not diproses:
        kunci_crawl.release()
        loader.catat_log_aktivitas(
            pemicu_id, body.pemicu_nama, loader.ringkasan_log(target, body.pemicu_nama, {}, data["dilewati"])
        )
        return JSONResponse(
            status_code=200,
            content={"message": "Tidak ada dosen yang perlu disinkron (aturan 7 hari)", "data": data},
        )

    threading.Thread(
        target=_jalankan_lalu_lepas,
        args=(diproses, dilewati, target, pemicu_id, body.pemicu_nama),
        daemon=True,
    ).start()
    return {"message": "Sinkron dimulai", "data": data}


@app.get("/health")
def health():
    return {"status": "ok"}
