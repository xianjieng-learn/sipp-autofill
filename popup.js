/* SIPP AutoFill - Popup Script */

const jsonInput = document.getElementById('jsonInput');
const btnPaste = document.getElementById('btnPaste');
const btnParse = document.getElementById('btnParse');
const btnFillAll = document.getElementById('btnFillAll');
const statusEl = document.getElementById('status');
const previewEl = document.getElementById('preview');
const childrenList = document.getElementById('childrenList');

let parsedData = null;
let selectedChild = null;

function showStatus(msg, type = 'info') {
  statusEl.textContent = msg;
  statusEl.className = `status show ${type}`;
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim();
  }
  return '';
}

function getNested(obj, path) {
  return path.split('.').reduce((acc, key) => (acc && Object.prototype.hasOwnProperty.call(acc, key) ? acc[key] : undefined), obj);
}

function pickValue(data, aliases) {
  return firstNonEmpty(...aliases.map(key => key.includes('.') ? getNested(data, key) : data?.[key]));
}

function normalizeDate(value) {
  const raw = firstNonEmpty(value);
  if (!raw) return '';

  let m = raw.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})\b/);
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = `20${y}`;
    return `${d.padStart(2, '0')}/${mo.padStart(2, '0')}/${y}`;
  }

  m = raw.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (m) {
    const [, y, mo, d] = m;
    return `${d.padStart(2, '0')}/${mo.padStart(2, '0')}/${y}`;
  }

  const months = {
    januari: '01', jan: '01', februari: '02', feb: '02', maret: '03', mar: '03',
    april: '04', apr: '04', mei: '05', juni: '06', jun: '06', juli: '07', jul: '07',
    agustus: '08', agu: '08', agt: '08', aug: '08', september: '09', sep: '09', sept: '09',
    oktober: '10', okt: '10', oct: '10', november: '11', nov: '11', desember: '12', des: '12', dec: '12',
  };

  const cleaned = raw
    .replace(/^(senin|selasa|rabu|kamis|jumat|jum'at|sabtu|minggu),?\s+/i, '')
    .replace(/\./g, '')
    .trim();

  m = cleaned.match(/\b(\d{1,2})\s+([A-Za-zÀ-ÿ']+)\s+(\d{2,4})\b/);
  if (m) {
    let [, d, monthName, y] = m;
    const mo = months[monthName.toLowerCase()];
    if (mo) {
      if (y.length === 2) y = `20${y}`;
      return `${d.padStart(2, '0')}/${mo}/${y}`;
    }
  }

  return raw;
}

function normalizeData(data) {
  const childSource = [data.children, data.anak, data.data_anak, data.child_data].find(Array.isArray) || [];
  const marriageSource = data.marriage_info && typeof data.marriage_info === 'object' ? data.marriage_info : {};

  const tanggalMenikah = firstNonEmpty(
    marriageSource.tanggal_menikah, marriageSource.tgl_nikah, marriageSource.tanggal_nikah,
    data.tanggal_menikah, data.tgl_nikah, data.tanggal_nikah
  );

  const tanggalDicatat = firstNonEmpty(
    marriageSource.tanggal_dicatat, marriageSource.tanggal_kutipan_akta_nikah, marriageSource.tgl_kutipan_akta_nikah,
    marriageSource.tanggal_akta_nikah, data.tanggal_dicatat, data.tanggal_kutipan_akta_nikah,
    data.tgl_kutipan_akta_nikah, data.tanggal_akta_nikah
  );

  const nomorAkta = firstNonEmpty(
    marriageSource.nomor_akta_nikah, marriageSource.nomor_kutipan_akta_nikah, marriageSource.no_kutipan_akta_nikah,
    marriageSource.no_akta_nikah, data.nomor_akta_nikah, data.nomor_kutipan_akta_nikah,
    data.no_kutipan_akta_nikah, data.no_akta_nikah
  );

  const kuaDicatat = firstNonEmpty(
    marriageSource.kua_dicatat, marriageSource.kua_tempat_menikah, marriageSource.kua_tempat_nikah,
    marriageSource.kua_menikah, marriageSource.kua, marriageSource.tempat_menikah,
    data.kua_dicatat, data.kua_tempat_menikah, data.kua_tempat_nikah, data.kua_menikah,
    data.kua, data.tempat_menikah
  );

  return {
    children: childSource.map(normalizeChild),
    posita: pickValue(data, ['posita', 'dalil', 'alasan']),
    petitum: pickValue(data, ['petitum', 'tuntutan', 'amar']),
    obyek_sengketa: pickValue(data, ['obyek_sengketa', 'objek_sengketa', 'obyek_gugatan', 'objek_gugatan']) || '-',
    tanggal_surat: normalizeDate(pickValue(data, [
      'tanggal_surat', 'tgl_surat', 'tanggalSurat', 'tglSurat', 'surat_tanggal',
      'tanggal_permohonan', 'tanggal_gugatan', 'tgl_permohonan', 'tgl_gugatan',
      'data_umum.tanggal_surat', 'data_umum.tgl_surat', 'surat.tanggal', 'surat.tgl_surat',
    ])),
    marriage_info: {
      tanggal_menikah: normalizeDate(tanggalMenikah),
      tanggal_dicatat: normalizeDate(tanggalDicatat),
      nomor_akta_nikah: nomorAkta,
      kua_dicatat: kuaDicatat,
    },
  };
}

function normalizeChild(c) {
  c = c || {};
  let tempat = firstNonEmpty(c.tempat_lahir, c.tempatLahir, c.tmp_lahir, c.tempat);
  let tanggal = firstNonEmpty(c.tanggal_lahir, c.tanggalLahir, c.tgl_lahir, c.tanggal);

  if (!/\d/.test(tanggal) && /\d/.test(tempat)) [tempat, tanggal] = [tanggal, tempat];

  return {
    anak_ke: firstNonEmpty(c.anak_ke, c.anakKe, c.index, c.urutan) || null,
    nama: firstNonEmpty(c.nama, c.name, c.nama_anak, c.nama_lengkap),
    nik: firstNonEmpty(c.nik, c.NIK),
    tempat_lahir: tempat,
    tanggal_lahir: normalizeDate(tanggal),
    jenis_kelamin: firstNonEmpty(c.jenis_kelamin, c.jenisKelamin, c.jk, c.kelamin),
    pendidikan: firstNonEmpty(c.pendidikan, c.jenis_pendidikan),
    pengasuhan: firstNonEmpty(c.pengasuhan, c.diasuh_oleh, c.diasuhOleh, c.diasuh, c.hadhanah),
  };
}

function parseJSON() {
  const raw = jsonInput.value.trim();
  if (!raw) return showStatus('⚠️ Belum ada data. Paste JSON dari PTSP Helper dulu.', 'error');

  try {
    parsedData = normalizeData(JSON.parse(raw));
    renderPreview(parsedData);
    btnFillAll.disabled = false;

    if (parsedData.children.length) {
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

function renderChildren(children) {
  childrenList.innerHTML = '';
  childrenList.style.display = 'block';

  children.forEach((c, i) => {
    const btn = document.createElement('button');
    btn.className = 'child-btn';
    btn.innerHTML = `<span class="child-name">${c.nama || `Anak ${i + 1}`}</span><span class="child-badge">Anak ke-${c.anak_ke || i + 1}</span>`;
    btn.onclick = () => {
      selectedChild = c;
      document.querySelectorAll('.child-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    };
    childrenList.appendChild(btn);
  });

  selectedChild = children[0] || null;
  if (childrenList.children[0]) childrenList.children[0].classList.add('selected');
}

function renderPreview(data) {
  let html = '<div class="preview-header"><span>📋 Preview Data SIPP</span></div>';

  if (data.children.length) {
    html += `<div class="preview-section"><div class="preview-section-title">👶 Data Anak (${data.children.length})</div>`;
    data.children.forEach((c, i) => {
      html += `<div class="preview-field"><span class="preview-label">Anak ${i + 1}</span><span class="preview-value">${c.nama || 'Tanpa Nama'}</span></div>`;
    });
    html += '</div>';
  }

  if (data.posita) html += `<div class="preview-section"><div class="preview-section-title">📝 Posita</div><div class="preview-field"><span class="preview-label">Panjang</span><span class="preview-value">${data.posita.length} karakter</span></div></div>`;
  if (data.petitum) html += `<div class="preview-section"><div class="preview-section-title">📋 Petitum</div><div class="preview-field"><span class="preview-label">Panjang</span><span class="preview-value">${data.petitum.length} karakter</span></div></div>`;

  const mi = data.marriage_info || {};
  if (Object.values(mi).some(Boolean)) {
    html += '<div class="preview-section"><div class="preview-section-title">💍 Info Pernikahan</div>';
    [
      ['Tanggal Menikah', mi.tanggal_menikah],
      ['Tanggal Dicatat', mi.tanggal_dicatat],
      ['No. Akta Nikah', mi.nomor_akta_nikah],
      ['KUA Tempat Menikah', mi.kua_dicatat],
    ].forEach(([label, value]) => {
      if (value) html += `<div class="preview-field"><span class="preview-label">${label}</span><span class="preview-value" title="${value}">${value}</span></div>`;
    });
    html += '</div>';
  }

  previewEl.innerHTML = html;
  previewEl.className = 'preview show';
}

async function fillAllSipp() {
  if (!parsedData) return showStatus('⚠️ Parse data dulu sebelum fill.', 'error');

  btnFillAll.disabled = true;
  btnFillAll.textContent = '⏳ Filling...';
  showStatus('⏳ Mengisi form SIPP...', 'info');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const isSippPage = tab && ['ecourt.mahkamahagung.go.id', '25.24.23.7'].some(host => tab.url.includes(host));
    if (!isSippPage) return showStatus('❌ Buka halaman SIPP/eCourt dulu.', 'error');

    const dataForFill = selectedChild ? { ...parsedData, children: [selectedChild] } : parsedData;
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      func: fillSippMainWorld,
      args: [dataForFill],
    });

    renderFillResult(results?.[0]?.result || { success: false, errors: ['Tidak ada response dari halaman SIPP'] });
  } catch (e) {
    showStatus(`❌ Error: ${e.message}. Coba refresh halaman SIPP.`, 'error');
  } finally {
    btnFillAll.disabled = false;
    btnFillAll.textContent = '⚡ Fill Semua ke SIPP';
  }
}

function renderFillResult(response) {
  document.getElementById('errorDetails')?.remove();
  const filled = response?.filledFields || 0;
  const errors = response?.errors || [];

  if (filled && !errors.length) return showStatus(`✅ Berhasil mengisi ${filled} field.`, 'success');
  if (filled && errors.length) {
    showStatus(`⚠️ ${filled} field berhasil, ${errors.length} gagal.`, 'info');
    return renderErrorDetails(errors);
  }
  if (errors.length) {
    showStatus('❌ Semua field gagal diisi. Lihat detail di bawah.', 'error');
    return renderErrorDetails(errors);
  }
  showStatus('⚠️ Gagal mengisi form SIPP.', 'error');
}

function renderErrorDetails(errors) {
  const div = document.createElement('div');
  div.id = 'errorDetails';
  div.style.cssText = 'margin-top:8px;padding:8px;background:#fff3cd;border:1px solid #ffc107;border-radius:6px;font-size:10px;max-height:150px;overflow-y:auto;';
  div.innerHTML = '<div style="font-weight:600;margin-bottom:4px;color:#856404;">⚠️ Field yang gagal:</div>' +
    errors.map(err => `<div style="padding:2px 0;color:#856404;border-bottom:1px solid #ffeeba;">• ${err}</div>`).join('') +
    '<div style="margin-top:6px;font-size:9px;color:#856404;">💡 Pastikan popup/form SIPP yang sesuai sedang terbuka.</div>';
  statusEl.parentNode.insertBefore(div, statusEl.nextSibling);
}

btnPaste.addEventListener('click', async () => {
  try {
    jsonInput.value = await navigator.clipboard.readText();
    showStatus('📋 Berhasil paste dari clipboard.', 'info');
    parseJSON();
  } catch (e) {
    showStatus('❌ Gagal akses clipboard. Paste manual (Ctrl+V).', 'error');
  }
});

btnParse.addEventListener('click', parseJSON);
btnFillAll.addEventListener('click', fillAllSipp);
if (jsonInput.value.trim()) parseJSON();

async function fillSippMainWorld(data) {
  const result = { filledFields: 0, errors: [] };
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

  function isVisible(node) {
    if (!node) return false;
    let el = node;
    while (el && el !== document) {
      const s = window.getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden') return false;
      el = el.parentElement;
    }
    return true;
  }

  const isDataAnakForm = isVisible(document.querySelector('form[action*="addAnakPihak"], #frm_user'));

  function setVal(el, value) {
    if (!el || value === undefined || value === null || String(value).trim() === '') return false;
    const val = String(value);
    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    try { setter ? setter.call(el, val) : (el.value = val); } catch (_) { el.value = val; }

    if (typeof jQuery !== 'undefined') {
      try {
        const $el = jQuery(el);
        if ($el.hasClass('hasDatepicker') || $el.data('datepicker')) {
          const [d, m, yRaw] = val.split('/');
          if (d && m && yRaw) {
            const y = yRaw.length === 2 ? `20${yRaw}` : yRaw;
            const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
            if (!Number.isNaN(date.getTime())) $el.datepicker('setDate', date);
          }
        }
        $el.val(val).trigger('input').trigger('change').trigger('blur');
      } catch (_) {}
    }

    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
    return true;
  }

  function norm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[._/()–—-]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function compact(s) {
    return norm(s).replace(/\s+/g, '');
  }

  function cleanKua(s) {
    return norm(s)
      .replace(/\bkantor urusan agama\b/g, ' ')
      .replace(/\bkua\b/g, ' ')
      .replace(/\bkecamatan\b/g, ' ')
      .replace(/\bkec\b/g, ' ')
      .replace(/\badm\b/g, ' ')
      .replace(/\badministrasi\b/g, ' ')
      .replace(/\bkota\b/g, ' ')
      .replace(/\bkabupaten\b/g, ' ')
      .replace(/\bkab\b/g, ' ')
      .replace(/\bprovinsi\b/g, ' ')
      .replace(/\bpropinsi\b/g, ' ')
      .replace(/\bdaerah khusus ibukota\b/g, ' ')
      .replace(/\bdki\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function tokenSubset(small, big) {
    const smallTokens = cleanKua(small).split(/\s+/).filter(t => t.length > 2);
    const bigTokens = cleanKua(big).split(/\s+/).filter(t => t.length > 2);
    return smallTokens.length > 0 && smallTokens.every(t => bigTokens.includes(t));
  }

  function kuaMatches(optionText, wantedText) {
    const optionNorm = norm(optionText);
    const wantedNorm = norm(wantedText);
    const optionClean = cleanKua(optionText);
    const wantedClean = cleanKua(wantedText);
    if (!optionNorm || !wantedNorm) return false;
    return optionNorm === wantedNorm || optionNorm.includes(wantedNorm) || wantedNorm.includes(optionNorm) ||
      compact(optionNorm).includes(compact(wantedNorm)) || compact(wantedNorm).includes(compact(optionNorm)) ||
      optionClean === wantedClean || optionClean.includes(wantedClean) || wantedClean.includes(optionClean) ||
      compact(optionClean).includes(compact(wantedClean)) || compact(wantedClean).includes(compact(optionClean)) ||
      tokenSubset(wantedText, optionText) || tokenSubset(optionText, wantedText);
  }

  function selectOption(select, option, displayText) {
    if (!select || !option) return false;
    const options = Array.from(select.options || []);
    options.forEach(o => { o.selected = false; });
    option.selected = true;
    select.selectedIndex = options.indexOf(option);
    select.value = option.value;

    if (typeof jQuery !== 'undefined') {
      try { jQuery(select).val(option.value).trigger('change').trigger('input').trigger('blur'); } catch (_) {}
    }

    select.dispatchEvent(new Event('input', { bubbles: true }));
    select.dispatchEvent(new Event('change', { bubbles: true }));

    const text = displayText || option.textContent || option.text || '';
    const container = document.getElementById(`select2-${select.id}-container`);
    if (container) {
      container.textContent = text;
      container.setAttribute('title', text);
    }
    return true;
  }

  function setSelect(select, value) {
    if (!select || !value) return false;
    const raw = String(value).trim();
    const valueNorm = norm(raw);
    const fieldKey = norm(`${select.id || ''} ${select.name || ''}`);
    const isDiasuh = fieldKey.includes('diasuh');
    const isJenisKelamin = fieldKey.includes('jenis kelamin') || fieldKey.includes('jeniskelamin');
    const isPendidikan = fieldKey.includes('pendidikan');

    const map = {
      sd: 'sekolah dasar', smp: 'sekolah lanjutan tingkat pertama', sltp: 'sekolah lanjutan tingkat pertama', mts: 'sekolah lanjutan tingkat pertama',
      sma: 'sekolah lanjutan tingkat atas', smk: 'sekolah lanjutan tingkat atas', ma: 'sekolah lanjutan tingkat atas', slta: 'sekolah lanjutan tingkat atas',
      s1: 'strata i', 'strata 1': 'strata i', s2: 'strata ii', 'strata 2': 'strata ii', s3: 'strata iii', 'strata 3': 'strata iii',
      d1: 'diploma i', d2: 'diploma ii', d3: 'diploma iii', d4: 'diploma iv', tk: 'taman kanak-kanak', paud: 'taman kanak-kanak',
      'tidak sekolah': 'tidak ada', 'belum sekolah': 'tidak ada', penggugat: 'penggugat/pemohon', pemohon: 'penggugat/pemohon',
      tergugat: 'tergugat/termohon', termohon: 'tergugat/termohon', 'orang tua': 'orang tua p atau t', 'orang tua p/t': 'orang tua p atau t',
      'orang tua p atau t': 'orang tua p atau t', 'lain lain': 'lain-lain', 'lain-lain': 'lain-lain', lainnya: 'lain-lain',
      'laki laki': 'laki-laki', 'laki-laki': 'laki-laki', perempuan: 'perempuan',
    };

    let wanted = map[valueNorm] || valueNorm;

    if (isDiasuh) {
      if (valueNorm.includes('penggugat') || valueNorm.includes('pemohon')) wanted = 'penggugat/pemohon';
      else if (valueNorm.includes('tergugat') || valueNorm.includes('termohon')) wanted = 'tergugat/termohon';
      else if (valueNorm === 'p') wanted = 'penggugat/pemohon';
      else if (valueNorm === 't') wanted = 'tergugat/termohon';
    }

    if (isPendidikan) {
      if (valueNorm.includes('belum sekolah') || valueNorm.includes('tidak sekolah') || valueNorm.includes('belum tamat')) wanted = 'tidak ada';
      else if (/\bsd\b/.test(valueNorm)) wanted = 'sekolah dasar';
      else if (/\b(smp|sltp|mts)\b/.test(valueNorm)) wanted = 'sekolah lanjutan tingkat pertama';
      else if (/\b(sma|smk|slta|ma)\b/.test(valueNorm)) wanted = 'sekolah lanjutan tingkat atas';
    }

    if (isJenisKelamin) {
      if (['l', 'lk'].includes(valueNorm)) wanted = 'laki-laki';
      if (['p', 'pr'].includes(valueNorm)) wanted = 'perempuan';
    }

    const options = Array.from(select.options || []);
    let option = null;
    if (isDiasuh || isPendidikan || isJenisKelamin) {
      option = options.find(o => norm(o.textContent || o.text) === wanted || compact(o.textContent || o.text) === compact(wanted));
    }
    if (!option) option = options.find(o => String(o.value) === raw);
    if (!option) option = options.find(o => {
      const t = norm(o.textContent || o.text);
      return t === wanted || t.includes(wanted) || wanted.includes(t) || compact(t).includes(compact(wanted)) || compact(wanted).includes(compact(t));
    });
    return selectOption(select, option);
  }

  function textToHtml(text) {
    if (!text) return '';
    if (/<[a-z][\s\S]*>/i.test(text)) {
      return text.replace(/<p(\s[^>]*)?>/gi, '<p$1 style="text-align:justify">').replace(/<li(\s[^>]*)?>/gi, '<li$1 style="text-align:justify">');
    }

    const lines = String(text).split(/\r?\n/);
    let html = '';
    let inMainOl = false;
    let currentMainOpen = false;
    let inSubList = false;

    const closeSub = () => { if (inSubList) { html += '</ul>'; inSubList = false; } };
    const closeMainLi = () => { if (currentMainOpen) { closeSub(); html += '</li>'; currentMainOpen = false; } };
    const closeMainOl = () => { closeMainLi(); if (inMainOl) { html += '</ol>'; inMainOl = false; } };

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        closeMainOl();
        html += '<p style="text-align:justify">&nbsp;</p>';
        continue;
      }

      const subDecimal = line.match(/^(\d+\.\d+\.?)(\s+.+)$/);
      const subAlpha = line.match(/^([a-z])[.)]\s+(.+)$/i);
      const main = line.match(/^(\d+)[.)]\s+(.+)$/);

      if (subDecimal && currentMainOpen) {
        if (!inSubList) { html += '<ul style="list-style-type:none;margin-left:20px;padding-left:0">'; inSubList = true; }
        html += `<li style="text-align:justify">${line}</li>`;
        continue;
      }

      if (subAlpha && currentMainOpen) {
        if (!inSubList) { html += '<ul style="list-style-type:none;margin-left:20px;padding-left:0">'; inSubList = true; }
        html += `<li style="text-align:justify">${subAlpha[1]}. ${subAlpha[2]}</li>`;
        continue;
      }

      if (main && !/^\d+\.\d+/.test(line)) {
        closeMainLi();
        if (!inMainOl) { html += '<ol>'; inMainOl = true; }
        html += `<li style="text-align:justify">${main[2]}`;
        currentMainOpen = true;
        continue;
      }

      if (currentMainOpen) html += `<br>${line}`;
      else {
        closeMainOl();
        html += `<p style="text-align:justify">${line}</p>`;
      }
    }

    closeMainOl();
    return html;
  }

  function fillEditor(id, value) {
    const html = textToHtml(value);
    if (typeof CKEDITOR !== 'undefined' && CKEDITOR.instances?.[id]) {
      CKEDITOR.instances[id].setData(html);
      const textarea = document.getElementById(id);
      if (textarea) textarea.value = html;
      return true;
    }
    const textarea = document.getElementById(id);
    return textarea ? setVal(textarea, html) : false;
  }

  async function fillKua(value) {
    const wanted = String(value || '').trim();
    if (!wanted) return false;

    const select = document.getElementById('ref_kua');
    if (!select) {
      result.errors.push('KUA Tempat Menikah: #ref_kua tidak ditemukan. Buka popup Edit Data Umum terlebih dahulu.');
      return false;
    }

    const existing = Array.from(select.options || []);
    const optionFromExisting = existing.find(o => o.value && kuaMatches(o.textContent || o.text, wanted));
    if (optionFromExisting && selectOption(select, optionFromExisting)) return true;

    const district = cleanKua(wanted).split(/\s+/).find(Boolean) || wanted;
    const optionByDistrict = existing.find(o => o.value && cleanKua(o.textContent || o.text).split(/\s+/).includes(district));
    if (optionByDistrict && selectOption(select, optionByDistrict)) return true;

    // Select2 AJAX search. This keeps the real SIPP KUA id when the option is not preloaded.
    if (typeof jQuery !== 'undefined' && jQuery(select).data('select2')) {
      const $select = jQuery(select);
      const terms = [wanted, cleanKua(wanted), district].filter((v, i, arr) => v && arr.indexOf(v) === i);
      for (const term of terms) {
        try {
          $select.select2('open');
          await delay(250);
          const input = document.querySelector('.select2-container--open .select2-search__field');
          if (!input) continue;
          input.value = term;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: term.slice(-1) || 'a' }));
          jQuery(input).val(term).trigger('input').trigger('keyup');
          await delay(1200);

          const results = Array.from(document.querySelectorAll('.select2-results__option')).filter(el => {
            const t = norm(el.textContent);
            return t && !t.includes('mencari') && !t.includes('searching') && !t.includes('tidak ditemukan') && !t.includes('no results');
          });
          const resultOption = results.find(el => kuaMatches(el.textContent, wanted)) || results.find(el => kuaMatches(el.textContent, term));
          if (resultOption) {
            resultOption.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            resultOption.click();
            await delay(250);
            const selectedText = document.getElementById('select2-ref_kua-container')?.textContent || '';
            if (selectedText && kuaMatches(selectedText, wanted)) return true;
            const refreshed = Array.from(select.options || []).find(o => o.selected || kuaMatches(o.textContent || o.text, wanted));
            if (refreshed && selectOption(select, refreshed)) return true;
          }
          try { $select.select2('close'); } catch (_) {}
        } catch (_) {}
      }
    }

    result.errors.push(`KUA Tempat Menikah: tidak ditemukan/terpilih (${wanted}). Coba buka dropdown KUA manual sekali, lalu klik Fill lagi.`);
    return false;
  }

  if (!isDataAnakForm) {
    if (data.tanggal_surat) {
      const el = document.getElementById('tgl_surat');
      if (el && setVal(el, data.tanggal_surat)) result.filledFields++;
      else result.errors.push('Tanggal Surat: #tgl_surat tidak ditemukan.');
    }

    const mi = data.marriage_info || {};
    for (const [label, id, value] of [
      ['Tanggal Menikah', 'tgl_nikah', mi.tanggal_menikah],
      ['Tanggal Kutipan Akta Nikah', 'tgl_kutipan_akta_nikah', mi.tanggal_dicatat],
      ['Nomor Kutipan Akta Nikah', 'no_kutipan_akta_nikah', mi.nomor_akta_nikah],
    ]) {
      if (!value) continue;
      const el = document.getElementById(id);
      if (el && setVal(el, value)) result.filledFields++;
      else result.errors.push(`${label}: #${id} tidak ditemukan.`);
    }

    if (mi.kua_dicatat) {
      if (await fillKua(mi.kua_dicatat)) result.filledFields++;
    }

    if (data.obyek_sengketa) {
      const el = document.getElementById('obyek_gugatan');
      if (el && setVal(el, data.obyek_sengketa)) result.filledFields++;
      else result.errors.push('Obyek Sengketa: #obyek_gugatan tidak ditemukan.');
    }

    if (data.posita) {
      let ok = false;
      for (let i = 0; i < 3 && !ok; i++) { ok = fillEditor('posita', data.posita); if (!ok) await delay(300); }
      if (ok) result.filledFields++;
      else result.errors.push('Posita: CKEditor/textarea #posita tidak ditemukan.');
    }

    if (data.petitum) {
      let ok = false;
      for (let i = 0; i < 3 && !ok; i++) { ok = fillEditor('petitum', data.petitum); if (!ok) await delay(300); }
      if (ok) result.filledFields++;
      else result.errors.push('Petitum: CKEditor/textarea #petitum tidak ditemukan.');
    }
  }

  if (Array.isArray(data.children)) {
    for (const child of data.children) {
      for (const [key, value, selectors] of [
        ['anak_ke', child.anak_ke ? String(child.anak_ke) : '', ['#anak_ke', 'input[name="anak_ke" i]', 'input[name*="anakke" i]']],
        ['nama', child.nama, ['#nama', 'input[name="nama" i]']],
        ['nik', child.nik || '', ['#nik', 'input[name="nik" i]', 'input[name*="nik" i]']],
        ['tempat_lahir', child.tempat_lahir, ['#tempat_lahir', 'input[name="tempat_lahir" i]', 'input[name*="tempatlahir" i]']],
        ['tanggal_lahir', child.tanggal_lahir, ['#tgl_lahir', 'input[name="tgl_lahir" i]', 'input[name="tanggal_lahir" i]', 'input[name*="tanggallahir" i]']],
      ]) {
        if (!value) continue;
        const el = selectors.map(s => document.querySelector(s)).find(Boolean);
        if (el && setVal(el, value)) result.filledFields++;
        else if (isDataAnakForm) result.errors.push(`Data Anak ${key}: field tidak ditemukan.`);
      }

      for (const [key, value, selectors] of [
        ['jenis_kelamin', child.jenis_kelamin, ['#jenis_kelamin', 'select[name="jenis_kelamin" i]']],
        ['pendidikan', child.pendidikan, ['#pendidikan', 'select[name="pendidikan" i]', 'select[name="jenis_pendidikan" i]']],
        ['pengasuhan', child.pengasuhan, ['#diasuh_oleh', 'select[name="diasuh_oleh" i]', 'select[name*="diasuh" i]', 'select[id*="diasuh" i]']],
      ]) {
        if (!value) continue;
        const el = selectors.map(s => document.querySelector(s)).find(Boolean);
        if (el && setSelect(el, value)) result.filledFields++;
        else if (isDataAnakForm) result.errors.push(`Data Anak ${key}: dropdown tidak ditemukan/tidak cocok.`);
      }
    }
  }

  result.success = result.filledFields > 0;
  return result;
}
