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
  const calonMempelaiSource = [data.calon_mempelai, data.calonMempelai, data.mempelai, data.candidates]
    .find(value => value && typeof value === 'object' && !Array.isArray(value)) || {};
  const marriageSource = data.marriage_info && typeof data.marriage_info === 'object' ? data.marriage_info : {};
  const isbatSource = data.isbat_info && typeof data.isbat_info === 'object' ? data.isbat_info : {};
  const caseDetailSource = [data.case_details, data.data_umum, data.additional_fields]
    .find(value => value && typeof value === 'object' && !Array.isArray(value)) || {};
  const detailValue = (...keys) => firstNonEmpty(
    ...keys.flatMap(key => [caseDetailSource[key], data[key]])
  );
  const detailArray = (...keys) => {
    for (const key of keys) {
      const value = caseDetailSource[key] ?? data[key];
      if (Array.isArray(value)) return value.filter(item => item !== undefined && item !== null && String(item).trim() !== '');
    }
    return [];
  };

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
    marriageSource.kua_menikah, marriageSource.kua,
    data.kua_dicatat, data.kua_tempat_menikah, data.kua_tempat_nikah, data.kua_menikah,
    data.kua
  );

  // Isbat Nikah has its own Data Umum fields.  Keep ceremony location apart
  // from KUA: #tempat_menikah_isbat is free text; #ref_kua is Select2.
  const alasanIsbat = firstNonEmpty(
    isbatSource.alasan_isbat, isbatSource.alasan, isbatSource.alasan_pengajuan,
    data.alasan_isbat, data.alasanIsbat, data.alasan_pengajuan_isbat
  );
  const tempatMenikahIsbat = firstNonEmpty(
    isbatSource.tempat_menikah, isbatSource.tempat,
    marriageSource.tempat_menikah, marriageSource.tempat_nikah,
    data.tempat_menikah, data.tempat_nikah
  );

  return {
    children: childSource.map(normalizeChild),
    // Dispensasi Kawin uses one form containing both calon mempelai. Keep
    // them separate from `children`: SIPP IDs for calon wanita use suffix `2`.
    calon_mempelai: {
      pria: normalizeCalonMempelai(calonMempelaiSource.pria || calonMempelaiSource.laki_laki || calonMempelaiSource.lakiLaki || calonMempelaiSource.calon_pria || calonMempelaiSource.calon_mempelai_pria || data.calon_mempelai_pria),
      wanita: normalizeCalonMempelai(calonMempelaiSource.wanita || calonMempelaiSource.perempuan || calonMempelaiSource.calon_wanita || calonMempelaiSource.calon_mempelai_wanita || data.calon_mempelai_wanita),
    },
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
    isbat_info: {
      alasan_isbat: alasanIsbat,
      // SIPP datepicker requires DD/MM/YYYY; narrative dates are not valid here.
      tanggal_menikah: normalizeDate(firstNonEmpty(
        isbatSource.tanggal_menikah, isbatSource.tgl_menikah,
        data.tanggal_menikah_isbat, data.tgl_menikah_isbat, tanggalMenikah
      )),
      tempat_menikah: tempatMenikahIsbat,
    },
    case_details: {
      alasan_poligami: detailValue('alasan_poligami'),
      penghasilan_poligami: detailValue('penghasilan_poligami'),
      batal_kawin: detailValue('batal_kawin', 'alasan_pembatalan_kawin'),
      alasan_kuasa_anak: detailValue('alasan_kuasa_anak', 'alasan_penguasaan_anak'),
      alasan_sah_anak: detailValue('alasan_sah_anak', 'alasan_pengesahan_anak'),
      alasan_asalusul: detailValue('alasan_asalusul', 'alasan_asal_usul_anak'),
      alasan_dispen: detailValue('alasan_dispen', 'alasan_dispensasi_kawin'),
      objek_wakaf: detailArray('objek_wakaf'),
      perkara_kumulasi: detailArray('perkara_kumulasi'),
    },
  };
}

function normalizeBoolean(value) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  return ['1', 'true', 'ya', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function normalizeCalonMempelai(c) {
  c = c && typeof c === 'object' ? c : {};
  return {
    dimohonkan: normalizeBoolean(c.dimohonkan ?? c.dimohonkan_diska ?? c.yang_dimohonkan ?? c.is_dimohonkan),
    nama: firstNonEmpty(c.nama, c.name, c.nama_lengkap),
    nik: firstNonEmpty(c.nik, c.NIK),
    tempat_lahir: firstNonEmpty(c.tempat_lahir, c.tempatLahir, c.tmp_lahir, c.tempat),
    tanggal_lahir: normalizeDate(firstNonEmpty(c.tanggal_lahir, c.tanggalLahir, c.tgl_lahir, c.tanggal)),
    pendidikan: firstNonEmpty(c.pendidikan, c.jenis_pendidikan),
    pekerjaan: firstNonEmpty(c.pekerjaan, c.job),
    penghasilan: firstNonEmpty(c.penghasilan, c.penghasilan_bulanan, c.penghasilan_per_bulan, c.income),
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
    // SIPP accepts "Tidak Ada" for a child whose education is not stated.
    pendidikan: firstNonEmpty(c.pendidikan, c.jenis_pendidikan) || 'Tidak Ada',
    pengasuhan: firstNonEmpty(c.pengasuhan, c.diasuh_oleh, c.diasuhOleh, c.diasuh, c.hadhanah) || 'Penggugat',
  };
}

// Auto-save must never create a partial child record. `anak_ke` is omitted
// because SIPP can infer it from existing child records. NIK is optional, and
// education is normalized to "Tidak Ada"; the other identity fields must be
// present before an automatic save is allowed.
function getMissingChildFields(child) {
  const fields = [
    ['Nama Anak', child?.nama],
    ['Tempat Lahir', child?.tempat_lahir],
    ['Tanggal Lahir', child?.tanggal_lahir],
    ['Jenis Kelamin', child?.jenis_kelamin],
    ['Pendidikan', child?.pendidikan],
    ['Diasuh Oleh', child?.pengasuhan],
  ];
  return fields
    .filter(([, value]) => value === undefined || value === null || String(value).trim() === '')
    .map(([label]) => label);
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
      // A single child also needs the automatic save path.  Previously this
      // toggle was hidden unless there were 2+ children, so the first/only
      // child could never be saved automatically.
      document.getElementById('autoSaveRow').style.display = 'flex';
    } else {
      showStatus('✅ Data siap di-fill ke SIPP.', 'success');
      childrenList.innerHTML = '';
      childrenList.style.display = 'none';
      document.getElementById('autoSaveRow').style.display = 'none';
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

  const calon = data.calon_mempelai || {};
  const calonEntries = [['Calon Pria', calon.pria], ['Calon Wanita', calon.wanita]]
    .filter(([, value]) => Object.values(value || {}).some(value => value !== '' && value !== null));
  if (calonEntries.length) {
    html += '<div class="preview-section"><div class="preview-section-title">💑 Data Calon Mempelai</div>';
    calonEntries.forEach(([label, value]) => {
      html += `<div class="preview-field"><span class="preview-label">${label}</span><span class="preview-value" title="${value.nama || ''}">${value.nama || 'Tanpa Nama'}</span></div>`;
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

  const isbat = data.isbat_info || {};
  if (Object.values(isbat).some(Boolean)) {
    html += '<div class="preview-section"><div class="preview-section-title">🕌 Data Isbat Nikah</div>';
    [
      ['Alasan Isbat', isbat.alasan_isbat],
      ['Tanggal Menikah', isbat.tanggal_menikah],
      ['Tempat Menikah', isbat.tempat_menikah],
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

    const autoSave = Boolean(document.getElementById('autoSaveToggle')?.checked && parsedData?.children?.length);
    const dataForFill = autoSave
      ? { ...parsedData, autoSave: true }
      : selectedChild ? { ...parsedData, children: [selectedChild] } : parsedData;

    if (autoSave) {
      // Auto-fill all children sequentially with Simpan + reopen between each
      // Flow: Open popup → Fill → Simpan (form POST, page reloads, popup closes) → reopen popup → next child
      const children = parsedData.children;
      showStatus(`🔄 Auto-fill ${children.length} anak...`, 'info');
      let stopped = false;

      // Ensure Data Anak popup is open before we start filling
      showStatus('⏳ Membuka form Data Anak...', 'info');
      const initialOpen = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: 'MAIN',
        func: reopenDataAnakPopup,
      });
      if (!initialOpen?.[0]?.result?.success) {
        showStatus(`❌ ${initialOpen?.[0]?.result?.error || 'Gagal buka form Data Anak'}`, 'error');
        return;
      }
      const initialForm = await waitForDataAnakForm(tab.id);
      if (!initialForm.success) {
        showStatus(`❌ ${initialForm.error}`, 'error');
        return;
      }

      for (let i = 0; i < children.length; i++) {
        const isLast = i === children.length - 1;
        const missingFields = getMissingChildFields(children[i]);
        if (missingFields.length) {
          const message = `Anak ${i + 1} (${children[i].nama || 'tanpa nama'}) dihentikan — data kosong: ${missingFields.join(', ')}. Data anak ini tidak disimpan dan proses tidak lanjut ke anak berikutnya.`;
          showStatus(`⚠️ ${message}`, 'error');
          renderErrorDetails([message]);
          stopped = true;
          break;
        }
        // The injected fill function marks a submit as ready only when
        // autoSave is present. Keep it true for EVERY child, including last.
        const childData = { ...parsedData, children: [children[i]], autoSave: true, isLastChild: false };
        showStatus(`⏳ Mengisi anak ${i + 1}/${children.length}: ${children[i].nama || ''}...`, 'info');

        let results;
        try {
          results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            world: 'MAIN',
            func: fillSippMainWorld,
            args: [childData],
          });
        } catch (scriptErr) {
          showStatus(`❌ Script error anak ${i + 1}: ${scriptErr.message}`, 'error');
          stopped = true;
          break;
        }

        const res = results?.[0]?.result;
        if (i === 0) renderFillResult(res || { success: false, errors: ['Tidak ada response'] });

        // A missing or mismatched field in the SIPP form is a hard stop too.
        // Never save a partly populated child merely because other fields filled.
        if (res?.errors?.length) {
          const message = `Anak ${i + 1} belum disimpan: ${res.errors.join('; ')}`;
          showStatus(`⚠️ ${message}`, 'error');
          renderErrorDetails([message]);
          stopped = true;
          break;
        }

        if (res?.submitted || (res?.success && res?.filledFields > 0)) {
          // Register the navigation watcher BEFORE clicking Simpan. The old
          // implementation watched afterwards, so it often missed the fast
          // SIPP POST/reload and falsely continued while the form was still open.
          showStatus(`⏳ Menyimpan anak ${i + 1}...`, 'info');
          const saved = await submitDataAnak(tab.id);
          if (!saved.success) {
            showStatus(`❌ Anak ${i + 1} belum tersimpan: ${saved.error}`, 'error');
            stopped = true;
            break;
          }
          if (isLast) {
            showStatus(`✅ Anak ${i + 1}/${children.length} sudah tersimpan.`, 'success');
            break;
          }

          // Reopen Data Anak popup for the next child
          showStatus(`⏳ Membuka kembali form Data Anak untuk anak ${i + 2}...`, 'info');
          const reopenRes = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            world: 'MAIN',
            func: reopenDataAnakPopup,
          });
          const reopen = reopenRes?.[0]?.result;
          if (!reopen?.success) {
            showStatus(`❌ Gagal buka form Data Anak: ${reopen?.error || 'tombol tidak ditemukan'}. Silakan buka manual, lalu klik Fill lagi.`, 'error');
            stopped = true;
            break;
          }
          const nextForm = await waitForDataAnakForm(tab.id);
          if (!nextForm.success) {
            showStatus(`❌ Anak ${i + 2} belum bisa dibuka: ${nextForm.error}`, 'error');
            stopped = true;
            break;
          }
        } else {
          // Fill failed or button not found
          const errText = res?.errors?.length ? res.errors.join('; ')
            : res === undefined || res === null ? 'Function tidak mengembalikan result (kemungkinan JS error di halaman SIPP)'
            : 'Tidak ada response';
          showStatus(`❌ Gagal mengisi anak ${i + 1}: ${errText}`, 'error');
          stopped = true;
          break;
        }
      }

      if (!stopped) {
        showStatus(`✅ Berhasil isi ${children.length} anak!`, 'success');
      }
    } else {
      let results;
      try {
        results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          world: 'MAIN',
          func: fillSippMainWorld,
          args: [dataForFill],
        });
      } catch (scriptErr) {
        return showStatus(`❌ Script error: ${scriptErr.message}`, 'error');
      }
      renderFillResult(results?.[0]?.result || { success: false, errors: ['Tidak ada response dari halaman SIPP'] });
    }
  } catch (e) {
    showStatus(`❌ Error: ${e.message}. Coba refresh halaman SIPP.`, 'error');
  } finally {
    btnFillAll.disabled = false;
    btnFillAll.textContent = '⚡ Fill Semua ke SIPP';
  }
}

async function waitForDataAnakForm(tabId, timeout = 10000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId }, world: 'MAIN',
        func: () => {
          const form = document.querySelector('form[action*="addAnakPihak" i], form[action*="add_anak" i], #frm_user');
          if (!form) return false;
          const style = window.getComputedStyle(form);
          return style.display !== 'none' && style.visibility !== 'hidden';
        },
      });
      if (result) return { success: true };
    } catch (_) { /* page can be navigating; retry */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  return { success: false, error: 'Form Data Anak tidak muncul dalam 10 detik.' };
}

function submitDataAnak(tabId, timeout = 12000) {
  return new Promise(resolve => {
    let done = false;
    const finish = value => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve(value);
    };
    const listener = (id, info) => {
      if (id === tabId && info.status === 'complete') finish({ success: true });
    };
    chrome.tabs.onUpdated.addListener(listener);
    const timer = setTimeout(() => finish({ success: false, error: 'SIPP tidak memuat ulang setelah tombol Simpan diklik. Periksa pesan validasi di form.' }), timeout);

    chrome.scripting.executeScript({
      target: { tabId }, world: 'MAIN',
      func: () => {
        const form = document.querySelector('form[action*="addAnakPihak" i], form[action*="add_anak" i], #frm_user');
        const btn = form?.querySelector('input[type="submit"], button[type="submit"]');
        if (!btn) return { clicked: false, error: 'Tombol Simpan tidak ditemukan pada form Data Anak.' };
        if (btn.disabled) return { clicked: false, error: 'Tombol Simpan sedang nonaktif.' };
        // SIPP displays the native browser confirmation: "Apakah Anda Yakin
        // Akan Menyimpan Data". It is synchronous within the click handler,
        // so temporarily approving confirm() lets the auto-save flow proceed
        // without leaving a native dialog that blocks the next child.
        const originalConfirm = window.confirm;
        try {
          window.confirm = () => true;
          btn.click();
          return { clicked: true, confirmation: 'approved' };
        } finally {
          window.confirm = originalConfirm;
        }
      },
    }).then(([{ result }]) => {
      if (!result?.clicked) finish({ success: false, error: result?.error || 'Tombol Simpan tidak dapat diklik.' });
    }).catch(() => {
      // A navigation can abort script delivery. The registered tab listener
      // decides success; otherwise the timeout reports a useful validation error.
    });
  });
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

/**
 * Reopen the Data Anak popup on the SIPP case detail page.
 * After Simpan, the form POSTs and the popup closes. This function finds and clicks
 * the button/link that reopens the Data Anak input form.
 *
 * Injected into SIPP MAIN world via chrome.scripting.executeScript.
 */
function reopenDataAnakPopup() {
  const isVisible = (node) => {
    if (!node) return false;
    let el = node;
    while (el && el !== document) {
      const s = window.getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false;
      el = el.parentElement;
    }
    return true;
  };

  // Strategy 1: only click an explicit ADD action. Never match generic
  // "anak_pihak" routes: SIPP's Hapus Anak link shares that text and the
  // previous broad selector could click it while preparing the next child.
  for (const el of document.querySelectorAll('a[onclick*="popup_form"], button[onclick*="popup_form"], input[onclick*="popup_form"]')) {
    const onclick = el.getAttribute('onclick') || '';
    const isAddAction = /add_anak|addAnak|addAnakPihak/i.test(onclick);
    const isDestructiveAction = /hapus|delete|remove|edit/i.test(onclick);
    if (isAddAction && !isDestructiveAction) {
      if (isVisible(el)) {
        el.click();
        return { success: true, method: 'onclick-popup_form' };
      }
    }
  }

  // Strategy 2: Find links/buttons with text matching "tambah" + "anak"
  for (const el of document.querySelectorAll('a, button, input[type="button"], input[type="submit"]')) {
    const text = (el.textContent || el.value || '').toLowerCase().trim();
    if ((text.includes('tambah') && text.includes('anak')) || text.includes('input data anak')) {
      if (isVisible(el)) {
        el.click();
        return { success: true, method: 'text-match' };
      }
    }
  }

  // Strategy 3: href must explicitly be an add action, never the generic
  // anak_pihak route that is also used by delete/edit links.
  for (const el of document.querySelectorAll('a[href*="add_anak" i], a[href*="addAnak" i], a[href*="addAnakPihak" i]')) {
    if (isVisible(el)) {
      el.click();
      return { success: true, method: 'href-match' };
    }
  }

  // Strategy 4: Look for popup_form function and call it directly with the add_anak URL
  if (typeof window.popup_form === 'function') {
    // Try to find the URL from existing onclick attributes
    for (const el of document.querySelectorAll('[onclick*="popup_form"]')) {
      const onclick = el.getAttribute('onclick') || '';
      const match = onclick.match(/popup_form\(['"]([^'"]*(?:add_anak|addAnak|addAnakPihak)[^'"]*)['"]\)/i);
      if (match) {
        window.popup_form(match[1]);
        return { success: true, method: 'popup_form-direct-call' };
      }
    }
  }

  return { success: false, error: 'Tombol "Tambah Data Anak" tidak ditemukan. Pastikan halaman detail perkara terbuka.' };
}

async function fillSippMainWorld(data) {
  const result = { filledFields: 0, errors: [] };
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

  try {

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
  const isCalonMempelaiForm = isVisible(document.querySelector('#nama2, input[name="nama2" i]')) &&
    /input calon mempelai/i.test(document.body?.textContent || '');

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

  function setCheckbox(el, checked) {
    if (!el || typeof checked !== 'boolean') return false;
    el.checked = checked;
    if (typeof jQuery !== 'undefined') {
      try { jQuery(el).prop('checked', checked).trigger('change'); } catch (_) {}
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return el.checked === checked;
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
    // Score-based: returns true only for GOOD matches, not loose token overlap
    const optionNorm = norm(optionText);
    const wantedNorm = norm(wantedText);
    const optionClean = cleanKua(optionText);
    const wantedClean = cleanKua(wantedText);
    if (!optionNorm || !wantedNorm) return false;

    // Exact match
    if (optionNorm === wantedNorm || optionClean === wantedClean) return true;

    // Substring: option contains the full wanted text (good match)
    if (optionClean.includes(wantedClean) && wantedClean.length > 3) return true;
    if (optionNorm.includes(wantedNorm) && wantedNorm.length > 3) return true;

    // Wanted contains full option text (option is shorter — OK if long enough)
    if (wantedClean.includes(optionClean) && optionClean.length > 6) return true;

    // Compact comparisons — handles "Pondok Gede" vs "Pondokgede" (no-space variant)
    const optC = compact(optionNorm);
    const wantC = compact(wantedNorm);
    if (optC.includes(wantC) && wantC.length > 4) return true;
    if (wantC.includes(optC) && optC.length > 6) return true;
    // Also compact the cleaned (KUA/kab/kota stripped) versions
    const optCC = compact(optionClean);
    const wantCC = compact(wantedClean);
    if (optCC.includes(wantCC) && wantCC.length > 3) return true;
    if (wantCC.includes(optCC) && optCC.length > 5) return true;

    // Token subset: ALL wanted tokens must appear in option
    return tokenSubset(wantedText, optionText);
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

  function setMultiSelect(select, values) {
    if (!select || !Array.isArray(values) || values.length === 0) return false;
    const wanted = new Set(values.map(value => String(value).trim()).filter(Boolean));
    const options = Array.from(select.options || []);
    let selectedCount = 0;
    options.forEach(option => {
      const text = norm(option.textContent || option.text);
      const match = wanted.has(String(option.value)) ||
        Array.from(wanted).some(value => {
          const valueNorm = norm(value);
          return text === valueNorm || text.includes(valueNorm) || valueNorm.includes(text);
        });
      option.selected = match;
      if (match) selectedCount++;
    });
    if (!selectedCount) return false;
    if (typeof jQuery !== 'undefined') {
      try { jQuery(select).trigger('change').trigger('input').trigger('blur'); } catch (_) {}
    }
    select.dispatchEvent(new Event('input', { bubbles: true }));
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
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

  function dispatchTyping(input, term) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    input.focus();
    input.click();
    try { setter ? setter.call(input, '') : (input.value = ''); } catch (_) { input.value = ''; }
    input.dispatchEvent(new Event('input', { bubbles: true }));

    try { setter ? setter.call(input, term) : (input.value = term); } catch (_) { input.value = term; }

    ['keydown', 'keypress', 'input', 'keyup', 'change'].forEach(type => {
      const ev = type.startsWith('key')
        ? new KeyboardEvent(type, { bubbles: true, cancelable: true, key: term.slice(-1) || 'g', code: 'KeyG', keyCode: 71, which: 71 })
        : new Event(type, { bubbles: true, cancelable: true });
      input.dispatchEvent(ev);
    });

    if (typeof jQuery !== 'undefined') {
      try { jQuery(input).val(term).trigger('keydown').trigger('keypress').trigger('input').trigger('keyup').trigger('change'); } catch (_) {}
    }
  }

  function clickLikeUser(el) {
    if (!el) return false;
    ['mouseenter', 'mouseover', 'mousedown', 'mouseup', 'click'].forEach(type => {
      el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
    });
    try { el.click(); } catch (_) {}
    return true;
  }

  function findKuaSearchInput() {
    return document.querySelector('.select2-container--open .select2-search__field') ||
      document.querySelector('input[aria-controls="select2-ref_kua-results"]') ||
      document.querySelector('.select2-container--open input[type="search"]') ||
      document.querySelector('.select2-container--open input[type="text"]') ||
      document.querySelector('input.select2-search__field') ||
      document.querySelector('.select2-search input') ||
      document.querySelector('input[role="searchbox"]');
  }

  // Extract kab/kota/provinsi names from text for geographic disambiguation
  // e.g. "Sukolilo 01, Kabupaten Pati" → ["pati"]
  // e.g. "KUA Sukolilo Kota Surabaya Provinsi Jawa Timur" → ["surabaya", "timur"]
  function extractGeoTokens(text) {
    const n = norm(text);
    const tokens = [];
    const re = /\b(?:kabupaten|kab|kota|provinsi|propinsi)\s+(\w+)/gi;
    let m;
    while ((m = re.exec(n))) {
      if (m[1].length > 2) tokens.push(m[1]);
    }
    return tokens;
  }

  // Score a candidate text against wanted, with extra weight for geographic tokens.
  // Used to disambiguate when multiple KUAs share the same kecamatan name.
  function scoreKuaMatch(candidateText, wantedText) {
    const wantedNorm = norm(wantedText);
    const candidateNorm = norm(candidateText);
    const wantedClean = cleanKua(wantedText);
    const candidateClean = cleanKua(candidateText);

    // Exact match gets max score
    if (candidateNorm === wantedNorm || candidateClean === wantedClean) return 1000;

    let score = 0;

    // Token overlap: count how many wanted tokens appear in candidate
    const wantedTokens = wantedClean.split(/\s+/).filter(t => t.length > 2);
    const candidateTokens = candidateClean.split(/\s+/);
    for (const tok of wantedTokens) {
      if (candidateTokens.includes(tok)) score += 10;
    }

    // Geographic tokens from wanted (kab/kota/provinsi names) — heavy weight
    const wantedGeo = extractGeoTokens(wantedText);
    for (const geo of wantedGeo) {
      if (candidateNorm.includes(geo)) score += 50;
    }

    // Geo MISMATCH penalty: when wanted has geographic qualifiers (e.g. "Kabupaten Brebes")
    // but this candidate has DIFFERENT geographic qualifiers, heavily penalize it.
    // This prevents "KUA Larangan, Kota Tangerang" from matching "Larangan, Kabupaten Brebes".
    if (wantedGeo.length > 0) {
      const candidateGeo = extractGeoTokens(candidateText);
      if (candidateGeo.length > 0) {
        const hasMatchingGeo = wantedGeo.some(wg => candidateGeo.some(cg => cg === wg));
        if (!hasMatchingGeo) score -= 200;
      }
    }

    // Substring matches
    if (candidateClean.includes(wantedClean) && wantedClean.length > 3) score += 100;
    if (candidateNorm.includes(wantedNorm) && wantedNorm.length > 3) score += 100;

    return score;
  }

  // When multiple candidates match, pick the one that best matches wanted text.
  // This prevents "Sukolilo Kota Surabaya" from winning over "Sukolilo Kab. Pati"
  // when wanted = "Sukolilo 01, Kabupaten Pati".
  function pickBestKua(candidates, wantedText) {
    if (!candidates || candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];

    let bestScore = -1;
    let best = candidates[0];
    for (const c of candidates) {
      const s = scoreKuaMatch(c.textContent, wantedText);
      console.log(`[SIPP KUA] pickBest: "${c.textContent.trim()}" score=${s}`);
      if (s > bestScore) {
        bestScore = s;
        best = c;
      }
    }
    return best;
  }

  function findKuaResult(wanted, term) {
    const selectors = [
      '#select2-ref_kua-results .select2-results__option',
      '.select2-results__option[role="option"]',
      '.select2-results__option',
      '.select2-results li',
      '.select2-result',
      '.select2-result-label',
      'ul.ui-autocomplete li',
      '.ui-menu-item',
      '.ac_results li',
      '.autocomplete-suggestions div',
      '.autocomplete-suggestion'
    ].join(',');

    const items = Array.from(document.querySelectorAll(selectors)).filter(el => {
      const text = norm(el.textContent);
      return text && !text.includes('mencari') && !text.includes('searching') && !text.includes('tidak ditemukan') && !text.includes('no results');
    });

    // Collect ALL exact wanted matches and pick best — don't just take the first one,
    // because multiple KUAs can share the same kecamatan name (e.g. "Larangan" in Brebes vs Tangerang)
    const exactMatches = items.filter(el => kuaMatches(el.textContent, wanted));
    let match = exactMatches.length > 0 ? pickBestKua(exactMatches, wanted) : null;
    if (!match) {
      // When matching by term, collect ALL candidates and pick the BEST one
      // to avoid wrong picks when multiple KUAs share the same kecamatan name
      const candidates = items.filter(el => kuaMatches(el.textContent, term));
      if (candidates.length > 0) {
        match = pickBestKua(candidates, wanted);
        console.log(`[SIPP KUA] disambiguated: picked "${match?.textContent?.trim()}" from ${candidates.length} candidates for term="${term}"`);
      }
    }
    if (!match) return null;

    if (match.classList.contains('select2-result-label')) {
      return match.closest('li, .select2-result') || match;
    }
    return match;
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
    console.log(`[SIPP KUA] wanted="${wanted}" existing_options=${existing.length}`);
    const matchingExisting = existing.filter(o => o.value && kuaMatches(o.textContent || o.text, wanted));
    const optionFromExisting = matchingExisting.length > 0 ? pickBestKua(matchingExisting, wanted) : null;
    if (optionFromExisting && selectOption(select, optionFromExisting)) {
      console.log('[SIPP KUA] ✅ matched existing option:', optionFromExisting.textContent);
      return true;
    }

    // Skip district matching — go straight to AJAX for reliable disambiguation
    // District matching was causing wrong picks when multiple KUA share the same name (e.g. "Baturetno" in Wonogiri vs Surakarta)
    const cleanFull = cleanKua(wanted);
    const beforeComma = wanted.split(',')[0].trim();

    // Search order: most specific first. Full cleaned name narrows results best.
    // e.g. "Pondok Gede, Kota Bekasi" → ["pondok gede", "Pondok Gede", "Pondokgede", "Pondok Gede, Kota Bekasi", "Pondok"]
    const noSpace = beforeComma.replace(/\s+/g, ''); // "Pondokgede" for no-space variant
    const terms = [cleanFull, beforeComma, noSpace, wanted, cleanFull.split(/\s+/).find(Boolean) || wanted]
      .filter((v, i, arr) => v && arr.indexOf(v) === i);
    console.log('[SIPP KUA] trying AJAX search terms:', terms);

    for (const term of terms) {
      try {
        console.log(`[SIPP KUA] term="${term}" — opening Select2...`);
        // Open Select2 the way a user does. Do not rely only on jQuery(select).data('select2'),
        // because SIPP sometimes initializes Select2 inside a popup after the extension loads.
        const container = document.getElementById('select2-ref_kua-container') ||
          document.querySelector('#ref_kua + .select2 .select2-selection') ||
          document.querySelector('span.select2[style*="550px"] .select2-selection') ||
          document.querySelector('.select2-selection[aria-labelledby="select2-ref_kua-container"]');

        if (typeof jQuery !== 'undefined') {
          try { jQuery(select).select2('open'); } catch (_) {}
        } else {
          // Only click if jQuery select2('open') wasn't used — click toggles,
          // so clicking after select2('open') would CLOSE the dropdown.
          clickLikeUser(container?.closest('.select2-selection') || container);
        }
        await delay(250);

        const input = findKuaSearchInput();
        if (!input) {
          console.warn('[SIPP KUA] ❌ search input not found for term:', term);
          continue;
        }
        console.log('[SIPP KUA] typing term into search input...');
        dispatchTyping(input, term);

        // Poll for results instead of fixed delay — wait up to 3s for AJAX to return
        let resultEl = null;
        for (let i = 0; i < 12; i++) {
          await delay(250);
          const allResults = document.querySelectorAll(
            '#select2-ref_kua-results .select2-results__option, .select2-results__option, .select2-results li'
          );
          const resultTexts = Array.from(allResults).map(el => el.textContent.trim()).filter(Boolean);
          if (resultTexts.length > 0) {
            console.log(`[SIPP KUA] poll #${i + 1}: ${resultTexts.length} results:`, resultTexts.slice(0, 5));
          }
          resultEl = findKuaResult(wanted, term);
          if (resultEl) {
            console.log('[SIPP KUA] found matching result:', resultEl.textContent.trim());
            break;
          }
        }
        if (resultEl) {
          clickLikeUser(resultEl);
          await delay(350);

          const selectedText = document.getElementById('select2-ref_kua-container')?.textContent || '';
          if (selectedText && (kuaMatches(selectedText, wanted) || kuaMatches(selectedText, term))) {
            console.log('[SIPP KUA] ✅ selection verified via container text:', selectedText);
            return true;
          }

          const refreshed = Array.from(select.options || []).find(o => o.selected || kuaMatches(o.textContent || o.text, wanted));
          if (refreshed && selectOption(select, refreshed)) {
            console.log('[SIPP KUA] ✅ selection verified via option refresh:', refreshed.textContent);
            return true;
          }
          console.warn('[SIPP KUA] clicked result but selection not verified. container text:', selectedText);
        } else {
          console.warn(`[SIPP KUA] ❌ no matching result found after 3s polling for term="${term}"`);
        }
      } catch (e) {
        console.error('[SIPP KUA] error during AJAX search:', e);
      }
    }

    // ── FINAL FALLBACK: Direct AJAX to SIPP KUA endpoint ──
    try {
      const ajaxUrl = (select.dataset.ajaxUrl || '/SIPP/kua/cari').replace(/\/$/, '');
      for (const term of terms) {
        try {
          const resp = await fetch(`${ajaxUrl}?term=${encodeURIComponent(term)}`, {
            headers: { 'X-Requested-With': 'XMLHttpRequest' }
          });
          if (!resp.ok) continue;
          const data = await resp.json();
          // SIPP may return {results: [{id, text}, ...]} (Select2 v4) or plain array
          const items = Array.isArray(data) ? data : (data.results || []);
          // Score and pick best match — collect ALL matches, don't take first one
          const allMatches = items.filter(r => kuaMatches(r.text || r.nama || '', wanted));
          let match = allMatches.length > 0 ? allMatches.reduce((best, r) => {
            const s = scoreKuaMatch(r.text || r.nama || '', wanted);
            const bestS = scoreKuaMatch(best.text || best.nama || '', wanted);
            return s > bestS ? r : best;
          }) : null;
          if (!match) {
            const candidates = items.filter(r => kuaMatches(r.text || r.nama || '', term));
            if (candidates.length > 0) {
              // Pick best by geographic disambiguation
              let bestScore = -1;
              for (const c of candidates) {
                const s = scoreKuaMatch(c.text || c.nama || '', wanted);
                if (s > bestScore) { bestScore = s; match = c; }
              }
            }
          }
          if (match) {
            const id = match.id || match.value || match.kode;
            const text = match.text || match.nama || '';
            // Remove old placeholder option if present
            const placeholder = Array.from(select.options).find(o => !o.value);
            if (placeholder) placeholder.remove();
            // Add and select the new option
            const opt = new Option(text, id, true, true);
            select.add(opt);
            select.value = id;
            if (typeof jQuery !== 'undefined') {
              jQuery(select).val(id).trigger('change').trigger('input');
            }
            await delay(100);
            // Verify
            const container2 = document.getElementById('select2-ref_kua-container');
            if (container2 && (kuaMatches(container2.textContent, wanted) || select.value == id)) return true;
            if (select.value == id) return true;
          }
        } catch (_) {}
      }
      // Try jQuery Select2 AJAX transport directly
      if (typeof jQuery !== 'undefined' && jQuery.fn.select2) {
        try {
          const s2data = jQuery(select).data('select2');
          if (s2data && s2data.dataAdapter) {
            for (const term of terms) {
              const params = { term: term, page: {} };
              const results = await new Promise((resolve, reject) => {
                s2data.dataAdapter.query(params, resolve);
                setTimeout(() => reject(new Error('timeout')), 5000);
              });
              const items = results.results || results || [];
              const allMatches = items.filter(r => kuaMatches(r.text || '', wanted));
              let match = allMatches.length > 0 ? allMatches.reduce((best, r) => {
                const s = scoreKuaMatch(r.text || '', wanted);
                const bestS = scoreKuaMatch(best.text || '', wanted);
                return s > bestS ? r : best;
              }) : null;
              if (!match) {
                const candidates = items.filter(r => kuaMatches(r.text || '', term));
                if (candidates.length > 0) {
                  let bestScore = -1;
                  for (const c of candidates) {
                    const s = scoreKuaMatch(c.text || '', wanted);
                    if (s > bestScore) { bestScore = s; match = c; }
                  }
                }
              }
              if (match) {
                const opt = new Option(match.text, match.id, true, true);
                select.add(opt);
                jQuery(select).val(match.id).trigger('change').trigger('input');
                await delay(100);
                return true;
              }
            }
          }
        } catch (_) {}
      }
    } catch (_) {}

    result.errors.push(`KUA Tempat Menikah: dropdown muncul manual, tapi script belum berhasil memilih (${wanted}). Coba klik field KUA sekali lalu klik Fill lagi.`);
    return false;
  }

  if (!isDataAnakForm && !isCalonMempelaiForm) {
    if (data.tanggal_surat) {
      const el = document.getElementById('tgl_surat');
      if (el && setVal(el, data.tanggal_surat)) result.filledFields++;
      else result.errors.push('Tanggal Surat: #tgl_surat tidak ditemukan.');
    }

    const mi = data.marriage_info || {};
    const isbat = data.isbat_info || {};
    const klasifikasi = document.getElementById('klasifikasi');
    const isIsbatNikah = klasifikasi?.value === '360' || isVisible(document.getElementById('alasan_isbat'));

    if (isIsbatNikah) {
      if (isbat.alasan_isbat) {
        const el = document.getElementById('alasan_isbat');
        if (el && setSelect(el, isbat.alasan_isbat)) result.filledFields++;
        else result.errors.push('Alasan Pengajuan Isbat Nikah: #alasan_isbat tidak ditemukan/tidak cocok.');
      }
      if (isbat.tanggal_menikah) {
        const el = document.getElementById('tgl_menikah_isbat');
        if (el && setVal(el, isbat.tanggal_menikah)) result.filledFields++;
        else result.errors.push('Tanggal Menikah Isbat: #tgl_menikah_isbat tidak ditemukan.');
      }
      if (isbat.tempat_menikah) {
        const el = document.getElementById('tempat_menikah_isbat');
        if (el && setVal(el, isbat.tempat_menikah)) result.filledFields++;
        else result.errors.push('Tempat Menikah Isbat: #tempat_menikah_isbat tidak ditemukan.');
      }
    } else {
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
    }

    const details = data.case_details || {};
    for (const [label, id, value] of [
      ['Alasan Pengajuan Poligami', 'alasan_poligami', details.alasan_poligami],
      ['Penghasilan Pemohon Poligami', 'penghasilan', details.penghasilan_poligami],
      ['Alasan Pembatalan Kawin', 'batal_kawin', details.batal_kawin],
      ['Alasan Penguasaan Anak', 'alasan_kuasa_anak', details.alasan_kuasa_anak],
      ['Alasan Pengesahan Anak', 'alasan_sah_anak', details.alasan_sah_anak],
      ['Alasan Asal Usul Anak', 'alasan_asalusul', details.alasan_asalusul],
      ['Alasan Dispensasi Kawin', 'alasan_dispen', details.alasan_dispen],
    ]) {
      if (!value) continue;
      const el = document.getElementById(id);
      if (!el || !isVisible(el)) continue;
      const filled = el.tagName === 'SELECT' ? setSelect(el, value) : setVal(el, value);
      if (filled) result.filledFields++;
      else result.errors.push(`${label}: #${id} tidak ditemukan/tidak cocok.`);
    }

    for (const [label, id, values] of [
      ['Objek Wakaf', 'multiselect3', details.objek_wakaf],
      ['Perkara Kumulasi', 'multiselect', details.perkara_kumulasi],
    ]) {
      if (!values?.length) continue;
      const el = document.getElementById(id);
      if (!el || !isVisible(el)) continue;
      if (setMultiSelect(el, values)) result.filledFields++;
      else result.errors.push(`${label}: #${id} tidak ditemukan/tidak cocok.`);
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

  if (isCalonMempelaiForm) {
    const calon = data.calon_mempelai || {};
    const rows = [
      ['Calon Mempelai Pria', calon.pria || {}, ''],
      ['Calon Mempelai Wanita', calon.wanita || {}, '2'],
    ];
    for (const [label, person, suffix] of rows) {
      if (!Object.values(person).some(value => value !== '' && value !== null)) continue;

      if (person.dimohonkan !== null) {
        const el = document.getElementById(`dimohonkan${suffix}`);
        if (setCheckbox(el, person.dimohonkan)) result.filledFields++;
        else result.errors.push(`${label}: checkbox Yang Dimohonkan DisKa tidak ditemukan.`);
      }

      for (const [field, value, selector] of [
        ['Nama', person.nama, `#nama${suffix}, input[name="nama${suffix}" i]`],
        ['NIK', person.nik, `#nik${suffix}, input[name="nik${suffix}" i]`],
        ['Tempat Lahir', person.tempat_lahir, `#tempat_lahir${suffix}, input[name="tempat_lahir${suffix}" i]`],
        ['Tanggal Lahir', person.tanggal_lahir, `input[name="tgl_lahir${suffix}" i], #tgl_lahir${suffix}`],
        ['Penghasilan/bulan', person.penghasilan, `#penghasilan${suffix}, input[name="penghasilan${suffix}" i]`],
      ]) {
        if (!value) continue;
        const el = document.querySelector(selector);
        if (el && setVal(el, value)) result.filledFields++;
        else result.errors.push(`${label} ${field}: field tidak ditemukan.`);
      }

      for (const [field, value, selector] of [
        ['Pendidikan', person.pendidikan, `#pendidikan${suffix}, select[name="pendidikan${suffix}" i]`],
        ['Pekerjaan', person.pekerjaan, `#pekerjaan${suffix}, select[name="pekerjaan${suffix}" i]`],
      ]) {
        if (!value) continue;
        const el = document.querySelector(selector);
        if (el && setSelect(el, value)) result.filledFields++;
        else result.errors.push(`${label} ${field}: dropdown tidak ditemukan/tidak cocok.`);
      }
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

      // Auto-save: click "Simpan" in the Data Anak form if not the last child
      // SIPP Data Anak form has only "Simpan" (not "Simpan dan Tambah Anak")
      // After submit, the popup closes and page reloads — popup.js must reopen it
      if (data.autoSave && !data.isLastChild && isDataAnakForm) {
        const anakForm = document.querySelector('form[action*="addAnakPihak"], #frm_user');
        const saveBtn = anakForm
          ? anakForm.querySelector('input[type="submit"], button[type="submit"]')
          : null;
        if (saveBtn) {
          result.submitted = true;
          result.filledFields++;
          // DO NOT click here — page navigation would destroy the return value.
          // popup.js will handle the click via a separate script injection.
        } else {
          result.errors.push('Auto-save: tombol "Simpan" tidak ditemukan di form Data Anak (#frm_user).');
        }
      }
    }
  }

  result.success = result.filledFields > 0;
  return result;

  } catch (e) {
    // Catch any uncaught JS errors and return them instead of crashing
    return {
      filledFields: result.filledFields,
      errors: [...result.errors, `JS Error: ${e.message || e}`],
      success: result.filledFields > 0,
    };
  }
}
