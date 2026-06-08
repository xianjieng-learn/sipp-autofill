# AGENTS.md — SIPP AutoFill Chrome Extension

## What This Is
Chrome extension (Manifest V3) that auto-fills SIPP forms (Pengadilan Agama Jakarta Timur) from JSON data produced by PTSP Helper.

**Target site:** `http://25.24.23.7/SIPP/` (internal court network)

## Architecture
- `manifest.json` — Extension config, permissions, content script registration
- `popup.html` / `popup.js` — Extension popup UI + main fill logic
- `content.js` — Content script (isolated world) for form detection and child form filling
- `popup.js` contains `fillSippMainWorld()` which is injected into the page's MAIN world via `chrome.scripting.executeScript` so it can access jQuery, CKEditor, and datepicker globals

## Data Flow
1. User extracts legal document via PTSP Helper (Streamlit app)
2. PTSP Helper outputs JSON via "Copy JSON (SIPP AutoFill)" button
3. User pastes JSON into extension popup → clicks Parse → clicks Fill
4. Extension injects `fillSippMainWorld(data)` into the SIPP page

## Key Functions in popup.js
- `normalizeData(data)` — Normalizes PTSP Helper JSON into internal format
- `fillSippMainWorld(data)` — MAIN world function injected into SIPP page
  - Fills: Posita (CKEditor), Petitum (CKEditor), Obyek Sengketa, Marriage Info, Tanggal Surat, Children
  - Uses `isDataAnakForm` check to skip main form fields when Data Anak popup is open
- `setVal(el, value)` — Sets input value + triggers jQuery datepicker + events
  - Parses DD/MM/YYYY into Date object for datepicker compatibility
- `setSelect(sel, value)` — Sets dropdown value with fuzzy matching

## SIPP Form Structure
- Main form: `#frm_data_umum` (inside popup)
- Data Anak: separate popup loaded via `popup_form()`
- Posita: `<textarea id="posita">` wrapped by CKEditor (`#cke_posita`)
- Petitum: `<textarea id="petitum">` wrapped by CKEditor (`#cke_petitum`)
- Obyek Sengketa: `<textarea id="obyek_gugatan">` (plain textarea)
- Tanggal Surat: `<input id="tgl_surat" class="datepicker hasDatepicker">` — jQuery datepicker, format `dd/mm/yy`
- KUA: Select2 dropdown `#ref_kua` — may need AJAX fetch via `/SIPP/kua/cari`

## Critical Pitfalls
1. **CKEditor fields** — Cannot set value via DOM. Must use `CKEDITOR.instances[name].setData(html)` + sync to hidden textarea
2. **jQuery datepicker** — `setDate` expects Date object, not string. Parse DD/MM/YYYY → `new Date(y, m-1, d)` first
3. **Data Anak popup** — Loads into same DOM but hidden. `isDataAnakForm` must check VISIBILITY (getComputedStyle), not just element existence
4. **KUA Select2** — SIPP only preloads saved KUA options. For new KUA, must fetch via AJAX `/SIPP/kua/cari`, append option, then trigger change. The `fillKua()` function uses a 3-tier strategy:
   - **Tier 1**: Match from existing `<option>` elements
   - **Tier 2**: Open Select2 dropdown, type in search input, poll for AJAX results (up to 3s)
   - **Tier 3**: Direct fetch to `/SIPP/kua/cari?term=...` + jQuery Select2 `dataAdapter.query()` as last resort
5. **Extension reload** — After code changes, user must click Reload in `chrome://extensions`

## JSON Format (from PTSP Helper)
```json
{
  "children": [{"anak_ke": 1, "nama": "...", "tempat_lahir": "...", "tanggal_lahir": "DD/MM/YYYY", "jenis_kelamin": "...", "pendidikan": "...", "pengasuhan": "..."}],
  "posita": "HTML or plain text",
  "petitum": "HTML or plain text",
  "obyek_sengketa": "-",
  "marriage_info": {"tanggal_menikah": "DD/MM/YYYY", "tanggal_dicatat": "DD/MM/YYYY", "nomor_akta_nikah": "...", "kua_dicatat": "..."},
  "tanggal_surat": "DD/MM/YYYY"
}
```
