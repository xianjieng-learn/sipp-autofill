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
    
    if (!tab || !tab.url.includes('ecourt.mahkamahagung.go.id')) {
      showStatus('❌ Buka halaman SIPP di eCourt dulu!', 'error');
      btnFillAll.disabled = false;
      btnFillAll.textContent = '⚡ Fill Semua ke SIPP';
      return;
    }

    // Send data to content script
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'fillAllSipp',
      data: parsedData,
    });

    if (response && response.success) {
      const filledCount = response.filledFields || 0;
      showStatus(`✅ Berhasil mengisi ${filledCount} field di SIPP!`, 'success');
    } else {
      showStatus(`⚠️ ${response?.error || 'Gagal mengisi form SIPP'}`, 'error');
    }
  } catch (e) {
    showStatus(`❌ Error: ${e.message}. Coba refresh halaman SIPP.`, 'error');
  }

  btnFillAll.disabled = false;
  btnFillAll.textContent = '⚡ Fill Semua ke SIPP';
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
