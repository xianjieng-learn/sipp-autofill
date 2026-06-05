/* SIPP AutoFill - compact restored popup */

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
function nonEmpty(...vals) {
  for (const v of vals) if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim