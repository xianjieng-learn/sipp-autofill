/**
 * SIPP AutoFill - Popup Script
 * Handles SIPP form filling from PTSP Helper data.
 */

const jsonInput = document.getElementById('jsonInput');
const btnPaste = document.getElementById('btnPaste');
const btnParse = document.getElementById('btnParse');
const btnFillAll = document.getElementById('btnFillAll');
const statusEl = document.getElementById('status');
const previewEl = document.getElementById('preview');
const childrenList = document.getElementById('childrenList');

let parsedData = null;
let selectedChild = null;

// ─── Status helpers ───
function showStatus(msg, type = 'info') {
  statusEl.textContent = msg;
  statusEl.className = `status show ${type}`;
}

function hideStatus() {
  statusEl.className = 'status';
}

// ─── Parse JSON ───
function parseJSON() {
  const raw = jsonInput.value.trim();
  if (!raw) {
    showStatus('⚠️ Belum ada data. Paste JSON dari PTSP Helper dulu.', 'error');
    return;
  }

  try {
    const data = JSON.parse(raw);
    parsedData = normalizeData(data);
    
    // Show preview
    renderPreview(parsedData);
    btnFillAll.disabled = false;
    
    // Show children list if multiple children
    if (parsedData.children && parsedData.children.length > 0) {
      showStatus(`✅ Terdeteksi ${parsedData.children.length} anak. Siap di-fill.`, 'success');
      renderChildren(parsedData.children);
    } else {
      showStatus(`✅ Data siap di-fill ke SIPP.`, 'success');
    }
  } catch (e) {
    showStatus(`❌ JSON tidak valid: ${e.message}`, 'error');
  }
}

// ─── Normalize data from PTSP Helper ───
function normalizeData(data) {
  const result = {
    children: [],
    posita: '',
    petitum: '',
    obyek_sengketa: '-',
    marriage_info: {},
    tanggal_surat: '',
  };

  // Handle children array
  if (data.children && Array.isArray(data.children)) {
    result.children = data.children.map(normalizeChild);
  }

  // Handle posita
  if (data.posita) {
    result.posita = data.posita;
  }

  // Handle petitum
  if (data.petitum) {
    result.petitum = data.petitum;
  }

  // Handle obyek sengketa
  if (data.obyek_sengketa) {
    result.obyek_sengketa = data.obyek_sengketa;
  }

  // Handle tanggal surat
  if (data.tanggal_surat) {
    result.tanggal_surat = data.tanggal_surat;
  }

  // Handle marriage info — nested object from PTSP Helper
  if (data.marriage_info && typeof data.marriage_info === 'object') {
    result.marriage_info = {
      tanggal_menikah: data.marriage_info.tanggal_menikah || '',
      tanggal_dicatat: data.marriage_info.tanggal_dicatat || '',
      nomor_akta_nikah: data.marriage_info.nomor_akta_nikah || '',
      kua_dicatat: data.marriage_info.kua_dicatat || '',
    };
  } else if (data.tanggal_menikah || data.tanggal_dicatat || data.nomor_akta_nikah || data.kua_dicatat) {
    // Fallback: top-level fields (old format)
    result.marriage_info = {
      tanggal_menikah: data.tanggal_menikah || '',
      tanggal_dicatat: data.tanggal_dicatat || '',
      nomor_akta_nikah: data.nomor_akta_nikah || '',
      kua_dicatat: data.kua_dicatat || '',
    };
  }

  return result;
}

function normalizeChild(c) {
  // Sanitize tempat_lahir / tanggal_lahir — sometimes extraction swaps them
  let tempat = c.tempat_lahir || c.tempatLahir || '';
  let tanggal = c.tanggal_lahir || c.tanggalLahir || '';

  // If tanggal looks like a city name (no digits) and tempat looks like a date, swap
  const tanggalIsDate = /\d/.test(tanggal);
  const tempatIsDate = /\d/.test(tempat);
  if (!tanggalIsDate && tempatIsDate) {
    [tempat, tanggal] = [tanggal, tempat];
  }

  return {
    anak_ke: c.anak_ke || c.index || null,
    nama: c.nama || c.name || '',
    nik: c.nik || '',
    tempat_lahir: tempat,
    tanggal_lahir: tanggal,
    jenis_kelamin: c.jenis_kelamin || c.jk || '',
    pendidikan: c.pendidikan || '',
    pengasuhan: c.pengasuhan || '',
    _raw: c,
  };
}

// ─── Render children list ───
function renderChildren(children) {
  childrenList.innerHTML = '';
  childrenList.style.display = 'block';

  children.forEach((c, i) => {
    const btn = document.createElement('button');
    btn.className = 'child-btn';
    btn.innerHTML = `
      <span class="child-name">${c.nama || 'Anak ' + (i + 1)}</span>
      <span class="child-badge">Anak ke-${c.anak_ke || i + 1}</span>
    `;
    btn.onclick = () => {
      selectedChild = c;
      document.querySelectorAll('.child-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    };
    childrenList.appendChild(btn);
  });

  // Auto-select first child
  if (children.length > 0) {
    selectedChild = children[0];
    childrenList.children[0].classList.add('selected');
  }
}

// ─── Render preview ───
function renderPreview(data) {
  let html = `
    <div class="preview-header">
      <span>📋 Preview Data SIPP</span>
    </div>
  `;

  // Children section
  if (data.children && data.children.length > 0) {
    html += `
      <div class="preview-section">
        <div class="preview-section-title">👶 Data Anak (${data.children.length})</div>
    `;
    
    data.children.forEach((c, i) => {
      html += `
        <div class="preview-field">
          <span class="preview-label">Anak ${i + 1}</span>
          <span class="preview-value">${c.nama || 'Tanpa Nama'}</span>
        </div>
      `;
      if (c.tempat_lahir && c.tanggal_lahir) {
        html += `
          <div class="preview-field">
            <span class="preview-label">Lahir</span>
            <span class="preview-value">${c.tempat_lahir}, ${c.tanggal_lahir}</span>
          </div>
        `;
      }
      if (c.nik) {
        html += `
          <div class="preview-field">
            <span class="preview-label">NIK</span>
            <span class="preview-value">${c.nik}</span>
          </div>
        `;
      }
    });
    
    html += `</div>`;
  }

  // Posita section
  if (data.posita) {
    html += `
      <div class="preview-section">
        <div class="preview-section-title">📝 Posita</div>
        <div class="preview-field">
          <span class="preview-label">Panjang</span>
          <span class="preview-value">${data.posita.length} karakter</span>
        </div>
      </div>
    `;
  }

  // Petitum section
  if (data.petitum) {
    html += `
      <div class="preview-section">
        <div class="preview-section-title">📋 Petitum</div>
        <div class="preview-field">
          <span class="preview-label">Panjang</span>
          <span class="preview-value">${data.petitum.length} karakter</span>
        </div>
      </div>
    `;
  }

  // Marriage info section
  if (data.marriage_info && Object.values(data.marriage_info).some(v => v)) {
    html += `
      <div class="preview-section">
        <div class="preview-section-title">💍 Info Pernikahan</div>
    `;
    
    const fields = [
      ['Tanggal Menikah', data.marriage_info.tanggal_menikah],
      ['Tanggal Dicatat', data.marriage_info.tanggal_dicatat],
      ['No. Akta Nikah', data.marriage_info.nomor_akta_nikah],
      ['KUA Dicatat', data.marriage_info.kua_dicatat],
    ];
    
    fields.forEach(([label, value]) => {
      if (value) {
        html += `
          <div class="preview-field">
            <span class="preview-label">${label}</span>
            <span class="preview-value" title="${value}">${value}</span>
          </div>
        `;
      }
    });
    
    html += `</div>`;
  }

  previewEl.innerHTML = html;
  previewEl.className = 'preview show';
}

// ─── Fill all SIPP fields ───
async function fillAllSipp() {
  if (!parsedData) {
    showStatus('⚠️ Parse data dulu sebelum fill.', 'error');
    return;
  }

  btnFillAll.disabled = true;
  btnFillAll.textContent = '⏳ Filling...';
  showStatus('⏳ Mengisi form SIPP...', 'info');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    const sippHosts = ['ecourt.mahkamahagung.go.id', '25.24.23.7'];
    const isSippPage = sippHosts.some(host => tab.url.includes(host));
    if (!tab || !isSippPage) {
      showStatus('❌ Buka halaman SIPP di eCourt dulu!', 'error');
      btnFillAll.disabled = false;
      btnFillAll.textContent = '⚡ Fill Semua ke SIPP';
      return;
    }

    // Always inject into MAIN world for fill — content script (isolated world) can't access CKEDITOR
    showStatus('⏳ Mengisi form SIPP...', 'info');
    try {
      // Data Anak lives in a separate SIPP popup that can save only ONE child at a time.
      // If a child card is selected in the extension, send only that child so we don't
      // loop through all children and overwrite the same Data Anak form.
      const dataForFill = selectedChild
        ? { ...parsedData, children: [selectedChild] }
        : parsedData;

      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: 'MAIN',
        func: fillSippMainWorld,
        args: [dataForFill],
      });
      const response = results?.[0]?.result || { success: false, error: 'No result from injection' };
      renderFillResult(response);
    } catch (injectErr) {
      console.error('[SIPP Extension] executeScript failed:', injectErr);
      showStatus(`❌ Gagal inject: ${injectErr.message}. Coba refresh halaman SIPP.`, 'error');
    }
  } catch (e) {
    showStatus(`❌ Error: ${e.message}. Coba refresh halaman SIPP.`, 'error');
  }

  btnFillAll.disabled = false;
  btnFillAll.textContent = '⚡ Fill Semua ke SIPP';
}

// ─── Render fill results with details ───
function renderFillResult(response) {
  if (!response) {
    showStatus('❌ Tidak ada response dari halaman SIPP', 'error');
    return;
  }

  const filledCount = response.filledFields || 0;
  const errors = response.errors || [];
  
  if (filledCount > 0 && errors.length === 0) {
    // All success
    showStatus(`✅ Berhasil mengisi ${filledCount} field! Semua OK.`, 'success');
  } else if (filledCount > 0 && errors.length > 0) {
    // Partial success
    showStatus(`⚠️ ${filledCount} field berhasil, ${errors.length} gagal. Lihat detail di bawah.`, 'info');
    renderErrorDetails(errors);
  } else if (errors.length > 0) {
    // All failed
    showStatus(`❌ Semua field gagal diisi. Lihat detail di bawah.`, 'error');
    renderErrorDetails(errors);
  } else {
    showStatus(`⚠️ ${response?.error || 'Gagal mengisi form SIPP'}`, 'error');
  }
}

// ─── Render error details ───
function renderErrorDetails(errors) {
  // Remove existing error details
  const existing = document.getElementById('errorDetails');
  if (existing) existing.remove();
  
  const div = document.createElement('div');
  div.id = 'errorDetails';
  div.style.cssText = 'margin-top: 8px; padding: 8px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; font-size: 10px; max-height: 150px; overflow-y: auto;';
  
  let html = '<div style="font-weight: 600; margin-bottom: 4px; color: #856404;">⚠️ Field yang gagal:</div>';
  
  errors.forEach(err => {
    html += `<div style="padding: 2px 0; color: #856404; border-bottom: 1px solid #ffeeba;">• ${err}</div>`;
  });
  
  html += '<div style="margin-top: 6px; font-size: 9px; color: #856404;">💡 Tips: Pastikan form SIPP sedang terbuka dan field ada di halaman.</div>';
  
  div.innerHTML = html;
  
  // Insert after status element
  statusEl.parentNode.insertBefore(div, statusEl.nextSibling);
}

// ─── Event listeners ───
btnPaste.addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    jsonInput.value = text;
    showStatus('📋 Berhasil paste dari clipboard.', 'info');
    parseJSON();
  } catch (e) {
    showStatus('❌ Gagal akses clipboard. Paste manual (Ctrl+V).', 'error');
  }
});

btnParse.addEventListener('click', parseJSON);
btnFillAll.addEventListener('click', fillAllSipp);

// Auto-parse if there's content
if (jsonInput.value.trim()) {
  parseJSON();
}

// ─── MAIN World Fill Function ───
// This function is injected into the page's MAIN world via chrome.scripting.executeScript
// so it can access CKEDITOR, jQuery, and other page-level variables.
async function fillSippMainWorld(data) {
  console.log('[SIPP MAIN] Function called. Data keys:', Object.keys(data));
  console.log('[SIPP MAIN] marriage_info:', data.marriage_info);
  console.log('[SIPP MAIN] tanggal_surat:', data.tanggal_surat);
  const result = { filledFields: 0, errors: [] };
  const isDataAnakForm = !!document.querySelector('form[action*="addAnakPihak"], #frm_user #anak_ke, #frm_user #tgl_lahir');
  console.log('[SIPP MAIN] isDataAnakForm:', isDataAnakForm);

  // Convert plain text posita/petitum to HTML for CKEditor
  function textToHtml(text) {
    if (!text) return '';
    // Already has HTML tags? Wrap each block in justify paragraph
    if (/<[a-z][\s\S]*>/i.test(text)) {
      // Add text-align:justify to existing <p> tags
      return text.replace(/<p(\s[^>]*)?>/gi, '<p$1 style="text-align:justify">')
                 .replace(/<li(\s[^>]*)?>/gi, '<li$1 style="text-align:justify">');
    }
    // Convert plain text with numbered list to HTML
    const lines = text.split(/\r?\n/);
    let html = '';
    let inOl = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        if (inOl) { html += '</ol>'; inOl = false; }
        html += '<p style="text-align:justify">&nbsp;</p>';
        continue;
      }
      // Numbered item: "1." "2." etc.
      const numMatch = trimmed.match(/^(\d+)[.)]\s*(.+)/);
      if (numMatch) {
        if (!inOl) { html += '<ol>'; inOl = true; }
        html += `<li style="text-align:justify">${numMatch[2]}</li>`;
      } else {
        if (inOl) { html += '</ol>'; inOl = false; }
        html += `<p style="text-align:justify">${trimmed}</p>`;
      }
    }
    if (inOl) html += '</ol>';
    return html;
  }

  function setVal(el, value) {
    if (!el) return false;
    // Set value directly on DOM element
    el.value = value;
    // Also try native setter for React/framework compatibility
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (setter && setter !== Object.getOwnPropertyDescriptor(el.__proto__, 'value')?.set) {
      try { setter.call(el, value); } catch(e) {}
    }
    // Trigger jQuery datepicker if present
    if (typeof jQuery !== 'undefined') {
      try {
        const $el = jQuery(el);
        if ($el.hasClass('hasDatepicker') || $el.data('datepicker')) {
          $el.datepicker('setDate', value);
        }
        $el.val(value).trigger('input').trigger('change');
      } catch(e) {}
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function setSelect(sel, value) {
    if (!sel || value === undefined || value === null || value === '') return false;
    const normalize = (s) => String(s || '')
      .toLowerCase()
      .replace(/[._-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const compact = (s) => normalize(s).replace(/\s+/g, '');
    const v = normalize(value);
    const fieldKey = normalize(`${sel.id || ''} ${sel.name || ''}`);
    const isDiasuh = fieldKey.includes('diasuh');
    const isJenisKelamin = fieldKey.includes('jenis kelamin') || fieldKey.includes('jeniskelamin');

    // Shorthand mapping for common SIPP/PTSP Helper values.
    // Map to the exact-ish option text, then match by option text.
    const shorthandMap = {
      // pendidikan
      'sd': 'sekolah dasar',
      's d': 'sekolah dasar',
      'smp': 'sekolah lanjutan tingkat pertama',
      'sltp': 'sekolah lanjutan tingkat pertama',
      'mts': 'sekolah lanjutan tingkat pertama',
      'sma': 'sekolah lanjutan tingkat atas',
      'smk': 'sekolah lanjutan tingkat atas',
      'ma': 'sekolah lanjutan tingkat atas',
      'slta': 'sekolah lanjutan tingkat atas',
      's1': 'strata i',
      'strata 1': 'strata i',
      's2': 'strata ii',
      'strata 2': 'strata ii',
      's3': 'strata iii',
      'strata 3': 'strata iii',
      'd1': 'diploma i',
      'd2': 'diploma ii',
      'd3': 'diploma iii',
      'd4': 'diploma iv',
      'tk': 'taman kanak-kanak',
      'paud': 'taman kanak-kanak',
      'tidak ada': 'tidak ada',
      'tidak sekolah': 'tidak ada',
      'belum sekolah': 'tidak ada',
      'belum tamat': 'tidak ada',
      // diasuh oleh
      'penggugat': 'penggugat/pemohon',
      'pemohon': 'penggugat/pemohon',
      'tergugat': 'tergugat/termohon',
      'termohon': 'tergugat/termohon',
      'orang tua': 'orang tua p atau t',
      'orang tua p/t': 'orang tua p atau t',
      'orang tua p atau t': 'orang tua p atau t',
      'lain lain': 'lain-lain',
      'lainnya': 'lain-lain',
      // jenis kelamin
      'laki laki': 'laki-laki',
      'laki-laki': 'laki-laki',
      'perempuan': 'perempuan',
    };
    if (isDiasuh) {
      if (v === 'p') shorthandMap[v] = 'penggugat/pemohon';
      if (v === 't') shorthandMap[v] = 'tergugat/termohon';
    }
    if (isJenisKelamin) {
      if (v === 'l' || v === 'lk') shorthandMap[v] = 'laki-laki';
      if (v === 'p' || v === 'pr') shorthandMap[v] = 'perempuan';
    }
    const expanded = shorthandMap[v] || v;

    const options = Array.from(sel.options || []);
    let opt = options.find(o => String(o.value) === String(value));

    // Text match against expanded value first.
    if (!opt) {
      opt = options.find(o => {
        const t = normalize(o.text);
        return t === expanded || t.includes(expanded) || expanded.includes(t);
      });
    }

    // Text match against original value.
    if (!opt) {
      opt = options.find(o => {
        const t = normalize(o.text);
        return t === v || t.includes(v) || v.includes(t);
      });
    }

    // Compact fallback: "Laki laki" vs "Laki-laki", "Kedung Tuban" vs "Kedungtuban".
    if (!opt) {
      const wantCompact = compact(expanded);
      const rawCompact = compact(value);
      opt = options.find(o => {
        const tCompact = compact(o.text);
        return tCompact === wantCompact || tCompact.includes(wantCompact) || wantCompact.includes(tCompact)
          || tCompact === rawCompact || tCompact.includes(rawCompact) || rawCompact.includes(tCompact);
      });
    }

    if (!opt) return false;
    if (typeof jQuery !== 'undefined' && jQuery(sel).data('select2')) {
      jQuery(sel).val(opt.value).trigger('change').trigger('select2:select');
    } else {
      sel.value = opt.value;
      sel.dispatchEvent(new Event('input', { bubbles: true }));
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return true;
  }

  // Fill Posita (CKEditor) — skip while the separate Data Anak popup is open.
  if (!isDataAnakForm && data.posita) {
    let filled = false;
    // Try up to 3 times with delay (CKEditor might not be initialized yet)
    for (let attempt = 0; attempt < 3 && !filled; attempt++) {
      if (typeof CKEDITOR !== 'undefined' && CKEDITOR.instances && CKEDITOR.instances['posita']) {
        try {
          const html = textToHtml(data.posita);
          CKEDITOR.instances['posita'].setData(html);
          // Force justify on all paragraphs via CKEditor command
          try {
            const body = CKEDITOR.instances['posita'].editable();
            if (body) {
              body.$.querySelectorAll('p,li').forEach(el => {
                el.style.textAlign = 'justify';
              });
            }
          } catch(je) {}
          const ta = document.getElementById('posita');
          if (ta) ta.value = html;
          result.filledFields++;
          filled = true;
        } catch(e) { result.errors.push('Posita: ' + e.message); filled = true; }
      } else {
        // Wait 300ms for CKEditor to initialize
        await new Promise(r => setTimeout(r, 300));
      }
    }
    if (!filled) result.errors.push('Posita: CKEditor tidak ditemukan');
  }

  // Fill Petitum (CKEditor) — skip while the separate Data Anak popup is open.
  if (!isDataAnakForm && data.petitum) {
    let filled = false;
    for (let attempt = 0; attempt < 3 && !filled; attempt++) {
      if (typeof CKEDITOR !== 'undefined' && CKEDITOR.instances && CKEDITOR.instances['petitum']) {
        try {
          const html = textToHtml(data.petitum);
          CKEDITOR.instances['petitum'].setData(html);
          // Force justify on all paragraphs via CKEditor command
          try {
            const body = CKEDITOR.instances['petitum'].editable();
            if (body) {
              body.$.querySelectorAll('p,li').forEach(el => {
                el.style.textAlign = 'justify';
              });
            }
          } catch(je) {}
          const ta = document.getElementById('petitum');
          if (ta) ta.value = html;
          result.filledFields++;
          filled = true;
        } catch(e) { result.errors.push('Petitum: ' + e.message); filled = true; }
      } else {
        await new Promise(r => setTimeout(r, 300));
      }
    }
    if (!filled) result.errors.push('Petitum: CKEditor tidak ditemukan');
  }

  // Fill Obyek Sengketa (plain textarea) — skip while the separate Data Anak popup is open.
  if (!isDataAnakForm && data.obyek_sengketa) {
    const ta = document.getElementById('obyek_gugatan');
    if (ta) { setVal(ta, data.obyek_sengketa); result.filledFields++; }
    else result.errors.push('Obyek Sengketa: tidak ditemukan');
  }

  // Fill marriage info fields (Edit Data Umum form) — skip while the separate Data Anak popup is open.
  if (!isDataAnakForm && data.marriage_info) {
    const mi = data.marriage_info;
    const marriageFields = [
      ['tgl_nikah', mi.tanggal_menikah],
      ['tgl_kutipan_akta_nikah', mi.tanggal_dicatat],
      ['no_kutipan_akta_nikah', mi.nomor_akta_nikah],
    ];
    for (const [id, val] of marriageFields) {
      if (!val) continue;
      const el = document.getElementById(id);
      if (el) {
        setVal(el, val);
        result.filledFields++;
      }
    }

    // KUA dropdown — try Select2 first, fallback to vanilla JS
    if (mi.kua_dicatat) {
      let found = false;
      // Strategy 1: jQuery/Select2 (if available)
      if (typeof jQuery !== 'undefined') {
        try {
          const $kua = jQuery('#ref_kua');
          if ($kua.length) {
            const v = mi.kua_dicatat.toLowerCase().replace(/\s+/g, '');
            $kua.find('option').each(function() {
              const t = jQuery(this).text().toLowerCase().replace(/\s+/g, '');
              if (t.includes(v) || v.includes(t) || t.includes(mi.kua_dicatat.toLowerCase())) {
                $kua.val(jQuery(this).val()).trigger('change');
                // Update Select2 display if exists
                const $container = jQuery('#select2-ref_kua-container');
                if ($container.length) {
                  $container.attr('title', jQuery(this).text()).text(jQuery(this).text());
                }
                found = true;
                return false; // break
              }
            });
          }
        } catch(e) {}
      }
      // Strategy 2: Vanilla JS fallback (when jQuery not available)
      if (!found) {
        const kuaEl = document.getElementById('ref_kua');
        if (kuaEl) {
          const v = mi.kua_dicatat.toLowerCase().replace(/\s+/g, '');
          for (const opt of kuaEl.options) {
            const t = opt.text.toLowerCase().replace(/\s+/g, '');
            if (t.includes(v) || v.includes(t) || t.includes(mi.kua_dicatat.toLowerCase())) {
              kuaEl.value = opt.value;
              kuaEl.dispatchEvent(new Event('change', { bubbles: true }));
              found = true;
              break;
            }
          }
        }
      }

      // Strategy 3: Select2 AJAX lookup. SIPP only preloads the current KUA option;
      // other KUA values (e.g. Cipayung) must be fetched from /kua/cari before selection.
      if (!found && typeof jQuery !== 'undefined') {
        try {
          const $kua = jQuery('#ref_kua');
          const ajaxConfig = $kua.data('select2')?.options?.options?.ajax;
          const url = ajaxConfig?.url;
          if ($kua.length && url) {
            const response = await new Promise((resolve) => {
              jQuery.ajax({
                url,
                type: ajaxConfig.type || 'post',
                dataType: ajaxConfig.dataType || 'json',
                data: { term: mi.kua_dicatat },
                success: (r) => resolve(Array.isArray(r) ? r : []),
                error: () => resolve([]),
              });
            });
            const v = mi.kua_dicatat.toLowerCase().replace(/\s+/g, '');
            const match = response.find((item) => {
              const t = String(item.text || '').toLowerCase().replace(/\s+/g, '');
              return t.includes(v) || v.includes(t) || String(item.text || '').toLowerCase().includes(mi.kua_dicatat.toLowerCase());
            });
            if (match?.id) {
              if (!$kua.find(`option[value="${match.id}"]`).length) {
                $kua.append(new Option(match.text, match.id, true, true));
              }
              $kua.val(match.id).trigger('change');
              const $container = jQuery('#select2-ref_kua-container');
              if ($container.length) {
                $container.attr('title', match.text).text(match.text);
              }
              found = true;
            }
          }
        } catch(e) {
          result.errors.push('KUA AJAX: ' + e.message);
        }
      }
      if (found) result.filledFields++;
      else result.errors.push('KUA Dicatat: tidak ditemukan (' + mi.kua_dicatat + ')');
    }
  }

  // Fill Tanggal Surat — skip while the separate Data Anak popup is open.
  if (!isDataAnakForm && data.tanggal_surat) {
    const el = document.getElementById('tgl_surat');
    if (el) {
      setVal(el, data.tanggal_surat);
      result.filledFields++;
    }
  }

  // Fill children (Data Anak — might be in separate popup)
  if (data.children && Array.isArray(data.children)) {
    for (const child of data.children) {
      console.log('[SIPP CHILD] Filling child:', JSON.stringify({...child, _raw: undefined}));
      // Text inputs — use specific selectors to avoid matching wrong fields
      const fields = [
        ['anak_ke', child.anak_ke ? String(child.anak_ke) : '', ['input[name="anak_ke" i]', 'input[id="anak_ke" i]', 'input[name*="anakke" i]']],
        ['nama', child.nama, ['input[name="nama" i]', 'input[id="nama" i]']],
        ['nik', child.nik || '', ['input[name="nik" i]', 'input[id="nik" i]', 'input[name*="nik" i]']],
        ['tempat_lahir', child.tempat_lahir, ['input[name="tempat_lahir" i]', 'input[id="tempat_lahir" i]', 'input[name*="tempatlahir" i]']],
        ['tanggal_lahir', child.tanggal_lahir, ['input[name="tgl_lahir" i]', 'input[id="tgl_lahir" i]', 'input[name="tanggal_lahir" i]', 'input[id="tanggal_lahir" i]', 'input[name*="tanggallahir" i]']],
      ];
      for (const [key, val, sels] of fields) {
        if (!val) continue;
        let filled = false;
        for (const sel of sels) {
          const el = document.querySelector(sel);
          if (el) {
            setVal(el, val);
            result.filledFields++;
            console.log(`[SIPP CHILD] ✅ ${key} = "${val}"`);
            filled = true;
            break;
          }
        }
        if (!filled) {
          console.warn(`[SIPP CHILD] ❌ ${key} not found (selectors: ${sels.join(', ')})`);
        }
      }
      // Dropdowns — use specific selectors
      const dropdowns = [
        ['jenis_kelamin', child.jenis_kelamin, ['select[name="jenis_kelamin" i]', 'select[id="jenis_kelamin" i]']],
        ['pendidikan', child.pendidikan, ['select[name="pendidikan" i]', 'select[id="pendidikan" i]', 'select[name="jenis_pendidikan" i]']],
        ['pengasuhan', child.pengasuhan, ['select[name="diasuh_oleh" i]', 'select[id="diasuh_oleh" i]', 'select[name="diasuh" i]', 'select[id="diasuh" i]', 'select[name*="diasuh" i]', 'select[id*="diasuh" i]']],
      ];
      for (const [key, val, sels] of dropdowns) {
        if (!val) continue;
        let filled = false;
        for (const sel of sels) {
          const el = document.querySelector(sel);
          if (el && setSelect(el, val)) {
            result.filledFields++;
            console.log(`[SIPP CHILD] ✅ ${key} = "${val}" (dropdown)`);
            filled = true;
            break;
          }
        }
        if (!filled) {
          console.warn(`[SIPP CHILD] ❌ ${key} dropdown not found or no match (selectors: ${sels.join(', ')})`);
        }
      }
    }
  }

  result.success = result.filledFields > 0;
  return result;
}
