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

  // Handle marriage info
  if (data.tanggal_menikah || data.tanggal_dicatat || data.nomor_akta_nikah || data.kua_dicatat) {
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
  return {
    anak_ke: c.anak_ke || c.index || null,
    nama: c.nama || c.name || '',
    tempat_lahir: c.tempat_lahir || c.tempatLahir || '',
    tanggal_lahir: c.tanggal_lahir || c.tanggalLahir || '',
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
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      func: fillSippMainWorld,
      args: [parsedData],
    });
    const response = results?.[0]?.result || { success: false, error: 'No result from injection' };
    renderFillResult(response);
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
  const result = { filledFields: 0, errors: [] };

  // Convert plain text posita/petitum to HTML for CKEditor
  function textToHtml(text) {
    if (!text) return '';
    // Already has HTML tags? Return as-is
    if (/<[a-z][\s\S]*>/i.test(text)) return text;
    // Convert plain text with numbered list to HTML
    const lines = text.split(/\r?\n/);
    let html = '';
    let inOl = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        if (inOl) { html += '</ol>'; inOl = false; }
        html += '<p>&nbsp;</p>';
        continue;
      }
      // Numbered item: "1." "2." etc.
      const numMatch = trimmed.match(/^(\d+)[.)]\s*(.+)/);
      if (numMatch) {
        if (!inOl) { html += '<ol>'; inOl = true; }
        html += `<li>${numMatch[2]}</li>`;
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
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
      || Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
    if (setter) setter.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
    if (typeof jQuery !== 'undefined') {
      try {
        const $el = jQuery(el);
        $el.val(value).trigger('change');
        // DO NOT call datepicker('setDate') — it overrides the value with its own format
      } catch(e) {}
    }
    return true;
  }

  function setSelect(sel, value) {
    if (!sel) return false;
    const v = value.toLowerCase();
    const opt = Array.from(sel.options).find(o =>
      o.text.toLowerCase() === v || o.value.toLowerCase() === v ||
      o.text.toLowerCase().includes(v) || v.includes(o.text.toLowerCase())
    );
    if (!opt) return false;
    if (typeof jQuery !== 'undefined' && jQuery(sel).data('select2')) {
      jQuery(sel).val(opt.value).trigger('change').trigger('select2:select');
    } else {
      sel.value = opt.value;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return true;
  }

  // Fill Posita (CKEditor)
  if (data.posita) {
    let filled = false;
    // Try up to 3 times with delay (CKEditor might not be initialized yet)
    for (let attempt = 0; attempt < 3 && !filled; attempt++) {
      if (typeof CKEDITOR !== 'undefined' && CKEDITOR.instances && CKEDITOR.instances['posita']) {
        try {
          const html = textToHtml(data.posita);
          CKEDITOR.instances['posita'].setData(html);
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

  // Fill Petitum (CKEditor)
  if (data.petitum) {
    let filled = false;
    for (let attempt = 0; attempt < 3 && !filled; attempt++) {
      if (typeof CKEDITOR !== 'undefined' && CKEDITOR.instances && CKEDITOR.instances['petitum']) {
        try {
          const html = textToHtml(data.petitum);
          CKEDITOR.instances['petitum'].setData(html);
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

  // Fill Obyek Sengketa (plain textarea)
  if (data.obyek_sengketa) {
    const ta = document.getElementById('obyek_gugatan');
    if (ta) { setVal(ta, data.obyek_sengketa); result.filledFields++; }
    else result.errors.push('Obyek Sengketa: tidak ditemukan');
  }

  // Fill marriage info fields (Edit Data Umum form)
  if (data.marriage_info) {
    const mi = data.marriage_info;
    const marriageFields = [
      ['tgl_nikah', mi.tanggal_menikah],
      ['tgl_kutipan_akta_nikah', mi.tanggal_dicatat],
      ['no_kutipan_akta_nikah', mi.nomor_akta_nikah],
    ];
    for (const [id, val] of marriageFields) {
      if (!val) continue;
      const el = document.getElementById(id);
      if (el) { setVal(el, val); result.filledFields++; }
    }
  }

  // Fill Tanggal Surat
  if (data.tanggal_surat) {
    const el = document.getElementById('tgl_surat');
    if (el) { setVal(el, data.tanggal_surat); result.filledFields++; }
  }

  // Fill children (Data Anak — might be in separate popup)
  if (data.children && Array.isArray(data.children)) {
    for (const child of data.children) {
      // Text inputs
      const fields = [
        ['nama', child.nama, ['input[name*="nama" i]', 'input[id*="nama" i]']],
        ['tempat_lahir', child.tempat_lahir, ['input[name*="tempat" i]', 'input[id*="tempat" i]']],
        ['tanggal_lahir', child.tanggal_lahir, ['input[name*="tanggal" i]', 'input[id*="tanggal" i]', 'input[name*="tgl" i]', 'input[id*="tgl" i]']],
      ];
      for (const [key, val, sels] of fields) {
        if (!val) continue;
        for (const sel of sels) {
          const el = document.querySelector(sel);
          if (el) {
            // Format date: PTSP outputs dd/mm/yyyy, SIPP expects same format
            setVal(el, val);
            result.filledFields++;
            break;
          }
        }
      }
      // Dropdowns
      const dropdowns = [
        ['jenis_kelamin', child.jenis_kelamin, ['select[name*="kelamin" i]', 'select[id*="kelamin" i]']],
        ['pendidikan', child.pendidikan, ['select[name*="pendidikan" i]', 'select[id*="pendidikan" i]']],
        ['pengasuhan', child.pengasuhan, ['select[name*="diasuh" i]', 'select[id*="diasuh" i]', 'select[name*="pengasuhan" i]', 'select[id*="pengasuhan" i]']],
      ];
      for (const [key, val, sels] of dropdowns) {
        if (!val) continue;
        for (const sel of sels) {
          const el = document.querySelector(sel);
          if (el && setSelect(el, val)) { result.filledFields++; break; }
        }
      }
    }
  }

  result.success = result.filledFields > 0;
  return result;
}
