# SIPP AutoFill - Chrome Extension

Auto-fill form SIPP (Data Anak, Posita, Petitum) dari hasil ekstraksi PTSP Helper.

## Fitur

- **Auto-fill Data Anak**: Nama, Tempat Lahir, Tanggal Lahir, Jenis Kelamin, Pendidikan, Diasuh oleh
- **Auto-infer Anak ke**: Otomatis mendeteksi urutan anak dari data yang sudah ada
- **Auto-fill Posita**: Isi otomatis kolom Posita
- **Auto-fill Petitum**: Isi otomatis kolom Petitum
- **Auto-fill Obyek Sengketa**: Selalu isi "-" (sesuai standar PTSP)

## Cara Install

1. Buka Chrome, ketik `chrome://extensions` di address bar
2. Aktifkan **Developer mode** (toggle di pojok kanan atas)
3. Klik **Load unpacked**
4. Pilih folder `sipp-autofill` ini
5. Extension akan muncul di toolbar Chrome

## Cara Pakai

1. Upload dokumen gugatan ke **PTSP Helper**
2. Klik tombol **"Copy JSON"** di PTSP Helper
3. Buka halaman SIPP di eCourt
4. Klik icon extension di toolbar Chrome
5. Klik **"📋 Paste"** untuk paste data dari clipboard
6. Klik **"⚡ Fill Semua ke SIPP"** untuk mengisi form

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
