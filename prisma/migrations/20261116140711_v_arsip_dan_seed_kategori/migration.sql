CREATE VIEW "v_arsip" AS
SELECT
  a.*,
  k.kode AS kategori_kode,
  k.nama AS kategori_nama,
  (a.tanggal_arsip + make_interval(years => a.retensi_aktif_tahun))::date AS tanggal_habis_aktif,
  (a.tanggal_arsip + make_interval(years => a.retensi_aktif_tahun + a.retensi_inaktif_tahun))::date AS tanggal_habis_inaktif,
  CASE
    WHEN CURRENT_DATE < (a.tanggal_arsip + make_interval(years => a.retensi_aktif_tahun))::date THEN 'Aktif'
    WHEN CURRENT_DATE < (a.tanggal_arsip + make_interval(years => a.retensi_aktif_tahun + a.retensi_inaktif_tahun))::date THEN 'Inaktif'
    ELSE 'Habis Retensi'
  END AS status
FROM "arsip" a
JOIN "kategori" k ON k.id = a.kategori_id;

INSERT INTO "kategori" ("kode", "nama", "retensi_aktif_tahun", "retensi_inaktif_tahun") VALUES
  ('ADM', 'Arsip Administrasi', 2, 3),
  ('HRD', 'Arsip HRD', 2, 5),
  ('KEU', 'Arsip Keuangan', 2, 8),
  ('OPS', 'Arsip Operasional', 2, 3),
  ('PRG', 'Arsip Program', 2, 3),
  ('RND', 'Arsip RnD', 3, 5),
  ('SLS', 'Arsip Sales', 2, 3),
  ('TI', 'Arsip Teknologi Informasi', 2, 3)
ON CONFLICT ("kode") DO NOTHING;
