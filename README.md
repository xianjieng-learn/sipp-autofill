# SIPP AutoFill - Chrome Extension

Auto-fill form SIPP (Data Anak, Posita, Petitum) dari hasil ekstraksi PTSP Helper.

## Fitur

- **Auto-fill Data Anak**: Nama, Tempat Lahir, Tanggal Lahir, Jenis Kelamin, Pendidikan, Diasuh oleh
- **Auto-infer Anak ke**: Otomatis mendeteksi urutan anak dari data yang sudah ada
- **Auto-fill Posita**: Isi otomatis kolom Posita
- **Auto-fill Petitum**: Isi otomatis kolom Petitum
- **Auto-fill Obyek Sengketa**: Selalu isi "-" (sesuai standar PTSP)
- **Data Umum bersyarat**: Isbat Nikah, Poligami, Pembatalan Kawin, Penguasaan Anak, Pengesahan Anak, Asal Usul Anak, Dispensasi Kawin, Wakaf, dan Perkara Kumulasi
- **Data Calon Mempelai Dispensasi Kawin**: Isi calon pria dan wanita pada form `Input Calon Mempelai` (identitas, pendidikan, pekerjaan, penghasilan, dan penanda yang dimohonkan DisKa)

## Cara Install

### 1. Clone Repository

```bash
git clone https://github.com/xianjieng-learn/sipp-autofill.git
cd sipp-autofill
```

Atau download ZIP dari GitHub: https://github.com/xianjieng-learn/sipp-autofill/archive/refs/heads/main.zip

### 2. Install ke Chrome

1. Buka Chrome, ketik `chrome://extensions` di address bar
2. Aktifkan **Developer mode** (toggle di pojok kanan atas)
3. Klik **Load unpacked**
4. Pilih folder `sipp-autofill` ini
5. Extension akan muncul di toolbar Chrome

### 3. Pin Extension (Optional)

Klik icon puzzle piece (🧩) di toolbar Chrome → cari "SIPP AutoFill" → klik pin (📌) supaya selalu terlihat.

## Cara Pakai

### Step 1: Export dari PTSP Helper

1. Buka **PTSP Helper** (Streamlit Cloud atau local)
2. Upload dokumen gugatan/permohonan
3. Tunggu proses ekstraksi selesai
4. Klik tab **"Posita & Petitum"**
5. Scroll ke bawah, klik tombol **"📋 Copy JSON (SIPP AutoFill)"**
6. Data akan ter-copy ke clipboard

### Step 2: Fill ke SIPP

1. Buka halaman **SIPP** di eCourt
2. Buka form yang mau di-fill (misal: "Tambah Anak")
3. Klik icon **SIPP AutoFill** di toolbar Chrome
4. Klik tombol **"📋 Paste"** — data akan ter-parse otomatis
5. Kalau ada beberapa anak, pilih anak yang mau di-fill
6. Klik tombol **"⚡ Fill Semua ke SIPP"**
7. **Verify** field yang terisi, lalu klik **Simpan**
8. Ulangi untuk anak berikutnya (kalau ada)

## Data yang Di-fill

| Field SIPP | Source dari PTSP Helper |
|-----------|------------------------|
| Anak ke | Auto-infer dari urutan |
| Nama Anak | `nama` |
| Tempat Lahir | `tempat_lahir` |
| Tanggal Lahir | `tanggal_lahir` |
| Jenis Kelamin | `jenis_kelamin` |
| Pendidikan | `pendidikan` |
| Diasuh oleh | `pengasuhan` |
| Posita | `posita` |
| Petitum | `petitum` |
| Obyek Sengketa | Selalu "-" |

### Data Umum Bersyarat

Pilih dulu klasifikasi perkaranya di SIPP, kemudian payload berikut dapat diisi dari JSON. Field yang tidak relevan atau sedang tersembunyi tidak disentuh.

```json
{
  "isbat_info": {
    "alasan_isbat": "4",
    "tanggal_menikah": "26/03/2020",
    "tempat_menikah": "wilayah hukum KUA Kecamatan Duren Sawit"
  },
  "case_details": {
    "alasan_kuasa_anak": "2",
    "alasan_poligami": "1",
    "penghasilan_poligami": "5000000",
    "batal_kawin": "4",
    "alasan_sah_anak": "1",
    "alasan_asalusul": "1",
    "alasan_dispen": "4",
    "objek_wakaf": ["1", "5"],
    "perkara_kumulasi": ["352"]
  }
}
```

Semua tanggal input SIPP, termasuk Isbat Nikah, wajib format **DD/MM/YYYY**.

## Troubleshooting

- **Form tidak terisi**: Pastikan halaman SIPP sedang terbuka dan form visible
- **Field tidak ditemukan**: Coba refresh halaman SIPP
- **JSON tidak valid**: Pastikan paste dari tombol "Copy JSON" di PTSP Helper

## Development

Extension ini menggunakan Chrome Extension Manifest V3.

### Struktur File

```
sipp-autofill/
├── manifest.json      # Konfigurasi extension
├── content.js         # Script yang di-inject ke halaman SIPP
├── popup.html         # UI popup extension
├── popup.js           # Logic popup
└── icons/             # Icon extension
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```
