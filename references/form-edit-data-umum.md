# SIPP Edit Data Umum Form - HTML Reference

## Form Details
- Form ID: `frm_data_umum`
- Action: `http://25.24.23.7/SIPP/manageDataUmum/validateInput`
- Method: POST (multipart/form-data)

## Fields

| Tag | ID | Name | Type/Class | Label | Notes |
|-----|-----|------|------------|-------|-------|
| SELECT | `aktif` | `aktif` | custom-dropdown | Pihak Dipublikasikan | Options: Ya/Tidak |
| SELECT | `klasifikasi` | `klasifikasi` | custom-dropdown | Klasifikasi Perkara | 36 options (Cerai Gugat, Cerai Talak, etc.) |
| INPUT | `tgl_surat` | `tgl_surat` | text / datepicker hasDatepicker | Tanggal Surat | format dd/mm/yy, maxlength=10 |
| INPUT | `no_surat` | `no_surat` | text / standard-input | Nomor Surat | maxlength=50 |
| INPUT | `tgl_nikah` | `tgl_nikah` | text / datepicker hasDatepicker | Tanggal Menikah | format dd/mm/yy, maxlength=10, class=cerai |
| INPUT | `tgl_kutipan_akta_nikah` | `tgl_kutipan_akta_nikah` | text / datepicker hasDatepicker | Tgl. Kutipan Akta Nikah | format dd/mm/yy, maxlength=10, class=cerai |
| INPUT | `no_kutipan_akta_nikah` | `no_kutipan_akta_nikah` | text / standard-input | No. Kutipan Akta Nikah | maxlength=50, class=cerai |
| SELECT | `ref_kua` | `ref_kua` | Select2 (hidden native select) | KUA Tempat Menikah | AJAX fetch via /SIPP/kua/cari, class=cerai |
| TEXTAREA | `obyek_gugatan` | `obyek_gugatan` | plain textarea | Obyek Sengketa Gugatan | No CKEditor |
| TEXTAREA | `posita` | `posita` | hidden (CKEditor #cke_posita) | Posita | Use CKEDITOR.instances.posita.setData() |
| TEXTAREA | `petitum` | `petitum` | hidden (CKEditor #cke_petitum) | Petitum | Use CKEDITOR.instances.petitum.setData() |
| INPUT | `nomor_perkara` | `nomor_perkara` | hidden | Nomor Perkara | Auto-filled |
| INPUT | `enc` | `enc` | hidden | Encryption token | Auto-filled |
| INPUT | `curr_date` | `curr_date` | hidden | Current date | Auto-filled |
| INPUT | `tglPendaftaran` | `tglPendaftaran` | hidden | Tanggal Pendaftaran | Auto-filled |

## Key Notes
- `tgl_surat`, `tgl_nikah`, `tgl_kutipan_akta_nikah` use jQuery datepicker (class `hasDatepicker`), format `dd/mm/yy`
- `posita` and `petitum` are hidden textareas wrapped by CKEditor instances
- `ref_kua` is a Select2 dropdown (native select is hidden, Select2 UI rendered)
- `obyek_gugatan` is a plain textarea (no CKEditor)
- Marriage fields (`tgl_nikah`, `tgl_kutipan_akta_nikah`, `no_kutipan_akta_nikah`, `ref_kua`) are in `<tr class="cerai">` — only visible for divorce cases
- Buttons: `close_form_dataumum` (Kembali) and `simpan` (Simpan/Submit)
