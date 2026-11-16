import os

from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ["DATABASE_URL"]
INTERNAL_KEY = os.environ["INTERNAL_KEY"]

DELAY_CATEGORY = float(os.getenv("DELAY_CATEGORY", "3"))
DELAY_DOSEN_MIN = float(os.getenv("DELAY_DOSEN_MIN", "2.5"))
DELAY_DOSEN_MAX = float(os.getenv("DELAY_DOSEN_MAX", "5"))

SYNC_ULANG_SETELAH_HARI = 7
