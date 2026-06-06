/* SIPP AutoFill - compact recovery + KUA v3/v4 fallback */
const jsonInput=document.getElementById('jsonInput'),btnPaste=document.getElementById('btnPaste'),btnParse=document.getElementById('btnParse'),btnFillAll=document.getElementById('btnFillAll'),statusEl=document.getElementById('status'),previewEl=document.getElementById('preview'),childrenList=document.getElementById('childrenList');
let parsedData=null,selectedChild=null;
function showStatus(m,t='info'){statusEl.textContent=m;statusEl.className=`status show ${t}`}
function first(...v){for(const x of v){if(x!==undefined&&x!==null&&String(x).trim()!=='')return String(x).trim()}return''}
function get(o,p){return p.split('.').reduce((a,k)=>a&&Object.prototype.hasOwnProperty.call(a,k)?a[k]:undefined,o)}
function pick(d,ks){return first(...ks.map(k=>k.includes('.')?get(d,k):d?.[k]))}
function ndate(v){let r=first(v);if(!r)return'';let m=r.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})\b/);if(m){let[,d,mo,y]=m;if(y.length===2)y