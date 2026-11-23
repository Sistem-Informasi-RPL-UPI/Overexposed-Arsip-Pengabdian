FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

WORKDIR /srv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# main.py, loader.py, sinta.py, dan config.py saling impor dengan nama pendek, jadi dijalankan dari app/.
COPY app/ ./app/
WORKDIR /srv/app

RUN useradd --create-home crawler
USER crawler

# PORT diisi Render. 8000 untuk jalan lokal.
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
