# Design System — Sistem Informasi RPL (KVV 5A)

Sumber: halaman **Design System** di file Figma "Sistem Informasi RPL - KVV 5A".
Dokumen ini dirangkum dari frame Guidelines, Headings, Body, Index, plus Color styles dan Variables di file tersebut.

> Tanda **[?]** = nilainya tidak terbaca di Figma (hanya berupa alias variable atau tidak ditampilkan). Cek langsung di Figma sebelum dipakai di kode.

---

## 1. Brand Colors

| Nama         | Peran                        | Hex       | Variable                        |
| ------------ | ---------------------------- | --------- | ------------------------------- |
| Vibrant Blue | Primary                      | `#0101B7` | `color/primary` → `brand/blue`  |
| Dreamy       | Secondary                    | `#8DCCF1` | `color/secondary` → `brand/sky` |
| WarmY        | Accent                       | `#FFD166` | `color/accent` → `brand/amber`  |
| Alice        | Neutral / background halaman | `#F2F7FF` | `color/bg/page` → `brand/alice` |

### Gradient / Card styles

- **Card Mitra Kampus**: linear gradient biru tua (Vibrant Blue) ke biru-ungu yang lebih terang. Stop persisnya **[?]**.
- **Card Tawaran Dosen**: warna kuning (keluarga WarmY). Detail fill **[?]**.

## 2. Semantic Color Tokens (collection `Color`, mode Light)

| Token                  | Alias ke              | Hex       |
| ---------------------- | --------------------- | --------- |
| `color/primary`        | `brand/blue`          | `#0101B7` |
| `color/secondary`      | `brand/sky`           | `#8DCCF1` |
| `color/accent`         | `brand/amber`         | `#FFD166` |
| `color/bg/page`        | `brand/alice`         | `#F2F7FF` |
| `color/bg/surface`     | `neutral/white`       | `#FFFFFF` |
| `color/text/primary`   | `neutral/ink`         | `#0B2A4C` |
| `color/text/muted`     | `neutral/muted`       | `#7D8590` |
| `color/text/inverse`   | `neutral/white`       | `#FFFFFF` |
| `color/border/default` | `neutral/line`        | `#D6E0F0` |
| `color/border/strong`  | `neutral/line-strong` | `#C9D3E6` |
| `color/tint/primary`   | `tint/blue`           | `#E3E8FF` |
| `color/tint/secondary` | `tint/sky`            | `#E3F3FC` |
| `color/tint/accent`    | `tint/amber`          | `#FFF3D6` |
| `color/tint/neutral`   | `neutral/gray-tint`   | `#EEF1F6` |
| `color/success/bg`     | `tint/green`          | `#DDF5E6` |
| `color/success/text`   | `ink/green`           | `#1B7F4B` |
| `color/warning/bg`     | (nilai langsung)      | `#FFF0D3` |
| `color/warning/text`   | `ink/amber`           | `#8A5A00` |
| `color/danger/bg`      | `tint/red`            | `#FDE1E1` |
| `color/danger/solid`   | `status/red`          | `#B3261E` |

Aturan pakai:

- Teks heading dan body memakai `color/text/primary` (navy gelap), **bukan** Vibrant Blue.
- Vibrant Blue dipakai untuk header section, aksi utama, dan card Mitra Kampus.
- Tint dipakai untuk latar badge/chip ringan; status memakai pasangan `bg` + `text`.

## 3. Typography

### Heading — Lexend (Google Fonts)

| Style     | Weight   | Size  | Line height |
| --------- | -------- | ----- | ----------- |
| Heading 1 | Bold     | 56 px | 61.6 px     |
| Heading 2 | Bold     | 48 px | 52.8 px     |
| Heading 3 | Bold     | 40 px | 44 px       |
| Heading 4 | Bold     | 32 px | 35.2 px     |
| Heading 5 | Bold     | 24 px | 26.4 px     |
| Heading 6 | SemiBold | 20 px | 22 px       |

- Line height = 110% dari font size. Letter spacing 0%.
- Warna: `color/text/primary`.

### Body — Plus Jakarta Sans (Google Fonts)

| Style       | Size  | Varian weight          |
| ----------- | ----- | ---------------------- |
| Large Text  | 24 px | Medium, Regular, Light |
| Normal Text | 16 px | Medium, Regular, Light |
| Small Text  | 13 px | Medium, Regular, Light |

- Mapping weight yang masuk akal: Medium = 500, Regular = 400, Light = 300.
- Line height body **[?]** (tidak ditampilkan di guideline).

## 4. Spacing (collection `Spacing & Radius`)

| Token        | Nilai |
| ------------ | ----- |
| `spacing/xs` | 4 px  |
| `spacing/sm` | 8 px  |
| `spacing/md` | 12 px |
| `spacing/lg` | 16 px |
| `spacing/xl` | 20 px |

## 5. Radius

| Token         | Nilai                     |
| ------------- | ------------------------- |
| `radius/sm`   | 12 px                     |
| `radius/md`   | 14 px                     |
| `radius/lg`   | 18 px                     |
| `radius/xl`   | 24 px                     |
| `radius/full` | 999 px (pill / lingkaran) |

## 6. Elevation & Layout (dari tampilan guideline)

- Card swatch/produk: sudut membulat besar, latar putih, shadow lembut menyebar ke bawah.
- Header section guideline: blok Vibrant Blue dengan teks putih (Lexend Bold) dan sudut kanan-bawah membulat besar.
- Frame guideline berukuran 1152 × 700 px.

## 7. Cakupan guideline (Index di Figma)

| No  | Section          | Status di page ini                           |
| --- | ---------------- | -------------------------------------------- |
| 01  | Logo             | Belum ada                                    |
| 02  | Colors           | Ada                                          |
| 03  | Typography       | Ada                                          |
| 04  | Grid System      | Belum ada                                    |
| 05  | Spacing          | Belum ada di page (token ada di Variables)   |
| 06  | Component System | Belum ada (kemungkinan di page _Components_) |
| 07  | Visual Elements  | Belum ada                                    |

## 8. Catatan implementasi

- Font: muat **Lexend** (heading) dan **Plus Jakarta Sans** (body) dari Google Fonts.
- Gunakan token semantik (`color/text/primary`, `color/bg/page`, dst.), jangan hardcode hex brand di komponen.
- Layer `Jangan D Unhide` di file ini sengaja disembunyikan, jadi tidak dibaca.
