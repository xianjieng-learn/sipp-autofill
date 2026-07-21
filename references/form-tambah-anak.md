# SIPP Input Data Anak Form - HTML Reference

## Form Details
- Form ID: `frm_user`
- Action: `http://25.24.23.7/SIPP/addAnakPihak/validateInput`
- Method: POST
- This form loads in a separate popup via `popup_form()`

## Fields

| Tag | ID | Name | Type | Label | Notes |
|-----|-----|------|------|-------|-------|
| INPUT | `anak_ke` | `anak_ke` | text (maxlength=3, width=50px) | Anak ke* | Numbers only, oninput strips non-numeric |
| INPUT | `nama` | `nama` | text (maxlength=255, width=250px) | Nama* | Required |
| INPUT | `nik` | `nik` | text (maxlength=255, width=200px) | NIK | Numbers only, optional |
| INPUT | `tempat_lahir` | `tempat_lahir` | text (maxlength=255) | Tempat Lahir* | Required |
| INPUT | `tgl_lahir` | `tgl_lahir` | text (datepicker, maxlength=10) | Tanggal Lahir* | format dd/mm/yy, placeholder="tgl/bln/tahun" |
| SELECT | `jenis_kelamin` | `jenis_kelamin` | custom-dropdown (width=250px) | Jenis Kelamin* | Options: 0=--pilih--, 1=Laki-laki, 2=Perempuan |
| SELECT | `pendidikan` | `pendidikan` | custom-dropdown | Pendidikan* | Options: Tidak Ada, TK, SD, SLTP, SLTA, D1-D4, S1-S3 |
| SELECT | `diasuh_oleh` | `diasuh_oleh` | custom-dropdown | Diasuh oleh* | Options: Penggugat/Pemohon, Tergugat/Termohon, Orang tua P atau T, lain-lain |

## Hidden Fields
| ID | Name | Purpose |
|----|------|---------|
| `enc` | `enc` | Encryption token (auto-generated) |
| `enc_id` | `enc_id` | Encryption ID (empty for new entry) |
| `act` | `act` | Action token (auto-generated) |

## Buttons
- `Kembali` — Close popup
- `Simpan` — Submit form

## Key Notes
- Form loads in a **separate popup** (not the main page)
- `tgl_lahir` uses jQuery datepicker (class `datepicker`), format `dd/mm/yy`
- Dropdowns use `custom-dropdown` styled selects (not native)
- `jenis_kelamin` values are numeric (0/1/2), NOT text
- `anak_ke` strips non-numeric characters on input
- `diasuh_oleh` is the field name (NOT `pengasuhan`)
- Form action URL includes the encrypted perkara ID
