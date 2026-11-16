import hmac
import queue
import random
import threading
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

import config
import loader

# Antrean sederhana: satu worker, jadi hanya satu crawl berjalan pada satu waktu.
jobs: "queue.Queue[str]" = queue.Queue()


def worker():
    while True:
        sinta_id = jobs.get()
        try:
            loader.sync_dosen(sinta_id)
        except Exception as e:
            print(f"[worker] sync {sinta_id} error: {type(e).__name__}: {e}")
        finally:
            jobs.task_done()
        if not jobs.empty():
            time.sleep(random.uniform(config.DELAY_DOSEN_MIN, config.DELAY_DOSEN_MAX))


@asynccontextmanager
async def lifespan(_app: FastAPI):
    loader.tandai_sisa_in_progress()
    threading.Thread(target=worker, daemon=True).start()
    yield


app = FastAPI(lifespan=lifespan)


class SyncRequest(BaseModel):
    sinta_id: str


def cek_kunci(x_internal_key: str | None):
    if not x_internal_key or not hmac.compare_digest(x_internal_key, config.INTERNAL_KEY):
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.post("/sync", status_code=202)
def sync(body: SyncRequest, x_internal_key: str | None = Header(default=None)):
    cek_kunci(x_internal_key)
    sinta_id = body.sinta_id.strip()
    if not sinta_id:
        raise HTTPException(status_code=422, detail="sinta_id kosong")
    jobs.put(sinta_id)
    return {"status": "accepted", "antrean": jobs.qsize()}


@app.get("/health")
def health():
    return {"status": "ok"}
