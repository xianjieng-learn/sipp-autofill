/**
 * SIPP AutoFill - Popup Script
 * Handles SIPP form filling from PTSP Helper data.
 *
 * Notes:
 * - Data Umum SIPP PA uses:
 *   #tgl_surat, #tgl_nikah, #tgl_kutipan_akta_nikah,
 *   #no_kutipan_akta_nikah, #ref_kua, #obyek_gugatan, #posita, #petitum.
 * - Data Anak popup uses:
 *   #anak_ke, #nama, #nik, #tempat_lahir, #tgl_lahir,
 *   #jenis_kelamin, #pendidikan, #diasuh_oleh.
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

function firstNonEmpty(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return '';
}

function getNested(obj, path) {
  if (!obj || !path) return undefined;
  return path.split('.').reduce((acc, key) => {
    if (acc && Object.prototype.hasOwnProperty.call(acc, key)) return acc[key];
    return undefined;
  }, obj);
}

function pickValue(data, aliases) {
  return firstNonEmpty(...aliases.map((key) => {
    if (key.includes('.')) return getNested(data, key);
    return data?.[key];
  }));
}

function normalizeDate(value) {
  const raw = firstNonEmpty(value);
  if (!raw) return '';

  // Already DD/MM/YYYY or DD-MM-YYYY.
  let match = raw.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})\b/);
  if (match) {
    let [, d, m, y] = match;
    if (y.length === 2) y = `20${y}`;
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  }

  // ISO-like YYYY-MM-DD.
  match = raw.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (match) {
    const [, y, m, d] = match;
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  }

  const months = {
    januari: '01', jan: '01',
    februari: '02', feb: '02',
    maret: '03', mar: '03',
    april: '04', apr: '04',
    mei: '05',
    juni: '06', jun: '06',
    juli: '07', jul: '07',
    agustus: '08', agu: '08', agt: '08', aug: '08',
    september: '09', sep: '09', sept: '09',
    oktober: '10', okt: '10', oct: '10',
    november: '11', nov: '11',
    desember: '12', des: '12', dec: '12',
  };

  // Examples: "Minggu, 15 Sep. 2002", "15 September 2002".
  const cleaned = raw
    .replace(/^(senin|selasa|rabu|kamis|jumat|jum'at|sabtu|minggu),?\s+/i, '')
    .replace(/\./g, '')
    .trim();

  match = cleaned.match(/\b(\d{1,2})\s+([A-Za-zÀ-ÿ']+)\s+(\d{4})\b/);
  if (match) {
    const [, d, monthName, y] = match;
    const m = months[monthName.toLowerCase()];
    if (m) return `${d.padStart(2, '0')}/${m}/${y}`;
  }

  return raw;
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

    renderPreview(parsedData);
    btnFillAll.disabled = false;

    if (parsedData.children && parsedData.children.length > 0) {
      showStatus(`✅ Terdeteksi ${parsedData.children.length} anak. Siap di-fill.`, 'success');
      renderChildren(parsedData.children);
    } else {
      showStatus('✅ Data siap di-fill ke SIPP.', 'success');
      childrenList.innerHTML = '';
      childrenList.style.display = 'none';
      selectedChild = null;
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

  const childSources = [
    data.children,
    data.anak,
    data.data_anak,
    data.child_data,
  ];

  for (const source of childSources) {
    if (Array.isArray(source)) {
      result.children = source.map(normalizeChild);
      break;
    }
  }

  result.posita = pickValue(data, ['posita', 'dalil', 'alasan']);
  result.petitum = pickValue(data, ['petitum', 'tuntutan', 'amar']);
  result.obyek_sengketa = pickValue(data, ['obyek_sengketa', 'objek_sengketa', 'obyek_gugatan', 'objek_gugatan']) || '-';
  result.tanggal_surat = normalizeDate(pickValue(data, ['tanggal_surat', 'tgl_surat', 'data_umum.tanggal_surat', 'data_umum.tgl_surat']));

  const marriageSource = (data.marriage_info && typeof data.marriage_info === 'object')
    ? data.marriage_info
    : {};

  const tanggalMenikah = firstNonEmpty(
    marriageSource.tanggal_menikah,
    marriageSource.tgl_nikah,
    marriageSource.tanggal_nikah,
    data.tanggal_menikah,
    data.tgl_nikah,
    data.tanggal_nikah
  );

  const tanggalDicatat = firstNonEmpty(
    marriageSource.tanggal_dicatat,
    marriageSource.tanggal_kutipan_akta_nikah,
    marriageSource.tgl_kutipan_akta_nikah,
    marriageSource.tanggal_akta_nikah,
    data.tanggal_dicatat,
    data.tanggal_kutipan_akta_nikah,
    data.tgl_kutipan_akta_nikah,
    data.tanggal_akta_nikah
  );

  const nomorAkta = firstNonEmpty(
    marriageSource.nomor_akta_nikah,
    marriageSource.nomor_kutipan_akta_nikah,
    marriageSource.no_kutipan_akta_nikah,
    marriageSource.no_akta_nikah,
    data.nomor_akta_nikah,
    data.nomor_kutipan_akta_nikah,
    data.no_kutipan_akta_nikah,
    data.no_akta_nikah
  );

  const kuaDicatat = firstNonEmpty(
    marriageSource.kua_dicatat,
    marriageSource.kua_tempat_menikah,
    marriageSource.kua_tempat_nikah,
    marriageSource.kua_menikah,
    marriageSource.kua,
    marriageSource.tempat_menikah,
    data.kua_dicatat,
    data.kua_tempat_menikah,
    data.kua_tempat_nikah,
    data.kua_menikah,
    data.kua,
    data.tempat_menikah
  );

  result.marriage_info = {
    tanggal_menikah: normalizeDate(tanggalMenikah),
    tanggal_dicatat: normalizeDate(tanggalDicatat),
    nomor_akta_nikah: nomorAkta,
    kua_dicatat: kuaDicatat,
  };

  return result;
}

function normalizeChild(c) {
  if (!c || typeof c !== 'object') c = {};

  let tempat = firstNonEmpty(c.tempat_lahir, c.tempatLahir, c.tmp_lahir, c.tempat);
  let tanggal = firstNonEmpty(c.tanggal_lahir, c.tanggalLahir, c.tgl_lahir, c.tanggal);

  const tanggalIsDate = /\d/.test(tanggal);
  const tempatIsDate = /\d/.test(tempat);
  if (!tanggalIsDate && tempatIsDate) {
    [tempat, tanggal] = [tanggal, tempat];
  }

  return {
    anak_ke: firstNonEmpty(c.anak_ke, c.anakKe, c.index, c.urutan) || null,
    nama: firstNonEmpty(c.nama, c.name, c.nama_anak, c.nama_lengkap),
    nik: firstNonEmpty(c.nik, c.NIK),
    tempat_lahir: tempat,
    tanggal_lahir: normalizeDate(tanggal),
    jenis_kelamin: firstNonEmpty(c.jenis_kelamin, c.jenisKelamin, c.jk, c.kelamin),
    pendidikan: firstNonEmpty(c.pendidikan, c.jenis_pendidikan),
    pengasuhan: firstNonEmpty(c.pengasuhan, c.diasuh_oleh, c.diasuhOleh, c.diasuh, c.hadhanah),
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
      if (c.tempat_lahir || c.tanggal_lahir) {
        html += `
          <div class="preview-field">
            <span class="preview-label">Lahir</span>
            <span class="preview-value">${[c.tempat_lahir, c.tanggal_lahir].filter(Boolean).join(', ')}</span>
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

  if (data.marriage_info && Object.values(data.marriage_info).some(v => v)) {
    html += `
      <div class="preview-section">
        <div class="preview-section-title">💍 Info Pernikahan</div>
    `;

    const fields = [
      ['Tanggal Menikah', data.marriage_info.tanggal_menikah],
      ['Tanggal Dicatat', data.marriage_info.tanggal_dicatat],
      ['No. Akta Nikah', data.marriage_info.nomor_akta_nikah],
      ['KUA Tempat Menikah', data.marriage_info.kua_dicatat],
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
    const isSippPage = tab && sippHosts.some(host => tab.url.includes(host));
    if (!tab || !isSippPage) {
      showStatus('❌ Buka halaman SIPP/eCourt dulu.', 'error');
      return;
    }

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
  } catch (e) {
    showStatus(`❌ Error: ${e.message}. Coba refresh halaman SIPP.`, 'error');
  } finally {
    btnFillAll.disabled = false;
    btnFillAll.textContent = '⚡ Fill Semua ke SIPP';
  }
}

// ─── Render fill results with details ───
function renderFillResult(response) {
  const existing = document.getElementById('errorDetails');
  if (existing) existing.remove();

  if (!response) {
    showStatus('❌ Tidak ada response dari halaman SIPP.', 'error');
    return;
  }

  const filledCount = response.filledFields || 0;
  const errors = response.errors || [];

  if (filledCount > 0 && errors.length === 0) {
    showStatus(`✅ Berhasil mengisi ${filledCount} field.`, 'success');
  } else if (filledCount > 0 && errors.length > 0) {
    showStatus(`⚠️ ${filledCount} field berhasil, ${errors.length} gagal.`, 'info');
    renderErrorDetails(errors);
  } else if (errors.length > 0) {
    showStatus('❌ Semua field gagal diisi. Lihat detail di bawah.', 'error');
    renderErrorDetails(errors);
  } else {
    showStatus(`⚠️ ${response?.error || 'Gagal mengisi form SIPP.'}`, 'error');
  }
}

function renderErrorDetails(errors) {
  const existing = document.getElementById('errorDetails');
  if (existing) existing.remove();

  const div = document.createElement('div');
  div.id = 'errorDetails';
  div.style.cssText = 'margin-top: 8px; padding: 8px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; font-size: 10px; max-height: 150px; overflow-y: auto;';

  let html = '<div style="font-weight: 600; margin-bottom: 4px; color: #856404;">⚠️ Field yang gagal:</div>';
  errors.forEach(err => {
    html += `<div style="padding: 2px 0; color: #856404; border-bottom: 1px solid #ffeeba;">• ${err}</div>`;
  });
  html += '<div style="margin-top: 6px; font-size: 9px; color: #856404;">💡 Tips: Pastikan popup/form SIPP yang sesuai sedang terbuka.</div>';

  div.innerHTML = html;
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

if (jsonInput.value.trim()) {
  parseJSON();
}

// ─── MAIN World Fill Function ───
// Injected into the page's MAIN world so it can access CKEDITOR, jQuery, Select2, etc.
async function fillSippMainWorld(data) {
  const result = { filledFields: 0, errors: [] };

  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  function isNodeVisible(node) {
    if (!node) return false;
    let el = node.nodeType === 1 ? node : node.parentElement;
    if (!el) return false;
    try {
      while (el && el !== document) {
        const s = window.getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden') return false;
        el = el.parentElement;
      }
      return true;
    } catch (e) {
      return true;
    }
  }

  const dataAnakForm = document.querySelector('form[action*="addAnakPihak"], #frm_user');
  const isDataAnakForm = dataAnakForm && isNodeVisible(dataAnakForm);

  function setVal(el, value) {
    if (!el || value === undefined || value === null || String(value).trim() === '') return false;

    const val = String(value);
    const proto = el.tagName === 'TEXTAREA'
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;

    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    try {
      if (setter) setter.call(el, val);
      else el.value = val;
    } catch (e) {
      el.value = val;
    }

    if (typeof jQuery !== 'undefined') {
      try {
        const $el = jQuery(el);
        if (($el.hasClass('hasDatepicker') || $el.data('datepicker')) && val) {
          const parts = val.split('/');
          if (parts.length === 3) {
            let [d, m, y] = parts;
            if (y.length === 2) y = `20${y}`;
            const dt = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
            if (!Number.isNaN(dt.getTime())) $el.datepicker('setDate', dt);
            else $el.datepicker('setDate', val);
          } else {
            $el.datepicker('setDate', val);
          }
        }
        $el.val(val).trigger('input').trigger('change').trigger('blur');
      } catch (e) {
        console.warn('[SIPP setVal] jQuery/datePicker error:', e.message);
      }
    }

    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
    return true;
  }

  function normalizeText(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[._/()–—-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function compactText(s) {
    return normalizeText(s).replace(/\s+/g, '');
  }

  function normalizeKuaText(s) {
    return normalizeText(s)
      .replace(/\bkua\b/g, ' ')
      .replace(/\bkantor urusan agama\b/g, ' ')
      .replace(/\bkecamatan\b/g, ' ')
      .replace(/\bkec\b/g, ' ')
      .replace(/\bkota adm\b/g, ' ')
      .replace(/\bkota administrasi\b/g, ' ')
      .replace(/\bkota\b/g, ' ')
      .replace(/\bkabupaten\b/g, ' ')
      .replace(/\bkab\b/g, ' ')
      .replace(/\bprovinsi\b/g, ' ')
      .replace(/\bpropinsi\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function kuaMatches(optionText, wantedText) {
    const optionNorm = normalizeText(optionText);
    const wantedNorm = normalizeText(wantedText);
    const optionKua = normalizeKuaText(optionText);
    const wantedKua = normalizeKuaText(wantedText);
    const optionCompact = compactText(optionText);
    const wantedCompact = compactText(wantedText);
    const optionKuaCompact = compactText(optionKua);
    const wantedKuaCompact = compactText(wantedKua);

    if (!wantedNorm) return false;
    return optionNorm === wantedNorm ||
      optionNorm.includes(wantedNorm) ||
      wantedNorm.includes(optionNorm) ||
      optionCompact.includes(wantedCompact) ||
      wantedCompact.includes(optionCompact) ||
      optionKua === wantedKua ||
      optionKua.includes(wantedKua) ||
      wantedKua.includes(optionKua) ||
      optionKuaCompact.includes(wantedKuaCompact) ||
      wantedKuaCompact.includes(optionKuaCompact);
  }

  function selectOption(select, option) {
    if (!select || !option) return false;

    const options = Array.from(select.options || []);
    options.forEach(o => { o.selected = false; });
    option.selected = true;
    select.selectedIndex = options.indexOf(option);

    // Important: use selectedIndex, not only select.value.
    // Some SIPP selects contain duplicate option values.
    if (option.value !== undefined) {
      select.value = option.value;
    }

    if (typeof jQuery !== 'undefined') {
      try {
        const $sel = jQuery(select);
        $sel.val(option.value).trigger('input').trigger('change').trigger('blur');
        if ($sel.data('select2')) {
          $sel.trigger({
            type: 'select2:select',
            params: { data: { id: option.value, text: option.textContent || option.text || '' } },
          });
        }
      } catch (e) {
        console.warn('[SIPP selectOption] jQuery/Select2 error:', e.message);
      }
    }

    select.dispatchEvent(new Event('input', { bubbles: true }));
    select.dispatchEvent(new Event('change', { bubbles: true }));

    const container = document.getElementById(`select2-${select.id}-container`);
    if (container) {
      const text = option.textContent || option.text || '';
      container.textContent = text;
      container.setAttribute('title', text);
    }

    return true;
  }

  function setSelect(select, value) {
    if (!select || value === undefined || value === null || String(value).trim() === '') return false;

    const normalize = (s) => String(s || '')
      .toLowerCase()
      .replace(/[._-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const compact = (s) => normalize(s).replace(/\s+/g, '');

    const raw = String(value).trim();
    const v = normalize(raw);
    const fieldKey = normalize(`${select.id || ''} ${select.name || ''}`);
    const isDiasuh = fieldKey.includes('diasuh');
    const isJenisKelamin = fieldKey.includes('jenis kelamin') || fieldKey.includes('jeniskelamin');

    const shorthandMap = {
      sd: 'sekolah dasar',
      's d': 'sekolah dasar',
      smp: 'sekolah lanjutan tingkat pertama',
      sltp: 'sekolah lanjutan tingkat pertama',
      mts: 'sekolah lanjutan tingkat pertama',
      sma: 'sekolah lanjutan tingkat atas',
      smk: 'sekolah lanjutan tingkat atas',
      ma: 'sekolah lanjutan tingkat atas',
      slta: 'sekolah lanjutan tingkat atas',
      s1: 'strata i',
      'strata 1': 'strata i',
      s2: 'strata ii',
      'strata 2': 'strata ii',
      s3: 'strata iii',
      'strata 3': 'strata iii',
      d1: 'diploma i',
      d2: 'diploma ii',
      d3: 'diploma iii',
      d4: 'diploma iv',
      tk: 'taman kanak-kanak',
      paud: 'taman kanak-kanak',
      'tidak sekolah': 'tidak ada',
      'belum sekolah': 'tidak ada',
      'belum tamat': 'tidak ada',
      penggugat: 'penggugat/pemohon',
      pemohon: 'penggugat/pemohon',
      tergugat: 'tergugat/termohon',
      termohon: 'tergugat/termohon',
      'orang tua': 'orang tua p atau t',
      'orang tua p/t': 'orang tua p atau t',
      'orang tua p atau t': 'orang tua p atau t',
      'lain lain': 'lain-lain',
      lainnya: 'lain-lain',
      'laki laki': 'laki-laki',
      'laki-laki': 'laki-laki',
      perempuan: 'perempuan',
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
    const options = Array.from(select.options || []);

    let opt = options.find(o => String(o.value) === raw);

    if (!opt) {
      opt = options.find(o => {
        const t = normalize(o.textContent || o.text);
        return t === expanded || t.includes(expanded) || expanded.includes(t);
      });
    }

    if (!opt) {
      opt = options.find(o => {
        const t = normalize(o.textContent || o.text);
        return t === v || t.includes(v) || v.includes(t);
      });
    }

    if (!opt) {
      const wantCompact = compact(expanded);
      const rawCompact = compact(raw);
      opt = options.find(o => {
        const tCompact = compact(o.textContent || o.text);
        return tCompact === wantCompact ||
          tCompact.includes(wantCompact) ||
          wantCompact.includes(tCompact) ||
          tCompact === rawCompact ||
          tCompact.includes(rawCompact) ||
          rawCompact.includes(tCompact);
      });
    }

    return selectOption(select, opt);
  }

  function textToHtml(text) {
    if (!text) return '';
    if (/<[a-z][\s\S]*>/i.test(text)) {
      return text
        .replace(/<p(\s[^>]*)?>/gi, '<p$1 style="text-align:justify">')
        .replace(/<li(\s[^>]*)?>/gi, '<li$1 style="text-align:justify">');
    }

    const lines = String(text).split(/\r?\n/);
    let html = '';
    let inOl = false;
    let inSubOl = false;
    let liOpen = false;

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed) {
        if (inSubOl) { html += '</ol>'; inSubOl = false; }
        if (liOpen) { html += '</li>'; liOpen = false; }
        if (inOl) { html += '</ol>'; inOl = false; }
        html += '<p style="text-align:justify">&nbsp;</p>';
        continue;
      }

      const subDecimalMatch = trimmed.match(/^(\d+\.\d+)[.)]?\s*(.+)/);
      const subAlphaMatch = trimmed.match(/^([a-z])[.)]\s*(.+)/i);
      const numMatch = trimmed.match(/^(\d+)[.)]\s*(.+)/);

      if (subDecimalMatch && inOl) {
        if (!inSubOl) {
          html += '<ol>';
          inSubOl = true;
        }
        html += `<li style="text-align:justify">${subDecimalMatch[0]}</li>`;
      } else if (subAlphaMatch && inOl) {
        if (!inSubOl) {
          html += '<ol style="list-style-type:lower-alpha">';
          inSubOl = true;
        }
        html += `<li style="text-align:justify">${subAlphaMatch[2]}</li>`;
      } else if (numMatch) {
        if (inSubOl) { html += '</ol>'; inSubOl = false; }
        if (liOpen) { html += '</li>'; liOpen = false; }
        if (!inOl) { html += '<ol>'; inOl = true; }
        html += `<li style="text-align:justify">${numMatch[2]}`;
        liOpen = true;
      } else {
        if (inSubOl) { html += '</ol>'; inSubOl = false; }
        if (liOpen) { html += '</li>'; liOpen = false; }
        if (inOl) { html += '</ol>'; inOl = false; }
        html += `<p style="text-align:justify">${trimmed}</p>`;
      }
    }

    if (inSubOl) html += '</ol>';
    if (liOpen) html += '</li>';
    if (inOl) html += '</ol>';
    return html;
  }

  function fillEditor(id, value, label) {
    if (!value) return false;
    const html = textToHtml(value);

    if (typeof CKEDITOR !== 'undefined' && CKEDITOR.instances && CKEDITOR.instances[id]) {
      CKEDITOR.instances[id].setData(html);

      try {
        const body = CKEDITOR.instances[id].editable();
        if (body) {
          const doc = body.$;
          const existingStyle = doc.getElementById('hermes-justify-css');
          if (!existingStyle) {
            const styleEl = doc.createElement('style');
            styleEl.id = 'hermes-justify-css';
            styleEl.textContent = 'p,li{text-align:justify!important}ol ol{list-style-type:lower-alpha!important}';
            doc.head.appendChild(styleEl);
          }
          doc.querySelectorAll('p,li').forEach(el => { el.style.textAlign = 'justify'; });
          doc.querySelectorAll('ol ol').forEach(ol => { ol.style.listStyleType = 'lower-alpha'; });
        }
      } catch (e) {
        console.warn(`[SIPP ${label}] justify styling warning:`, e.message);
      }

      const textarea = document.getElementById(id);
      if (textarea) textarea.value = html;
      return true;
    }

    const textarea = document.getElementById(id);
    if (textarea) return setVal(textarea, html);

    return false;
  }

  async function fillKua(kuaValue) {
    const wanted = String(kuaValue || '').trim();
    if (!wanted) return false;

    const select = document.getElementById('ref_kua');
    if (!select) {
      result.errors.push('KUA Tempat Menikah: select#ref_kua tidak ditemukan');
      return false;
    }

    // 1) Existing options. In SIPP edit form, the current KUA is often already injected as an option.
    const existingOptions = Array.from(select.options || []);
    let existingMatch = existingOptions.find(opt => {
      const text = opt.textContent || opt.text || '';
      return opt.value && kuaMatches(text, wanted);
    });

    if (existingMatch && selectOption(select, existingMatch)) {
      console.log('[SIPP KUA] ✅ selected from existing option:', existingMatch.textContent || existingMatch.text);
      return true;
    }

    // 2) Use Select2 UI search. This is safer because it reuses SIPP's real AJAX config.
    if (typeof jQuery !== 'undefined') {
      const $select = jQuery(select);

      if ($select.data('select2')) {
        const terms = [
          wanted,
          wanted.replace(/^kua\s+/i, '').trim(),
          wanted.split(',')[0].replace(/^kua\s+/i, '').trim(),
        ].filter((v, i, arr) => v && arr.indexOf(v) === i);

        for (const term of terms) {
          try {
            $select.select2('open');
            await delay(150);

            const searchInput = document.querySelector('.select2-container--open .select2-search__field');
            if (searchInput) {
              searchInput.focus();
              searchInput.value = term;
              searchInput.dispatchEvent(new Event('input', { bubbles: true }));
              searchInput.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: term.slice(-1) || 'a' }));
              jQuery(searchInput).val(term).trigger('input').trigger('keyup');
            }

            await delay(900);

            const resultOptions = Array.from(document.querySelectorAll('.select2-results__option'))
              .filter(el => {
                const text = normalizeText(el.textContent);
                return text && !text.includes('searching') && !text.includes('mencari') && !text.includes('tidak ditemukan');
              });

            const optionEl = resultOptions.find(el => kuaMatches(el.textContent, wanted)) ||
              resultOptions.find(el => kuaMatches(el.textContent, term));

            if (optionEl) {
              optionEl.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
              optionEl.click();
              await delay(150);

              const selectedText = document.getElementById('select2-ref_kua-container')?.textContent || '';
              if (selectedText && kuaMatches(selectedText, wanted)) {
                console.log('[SIPP KUA] ✅ selected via Select2 UI:', selectedText);
                return true;
              }

              const refreshedMatch = Array.from(select.options || []).find(opt => opt.selected || kuaMatches(opt.textContent || opt.text, wanted));
              if (refreshedMatch && selectOption(select, refreshedMatch)) {
                console.log('[SIPP KUA] ✅ selected via Select2 refreshed option:', refreshedMatch.textContent || refreshedMatch.text);
                return true;
              }
            }

            try { $select.select2('close'); } catch (e) {}
          } catch (e) {
            console.warn('[SIPP KUA] Select2 UI strategy failed:', e.message);
          }
        }
      }
    }

    // 3) Direct AJAX fallback. Try configured Select2 URL first, then known/likely SIPP variants.
    if (typeof jQuery !== 'undefined') {
      const ajaxConfigs = [];
      try {
        const $select = jQuery(select);
        const ajaxConfig = $select.data('select2')?.options?.options?.ajax;
        if (ajaxConfig?.url) {
          ajaxConfigs.push({
            url: typeof ajaxConfig.url === 'function' ? ajaxConfig.url() : ajaxConfig.url,
            type: ajaxConfig.type || ajaxConfig.method || 'GET',
          });
        }
      } catch (e) {}

      ajaxConfigs.push(
        { url: '/SIPP/kua/cari', type: 'POST' },
        { url: '/SIPP/kua/cari', type: 'GET' },
        { url: '/SIPP/ref_kua/cari', type: 'POST' },
        { url: '/SIPP/referensi/kua', type: 'GET' },
        { url: '/SIPP/manageDataUmum/get_kua', type: 'GET' }
      );

      const uniqueConfigs = ajaxConfigs.filter((cfg, idx, arr) =>
        cfg.url && arr.findIndex(x => x.url === cfg.url && x.type === cfg.type) === idx
      );

      const terms = [
        wanted,
        wanted.replace(/^kua\s+/i, '').trim(),
        wanted.split(',')[0].replace(/^kua\s+/i, '').trim(),
        wanted.split(/\s+/).find(Boolean) || wanted,
      ].filter((v, i, arr) => v && arr.indexOf(v) === i);

      for (const cfg of uniqueConfigs) {
        for (const term of terms) {
          const response = await new Promise(resolve => {
            jQuery.ajax({
              url: cfg.url,
              type: cfg.type,
              dataType: 'json',
              data: { term, q: term, search: term },
              success: resolve,
              error: () => resolve(null),
            });
          });

          const itemsRaw = Array.isArray(response)
            ? response
            : (Array.isArray(response?.results)
              ? response.results
              : (Array.isArray(response?.data) ? response.data : []));

          const items = itemsRaw.map(item => ({
            id: item.id ?? item.value ?? item.kode ?? item.ref_kua ?? item.key,
            text: item.text ?? item.nama ?? item.label ?? item.name ?? item.kua ?? item.value,
          })).filter(item => item.id && item.text);

          const match = items.find(item => kuaMatches(item.text, wanted)) ||
            items.find(item => kuaMatches(item.text, term));

          if (match) {
            let option = Array.from(select.options || []).find(opt => String(opt.value) === String(match.id));
            if (!option) {
              option = new Option(match.text, match.id, true, true);
              select.appendChild(option);
            }
            option.textContent = match.text;
            if (selectOption(select, option)) {
              console.log('[SIPP KUA] ✅ selected via AJAX:', match.text, match.id);
              return true;
            }
          }
        }
      }
    }

    result.errors.push(`KUA Tempat Menikah: tidak ditemukan/terpilih (${wanted})`);
    return false;
  }

  // Fill main Data Umum form only when Data Anak popup is not active.
  if (!isDataAnakForm) {
    if (data.tanggal_surat) {
      const el = document.getElementById('tgl_surat');
      if (el && setVal(el, data.tanggal_surat)) result.filledFields++;
      else result.errors.push('Tanggal Surat: #tgl_surat tidak ditemukan');
    }

    if (data.marriage_info) {
      const mi = data.marriage_info;
      const marriageFields = [
        ['Tanggal Menikah', 'tgl_nikah', mi.tanggal_menikah],
        ['Tanggal Kutipan Akta Nikah', 'tgl_kutipan_akta_nikah', mi.tanggal_dicatat],
        ['Nomor Kutipan Akta Nikah', 'no_kutipan_akta_nikah', mi.nomor_akta_nikah],
      ];

      for (const [label, id, value] of marriageFields) {
        if (!value) continue;
        const el = document.getElementById(id);
        if (el && setVal(el, value)) result.filledFields++;
        else result.errors.push(`${label}: #${id} tidak ditemukan`);
      }

      if (mi.kua_dicatat) {
        const ok = await fillKua(mi.kua_dicatat);
        if (ok) result.filledFields++;
      }
    }

    if (data.obyek_sengketa) {
      const ta = document.getElementById('obyek_gugatan');
      if (ta && setVal(ta, data.obyek_sengketa)) result.filledFields++;
      else result.errors.push('Obyek Sengketa: #obyek_gugatan tidak ditemukan');
    }

    if (data.posita) {
      let filled = false;
      for (let attempt = 0; attempt < 3 && !filled; attempt++) {
        filled = fillEditor('posita', data.posita, 'Posita');
        if (!filled) await delay(300);
      }
      if (filled) result.filledFields++;
      else result.errors.push('Posita: CKEditor/textarea #posita tidak ditemukan');
    }

    if (data.petitum) {
      let filled = false;
      for (let attempt = 0; attempt < 3 && !filled; attempt++) {
        filled = fillEditor('petitum', data.petitum, 'Petitum');
        if (!filled) await delay(300);
      }
      if (filled) result.filledFields++;
      else result.errors.push('Petitum: CKEditor/textarea #petitum tidak ditemukan');
    }
  }

  // Fill Data Anak popup.
  if (data.children && Array.isArray(data.children)) {
    for (const child of data.children) {
      const fields = [
        ['anak_ke', child.anak_ke ? String(child.anak_ke) : '', ['#anak_ke', 'input[name="anak_ke" i]', 'input[name*="anakke" i]']],
        ['nama', child.nama, ['#nama', 'input[name="nama" i]']],
        ['nik', child.nik || '', ['#nik', 'input[name="nik" i]', 'input[name*="nik" i]']],
        ['tempat_lahir', child.tempat_lahir, ['#tempat_lahir', 'input[name="tempat_lahir" i]', 'input[name*="tempatlahir" i]']],
        ['tanggal_lahir', child.tanggal_lahir, ['#tgl_lahir', 'input[name="tgl_lahir" i]', 'input[name="tanggal_lahir" i]', 'input[name*="tanggallahir" i]']],
      ];

      for (const [key, value, selectors] of fields) {
        if (!value) continue;
        let done = false;
        for (const selector of selectors) {
          const el = document.querySelector(selector);
          if (el && setVal(el, value)) {
            result.filledFields++;
            done = true;
            break;
          }
        }
        if (!done && isDataAnakForm) result.errors.push(`Data Anak ${key}: field tidak ditemukan`);
      }

      const dropdowns = [
        ['jenis_kelamin', child.jenis_kelamin, ['#jenis_kelamin', 'select[name="jenis_kelamin" i]']],
        ['pendidikan', child.pendidikan, ['#pendidikan', 'select[name="pendidikan" i]', 'select[name="jenis_pendidikan" i]']],
        ['pengasuhan', child.pengasuhan, ['#diasuh_oleh', 'select[name="diasuh_oleh" i]', 'select[name*="diasuh" i]', 'select[id*="diasuh" i]']],
      ];

      for (const [key, value, selectors] of dropdowns) {
        if (!value) continue;
        let done = false;
        for (const selector of selectors) {
          const el = document.querySelector(selector);
          if (el && setSelect(el, value)) {
            result.filledFields++;
            done = true;
            break;
          }
        }
        if (!done && isDataAnakForm) result.errors.push(`Data Anak ${key}: dropdown tidak ditemukan/tidak cocok`);
      }
    }
  }

  result.success = result.filledFields > 0;
  return result;
}
