import os

from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ["DATABASE_URL"]
INTERNAL_KEY = os.environ["INTERNAL_KEY"]

# Jeda antar tab SINTA 1,5 detik (PRD 5.3, keputusan 12 nomor 8) dan jeda acak antar dosen.
DELAY_CATEGORY = float(os.getenv("DELAY_CATEGORY", "1.5"))
DELAY_DOSEN_MIN = float(os.getenv("DELAY_DOSEN_MIN", "2.5"))
DELAY_DOSEN_MAX = float(os.getenv("DELAY_DOSEN_MAX", "5"))

SYNC_ULANG_SETELAH_HARI = 7

# IN_PROGRESS yang lebih tua dari ini dianggap sisa crawl yang mati saat layanan menyala.
# Yang lebih muda dibiarkan, karena bisa jadi baru dipesan Next.js tepat sebelum memanggil /sync.
SISA_IN_PROGRESS_MENIT = int(os.getenv("SISA_IN_PROGRESS_MENIT", "10"))
