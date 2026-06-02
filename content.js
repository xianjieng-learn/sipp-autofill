/**
 * SIPP AutoFill - Content Script
 * Injected into SIPP pages (http://25.24.23.7/SIPP/...).
 * Handles SIPP forms:
 *   1. Input Data Anak (separate popup)
 *   2. Posita (CKEditor)
 *   3. Petitum (CKEditor)
 *   4. Obyek Sengketa Gugatan (plain textarea)
 *
 * Actual SIPP HTML structure:
 *   - Form: #frm_data_umum (inside #popup_form > #form_pop)
 *   - Obyek Sengketa: <textarea id="obyek_gugatan" name="obyek_gugatan"> — plain textarea
 *   - Posita: <textarea id="posita" name="posita"> — hidden, wrapped by CKEditor (#cke_posita)
 *   - Petitum: <textarea id="petitum" name="petitum"> — hidden, wrapped by CKEditor (#cke_petitum)
 *   - Data Anak: separate popup (loaded via popup_form())
 */

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'detectForm') {
    const type = detectFormType();
    sendResponse({ type });
  } else if (request.action === 'fillChildForm') {
    const result = fillChildForm(request.data);
    sendResponse(result);
  } else if (request.action === 'fillPosita') {
    const result = fillTextArea('posita', request.data);
    sendResponse(result);
  } else if (request.action === 'fillPetitum') {
    const result = fillTextArea('petitum', request.data);
    sendResponse(result);
  } else if (request.action === 'fillObyekSengketa') {
    const result = fillObyekSengketa();
    sendResponse(result);
  } else if (request.action === 'fillAllSipp') {
    const result = fillAllSippFields(request.data);
    sendResponse(result);
  }
  return true;
});

/**
 * Detect which SIPP form is currently visible.
 */
function detectFormType() {
  const bodyText = (document.body?.textContent || '').toLowerCase();
  
  if (bodyText.includes('input data anak') || bodyText.includes('data anak')) {
    return 'child';
  }
  if (bodyText.includes('posita')) {
    return 'posita';
  }
  if (bodyText.includes('petitum')) {
    return 'petitum';
  }
  if (bodyText.includes('obyek sengketa') || bodyText.includes('objek sengketa')) {
    return 'obyek';
  }
  
  return 'unknown';
}

/**
 * Fill "Input Data Anak" form.
 * Data should include: nama, tempat_lahir, tanggal_lahir, jenis_kelamin, pendidikan, pengasuhan
 * Anak ke will be auto-inferred from existing children count.
 */
function fillChildForm(data) {
  let filledFields = 0;
  const errors = [];

  // Auto-infer "Anak ke" from existing children count
  const anakKe = data.anak_ke || inferAnakKe();
  
  console.log('[SIPP CHILD] Filling child form:', JSON.stringify({...data, _raw: undefined}, null, 2));
  console.log('[SIPP CHILD] Anak ke:', anakKe, '(source:', data.anak_ke ? 'data' : 'inferred', ')');
  
  const fieldMap = [
    { key: 'anak_ke', value: String(anakKe), labels: ['Anak ke', 'Anak Ke', 'Urutan'], type: 'text' },
    { key: 'nama', value: data.nama || '', labels: ['Nama', 'Nama Anak', 'Nama Lengkap'], type: 'text' },
    { key: 'nik', value: data.nik || '', labels: ['NIK', 'Nik', 'Nomor Induk'], type: 'text' },
    { key: 'tempat_lahir', value: data.tempat_lahir || '', labels: ['Tempat Lahir', 'Tmp Lahir'], type: 'text' },
    { key: 'tanggal_lahir', value: data.tanggal_lahir || '', labels: ['Tanggal Lahir', 'Tgl Lahir', 'Tgl. Lahir', 'Tgl Lahir'], type: 'text' },
    { key: 'jenis_kelamin', value: data.jenis_kelamin || '', labels: ['Jenis Kelamin', 'JK', 'Kelamin'], type: 'dropdown' },
    { key: 'pendidikan', value: data.pendidikan || '', labels: ['Pendidikan'], type: 'dropdown' },
    { key: 'pengasuhan', value: data.pengasuhan || '', labels: ['Diasuh oleh', 'Diasuh Oleh', 'Pengasuhan'], type: 'dropdown' },
  ];

  for (const field of fieldMap) {
    if (!field.value) continue;

    try {
      let success = false;
      
      if (field.type === 'dropdown') {
        success = fillDropdown(field.labels, field.value);
      } else {
        success = fillTextInput(field.labels, field.value);
      }

      if (success) {
        filledFields++;
        console.log(`[SIPP CHILD] ✅ ${field.key} = "${field.value}"`);
      } else {
        errors.push(`${field.key}: field tidak ditemukan`);
        console.warn(`[SIPP CHILD] ❌ ${field.key} not found (labels: ${field.labels.join(', ')})`);
      }
    } catch (e) {
      errors.push(`${field.key}: ${e.message}`);
    }
  }

  if (filledFields === 0 && errors.length > 0) {
    return { 
      success: false, 
      error: `Tidak ada field yang berhasil diisi. Pastikan form SIPP sedang terbuka. ${errors.join('; ')}` 
    };
  }

  return { 
    success: true, 
    filledFields,
    errors: errors.length > 0 ? errors : undefined 
  };
}

/**
 * Infer "Anak ke" from existing children in the page.
 * Counts how many child entries already exist.
 */
function inferAnakKe() {
  // Look for existing child entries or "Anak ke" fields
  const allLabels = document.querySelectorAll('label, .label, span, div, td, th');
  let maxAnakKe = 0;
  
  for (const labelEl of allLabels) {
    const text = (labelEl.textContent || '').trim();
    const match = text.match(/anak\s+ke[\s:-]*(\d+)/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxAnakKe) {
        maxAnakKe = num;
      }
    }
  }
  
  return maxAnakKe + 1;
}

/**
 * Fill Posita or Petitum textarea.
 *
 * Strategy 0: Direct ID lookup (SIPP uses id="posita" / id="petitum")
 * Strategy 1: CKEditor instance by name
 * Strategy 2: Query by name/id attributes
 * Strategy 3: Nearby text matching (fallback)
 */
function fillTextArea(type, data) {
  const text = type === 'posita' ? data.posita : data.petitum;
  if (!text) {
    return { success: false, error: `Tidak ada data ${type.toUpperCase()}` };
  }

  // Priority 1: CKEditor API (SIPP wraps textarea with CKEditor)
  // CKEditor manages its own state — setting hidden textarea value does NOT update the editor
  if (typeof CKEDITOR !== 'undefined' && CKEDITOR.instances && CKEDITOR.instances[type]) {
    try {
      CKEDITOR.instances[type].setData(text);
      // Also sync to hidden textarea for form submission
      const ta = document.getElementById(type);
      if (ta) { ta.value = text; }
      return { success: true, filledFields: 1 };
    } catch (e) {
      console.error(`CKEditor setData failed for ${type}:`, e);
    }
  }

  // Priority 2: Direct textarea (no CKEditor)
  const textarea = document.getElementById(type);
  if (textarea && textarea.tagName === 'TEXTAREA') {
    setTextAreaValue(textarea, text);
    return { success: true, filledFields: 1 };
  }

  // Priority 3: Query by name/id attributes
  const namePatterns = type === 'posita' 
    ? ['posita', 'dalil', 'alasan'] 
    : ['petitum', 'tuntutan', 'amar'];
  
  for (const pattern of namePatterns) {
    const el = document.querySelector(
      `textarea[name*="${pattern}" i], textarea[id*="${pattern}" i]`
    );
    if (el) {
      setTextAreaValue(el, text);
      return { success: true, filledFields: 1 };
    }
  }

  // Priority 4: Nearby text matching (fallback)
  const textareas = document.querySelectorAll('textarea');
  for (const ta of textareas) {
    const nearbyText = getNearbyText(ta).toLowerCase();
    if ((type === 'posita' && nearbyText.includes('posita')) ||
        (type === 'petitum' && nearbyText.includes('petitum'))) {
      setTextAreaValue(ta, text);
      return { success: true, filledFields: 1 };
    }
  }

  return { success: false, error: `Textarea ${type.toUpperCase()} tidak ditemukan` };
}

/**
 * Fill Obyek Sengketa Gugatan with "-"
 *
 * The actual field is: <textarea id="obyek_gugatan" name="obyek_gugatan">
 * It's a plain textarea, NOT CKEditor.
 */
function fillObyekSengketa() {
  const value = '-';

  // Direct ID lookup (matches actual SIPP HTML)
  const textarea = document.getElementById('obyek_gugatan');
  if (textarea && textarea.tagName === 'TEXTAREA') {
    setTextAreaValue(textarea, value);
    return { success: true, filledFields: 1 };
  }

  // Fallback: try by name attribute
  const byName = document.querySelector('textarea[name="obyek_gugatan"]');
  if (byName) {
    setTextAreaValue(byName, value);
    return { success: true, filledFields: 1 };
  }

  // Fallback: label text matching
  const success = fillTextInput(['Obyek Sengketa', 'Objek Sengketa', 'Obyek', 'Objek'], value);
  if (success) {
    return { success: true, filledFields: 1 };
  }

  return { success: false, error: 'Field Obyek Sengketa tidak ditemukan' };
}

/**
 * Fill all SIPP fields at once.
 */
function fillAllSippFields(data) {
  let totalFilled = 0;
  const allErrors = [];

  // Fill child data if present
  if (data.children && Array.isArray(data.children)) {
    for (const child of data.children) {
      const childResult = fillChildForm(child);
      if (childResult.success) {
        totalFilled += childResult.filledFields || 0;
      } else if (childResult.error) {
        allErrors.push(childResult.error);
      }
    }
  }

  // Fill posita if present
  if (data.posita) {
    const positaResult = fillTextArea('posita', data);
    if (positaResult.success) {
      totalFilled += positaResult.filledFields || 0;
    } else if (positaResult.error) {
      allErrors.push(positaResult.error);
    }
  }

  // Fill petitum if present
  if (data.petitum) {
    const petitumResult = fillTextArea('petitum', data);
    if (petitumResult.success) {
      totalFilled += petitumResult.filledFields || 0;
    } else if (petitumResult.error) {
      allErrors.push(petitumResult.error);
    }
  }

  // Fill obyek sengketa if present
  if (data.obyek_sengketa) {
    const obyekResult = fillObyekSengketa();
    if (obyekResult.success) {
      totalFilled += obyekResult.filledFields || 0;
    } else if (obyekResult.error) {
      allErrors.push(obyekResult.error);
    }
  }

  return {
    success: totalFilled > 0,
    filledFields: totalFilled,
    errors: allErrors.length > 0 ? allErrors : undefined,
  };
}

/**
 * Fill a text input field by matching label text.
 */
function fillTextInput(labelPatterns, value) {
  // Strategy 1: Find by label text in nearby elements
  const allLabels = document.querySelectorAll('label, .label, span, div, td, th');
  
  for (const labelEl of allLabels) {
    const labelText = (labelEl.textContent || '').trim().toLowerCase();
    
    for (const pattern of labelPatterns) {
      if (labelText.includes(pattern.toLowerCase())) {
        const input = findAssociatedInput(labelEl);
        if (input) {
          setInputValue(input, value);
          return true;
        }
      }
    }
  }

  // Strategy 2: Find inputs by placeholder or nearby text
  const inputs = document.querySelectorAll('input[type="text"], input:not([type]), textarea');
  for (const input of inputs) {
    const placeholder = (input.placeholder || '').toLowerCase();
    const nearbyText = getNearbyText(input).toLowerCase();
    
    for (const pattern of labelPatterns) {
      if (placeholder.includes(pattern.toLowerCase()) || nearbyText.includes(pattern.toLowerCase())) {
        setInputValue(input, value);
        return true;
      }
    }
  }

  // Strategy 3: Try by input name or id attributes
  const nameMap = {
    'anak_ke': ['anakke', 'anak_ke', 'urutan'],
    'nama': ['nama', 'name', 'namaanak'],
    'tempat_lahir': ['tempatlahir', 'tempat_lahir', 'tmp_lahir'],
    'tanggal_lahir': ['tanggallahir', 'tanggal_lahir', 'tgl_lahir'],
    'jenis_kelamin': ['jeniskelamin', 'jenis_kelamin', 'jk', 'kelamin'],
    'pendidikan': ['pendidikan'],
    'pengasuhan': ['pengasuhan', 'diasuh'],
  };

  for (const [key, patterns] of Object.entries(nameMap)) {
    for (const namePattern of patterns) {
      const input = document.querySelector(
        `input[name*="${namePattern}" i], input[id*="${namePattern}" i]`
      );
      if (input) {
        setInputValue(input, value);
        return true;
      }
    }
  }

  return false;
}

/**
 * Fill a dropdown/select field by matching label text.
 */
function fillDropdown(labelPatterns, value) {
  const valueLower = value.toLowerCase();

  // Strategy 1: Find <select> elements near labels
  const allLabels = document.querySelectorAll('label, .label, span, div, td, th');
  
  for (const labelEl of allLabels) {
    const labelText = (labelEl.textContent || '').trim().toLowerCase();
    
    for (const pattern of labelPatterns) {
      if (labelText.includes(pattern.toLowerCase())) {
        const select = findAssociatedSelect(labelEl);
        if (select) {
          return setSelectValue(select, value);
        }
      }
    }
  }

  // Strategy 2: Find selects by name/id
  const selectElements = document.querySelectorAll('select');
  for (const select of selectElements) {
    const nameId = ((select.name || '') + (select.id || '')).toLowerCase();
    const nearbyText = getNearbyText(select).toLowerCase();
    
    for (const pattern of labelPatterns) {
      const p = pattern.toLowerCase();
      if (nameId.includes(p) || nearbyText.includes(p)) {
        return setSelectValue(select, value);
      }
    }
  }

  // Strategy 3: Custom dropdown components
  const customDropdowns = document.querySelectorAll(
    '.dropdown, [role="listbox"], [role="combobox"], .select-wrapper, .ant-select, .MuiSelect-root'
  );
  
  for (const dropdown of customDropdowns) {
    const nearbyText = getNearbyText(dropdown).toLowerCase();
    for (const pattern of labelPatterns) {
      if (nearbyText.includes(pattern.toLowerCase())) {
        return fillCustomDropdown(dropdown, value);
      }
    }
  }

  return false;
}

/**
 * Find the input element associated with a label.
 */
function findAssociatedInput(labelEl) {
  if (labelEl.htmlFor) {
    const input = document.getElementById(labelEl.htmlFor);
    if (input) return input;
  }

  const nestedInput = labelEl.querySelector('input, textarea');
  if (nestedInput) return nestedInput;

  let sibling = labelEl.nextElementSibling;
  for (let i = 0; i < 5 && sibling; i++) {
    const input = sibling.querySelector('input, textarea') || 
                  (sibling.matches('input, textarea') ? sibling : null);
    if (input) return input;
    sibling = sibling.nextElementSibling;
  }

  const parent = labelEl.parentElement;
  if (parent) {
    const parentInput = parent.querySelector('input:not([type="hidden"]), textarea');
    if (parentInput && parentInput !== labelEl) return parentInput;
  }

  return null;
}

/**
 * Find the select element associated with a label.
 */
function findAssociatedSelect(labelEl) {
  if (labelEl.htmlFor) {
    const select = document.getElementById(labelEl.htmlFor);
    if (select && select.tagName === 'SELECT') return select;
  }

  const nestedSelect = labelEl.querySelector('select');
  if (nestedSelect) return nestedSelect;

  let sibling = labelEl.nextElementSibling;
  for (let i = 0; i < 5 && sibling; i++) {
    const select = sibling.querySelector('select') || 
                   (sibling.matches('select') ? sibling : null);
    if (select) return select;
    sibling = sibling.nextElementSibling;
  }

  return null;
}

/**
 * Get text content near an element (for matching labels).
 */
function getNearbyText(element) {
  const parent = element.closest('.form-group, .form-row, .field, tr, .input-group, [class*="form"]');
  if (parent) {
    return parent.textContent || '';
  }
  return element.parentElement?.textContent || '';
}

/**
 * Set input value and trigger events for frameworks.
 * Also triggers jQuery events since SIPP uses jQuery.
 */
function setInputValue(input, value) {
  input.focus();
  input.click();
  input.value = '';
  
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype, 'value'
  )?.set || Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype, 'value'
  )?.set;
  
  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(input, value);
  } else {
    input.value = value;
  }
  
  // Dispatch standard DOM events
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.dispatchEvent(new Event('blur', { bubbles: true }));
  
  // Trigger jQuery events if available (SIPP uses jQuery 1.8.2)
  if (typeof jQuery !== 'undefined' || typeof $ !== 'undefined') {
    try {
      const jq = jQuery || $;
      jq(input).val(value).trigger('input').trigger('change').trigger('blur');
    } catch (e) { /* ignore jQuery errors */ }
  }
  
  if (input.value !== value) {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

/**
 * Set textarea value and trigger events.
 * Also handles CKEditor instances — SIPP uses CKEditor for Posita/Petitum.
 *
 * CKEditor instance names match the textarea ID:
 *   - CKEDITOR.instances['posita']  → for <textarea id="posita">
 *   - CKEDITOR.instances['petitum'] → for <textarea id="petitum">
 *
 * The actual <textarea> is hidden (visibility:hidden; display:none)
 * and CKEditor renders its own UI in a <div id="cke_posita"> wrapper.
 */
function setTextAreaValue(textarea, value) {
  // Strategy 1: If CKEditor is present, use its API (SIPP uses CKEditor for rich text)
  if (typeof CKEDITOR !== 'undefined' && textarea.id) {
    const editor = CKEDITOR.instances[textarea.id];
    if (editor) {
      editor.setData(value);
      // Sync back to hidden textarea for form submission
      textarea.value = value;
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
  }

  // Strategy 2: Plain textarea (no CKEditor) — use native setter + events
  textarea.focus();
  textarea.value = '';
  
  const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype, 'value'
  )?.set;
  
  if (nativeTextAreaValueSetter) {
    nativeTextAreaValueSetter.call(textarea, value);
  } else {
    textarea.value = value;
  }
  
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.dispatchEvent(new Event('change', { bubbles: true }));
  textarea.dispatchEvent(new Event('blur', { bubbles: true }));
  
  if (textarea.value !== value) {
    textarea.value = value;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

/**
 * Set select element value.
 */
function setSelectValue(select, value) {
  const valueLower = value.toLowerCase();
  const options = Array.from(select.options);
  
  let option = options.find(o => o.value.toLowerCase() === valueLower || 
                                 o.text.toLowerCase() === valueLower);
  
  if (!option) {
    option = options.find(o => 
      o.text.toLowerCase().includes(valueLower) || 
      valueLower.includes(o.text.toLowerCase())
    );
  }

  if (option) {
    select.value = option.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  return false;
}

/**
 * Fill custom dropdown component.
 */
function fillCustomDropdown(dropdown, value) {
  // Click to open dropdown
  dropdown.click();
  
  // Wait for options to appear, then select
  setTimeout(() => {
    const options = dropdown.querySelectorAll('[role="option"], .dropdown-item, li');
    for (const option of options) {
      if (option.textContent.toLowerCase().includes(value.toLowerCase())) {
        option.click();
        break;
      }
    }
  }, 100);
  
  return true;
}
