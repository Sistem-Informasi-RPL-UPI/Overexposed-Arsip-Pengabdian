# PRD: Modul 4 (Arsip Prodi) dan Modul 7 (Data Tridarma Dosen)

Dokumen ini adalah acuan untuk Claude Code dan pengembang. Tujuannya menjelaskan apa yang dibangun, keputusan yang sudah diambil, dan keputusan yang belum. **Bagian bertanda "Usulan" belum disetujui tim. Jangan diperlakukan sebagai keputusan final.** Bagian "Keputusan terbuka" harus ditanyakan ke pemilik proyek, bukan ditebak.

Versi: 1.21. Berdasarkan ERD versi 6.

| Versi | Tanggal    | Perubahan                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ----- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.0   | (awal)     | Versi awal.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 1.1   | 2026-11-17 | Crawler diputuskan di Render Web Service gratis, on-demand, tanpa cron dan tanpa monitor ping. Alur sinkron diperjelas (warm-up, async, status di database). Aturan 7 hari berlaku untuk semua peran dan tidak bisa dipaksa. Keputusan deploy crawler ditutup.                                                                                                                                                                                                                                                                         |
| 1.2   | 2026-11-17 | Role admin di bagian 8.1 diganti Staff Kaprodi (rute `/api/staff-kaprodi/sinkron`). Catatan "Admin belum ada di SSO" dihapus, pertanyaan hak Kaprodi ditambahkan ke bagian 12.                                                                                                                                                                                                                                                                                                                                                         |
| 1.3   | 2026-11-17 | Pengisian `sinta_id` untuk Staff Kaprodi dibuat opsional (5.1, 8.1). Pertanyaan terbuka nomor 1 ditutup.                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 1.4   | 2026-11-17 | Sesi disimpan di cookie terenkripsi (refresh token dienkripsi dengan kunci dari `SESSION_SECRET`). Tidak ada tabel sesi. Aturan refresh diperjelas dan risiko pencabutan sesi ditambahkan ke bagian 12.                                                                                                                                                                                                                                                                                                                                |
| 1.5   | 2026-11-18 | Modul 4 dirombak: hak akses per peran (6.1), validasi arsip oleh Kaprodi dengan halaman terpisah, nomor arsip dan nomor surat diisi manual, edit arsip, hapus hanya untuk status Dimusnahkan, status retensi Aktif/Inaktif/Dimusnahkan, tanggal tanpa jam. Log aktivitas diperluas ke modul 4, 7, dan login (sukses dan gagal) dengan kolom `modul`, tanpa `objek_id` dan `ip_address`. Halaman Users dihapus.                                                                                                                         |
| 1.6   | 2026-11-19 | Penyesuaian dokumen dengan implementasi auth & RBAC aktual: login hanya `findUnique` ke `dosen` (tidak membuat/menimpa baris sebelum `sinta_id` diisi), mekanisme cookie `app_session` + `sso_refresh` terenkripsi, `src/proxy.ts` (Next.js 16), alias sementara `Admin` ke `Staff Kaprodi`, rute `/sso/logout`, `/auth/refresh`, `/login`, `/api/dev-login`, `/akses-ditolak`, dan RBAC Modul 4 & 7.                                                                                                                                  |
| 1.7   | 2026-11-19 | Pengisian `sinta_id` (5.1 langkah 4) diperjelas: endpoint hanya menambah baris `dosen`, crawl tidak otomatis dan hanya berjalan saat tombol sinkron ditekan.                                                                                                                                                                                                                                                                                                                                                                           |
| 1.8   | 2026-11-21 | Modul 4 disesuaikan dengan implementasi: endpoint kategori dan arsip (6.7) berada di `/api/arsip/kategori` dan memakai `PATCH`, pencarian arsip mencakup nomor arsip, edit arsip mengosongkan `catatan_validasi`, retensi kategori minimal 1 tahun. Konvensi respons galat JSON memakai kunci `message`. Log login gagal memakai `null` (fallback UUID nol dihapus). Struktur folder dan status pengerjaan diperbarui.                                                                                                                 |
| 1.9   | 2026-11-21 | Dosen boleh melihat Dashboard (bagian 12 nomor 13 ditutup). Endpoint `GET /api/dashboard` ditambahkan (6.3, 6.7). `pencipta_unit` arsip diisi otomatis dari nama akun yang login dan tidak bisa diubah.                                                                                                                                                                                                                                                                                                                                |
| 1.10  | 2026-11-21 | Endpoint `GET /api/log-aktivitas` ditambahkan (6.4, 6.7): filter modul, aksi, objek, dan rentang tanggal (batas hari WIB). Endpoint validasi arsip (`GET /api/arsip/validasi`, `PATCH /api/arsip/[id]/validasi`) dicatat di 6.7. Struktur folder dan status pengerjaan diperbarui.                                                                                                                                                                                                                                                     |
| 1.11  | 2026-11-22 | Rekap penilaian tridarma (kolom TS, TS-1, TS-2) dan tabel "Publikasi Ilmiah Hasil Penelitian DTPS" dikeluarkan dari cakupan untuk sementara (5.5 dan 13). Ditunda, bukan dibatalkan.                                                                                                                                                                                                                                                                                                                                                   |
| 1.12  | 2026-11-22 | Hak akses Modul 7 per peran (5.6 dan 8.1), termasuk akses baca publik tanpa login. Deploy Next.js di Vercel, crawler di Render. Crawl yang sedang berjalan menolak permintaan lain dengan pesan "sedang berjalan" (tidak diantrekan). Crawl ulang untuk status FAILED atau PARTIAL boleh sebelum 7 hari. Jeda 1,5 detik per tab. Ping warm-up hanya di halaman sinkron modul 7. Catatan untuk front-end (8.2). Keputusan terbuka 2 sampai 11 ditutup.                                                                                  |
| 1.13  | 2026-11-22 | Hak akses bagian pengajaran (5.4): `matkul` dikelola Kaprodi dan Staff Kaprodi. `kelas` dan `berkas_pengajaran` diisi Dosen pemilik, Kaprodi dan Staff Kaprodi hanya melihat. Mahasiswa dan Umum tidak punya akses pengajaran. Pengecualian ditambahkan di 5.6. Keputusan terbuka 14 diperbarui, dan nomor 15 (Dosen melihat kelas dosen lain) ditunda.                                                                                                                                                                                |
| 1.14  | 2026-11-22 | CRUD data manual untuk publikasi, kegiatan (penelitian dan pengabdian), IPRS, dan buku (5.7). Kolom `sumber` (`sinta` atau `manual`) di tiap tabel data tridarma. Data manual yang duplikat dengan data SINTA ditolak. Crawl tidak mengubah atau menghapus data manual. Keputusan terbuka 14 sebagian ditutup, dan nomor 16 (data manual yang kemudian ditemukan crawl) ditambahkan.                                                                                                                                                   |
| 1.15  | 2026-11-22 | Status data tridarma disederhanakan: kolom `status` hanya ada di `iprs`. Kolom `status` di `kegiatan` (penelitian dan pengabdian) dihapus dan crawler tidak lagi menyimpannya. Tidak ada validator atau validasi Kaprodi untuk data modul 7. Status IPRS manual langsung `Approved`, status IPRS hasil crawl mengikuti SINTA (5.3 dan 5.7). Keputusan terbuka 17 (nilai status IPRS) ditambahkan, dan 16 diberi catatan status.                                                                                                        |
| 1.16  | 2026-11-22 | Status IPRS disatukan menjadi `Diterima`: IPRS manual berstatus `Diterima`, dan status SINTA `Granted` atau `Diterima` disimpan sebagai `Diterima`. Keputusan terbuka 17 dan 16 ditutup (data manual yang ditemukan crawl digabung menjadi satu baris).                                                                                                                                                                                                                                                                                |
| 1.17  | 2026-11-22 | Koreksi 1.16: status IPRS hasil crawl disimpan **apa adanya** dari SINTA (misalnya `Granted` atau `Diterima`), tidak dipetakan. Hanya IPRS manual yang diisi `Diterima`.                                                                                                                                                                                                                                                                                                                                                               |
| 1.18  | 2026-11-22 | Penulis dan peserta data manual (5.7): `publikasi.penulis`, `iprs.pemegang`, `iprs.inventor`, dan `buku.penulis` berupa satu teks bebas dipisah `;`. Peserta `kegiatan` tetap dipecah per baris di `kegiatan_anggota` dengan `peran`. Fitur "Tautkan ke saya" untuk data manual milik orang lain yang terdeteksi duplikat (5.7 dan 8.2). Keputusan terbuka 18 (nilai `publikasi_dosen.source` untuk data manual) ditambahkan.                                                                                                          |
| 1.19  | 2026-11-22 | Usulan di 5.7 disetujui menjadi keputusan: aturan hapus saat ada dosen lain yang tertaut, penolakan kegiatan manual untuk dosen yang belum pernah sinkron, dan bentuk form kegiatan (`peran_saya`, `ketua`, `anggota_lain`). Keputusan terbuka 18 ditutup: `publikasi_dosen.source` untuk data manual bernilai `manual`.                                                                                                                                                                                                               |
| 1.20  | 2026-11-23 | Data manual yang duplikat dengan data `sumber = manual` milik dosen lain kini **otomatis ditautkan** (balas `200`, `ditautkan = true`), tanpa tombol "Tautkan ke saya" dan tanpa endpoint `tautkan` (5.7, 8.2). Duplikat dengan data SINTA tetap `409`. Form kegiatan memakai satu kolom `tim`: nama pertama `ketua`, berikutnya `anggota` (5.7). `kuartil` dan `akreditasi` publikasi manual opsional (5.7). Penegasan baca data per dosen lewat filter `dosen_id` (5.8). Enum `PublikasiSource` perlu nilai `manual`.                |
| 1.21  | 2026-11-23 | Daftar endpoint baca data tridarma ditetapkan (5.9): `GET /api/tridarma/{dosen,publikasi,kegiatan,iprs,buku}` dan detail `[id]`, data satu dosen lewat query `dosen_id` (bukan path), `kegiatan` satu route dengan `jenis`. Default dosen yang login diatur front-end (8.2). Semua perubahan skema modul 7 (hapus `kegiatan.status`, kolom `sumber`, nilai `manual` di enum `PublikasiSource`) dipusatkan dalam satu migrasi di issue pertama (5.3, 14). Tidak ada perubahan skema untuk kolom `tim` kegiatan: hanya field form (5.7). |

---

## 1. Ringkasan

Proyek kelas Sistem Informasi RPL (UPI Kampus Cibiru) berisi 10 modul yang dijadikan microservice dengan login SSO bersama (SACIBIRU). Tim ini memegang dua modul:

- **Modul 4, Arsip Prodi.** Web untuk mengelola arsip surat dan dokumen program studi.
- **Modul 7, Data Tridarma Dosen.** Mengumpulkan data penelitian, pengabdian, publikasi, buku, IPRS, dan pengajaran dosen. Sebagian data diambil dari SINTA publik lewat crawler, sebagian lagi bisa diisi manual oleh dosen.

Kedua modul berada di **satu aplikasi Next.js dengan satu database**. Pengembang yang memakai Claude Code ini memegang **back-end** (API, database, integrasi SSO, layanan crawler). Front-end dikerjakan orang lain di repo yang sama.

## 2. Tech stack

| Bagian             | Pilihan                                                         |
| ------------------ | --------------------------------------------------------------- |
| Aplikasi           | Next.js (monolith: front-end dan back-end dalam satu repo)      |
| Deploy Next.js     | **Vercel** (keputusan 2026-11-22).                              |
| Database           | Postgres di Neon                                                |
| ORM dan migrasi    | Prisma (Prisma memiliki skema)                                  |
| Verifikasi JWT SSO | `jose`                                                          |
| Crawler            | Python, dibungkus layanan FastAPI terpisah di folder `crawler/` |
| Library Python     | `requests`, `beautifulsoup4`, `psycopg` (v3)                    |
| Deploy crawler     | **Render Web Service paket gratis** (lihat bagian 8).           |

Database sebelumnya MariaDB (dump `db_belajarcrawling`). Sekarang Postgres, jadi kode dan skema lama perlu disesuaikan (lihat bagian 9).

## 3. Batas tanggung jawab

**Ada di repo ini:** Modul 4 dan Modul 7, termasuk sisi klien SSO (login dan callback) dan layanan crawler.

**Tidak ada di repo ini:** server SSO, tabel user SSO, dan password. Semua itu ada di repo dan database SSO yang terpisah. Modul ini tidak boleh menyimpan password atau membuat tabel user.

Relasi ke pengguna SSO memakai `user_id` (UUID, nilai klaim `sub`) **tanpa foreign key** lintas database.

## 4. Integrasi SSO (sisi klien)

SSO memakai OAuth 2.0 Authorization Code, PKCE (S256), dan access token JWT RS256. Alurnya:

1. Pengguna klik kartu modul di Menu Utama SSO, lalu SSO mengalihkan ke `launch_url` modul (`/sso/login`).
2. Modul membuat `state` dan PKCE, menyimpannya di cookie `httpOnly`, lalu mengalihkan ke `{SSO}/api/sso/authorize`.
3. Setelah login, SSO mengalihkan ke `redirect_uri` (`/auth/callback`) membawa `code` dan `state`.
4. Modul memastikan `state` cocok, lalu dari backend menukar `code` ke `{SSO}/api/sso/token` (dengan `client_secret` dan `code_verifier`).
5. Modul memverifikasi JWT dengan `jose` (`algorithms: ["RS256"]`, `issuer`, `audience`) dan kunci publik dari `{SSO}/api/sso/jwks`.
6. Modul membuat sesi lokal tanpa tabel sesi di database menggunakan cookie `httpOnly`, `secure` (di production), `sameSite=lax`: `app_session` (JWT HS256 berumur 15 menit sesuai `exp` access token, memuat `sub`, `dosen_id`, `name`, `email`, `nip`, `role`) dan `sso_refresh` (JWE terenkripsi AES-256-GCM dengan kunci SHA-256 turunan dari `SESSION_SECRET`, berumur 30 hari). Cookie sementara `sso_tx` (10 menit) dipakai untuk menyimpan `state` dan PKCE `code_verifier` selama proses login.

Aturan penting:

- Klaim token: `sub`, `name`, `email`, `nip`, `role`, `iss`, `aud`, `exp`. Pakai `sub` sebagai kunci akun.
- Umur access token 15 menit, refresh token 30 hari dan **dirotasi** setiap dipakai. Setiap refresh yang berhasil menulis ulang `app_session` dan `sso_refresh` terenkripsi dengan token terbaru. Memakai token lama membatalkan seluruh rantai. Di dalam satu instance server, pembaruan token dijalankan dengan _single-flight deduplication_ (`inFlightRefreshes`), tetapi lintas instance serverless tetap tidak ada lock database terpusat. Refresh hanya dilakukan saat `app_session` habis, dan kegagalan `invalid_grant`/`invalid_client` menghapus cookie sesi dan mengarahkan ke `/sso/login` (gangguan `5xx` atau jaringan tidak menghapus cookie).
- Pembaruan sesi otomatis berjalan di `src/proxy.ts` (Next.js 16 Proxy) maupun lewat endpoint `POST /auth/refresh`.
- Logout (`GET /sso/logout`): hapus cookie sesi lokal (`app_session`, `sso_refresh`, `sso_tx`), lalu alihkan ke `{SSO}/api/sso/logout` dengan `client_id` dan `post_logout_redirect_uri`.
- Login sukses dan gagal dicatat di `log_aktivitas` (`modul`: `auth`, `aksi`: `login` / `login_gagal`, `objek`: `sso`, `detail`: alasan gagal atau role login). Saat gagal, `user_id` dan `user_nama` bernilai `null`. Penulisan log lewat helper `catatLog` (`src/lib/log-aktivitas.ts`); `recordAuthLog` (`src/lib/auth-log.ts`) adalah pintasan untuk login. Kegagalan menulis log hanya dicatat ke console dan tidak membatalkan operasi utama. Galat konfigurasi di callback (`SESSION_SECRET` atau konfigurasi SSO kosong) belum dicatat sebagai `login_gagal`.
- `client_secret` hanya di environment server. Tidak boleh berawalan `NEXT_PUBLIC_`, tidak boleh masuk repo.

Role dari SSO: **`Kaprodi`, `Dosen`, `Staff Kaprodi`, `Mahasiswa`.** Catatan: dokumen SSO v1.0 masih menyebut `Admin` dan belum memuat `Staff Kaprodi` dan `Mahasiswa`. Perubahan itu harus dilakukan oleh tim SSO. Sampai itu selesai, modul sementara menerima **`Admin` sebagai alias `Staff Kaprodi`**, serta **`Umum`** untuk pengunjung tanpa sesi pada rute baca publik (`/tridharma`).

Variabel lingkungan: `SSO_URL` (tanpa `/` akhir, harus sama dengan klaim `iss`), `SSO_CLIENT_ID`, `SSO_CLIENT_SECRET`, `SSO_REDIRECT_URI`, `SSO_POST_LOGOUT_URI` (opsional), `SESSION_SECRET`.

`SESSION_SECRET` dipakai untuk mengenkripsi refresh token. Mengubahnya membuat semua sesi aktif tidak bisa dibaca, sehingga semua user harus login ulang. Nilainya berbeda untuk setiap aplikasi dan tidak dibagi antar modul.

Pendaftaran modul ke pengelola SSO (`client_id`, `launch_url`, `redirect_uri`, role yang boleh masuk) dilakukan manual oleh tim. Karena Modul 4 dan 7 satu aplikasi, cukup satu `client_id`.

## 5. Modul 7: Data Tridarma Dosen

### 5.1 Tabel `dosen` dan pendaftaran dosen

Tabel `dosen` **hanya berisi pengguna yang sudah mengisi `sinta_id`**. Mahasiswa tidak pernah masuk tabel ini. Staff Kaprodi masuk hanya bila mengisi `sinta_id`.

Alur login pertama:

1. Pengguna login lewat SSO (`/sso/login` → `/auth/callback`). Saat callback (maupun `/auth/refresh` dan `/api/dev-login`), backend **tidak membuat baris baru dan tidak menimpa baris `dosen`**, melainkan hanya mencari baris yang sudah ada lewat `findUnique` berdasarkan `user_id = sub`. Bila belum ada, `dosen_id` di sesi bernilai `null`.
2. Bila role `Mahasiswa` (atau `Umum`), tidak ada baris `dosen` dan tidak diminta `sinta_id`.
3. Bila role `Kaprodi` atau `Dosen` dan `dosen_id` di sesi masih `null` (belum ada baris `dosen` dengan `user_id = sub`), pengguna diminta mengisi `sinta_id` di aplikasi. Untuk `Staff Kaprodi`, pengisian `sinta_id` **boleh dilewati**. Staff Kaprodi yang melewati tidak punya baris `dosen`, dan bisa mengisi `sinta_id` kapan saja nanti.
4. Setelah `sinta_id` diisi (lewat endpoint `/api/dosen/sinta-id`), barulah baris `dosen` dibuat dengan `user_id = sub` dan cookie `app_session` diperbarui dengan `dosen_id`. Endpoint ini **hanya menambah baris `dosen`**. Crawl tidak dijalankan otomatis. Kolom `nama`, `nama_normal`, `afiliasi`, `departemen`, skor, dan metrik tetap kosong sampai pengguna menekan tombol sinkron (8.1). Baris baru itu belum punya `sync_status` dan `last_synced_at`, sehingga aturan 7 hari langsung membolehkan sinkron pertama.
5. Login berikutnya langsung menemukan baris `dosen` lewat `user_id` dan menyimpan `dosen.id` ke `app_session.dosen_id`.

Aturan:

- `dosen.user_id` wajib dan unik. `dosen.sinta_id` unik (target desain wajib diisi; pada migrasi saat ini sementara nullable agar selaras dengan penyesuaian sebelumnya, dan aman dikembalikan `NOT NULL` setelah endpoint `/api/dosen/sinta-id` aktif).
- **Tidak ada `email` dan `nip` di tabel `dosen`.** Hubungan ke SSO hanya lewat `user_id`. Tidak ada pencocokan nama ke SSO.
- `dosen.nama` dan `nama_normal` tetap berasal dari SINTA, karena `nama_normal` dipakai mencocokkan nama ketua dan anggota di `kegiatan_anggota` (juga dari SINTA). Jangan menimpanya dengan nama SSO. Nama tampilan di aplikasi diambil dari sesi SSO.
- Tiga baris `dosen` di dump lama adalah data uji dari masa sebelum SSO. Buang, jangan di-seed.

### 5.2 Sumber data: SINTA publik

SINTA diambil **tanpa login**. Halaman publik hanya menampilkan sekitar 10 item pertama per tab, jadi data bisa terpotong (dicatat di `crawl_log.terpotong`). Login SINTA dengan akun dosen masih berupa opsi, belum dicoba, dan butuh persetujuan dosen. **Jangan diimplementasikan.**

Data yang diambil per dosen: profil (nama, afiliasi, departemen), skor SINTA, metrik (Scopus, Google Scholar, WOS), dan 8 tab: Scopus, Garuda, Google Scholar, RAMA, Penelitian, Pengabdian, IPR (HKI), Buku.

### 5.3 Aturan pemrosesan data (sudah ditetapkan)

- **Anti-dobel.** Kunci dibuat dari teks yang dinormalisasi (huruf kecil, tanpa tanda baca), lalu di-hash md5. `publikasi.judul_hash = md5(norm(judul))`. `kegiatan.kunci = md5(jenis | judul | tahun)`. `iprs.kunci` dari nomor permohonan, atau judul dan tahun bila kosong. `buku.kunci` dari ISBN, atau judul dan tahun bila kosong. Kunci yang sama dipakai untuk data manual (5.7).
- **Upsert.** Crawl ulang tidak menambah baris ganda, hanya memperbarui.
- **Publikasi.** `sitasi` memakai nilai tertinggi (`GREATEST`). Kolom lain diisi hanya bila masih kosong (`COALESCE`).
- **Urutan sumber saat simpan:** Scopus, Garuda, Google Scholar SINTA, RAMA. Nilai `publikasi_dosen.source`: `sinta_scopus`, `sinta_garuda`, `sinta_googlescholar`, `sinta_rama`.
- **Ketua dan anggota kegiatan.** `nama` disimpan apa adanya, `nama_normal` hasil normalisasi. Dicocokkan ke `dosen.nama_normal` hanya bila cocok tepat satu baris. Yang tidak cocok tetap tersimpan dengan `dosen_id` NULL.
- **Gelar dibuang saat normalisasi** (Dr., Prof., S.Kom., M.T., dst).
- **Tab gagal tidak menimpa data lama.** Kegagalan dicatat di `crawl_log`.
- **Status sinkron (`sync_status`).** `IN_PROGRESS` saat berjalan. `SUCCESS` (dan `last_synced_at` diisi) bila semua tab berhasil. `PARTIAL` bila sebagian gagal. `FAILED` bila semua gagal. Sisa `IN_PROGRESS` yang sudah lama dianggap `FAILED`.
- **Aturan 7 hari.** Dosen diproses bila belum pernah sinkron, atau `last_synced_at` sudah lebih dari 7 hari lalu. **Aturan ini berlaku untuk semua peran, termasuk Staff Kaprodi. Tidak ada opsi paksa.** Dosen yang masih dalam 7 hari dilewati dan dicatat sebagai dilewati.
  - **Pengecualian (keputusan 2026-11-22):** bila sinkron terakhir berstatus `FAILED` atau `PARTIAL`, dosen tersebut boleh disinkron ulang walaupun belum 7 hari. Bila statusnya `SUCCESS`, aturan 7 hari berlaku penuh.
- **Jeda.** 1,5 detik antar tab ke SINTA (keputusan 2026-11-22, lihat 12 nomor 8) dan jeda acak antar dosen.
- **Sumber data (keputusan 2026-11-22).** Setiap tabel data tridarma (`publikasi`, `kegiatan`, `iprs`, `buku`) punya kolom `sumber` dengan nilai `sinta` atau `manual`. Crawl hanya menulis dan memperbarui baris `sumber = sinta`. Crawl **tidak pernah mengubah atau menghapus** baris `sumber = manual`.
- **Data manual yang kemudian ditemukan crawl (keputusan 2026-11-22).** Karena `kunci` unik, tidak mungkin ada dua baris untuk data yang sama. Bila crawl menemukan data dengan kunci yang sudah ada sebagai baris manual, baris itu **digabung menjadi satu**: kolom yang masih kosong diisi dari SINTA, `sumber` berubah menjadi `sinta`, dan sesudahnya baris itu mengikuti aturan SINTA (tidak bisa diubah atau dihapus lewat CRUD).
- **Perubahan skema dipusatkan (keputusan 2026-11-23).** Semua perubahan skema modul 7 dikerjakan dalam satu migrasi Prisma di issue pertama: hapus `kegiatan.status`, tambah kolom `sumber` di `publikasi`, `kegiatan`, `iprs`, dan `buku`, dan tambah nilai `manual` di enum `PublikasiSource`. Issue lain memakai hasil migrasi itu dan tidak mengubah skema.
- **Status hanya di IPRS (keputusan 2026-11-22).** Kolom `status` hanya ada di tabel `iprs`. Tabel `kegiatan` (penelitian dan pengabdian) **tidak punya kolom status**, dan crawler tidak lagi mengambil atau menyimpan status kegiatan dari SINTA. Untuk `iprs`: baris `sumber = sinta` menyimpan status apa adanya dari SINTA dan diperbarui tiap crawl, baris `sumber = manual` berstatus `Diterima` (5.7). Status SINTA disimpan apa adanya, tanpa dipetakan: bila SINTA menulis `Granted`, yang tersimpan `Granted`, bila `Diterima`, yang tersimpan `Diterima`. Tidak ada validasi oleh Kaprodi atau peran lain untuk data modul 7.

### 5.4 Pengajaran (bidang tridarma ketiga)

Mengoleksi kinerja dosen di bidang pengajaran. Berkas berupa **link saja** (misalnya Google Drive), tidak ada upload.

- `matkul`: daftar mata kuliah (`kode` unik, `nama`, `sks`).
- `kelas`: mata kuliah yang diampu dosen pada tahun ajaran dan semester tertentu (`matkul_id`, `dosen_id`, `tahun_ajaran`, `semester` Ganjil/Genap). Unik per (`matkul_id`, `dosen_id`, `tahun_ajaran`, `semester`), sesuai keputusan 2026-11-22 (lihat 12 nomor 2).
- `berkas_pengajaran`: berkas per kelas. Kolom `jenis` berupa enum: **RPS, Slide, UTS, UAS, Kuis, Presensi, Nilai, Modul**. Satu kelas boleh punya lebih dari satu berkas dengan jenis sama (misalnya dua kuis).
- Tidak ada tabel kategori berkas, dan **tidak ada kolom retensi** di berkas pengajaran.

**Hak akses pengajaran (keputusan 2026-11-22).** Bagian ini adalah pengecualian dari aturan umum di 5.6 dan 5.7. Data pengajaran tidak punya kolom `sumber`, karena seluruhnya diisi manual.

| Data                | Dosen                                                                                      | Kaprodi             | Staff Kaprodi       | Mahasiswa | Umum  |
| ------------------- | ------------------------------------------------------------------------------------------ | ------------------- | ------------------- | --------- | ----- |
| `matkul`            | lihat                                                                                      | tambah, ubah, hapus | tambah, ubah, hapus | tidak     | tidak |
| `kelas`             | tambah, ubah, hapus milik sendiri. Lihat kelas dosen lain: belum diputuskan (12 nomor 15)  | lihat               | lihat               | tidak     | tidak |
| `berkas_pengajaran` | tambah, ubah, hapus milik sendiri. Lihat berkas dosen lain: belum diputuskan (12 nomor 15) | lihat               | lihat               | tidak     | tidak |

- Kaprodi dan Staff Kaprodi **tidak** bisa menambah, mengubah, atau menghapus `kelas` maupun `berkas_pengajaran`, termasuk milik dosen lain.
- Mahasiswa dan Umum tidak punya akses sama sekali ke bagian pengajaran, walaupun mereka boleh membaca data tridarma lain di 5.6.

### 5.5 Fase berikutnya (belum dikerjakan, jangan dibangun dulu)

- Grafik profil SINTA ("Latest number of publications" per tahun dan "Article Quartile"). Bisa dihitung dari `publikasi` dan `publikasi_dosen` (filter `source = 'sinta_scopus'`), tetapi hanya akurat untuk dosen dengan 10 artikel Scopus atau kurang, karena batas SINTA publik.
- `kutipan_tahun` (sitasi per tahun dari SerpAPI) sudah dirancang tetapi tidak dipakai, karena alur sekarang hanya SINTA.

Rekap penilaian tridarma (TS, TS-1, TS-2) tidak ada di fase ini. Lihat bagian 13.

### 5.6 Hak akses Modul 7 (keputusan 2026-11-22)

Halaman baca modul 7 (`/tridharma`) **bisa dibuka tanpa login** oleh peran `Umum`. Pengguna yang ingin menambah, mengubah, atau menghapus data **wajib login** terlebih dahulu.

Tabel ini berlaku untuk data penelitian, pengabdian, publikasi, buku, dan IPRS. **Bagian pengajaran (5.4) memakai aturannya sendiri.**

| Peran              | Lihat data | Tambah, ubah, hapus data manual | Crawl semua dosen | Crawl satu dosen (pilih) | Crawl diri sendiri                |
| ------------------ | ---------- | ------------------------------- | ----------------- | ------------------------ | --------------------------------- |
| Umum (tanpa login) | ya         | tidak (harus login)             | tidak             | tidak                    | tidak                             |
| Mahasiswa          | ya         | tidak                           | tidak             | tidak                    | tidak (tidak punya baris `dosen`) |
| Dosen              | ya         | ya, milik sendiri (5.7)         | tidak             | tidak                    | ya, bila sudah mengisi `sinta_id` |
| Kaprodi            | ya         | ya, milik sendiri (5.7)         | tidak             | tidak                    | ya, bila sudah mengisi `sinta_id` |
| Staff Kaprodi      | ya         | ya, milik sendiri (5.7)         | ya                | ya                       | ya, bila sudah mengisi `sinta_id` |

- Hak akses dicek di server (`src/proxy.ts` dan handler), bukan hanya disembunyikan di UI.

### 5.7 CRUD data manual (keputusan 2026-11-22)

Sebagian data tridarma tidak ada di SINTA, jadi pengguna bisa menambahkannya sendiri.

**Cakupan.** Data manual berlaku untuk:

- `publikasi` (paper dan artikel).
- `kegiatan`, dibedakan dengan kolom `jenis` (penelitian atau pengabdian).
- `iprs`, dibedakan dengan kolom `jenis` (jenis HKI).
- `buku`.

**Siapa yang boleh.** Dosen, Kaprodi, dan Staff Kaprodi boleh menambah data manual. Alasannya, ketiga peran ini bisa saja memiliki paper. Mahasiswa dan Umum tidak boleh.

**Batasan kepemilikan.**

- Pengguna hanya boleh mengubah atau menghapus data manual yang terkait dengan dirinya lewat tabel penghubung (`publikasi_dosen`, `kegiatan_anggota`, `iprs_dosen`, `buku_dosen`). Ini mengikuti `dosen_id`, jadi pengguna harus sudah punya baris `dosen` (sinta_id terisi).
- Data dengan `sumber = sinta` **tidak bisa diubah atau dihapus** lewat CRUD. Data itu hanya diperbarui oleh sinkron (lihat 5.3).

**Status dan validasi (keputusan 2026-11-22).** Data manual **tidak perlu divalidasi** dan tidak ada validator. Hanya `iprs` yang punya kolom `status`:

- IPRS manual: server mengisi `status = Diterima` saat dibuat. Pengguna tidak mengirim atau mengubah status lewat CRUD.
- IPRS hasil crawl: `status` disimpan apa adanya dari SINTA (misalnya `Granted` atau `Diterima`), tidak dipetakan.
- `publikasi`, `kegiatan`, dan `buku` tidak punya status. Kolom `status` lama di `kegiatan` dihapus lewat migrasi Prisma, dan front-end tidak menampilkan status untuk penelitian dan pengabdian.

**Duplikat dan penautan otomatis (keputusan 2026-11-23).** Saat menambah data manual, sistem mengecek kunci anti-dobel (5.3). Hasilnya ada tiga:

- Tidak ada yang cocok: data dibuat dan dibalas `201`.
- Cocok dengan data `sumber = manual` dan pengguna belum tertaut: sistem **otomatis menambah satu baris di tabel penghubung milik pengguna** (`publikasi_dosen` dengan `source = manual`, `iprs_dosen`, `buku_dosen`, atau baris di `kegiatan_anggota`), lalu membalas `200` dengan `ditautkan = true`, `id`, dan judul data itu, supaya front-end menampilkan pesan seperti "Data ini sudah ada dan sudah dihubungkan ke akunmu". Tidak ada tombol dan tidak ada endpoint `tautkan`. Tidak ada baris baru di tabel utama, dan isian form lain (jurnal, kuartil, dan seterusnya) tidak dipakai, jadi isi data yang sudah ada tidak berubah. Untuk `kegiatan`: bila baris `kegiatan_anggota` dengan `nama_normal` pengguna sudah ada tetapi `dosen_id` NULL, isi `dosen_id`-nya. Bila belum ada, tambah baris baru dengan `peran` dari posisi nama pengguna di daftar `tim`. Baris orang lain dan `peran` yang sudah ada tidak diubah.
- Cocok dengan data `sumber = sinta`, atau pengguna sudah tertaut ke data itu: tolak dengan `409` dan pesan yang menegaskan data itu sudah ada. Contoh untuk publikasi: "Paper ini sudah ada di data." Data SINTA tidak ditautkan otomatis, karena tautannya datang dari crawl dosen itu sendiri.

Aturan hapus: bila masih ada dosen lain yang tertaut, hapus hanya melepas tautan pengguna, dan baris data baru terhapus bila tidak ada tautan tersisa. Dengan begitu, tautan yang keliru bisa dilepas lewat hapus. Risiko yang diterima: `kunci` kegiatan (jenis, judul, tahun) bisa bentrok pada judul yang generik, sehingga dua kegiatan berbeda bisa tertaut ke satu baris. Pesan yang menyebut judul data yang ditautkan menjadi penangkalnya.

**Penulis dan peserta (keputusan 2026-11-22).**

- `publikasi.penulis`, `iprs.pemegang`, `iprs.inventor`, dan `buku.penulis` berupa **satu teks bebas**, nama dipisah `;` (misalnya `A; B; C`). Tidak ada pembagian ketua dan anggota, karena SINTA tidak membedakannya untuk data ini. Teks itu tidak diurai dan tidak dicocokkan ke dosen. Format hasil crawl campur (Garuda `;`, Google Scholar koma, IPRS dan buku koma, Scopus satu nama), jadi isinya ditampilkan apa adanya. Kepemilikan ditentukan oleh tabel penghubung, bukan oleh teks ini.
- `kegiatan` berbeda: peserta disimpan per baris di `kegiatan_anggota` dengan `peran` (`ketua` atau `anggota`), karena SINTA memberi pembeda itu. Form memakai **satu kolom `tim`**, nama dipisah `;` (misalnya `Ketua; Anggota 1; Anggota 2`). **Nama pertama menjadi `ketua`, nama kedua dan seterusnya menjadi `anggota`.** Kolom diisi awal dengan nama dosen yang login (dari `dosen.nama`) dan boleh diubah urutannya. Nama dosen yang login harus ada di daftar (dicocokkan dengan `norm_nama`), bila tidak dibalas `400` dengan pesan "Nama kamu harus ada di daftar tim". Nama yang sama dua kali digabung menjadi satu baris (primary key `kegiatan_anggota` adalah `kegiatan_id` dan `nama_normal`), dan posisi paling awal yang dipakai. Tiap nama dinormalisasi dengan fungsi yang sama dengan crawler (`norm_nama`), lalu dicocokkan ke `dosen.nama_normal` hanya bila cocok tepat satu, seperti di 5.3. Pengguna yang belum pernah sinkron (nama di baris `dosen` masih kosong) ditolak sampai sinkron dulu, supaya nama di baris manual sama dengan nama SINTA. `tim` hanya field di body request. Skema `kegiatan_anggota` tidak berubah (satu baris per orang dengan `nama`, `nama_normal`, `peran`, `dosen_id`), jadi hasil isian manual dan hasil crawl tersimpan dalam bentuk yang sama.

**Catatan respons.** Pesan galat memakai kunci `message` (6.7).

**Isian publikasi manual (keputusan 2026-11-23).** `judul`, `tahun`, `penulis` (satu teks, dipisah `;`), `jurnal`, `jenis`, `penerbit`, `doi`, `link`, dan `sitasi` (bawaan 0). `kuartil` dan `akreditasi` **sama-sama opsional dan boleh terisi sekaligus**: dosen mengisi yang berlaku untuk jurnalnya dan mengosongkan sisanya. Nilainya mengikuti nilai hasil crawl. Dua kolom ini hanya informasi dan belum dipakai untuk penilaian, karena rekap penilaian tridarma ditunda (bagian 13).

**Nilai `source` data manual.** Baris `publikasi_dosen` untuk data manual memakai `source = manual`, dan `urutan_penulis`, `total_penulis` dikosongkan. Enum `PublikasiSource` perlu nilai `manual` di migrasi Prisma.

### 5.8 Hak akses di luar pengajaran (ringkasan)

Ringkasan untuk pengecekan cepat, sumber utama tetap 5.6 dan 5.7.

- Lihat: semua peran yang login, dan Umum untuk halaman `/tridharma`.
- Tambah manual: Dosen, Kaprodi, Staff Kaprodi, untuk data milik sendiri. Data manual orang lain yang duplikat otomatis ditautkan ke pengguna (5.7).
- Baca per dosen: data tiap dosen dibaca lewat endpoint daftar (publikasi, kegiatan, IPRS, buku) dengan filter `dosen_id`, melalui tabel penghubung, sehingga data SINTA dan manual muncul bersama. Profil dosen beserta skor dan metrik dibaca lewat endpoint profil. Terbuka untuk semua peran.
- Crawl: sesuai 8.1.
- Tidak ada validasi oleh Kaprodi untuk data modul 7. Validasi Kaprodi hanya ada di modul 4 (arsip).

### 5.9 Endpoint baca data tridarma (keputusan 2026-11-23)

Semua `GET`, terbuka untuk semua peran termasuk Umum tanpa login. Server tidak memilih dosen bawaan.

| Endpoint                           | Keterangan                                                                                                 |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `GET /api/tridarma/dosen`          | Daftar dosen (nama, afiliasi, departemen, `sync_status`, `last_synced_at`), dipakai untuk dropdown filter. |
| `GET /api/tridarma/dosen/[id]`     | Profil satu dosen beserta skor SINTA dan metrik.                                                           |
| `GET /api/tridarma/publikasi`      | Parameter `dosen_id`, `tahun`, `q` (judul), `page`, `pageSize`.                                            |
| `GET /api/tridarma/publikasi/[id]` | Detail satu publikasi.                                                                                     |
| `GET /api/tridarma/kegiatan`       | Parameter sama, ditambah `jenis` (`penelitian` atau `pengabdian`). Respons memuat peserta dengan `peran`.  |
| `GET /api/tridarma/kegiatan/[id]`  | Detail satu kegiatan.                                                                                      |
| `GET /api/tridarma/iprs`           | Parameter sama dengan publikasi. Di tampilan diberi label "HKI".                                           |
| `GET /api/tridarma/iprs/[id]`      | Detail satu IPRS.                                                                                          |
| `GET /api/tridarma/buku`           | Parameter sama dengan publikasi.                                                                           |
| `GET /api/tridarma/buku/[id]`      | Detail satu buku.                                                                                          |

- **ID dosen lewat query `dosen_id`, bukan bagian path.** `/publikasi/[id_dosen]` akan bentrok dengan `/publikasi/[id]` (sama-sama satu segmen dinamis). Filter lain (`tahun`, `q`, `page`) juga lewat query, jadi semua saringan ada di satu tempat.
- Filter `dosen_id` bekerja lewat tabel penghubung (`publikasi_dosen`, `kegiatan_anggota`, `iprs_dosen`, `buku_dosen`), jadi data SINTA dan data manual muncul bersama. Tanpa `dosen_id`, server mengembalikan semua data. Paper yang ditulis dua dosen muncul untuk keduanya (satu baris, dua tautan).
- `kegiatan` satu route dengan `jenis`, karena `penelitian` dan `pengabdian` satu tabel. Tidak ada `/kegiatan/penelitian/...` terpisah. Nama endpoint dan tabel tetap `iprs`, bukan `hki`.
- Setiap item memuat `sumber` dan `bisa_diubah` (benar hanya bila pengguna login, `sumber = manual`, dan item terhubung ke dosen milik pengguna). `iprs` memuat `status`, `kegiatan` tidak.
- Tulis (tambah, ubah, hapus) memakai route koleksi yang sama: `POST /api/tridarma/<jenis>`, `PATCH` dan `DELETE /api/tridarma/<jenis>/[id]` (5.7).
- Pengajaran tidak termasuk di sini (5.4 dan keputusan terbuka 15).

## 6. Modul 4: Arsip Prodi (Ruang Arsip Digital)

Web untuk mengelola arsip surat dan dokumen. Menu: Dashboard, Input Arsip (Staff Kaprodi), Daftar Arsip, Validasi Arsip (Kaprodi), Kategori, Log Aktivitas, Profil Saya, Logout. Halaman Users dihapus dari desain.

### 6.1 Hak akses Modul 4

| Peran         | Dashboard | Daftar Arsip | Kategori | Validasi Arsip | Log Aktivitas | Tulis                                  |
| ------------- | --------- | ------------ | -------- | -------------- | ------------- | -------------------------------------- |
| Staff Kaprodi | ya        | ya           | ya       | tidak          | ya            | tambah, ubah, hapus arsip dan kategori |
| Kaprodi       | ya        | ya           | ya       | ya             | ya            | hanya validasi arsip                   |
| Dosen         | ya        | ya           | tidak    | tidak          | tidak         | tidak ada                              |
| Mahasiswa     | tidak     | tidak        | tidak    | tidak          | tidak         | tidak ada akses ke modul arsip         |

Dosen boleh melihat Dashboard (diputuskan 2026-11-21, bagian 12 nomor 13).

- Kaprodi hanya satu orang.
- Hak tulis dicek di server, bukan hanya disembunyikan di UI.

### 6.2 Kategori

- `kategori`: `kode` unik (contoh KEU, maksimal 5 karakter huruf kapital), `nama`, `retensi_aktif_tahun`, `retensi_inaktif_tahun`, `keterangan`. Tidak ada ikon.
- Form tambah dan edit memakai field yang sama. Edit dilakukan lewat klik baris di front-end.
- Hapus hanya bisa dilakukan kalau kategori tidak dipakai arsip (`ON DELETE RESTRICT`). Bila masih dipakai, API membalas 409.
- Kode hanya huruf A-Z (tanpa angka dan tanda baca). Huruf kecil yang dikirim diubah menjadi kapital, dan keunikan dicek tanpa membedakan huruf besar kecil.
- `retensi_aktif_tahun` dan `retensi_inaktif_tahun` wajib bilangan bulat minimal 1 (maksimal 32767).
- Daftar kategori memuat `jumlah_arsip` per kategori, bisa dicari lewat kode atau nama (tanpa membedakan huruf besar kecil), difilter masa retensi, dan dibagi 6 baris per halaman.
- Data awal: ADM Arsip Administrasi (2/3), HRD Arsip HRD (2/5), KEU Arsip Keuangan (2/8), OPS Arsip Operasional (2/3), PRG Arsip Program (2/3), RND Arsip RnD (3/5), SLS Arsip Sales (2/3), TI Arsip Teknologi Informasi (2/3). Angka dalam kurung adalah retensi aktif/inaktif (tahun).

### 6.3 Arsip

- Berkas **tidak diupload**, hanya disimpan sebagai link (`link_berkas`).
- `arsip`:
  - `nomor_arsip`: wajib, diisi manual, unik.
  - `nomor_surat`: wajib.
  - `judul`, `kategori_id`, `tanggal_arsip` (tanggal saja, tanpa jam), `pencipta_unit`, `keterangan`, `link_berkas`.
  - `pencipta_unit`: diisi otomatis dengan nama akun yang membuat arsip (klaim `name` dari sesi SSO). Nilai yang dikirim klien diabaikan, baik saat tambah maupun ubah.
  - `retensi_aktif_tahun` dan `retensi_inaktif_tahun`: salinan dari kategori saat dibuat, boleh diubah. Bila diisi sendiri, nilainya bilangan bulat 0 sampai 32767 (0 berarti fase itu langsung berakhir di hari arsip).
  - `link_berkas` wajib berupa URL `http://` atau `https://` yang valid.
  - `status_validasi`: Pending, Diterima, atau Ditolak.
  - `catatan_validasi`: wajib diisi saat Ditolak.
  - `dibuat_oleh` (`sub` SSO), `created_at`, `updated_at`.
- **Alur validasi:**
  1. Arsip yang dibuat Staff Kaprodi otomatis berstatus Pending.
  2. Kaprodi menyetujui (Diterima) atau menolak (Ditolak, dengan catatan).
  3. Setiap perubahan isi arsip, termasuk arsip yang Ditolak, mengembalikan status ke Pending dan mengosongkan `catatan_validasi`. Reset ini terjadi pada setiap permintaan ubah yang berhasil, walaupun nilai yang dikirim sama dengan sebelumnya.
- **Halaman Validasi Arsip** terpisah, khusus Kaprodi, dengan tab Pending, Diterima, dan Ditolak.
- **Status retensi** dihitung saat dibaca, tidak disimpan. Ada tiga nilai:
  - Aktif: sebelum habis retensi aktif.
  - Inaktif: sudah habis retensi aktif, belum habis retensi inaktif.
  - Dimusnahkan: sudah habis keduanya.
- **Hapus arsip** hanya bisa dilakukan kalau status retensinya Dimusnahkan. Hapus permanen. Bila belum Dimusnahkan, API membalas 409 dengan menyebut status retensi saat ini.
- **Tanggal** pada JSON (`tanggal_arsip`, `tanggal_habis_aktif`, `tanggal_habis_inaktif`) dikirim sebagai ISO UTC (`YYYY-MM-DDT00:00:00.000Z`). Front-end menampilkan bagian tanggalnya saja. Pengecualian: Dashboard mengirim `tanggal_arsip` langsung sebagai `YYYY-MM-DD`. Status retensi dihitung dengan tanggal UTC, sama dengan `v_arsip`.
- **Daftar dan detail.** Daftar membaca dari view `v_arsip` dan tidak memuat status retensi maupun status validasi. Detail memuat `status_retensi`, `tanggal_habis_aktif`, `tanggal_habis_inaktif`, `status_validasi`, dan `catatan_validasi`.
- **Dashboard** menampilkan total arsip yang status retensinya Aktif, dan lima arsip terbaru. Badge Masuk/Keluar dan field pengirim dihapus.
  - `totalArsip`: jumlah arsip berstatus retensi Aktif (dibaca dari `v_arsip`), tidak terpengaruh pencarian.
  - `aktivitasTerbaru`: arsip diurutkan dari `created_at` terbaru, 5 per halaman. Isinya nomor arsip, judul, kategori (kode dan nama), nomor surat, dan tanggal arsip tanpa jam. Bisa dicari lewat judul, nomor surat, atau nomor arsip, dan memuat `pagination.total` untuk teks "Menampilkan X dari Y".
- **Daftar Arsip**: pencarian (judul, nomor surat, dan nomor arsip, tanpa membedakan huruf besar kecil), filter kategori, filter tahun, reset filter, tombol tambah arsip, dan tabel dengan kolom nomor arsip, judul, kategori, masa retensi (aktif dan inaktif), serta aksi detail dan hapus. Paginasi: bawaan 10 baris, maksimal 50 per halaman.

### 6.4 Log aktivitas

- `log_aktivitas`: `user_id` (`sub` SSO), `user_nama` (salinan nama, supaya log tetap terbaca bila user dihapus di SSO), `modul` (`4`, `7`, atau `auth`), `aksi` (tambah, ubah, hapus, validasi, sinkron, login, login_gagal), `objek` (arsip, kategori, dosen, atau sso), `detail` (teks yang berisi pengenal, misalnya nomor arsip atau judul, serta alasan gagal login), `created_at`.
- Tidak ada `objek_id` dan `ip_address`.
- Yang dicatat: tambah, ubah, hapus, dan validasi arsip; perubahan kategori; sinkron dosen (modul 7); login sukses dan gagal (modul auth).
- Yang boleh melihat: Staff Kaprodi dan Kaprodi. Peran lain mendapat 403. Log hanya bisa dibaca lewat API, tidak bisa ditambah, diubah, atau dihapus dari luar.
- Daftar log (`GET /api/log-aktivitas`) diurutkan dari yang terbaru, 10 per halaman (maksimal 50). Filter: `modul` (`4`, `7`, `auth`), `aksi`, `objek`, serta rentang tanggal `dari` dan `sampai` (format `YYYY-MM-DD`, keduanya inklusif). Batas hari pada filter tanggal memakai WIB, karena `created_at` adalah waktu kejadian. Nilai filter yang tidak dikenal dibalas 400.

### 6.5 Profil Saya

- Data dari sesi SSO, ditambah `sinta_id` dari tabel `dosen` bila role-nya memakainya.
- Mahasiswa tidak punya baris `dosen`, jadi tidak ada `sinta_id`.

### 6.6 Aturan umum

- Modul 4 **tidak punya tabel user**. Data user diambil dari sesi SSO.
- Retensi disalin ke arsip saat dibuat, supaya perubahan kategori tidak mengubah arsip lama.
- Kategori yang masih dipakai arsip tidak bisa dihapus.

### 6.7 Endpoint Modul 4 (kondisi saat ini)

Hak akses dicek dua lapis: di `src/proxy.ts` (per rute dan method) dan di handler (`getArsipPermissions`). `Admin` diperlakukan sama dengan Staff Kaprodi (lihat bagian 4). Kategori berada di `/api/arsip/kategori` dan memakai `PATCH` untuk ubah.

| Method dan path                   | Peran                         | Keterangan                                                                                                                                                             |
| --------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/arsip/kategori`         | Staff Kaprodi, Kaprodi        | Parameter `search`, `retensi`, `page`. Memuat `jumlah_arsip`.                                                                                                          |
| `POST /api/arsip/kategori`        | Staff Kaprodi                 | 201. 409 bila kode sudah dipakai.                                                                                                                                      |
| `PATCH /api/arsip/kategori/[id]`  | Staff Kaprodi                 | Hanya field yang dikirim. 404 bila tidak ada, 409 bila kode dipakai kategori lain.                                                                                     |
| `DELETE /api/arsip/kategori/[id]` | Staff Kaprodi                 | 409 bila masih dipakai arsip.                                                                                                                                          |
| `GET /api/arsip`                  | Staff Kaprodi, Kaprodi, Dosen | Parameter `search`, `kategori` atau `kategoriId`, `tahun`, `page`, `pageSize`.                                                                                         |
| `GET /api/arsip/[id]`             | Staff Kaprodi, Kaprodi, Dosen | Detail dengan status retensi dan validasi.                                                                                                                             |
| `POST /api/arsip`                 | Staff Kaprodi                 | 201. Status Pending, retensi disalin dari kategori bila tidak diisi, `pencipta_unit` dari nama akun. 409 bila nomor arsip sudah dipakai.                               |
| `PATCH /api/arsip/[id]`           | Staff Kaprodi                 | Hanya field yang dikirim. Status kembali ke Pending. 409 bila nomor arsip dipakai arsip lain.                                                                          |
| `DELETE /api/arsip/[id]`          | Staff Kaprodi                 | Hanya bila status retensi Dimusnahkan, selain itu 409.                                                                                                                 |
| `GET /api/dashboard`              | Staff Kaprodi, Kaprodi, Dosen | Parameter `search`, `page`, `pageSize` (bawaan 5). Respons `{ totalArsip, aktivitasTerbaru: { items, pagination } }`.                                                  |
| `GET /api/arsip/validasi`         | Kaprodi                       | Daftar untuk halaman Validasi. Parameter `status` (`Pending`, `Diterima`, `Ditolak`), `search`, `kategori`, `tahun`, `page`, `pageSize`.                               |
| `PATCH /api/arsip/[id]/validasi`  | Kaprodi                       | Body `{ "status_validasi": "Diterima" \| "Ditolak", "catatan_validasi": "..." }`. Catatan wajib saat Ditolak. Arsip yang sudah divalidasi tetap bisa divalidasi ulang. |
| `GET /api/log-aktivitas`          | Staff Kaprodi, Kaprodi        | Parameter `modul`, `aksi`, `objek`, `dari`, `sampai`, `page`, `pageSize`. Lihat 6.4.                                                                                   |

Mahasiswa dan Umum tidak punya akses ke semua rute di atas. Setiap penambahan, perubahan, dan penghapusan tercatat di `log_aktivitas` (`modul = 4`).

**Konvensi respons.** Semua galat JSON memakai satu kunci: `{ "message": "..." }`, termasuk 401 dan 403 dari `proxy.ts`. Respons sukses tulis berbentuk `{ "message": "...", "data": { ... } }`, daftar berbentuk `{ "items": [...], "pagination": { "page", "pageSize", "total", "totalPages" } }`, dan detail berbentuk `{ "data": { ... } }`. Rute baru mengikuti konvensi ini.

## 7. Model data

**Modul 7:** `dosen`, `sinta_skor` (PK dosen_id+label), `sinta_metrik` (PK dosen_id+label; kolom scopus, gscholar, wos), `crawl_log`, `publikasi`, `publikasi_dosen` (PK publikasi_id+dosen_id+source), `kegiatan` (kolom `jenis`: penelitian atau pengabdian, tanpa kolom status), `kegiatan_anggota` (PK kegiatan_id+nama_normal, `dosen_id` boleh NULL), `iprs` (kolom `jenis` dan `status`), `iprs_dosen`, `buku`, `buku_dosen`, `matkul`, `kelas`, `berkas_pengajaran`. Tabel `publikasi`, `kegiatan`, `iprs`, dan `buku` punya kolom `sumber` (`sinta` atau `manual`), sesuai 5.3.

**Modul 4:** `kategori`, `arsip`, `log_aktivitas`, view `v_arsip`.

Aturan relasi: relasi antar tabel dalam database memakai foreign key (cascade untuk tabel penghubung dosen; `kegiatan_anggota.dosen_id` menjadi NULL bila dosen dihapus; `arsip.kategori_id` RESTRICT). Kolom `user_id`, `dibuat_oleh`, dan `log_aktivitas.user_id` bertipe `CHAR(36)` atau UUID **tanpa FK**.

## 8. Layanan crawler (Python)

Layanan FastAPI kecil di `crawler/`, di-deploy sebagai **Render Web Service paket gratis**, dipanggil dari route handler Next.js (di Vercel) lewat HTTP.

Sifat layanan:

- **On-demand.** Tidak ada cron job dan tidak ada monitor uptime eksternal. Sinkron hanya dipicu manual oleh user, dan data SINTA jarang berubah. Ping warm-up di 8.2 bukan monitor: ia hanya dikirim saat user membuka halaman sinkron modul 7.
- Paket gratis Render tidur setelah 15 menit tanpa request masuk, dan bangun sekitar satu menit. Sinkron pertama setelah lama tidak dipakai akan terasa lambat. Ini diterima.
- Kuota gratis Render: 750 jam per bulan per workspace, dibagi untuk semua Web Service gratis di workspace itu. Cek ulang angka ini di dokumentasi Render sebelum deploy.
- Sinkron 8 dosen memakan sekitar 3–6 menit (15–40 detik per dosen). Karena itu crawling berjalan di background, tidak di dalam request.

Alur sinkron:

1. Saat halaman tombol sinkron modul 7 dibuka, frontend memanggil route Next.js `GET /api/crawler/health` yang meneruskan `GET /health` ke layanan Python (lihat 8.2). Tombol dinonaktifkan dan muncul indikator "Server sedang bersiap..." sampai layanan membalas `200 OK`.
2. User menekan tombol. Route handler Next.js memeriksa sesi dan hak (8.1), lalu menerapkan aturan 7 hari dengan pengecualian FAILED/PARTIAL (5.3). Dosen yang masih dalam 7 hari dan statusnya `SUCCESS` dilewati.
3. Route handler mengubah status secara atomik: `updateMany` dengan kondisi `sync_status != IN_PROGRESS`. Bila tidak ada baris berubah, tolak dengan pesan "sedang berjalan".
4. Route handler memanggil `POST {CRAWLER_URL}/sync` dengan body `{ "sinta_id": "..." }` (kosong untuk semua dosen yang lolos aturan 7 hari) dan header `X-Internal-Key`, lalu membalas `202 Accepted` tanpa menunggu.
5. Layanan Python menjalankan crawl di background dan **menulis langsung ke database** memakai logika upsert. Progres dan status akhir disimpan di database, bukan di memori, supaya tetap terbaca walau layanan restart. Status akhir `SUCCESS`, `PARTIAL`, atau `FAILED`.
6. Frontend memeriksa `sync_status` lewat route Next.js secara berkala (misalnya tiap 5–10 detik) sampai status tidak lagi `IN_PROGRESS`. Polling ini juga membuat layanan tetap terjaga selama sinkron berjalan.

Aturan:

- Crawling **tidak boleh dijalankan di dalam request**.
- Layanan Python **tidak boleh publik**. Wajib header rahasia `X-Internal-Key` (nilai di `INTERNAL_KEY`).
- Browser **tidak boleh memanggil layanan Python langsung**. Semua lewat route Next.js, supaya `INTERNAL_KEY` tidak pernah sampai ke klien.
- Hanya satu crawl berjalan pada satu waktu. Permintaan lain yang masuk saat crawl berjalan, baik untuk satu dosen maupun semua dosen dan dari peran apa pun, **ditolak dengan pesan "sedang berjalan" dan tidak diantrekan** (keputusan 2026-11-22, lihat 12 nomor 9–10).
- Crawl hanya menulis dan memperbarui baris `sumber = sinta`. Baris `sumber = manual` tidak pernah diubah atau dihapus oleh crawl (5.3, 5.7).
- Sisa `IN_PROGRESS` yang sudah lama ditandai `FAILED` saat layanan menyala. Jangan dijalankan di setiap request.
- Layanan Python hanya meng-UPDATE baris `dosen` yang sudah ada (dibuat oleh Next.js saat dosen atau staff kaprodi mengisi `sinta_id`). Ia tidak membuat baris `dosen`.
- Layanan Python memakai `DATABASE_URL` berupa URL pooled.
- Setiap sinkron dicatat di `log_aktivitas` dengan `modul = 7`, termasuk pemicu, `sinta_id` (atau semua dosen), dan status akhir.

Endpoint layanan: `GET /health`, `POST /sync`.

Variabel lingkungan:

- Next.js (Vercel): `CRAWLER_URL` (alamat layanan Render), `INTERNAL_KEY`. Keduanya harus diisi juga di environment Vercel.
- Layanan Python (Render): `INTERNAL_KEY` (nilai sama dengan Next.js), `DATABASE_URL` (URL langsung), `PORT` (diisi Render).
- Nilai rahasia dibuat sendiri dan tidak pernah ditulis di repo atau di chat. File `.env` wajib di-gitignore.

### 8.1 Hak menjalankan crawling

| Peran         | Semua dosen | Satu dosen (pilih) | Diri sendiri                      |
| ------------- | ----------- | ------------------ | --------------------------------- |
| Staff Kaprodi | ya          | ya                 | ya, bila sudah mengisi `sinta_id` |
| Kaprodi       | tidak       | tidak              | ya, bila sudah mengisi `sinta_id` |
| Dosen         | tidak       | tidak              | ya, bila sudah mengisi `sinta_id` |
| Mahasiswa     | tidak       | tidak              | tidak (tidak punya baris `dosen`) |
| Umum          | tidak       | tidak              | tidak (tanpa login)               |

- Pemeriksaan hak dilakukan di Next.js (route handler), sebelum memanggil layanan Python. Layanan Python hanya memeriksa `X-Internal-Key`.
- Route Next.js: `POST /api/dosen/sinkron` untuk diri sendiri (`sinta_id` diambil dari baris dosen yang user_id-nya sama dengan sub sesi), dan `POST /api/staff-kaprodi/sinkron` untuk Staff Kaprodi (body berisi `sinta_id` opsional; kosong berarti semua dosen).
- Route `POST /api/dosen/sinkron` menolak bila baris `dosen` belum ada, dengan pesan untuk mengisi `sinta_id` dulu.
- Aturan 7 hari berlaku untuk semua peran, termasuk Staff Kaprodi. Staff Kaprodi tidak bisa memaksa sinkron sebelum 7 hari, kecuali untuk dosen yang status terakhirnya FAILED atau PARTIAL.
- Hanya satu crawl berjalan dalam satu waktu. Permintaan kedua ditolak dengan pesan "sedang berjalan", tidak diantrekan.

### 8.2 Ping warm-up dan catatan untuk front-end (keputusan 2026-11-22)

**Ping warm-up:**

- Dikirim hanya saat halaman tombol sinkron modul 7 dibuka. Tidak dikirim di halaman modul 4 atau halaman modul 7 lainnya.
- Browser memanggil route Next.js `GET /api/crawler/health`. Route itu, dari server, meneruskan `GET /health` ke Render. Browser tidak pernah memanggil Render langsung.
- Ping dikirim di background. Halaman tidak menunggu hasilnya untuk tampil.
- Ping bukan jaminan. Kalau user menekan tombol sebelum Render bangun, route sinkron tetap bisa lambat atau gagal. Karena itu tombol harus menunggu status siap (lihat di bawah).

**Teks dan status tombol sinkron:**

- Selama `/health` belum membalas `200 OK`: tampilkan teks **"Server sedang bersiap..."** dan tombol sinkron dalam keadaan nonaktif.
- Setelah `/health` membalas `200 OK`: hilangkan teks tersebut dan aktifkan tombol.
- Usulan: bila `/health` belum `200 OK` setelah 60 detik, tampilkan "Server belum merespons, coba lagi sebentar" dan tombol tetap nonaktif. Belum diputuskan tim.

**Setelah tombol ditekan:**

- Respons `202 Accepted`: mulai polling status (tiap 5–10 detik). Tampilkan indikator sedang berjalan.
- Respons `409` dengan pesan "sedang berjalan": tampilkan pesan itu apa adanya. Jangan diubah menjadi pesan lain.
- Setelah status tidak lagi `IN_PROGRESS`: tampilkan hasil `SUCCESS`, `PARTIAL`, atau `FAILED`, lalu aktifkan kembali tombol.

**Informasi per dosen:**

- Dosen dengan `sinkron` terakhir berstatus `SUCCESS` dan belum 7 hari: tampilkan tanggal sinkron terakhir dan keterangan bahwa sinkron bisa dilakukan lagi setelah 7 hari.
- Dosen dengan status terakhir `FAILED` atau `PARTIAL`: tombol tetap aktif tanpa menunggu 7 hari.

**Tampilan menurut peran (8.1, 5.6, dan 5.7):**

- Peran tanpa hak crawl (Mahasiswa, Umum, Kaprodi untuk dosen lain): tombol crawl tidak ditampilkan. Pemeriksaan tetap di server.
- Dosen, Kaprodi, dan Staff Kaprodi yang belum mengisi `sinta_id`: tombol crawl "diri sendiri" tidak ditampilkan, dan diganti pesan "isi sinta_id dulu" dengan tautan ke pengisian `sinta_id`.
- Staff Kaprodi: tombol "sinkron semua" dan "pilih dosen" tampil walaupun dirinya belum mengisi `sinta_id`.
- Umum (tanpa login): hanya bisa melihat data. Tombol tambah, ubah, hapus tidak ditampilkan, dan tombol login yang muncul. Bila tombol tambah, ubah, hapus tetap diklik, arahkan ke login.
- Mahasiswa: hanya bisa melihat data, tanpa tombol tambah, ubah, hapus, atau crawl.
- Setiap data tridarma menampilkan label sumbernya (SINTA atau manual). Tombol ubah dan hapus hanya tampil untuk data `manual` milik sendiri (5.7).
- Default tampilan (5.9): dosen, Kaprodi, atau Staff Kaprodi yang sudah punya `dosen_id` di sesi membuka tab tridarma dengan `dosen_id` miliknya sendiri. Dosen lain dilihat lewat dropdown filter, yang mengganti `dosen_id`. Peran tanpa `dosen_id` (Umum, Mahasiswa, atau yang belum mengisi `sinta_id`) memanggil tanpa filter atau memilih dosen dulu. Server tidak menentukan default ini.
- Form tambah data manual menampilkan pesan 409 duplikat apa adanya, termasuk pesan "sudah ada di data". Bila respons `200` memuat `ditautkan = true`, tampilkan pesan bahwa data itu sudah ada dan sudah dihubungkan ke akun pengguna, lengkap dengan judulnya. Tidak ada tombol tambahan.
- Bagian pengajaran (5.4): Kaprodi dan Staff Kaprodi hanya melihat `kelas` dan `berkas_pengajaran`, jadi tombol tambah, ubah, hapus di bagian itu tidak ditampilkan untuk mereka. Mahasiswa dan Umum tidak melihat bagian ini sama sekali.

## 9. Porting MariaDB ke Postgres (Neon) dan Prisma

**Kode Python (`sinta_to_db.py` menjadi `loader.py`):**

| MariaDB                                   | Postgres                                                           |
| ----------------------------------------- | ------------------------------------------------------------------ |
| `pymysql`, `DictCursor`                   | `psycopg` v3, `dict_row`                                           |
| `INSERT ... ON DUPLICATE KEY UPDATE`      | `INSERT ... ON CONFLICT (kolom_unik) DO UPDATE SET k = EXCLUDED.k` |
| `INSERT IGNORE`                           | `INSERT ... ON CONFLICT DO NOTHING`                                |
| `VALUES(kolom)` di dalam update           | `EXCLUDED.kolom`                                                   |
| `IF(a, b, c)`                             | `CASE WHEN a THEN b ELSE c END`                                    |
| `NOW() - INTERVAL %s DAY`                 | `NOW() - (%s * INTERVAL '1 day')`                                  |
| `UPDATE ... JOIN` (di `backfill_anggota`) | `UPDATE ... SET ... FROM ... WHERE ...`                            |
| Backtick                                  | Tanda kutip ganda atau tanpa pembungkus                            |
| `DB_CONFIG` dengan `root` tanpa password  | `DATABASE_URL` dari environment, `sslmode=require`                 |
| `main()` dan argparse                     | fungsi `sync_dosen(sinta_id)` untuk FastAPI                        |

Placeholder `%s`, `COALESCE`, `GREATEST`, `NULLIF`, `CONCAT_WS` tetap bisa dipakai. Uji penulisan nilai string ke kolom enum Postgres.

**Skema Prisma:**

- Kolom `publikasi.sumber` (tipe SET) **dihapus**. Nilainya dihitung dari `publikasi_dosen.source` saat dibaca. Fungsi `sinkron_sumber` di Python ikut dihapus. Catatan: ini beda dengan kolom `sumber` (`sinta` atau `manual`) yang baru di 5.3. Kolom baru itu adalah asal baris, bukan asal sumber per paper.
- `kegiatan.updated_at`: Prisma `@updatedAt` hanya bekerja dari sisi Prisma. Dari Python, isi `updated_at = NOW()` secara eksplisit.
- Tipe: `tinyint` menjadi `SmallInt`, `datetime` menjadi `DateTime`, `enum` menjadi `enum` Prisma, `user_id` menjadi `String` (atau `@db.Uuid`).
- Pakai `@@map` dan `@map` agar nama tabel dan kolom di database tetap `snake_case`, karena SQL di Python memakai nama itu.
- Migrasi memakai URL koneksi langsung (non-pooled); aplikasi memakai URL pooled. Variabel: `DATABASE_URL` dan `DIRECT_URL`.
- **Prisma adalah satu-satunya pemilik skema.** Setiap perubahan skema harus diikuti pengecekan SQL di `crawler/`.

## 10. Struktur folder (usulan)

```
sacibiru-modul/
├─ prisma/
│  ├─ schema.prisma
│  └─ migrations/
├─ src/
│  ├─ app/
│  │  ├─ login/page.tsx               (gerbang login SSO & dev-login lokal)
│  │  ├─ akses-ditolak/page.tsx       (halaman 403 RBAC)
│  │  ├─ tridharma/page.tsx           (baca publik tanpa login)
│  │  ├─ arsip/page.tsx
│  │  ├─ sso/
│  │  │  ├─ login/route.ts
│  │  │  └─ logout/route.ts
│  │  ├─ auth/
│  │  │  ├─ callback/route.ts
│  │  │  └─ refresh/route.ts
│  │  └─ api/
│  │     ├─ me/route.ts               (data sesi aktif, 401 bila belum login)
│  │     ├─ dashboard/route.ts        (GET dashboard arsip)
│  │     ├─ dev-login/route.ts        (khusus development, nonaktif di production)
│  │     ├─ crawler/health/route.ts   (ping warm-up ke Render, hanya dipanggil dari halaman sinkron)
│  │     ├─ dosen/sinta-id/route.ts
│  │     ├─ dosen/sinkron/route.ts
│  │     ├─ dosen/sinkron/status/route.ts
│  │     ├─ staff-kaprodi/sinkron/route.ts
│  │     ├─ log-aktivitas/route.ts    (GET daftar log, Staff Kaprodi dan Kaprodi)
│  │     ├─ arsip/
│  │     │  ├─ route.ts               (GET daftar, POST tambah)
│  │     │  ├─ [id]/route.ts          (GET detail, PATCH ubah, DELETE hapus)
│  │     │  ├─ [id]/validasi/route.ts (PATCH validasi oleh Kaprodi)
│  │     │  ├─ kategori/
│  │     │  │  ├─ route.ts            (GET daftar, POST tambah)
│  │     │  │  └─ [id]/route.ts       (PATCH ubah, DELETE hapus)
│  │     │  └─ validasi/route.ts      (GET daftar untuk halaman Validasi)
│  │     └─ tridarma/
│  │        ├─ dosen/...              (GET daftar dan profil, 5.9)
│  │        ├─ publikasi/...          (GET daftar dan detail 5.9; CRUD manual milik sendiri dan penautan otomatis 5.7)
│  │        ├─ kegiatan/...           (GET daftar dan detail 5.9; CRUD manual milik sendiri dan penautan otomatis 5.7)
│  │        ├─ iprs/...               (GET daftar dan detail 5.9; CRUD manual milik sendiri dan penautan otomatis 5.7)
│  │        ├─ buku/...               (GET daftar dan detail 5.9; CRUD manual milik sendiri dan penautan otomatis 5.7)
│  │        └─ pengajaran/...         (matkul CRUD untuk Kaprodi dan Staff Kaprodi; kelas dan berkas read-only untuk Kaprodi dan Staff Kaprodi, CRUD milik sendiri untuk Dosen)
│  ├─ lib/
│  │  ├─ db.ts
│  │  ├─ session.ts
│  │  ├─ sso.ts
│  │  ├─ auth-log.ts              (pintasan catatLog untuk login)
│  │  ├─ log-aktivitas.ts         (helper catatLog)
│  │  ├─ log-aktivitas-daftar.ts  (filter dan query daftar log)
│  │  ├─ dosen-sesi.ts            (cariDosenIdSesi untuk login dan refresh)
│  │  ├─ retensi.ts               (hitungRetensi: logika murni status retensi)
│  │  ├─ arsip.ts                 (validasi dan query arsip)
│  │  ├─ kategori.ts              (validasi dan query kategori)
│  │  ├─ dashboard.ts             (query dashboard arsip)
│  │  ├─ rbac.ts
│  │  └─ crawler-client.ts
│  └─ proxy.ts                        (Next.js 16 Proxy: refresh sesi & RBAC rute)
├─ crawler/
│  ├─ app/
│  │  ├─ main.py
│  │  ├─ sinta.py
│  │  ├─ loader.py
│  │  └─ config.py
│  ├─ tests/
│  │  └─ test_norm_nama.py        (unittest)
│  ├─ requirements.txt
│  ├─ Dockerfile
│  └─ .env.example
├─ tests/                         (Vitest, di luar src/, struktur meniru src/)
│  ├─ helpers/fixtures.ts
│  ├─ lib/                        (retensi, log-aktivitas, log-aktivitas-daftar, kategori, arsip, arsip-validasi, dashboard, dosen-sesi, rbac-arsip)
│  ├─ api/                        (kategori, arsip, dashboard, log-aktivitas: handler dengan database tiruan)
│  └─ proxy.test.ts               (penyegaran sesi dan dosen_id)
├─ vitest.config.ts
├─ .env.example
└─ package.json
```

Di `crawler/app/`, `loader.py` mengimpor `sinta.py` dengan `import sinta`. Nama file dan impor harus sama.

**Batas kerja back-end di repo bersama:** pemilik back-end memegang `prisma/`, `src/app/api/**`, `src/app/sso/**`, `src/app/auth/**`, `src/lib/**`, `src/proxy.ts`, dan `crawler/`. File UI dan komponen milik front-end, jangan diedit tanpa diminta.

## 11. Masalah yang sudah diketahui di kode crawler yang ada

Temuan dari tinjauan `sinta.py` dan `sinta_to_db.py` (kode ini sudah terbukti hasilnya baik di JSON):

1. Jeda antar tab sudah ditetapkan 1,5 detik (12 nomor 8). Temuan ini ditutup.
2. `parse_profile_overview`: angka seperti `1.234` diperlakukan sebagai desimal. Bila SINTA memakai titik sebagai pemisah ribuan, skor akan keliru. Cek dengan HTML asli.
3. `simpan_kegiatan` memanggil `muat_peta_dosen` untuk setiap baris, yaitu satu query tambahan per kegiatan. Pindahkan ke luar loop.
4. Untuk ID yang tidak ada (404), `fetch` mengembalikan `None` dan pesannya menjadi "Gagal menghubungi SINTA". Retry sekitar 12 detik tidak perlu untuk 404.
5. `norm_nama` membuang semua teks setelah koma pertama. Nama berformat "Nama, Nama" bisa terpotong.

## 12. Keputusan terbuka (tanyakan ke pemilik proyek)

Nomor disimpan tetap supaya referensi di bagian lain tetap benar. Yang sudah diputuskan ditandai.

1. _(Sudah diputuskan: pengisian `sinta_id` untuk Staff Kaprodi opsional. Lihat 5.1.)_
2. _(Sudah diputuskan 2026-11-22: `kelas` per kelas, yaitu mata kuliah + dosen + tahun ajaran + semester. Lihat 5.4.)_
3. _(Sudah diputuskan 2026-11-22: hak crawl semua dosen dan satu dosen hanya untuk Staff Kaprodi. Kaprodi tidak punya hak ini. Lihat 8.1.)_
4. _(Sudah diputuskan 2026-11-22: hak akses Modul 7 per peran. Lihat 5.6 dan 8.1. Persetujuan `ACC dosen lain` dihapus, karena Kaprodi tidak perlu melakukan ACC dosen lain.)_
5. _(Sudah diputuskan: nomor arsip diisi manual dan wajib. Lihat 6.3.)_
6. _(Sudah diputuskan: status retensi Aktif, Inaktif, dan Dimusnahkan. Lihat 6.3.)_
7. _(Sudah diputuskan 2026-11-22: Next.js di Vercel, layanan crawler di Render. Lihat 2 dan 8.)_
8. _(Sudah diputuskan 2026-11-22: jeda crawling 1,5 detik per tab. Lihat 5.3.)_
9. _(Sudah diputuskan 2026-11-22: saat crawl sedang berjalan, permintaan crawl satu dosen ditolak dengan pesan "sedang berjalan", tidak diantrekan. Lihat 8.)_
10. _(Sudah diputuskan 2026-11-22: dosen memicu crawl dirinya saat Staff Kaprodi sedang sinkron semua, permintaan ditolak dengan pesan "sedang berjalan", tidak diantrekan. Lihat 8.)_
11. _(Sudah diputuskan 2026-11-22: dosen dengan status terakhir `FAILED` atau `PARTIAL` boleh disinkron ulang sebelum 7 hari. Dosen dengan status `SUCCESS` mengikuti aturan 7 hari. Lihat 5.3.)_
12. **Pencabutan sesi.** Karena sesi disimpan di cookie, akun yang dicabut admin SSO baru terasa saat refresh berikutnya gagal. Diterima untuk skala tugas ini. Perlu persetujuan tim.
13. _(Sudah diputuskan 2026-11-21: Dosen boleh melihat Dashboard. Lihat 6.1.)_
14. _(Sebagian sudah diputuskan 2026-11-22: CRUD data manual untuk publikasi, kegiatan, IPRS, dan buku oleh Dosen, Kaprodi, dan Staff Kaprodi, untuk data milik sendiri. Duplikat ditolak. Lihat 5.7. Untuk pengajaran sudah diputuskan di 5.4.)_
15. **Dosen melihat kelas dan berkas milik dosen lain.** Apakah Dosen boleh melihat `kelas` dan `berkas_pengajaran` dari dosen lain, atau hanya miliknya sendiri? Ditunda, akan dibahas nanti.
16. _(Sudah diputuskan 2026-11-22: data manual yang kemudian ditemukan crawl digabung menjadi satu baris dan `sumber` menjadi `sinta`. Lihat 5.3.)_
17. _(Sudah diputuskan 2026-11-22: status IPRS hasil crawl disimpan apa adanya dari SINTA, IPRS manual diisi `Diterima`. Lihat 5.3 dan 5.7.)_
18. _(Sudah diputuskan 2026-11-22: `publikasi_dosen.source` untuk data manual bernilai `manual`. Lihat 5.7.)_

## 13. Di luar cakupan

- Server SSO dan tabel user SSO.
- Upload file (semua berkas berupa link).
- Login SINTA dengan akun dosen.
- Rekap penilaian tridarma TS, TS-1, TS-2, dan tabel "Publikasi Ilmiah Hasil Penelitian DTPS" 10 jenis. **Ditunda (2026-11-22), belum masuk cakupan modul ini.** Jangan dibangun dan jangan dimasukkan ke skema sampai dibuka lagi.
- Grafik profil SINTA (fase berikutnya, lihat 5.5).
- Front-end dan UI, kecuali catatan untuk front-end di 8.2.
- SerpAPI / Google Scholar lewat API (tidak dipakai lagi).
- Cron job dan monitor uptime untuk layanan crawler.
- Tabel sesi di database. Sesi disimpan di cookie terenkripsi.
- Halaman Users.
- Upload berkas dan edit massal arsip.

## 14. Urutan pengerjaan (usulan)

1. `schema.prisma` dari ERD versi 6 dan migrasi ke Neon, termasuk semua perubahan skema modul 7 dalam satu migrasi (hapus `kegiatan.status`, kolom `sumber` di tabel data tridarma, nilai `manual` di enum `PublikasiSource`).
2. Sisi klien SSO: `/sso/login`, `/auth/callback`, sesi, refresh, logout.
3. Alur login pertama dan pengisian `sinta_id`.
4. `loader.py` versi Postgres dan layanan FastAPI (`/health`, `/sync`), termasuk pengecekan 7 hari dengan pengecualian FAILED/PARTIAL, penolakan permintaan saat crawl berjalan, dan pembersihan `IN_PROGRESS` yang tertinggal. Lalu route Next.js `POST /api/dosen/sinkron`, `POST /api/staff-kaprodi/sinkron`, route status, dan route ping `GET /api/crawler/health`.
5. API Modul 4 (kategori, arsip termasuk edit dan validasi, `v_arsip`, log aktivitas).
6. API Modul 7 (tridarma, CRUD manual dengan cek duplikat 5.7, lalu pengajaran dengan aturan 5.4).
7. Tinjauan keamanan sisi SSO, lalu tes untuk logika murni (normalisasi nama, hash, status retensi, upsert, aturan 7 hari, cek duplikat CRUD manual).

**Status Modul 4 (2026-11-21).** Sudah ada beserta tes: perubahan skema dan `v_arsip`, `hitungRetensi`, helper log aktivitas, API kategori, API arsip, dashboard, validasi arsip oleh Kaprodi, dan endpoint daftar log aktivitas (6.7). Belum ada: profil saya. Perintah tes: `npm test` (Vitest) dan `python -m unittest discover -s crawler/tests` (Python, dengan dependensi crawler terpasang, misalnya lewat `crawler/.venv`).
