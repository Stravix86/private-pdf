import * as E from './engine.js';
import { openSignatureDialog, savedSignatures, removeSignature } from './sign.js';

// Leave empty to hide the Support button. Set to a Ko-fi, Buy Me a Coffee, PayPal.me or GitHub Sponsors link.
const SUPPORT_URL = '';
const REPO = 'https://github.com/Stravix86/private-pdf';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(c));
  return el;
}

const ICONS = {
  rotl: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  rotr: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  first: '<path d="M18 17l-5-5 5-5"/><path d="M11 17l-5-5 5-5"/>',
  last: '<path d="M6 17l5-5-5-5"/><path d="M13 17l5-5-5-5"/>',
  left: '<path d="M15 18l-6-6 6-6"/>',
  right: '<path d="M9 18l6-6-6-6"/>',
  extract: '<path d="M14 3h7v7"/><path d="M10 14L21 3"/><path d="M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"/>',
  x: '<path d="M18 6L6 18"/><path d="M6 6l12 12"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  share: '<path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v13"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  merge: '<path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3"/><path d="M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3"/><path d="M12 8v8M8 12h8"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  compress: '<path d="M4 14h6v6"/><path d="M20 10h-6V4"/><path d="M14 10l7-7"/><path d="M3 21l7-7"/>',
  split: '<path d="M16 3h5v5"/><path d="M8 3H3v5"/><path d="M12 22v-8.3a4 4 0 0 0-1.2-2.9L3 3"/><path d="M15 9l6-6"/>',
  sign: '<path d="M3 17c3-4 5-6 6-6s1 4 3 4 3-5 5-5 2 3 4 3"/><path d="M3 21h18"/>',
  form: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h10M7 13h6"/><path d="M15 15l2 2 3-4"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/>',
  stamp: '<path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/>',
  text: '<path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  square: '<rect x="4" y="7" width="16" height="10" rx="1"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>',
  wifi: '<path d="M2 8.8a15 15 0 0 1 20 0"/><path d="M5 12.9a10 10 0 0 1 14 0"/><path d="M8.5 16.4a5 5 0 0 1 7 0"/><path d="M12 20h.01"/>',
  code: '<path d="M16 18l6-6-6-6"/><path d="M8 6l-6 6 6 6"/>',
};
const icon = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;
const iconBtn = (name, label, onclick, cls = 'icon-btn') => h('button', { class: cls, type: 'button', title: label, 'aria-label': label, html: icon(name), onclick });

const isNative = !!(window.NativeApp || window.__TAURI_INTERNALS__);

// ---------- feedback ----------

let toastTimer;
function toast(msg, ms = 3200) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}

async function busy(label, fn) {
  const o = $('#busy');
  $('#busyText').textContent = label;
  const bar = $('#busyBar');
  bar.style.width = '0%';
  o.hidden = false;
  // Let the overlay paint first (the timeout covers background tabs, where frames are paused).
  await new Promise((r) => { requestAnimationFrame(() => setTimeout(r, 0)); setTimeout(r, 50); });
  try {
    return await fn((p) => { bar.style.width = `${Math.round(Math.min(1, p) * 100)}%`; });
  } catch (e) {
    console.error(e);
    toast(e?.message || 'Something went wrong.', 6000);
    return undefined;
  } finally {
    o.hidden = true;
  }
}

function fmtSize(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1048576).toFixed(n < 10485760 ? 1 : 0)} MB`;
}

// ---------- saving files ----------

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).slice(String(r.result).indexOf(',') + 1));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

async function saveBlob(blob, name) {
  if (window.NativeApp?.saveBase64) { window.NativeApp.saveBase64(name, blob.type, await blobToBase64(blob)); return; }
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  afterSave();
}

const canShareFiles = () => !!window.NativeApp?.shareBase64
  || (!!navigator.canShare && navigator.canShare({ files: [new File([''], 'a.pdf', { type: 'application/pdf' })] }));

async function shareBlob(blob, name) {
  if (window.NativeApp?.shareBase64) { window.NativeApp.shareBase64(name, blob.type, await blobToBase64(blob)); return; }
  try {
    await navigator.share({ files: [new File([blob], name, { type: blob.type })], title: name });
  } catch (e) {
    if (e?.name !== 'AbortError') toast('Sharing isn\'t available here. Use Save instead.');
  }
}

/** A quiet, occasional note after saving. Never blocks anything. */
function afterSave() {
  if (!SUPPORT_URL) return;
  let n = 0;
  try { n = Number(localStorage.getItem('ppdf.saves') || 0) + 1; localStorage.setItem('ppdf.saves', String(n)); } catch { /* private mode */ }
  if (n === 3 || n % 15 === 0) toast('Saved. Private PDF is free; if it helps you, consider supporting it.', 5000);
}

// ---------- state ----------

const S = {
  srcs: new Map(),
  pages: [], // { id, src, i, rot, ov: [] }
  sel: new Set(),
  stamps: { numbers: null, watermark: null },
  form: {},
  flatten: false,
  clean: false,
  panel: 'organize',
  name: 'document',
};
let uid = 1;
let undoStack = [], redoStack = [];

const snap = () => JSON.stringify(S.pages);
function remember(before = snap()) {
  undoStack.push(before);
  if (undoStack.length > 80) undoStack.shift();
  redoStack = [];
}
function change(fn) {
  remember();
  fn();
  refresh();
}
function restore(json) {
  S.pages = JSON.parse(json);
  const ids = new Set(S.pages.map((p) => p.id));
  for (const id of [...S.sel]) if (!ids.has(id)) S.sel.delete(id);
  refresh();
}
function undo() { if (undoStack.length) { redoStack.push(snap()); restore(undoStack.pop()); } }
function redo() { if (redoStack.length) { undoStack.push(snap()); restore(redoStack.pop()); } }

const selectedPages = () => S.pages.filter((p) => S.sel.has(p.id));
const targetPages = () => (S.sel.size ? selectedPages() : S.pages);

// ---------- opening files ----------

function askPassword(name, wrong) {
  const dlg = $('#pwDlg');
  $('#pwTitle').textContent = `${name} is password protected`;
  $('#pwMsg').textContent = wrong ? 'That password is incorrect. Try again.' : 'Enter the password to open it.';
  const input = $('#pwInput');
  input.value = '';
  dlg.returnValue = '';
  dlg.showModal();
  input.focus();
  return new Promise((resolve) => {
    dlg.addEventListener('close', () => resolve(dlg.returnValue === 'ok' ? input.value : null), { once: true });
  });
}

let pendingTool = null;

async function openFiles(files, { insertAt = null } = {}) {
  files = [...files].filter(Boolean);
  if (!files.length) return;
  const added = [];
  await busy(files.length > 1 ? `Opening ${files.length} files…` : `Opening ${files[0].name}…`, async (progress) => {
    for (let k = 0; k < files.length; k++) {
      try {
        const src = await E.openFile(files[k], askPassword);
        if (src) { S.srcs.set(src.id, src); added.push(src); if (src.locked) toast(`${src.name} is protected or damaged. Its pages will be saved as images.`, 6000); }
      } catch (e) {
        toast(e.message || `${files[k].name} couldn't be opened.`, 6000);
      }
      progress((k + 1) / files.length);
    }
  });
  if (!added.length) return;
  const wasEmpty = !S.pages.length;
  const newPages = added.flatMap((s) => s.pages.map((_, i) => ({ id: uid++, src: s.id, i, rot: 0, ov: [] })));
  change(() => {
    if (insertAt == null) S.pages.push(...newPages);
    else S.pages.splice(insertAt, 0, ...newPages);
  });
  if (wasEmpty) {
    undoStack = [];
    S.name = added.length === 1 ? added[0].name : `${added[0].name} (merged)`;
    $('#docName').value = S.name;
    showWork();
    const tool = pendingTool;
    pendingTool = null;
    let panel = ALIAS[tool] || tool || (hasFields() ? 'form' : 'organize');
    if (panel === 'form' && !hasFields()) {
      panel = 'sign';
      toast('This PDF has no fillable fields. Use the page editor to type anywhere on the page.', 6000);
    }
    setPanel(panel);
    if (tool === 'sign') openEditor(S.pages[0].id);
  } else {
    if (S.name.indexOf('(merged)') < 0 && S.srcs.size > 1) { S.name = `${S.name} (merged)`; $('#docName').value = S.name; }
    renderPanel();
    toast(`Added ${newPages.length} page${newPages.length === 1 ? '' : 's'}.`);
  }
}

function insertIndex() {
  if (!S.sel.size) return null;
  let last = -1;
  S.pages.forEach((p, k) => { if (S.sel.has(p.id)) last = k; });
  return last + 1;
}

function showWork() {
  $('#home').hidden = true;
  $('#work').hidden = false;
  document.body.classList.add('working');
}

function closeAll() {
  if (S.pages.length && !confirm('Close these files? Changes you haven\'t saved will be lost.')) return;
  for (const s of S.srcs.values()) E.closeSource(s);
  for (const t of thumbs.values()) URL.revokeObjectURL(t.url);
  for (const url of oldThumbs) URL.revokeObjectURL(url);
  thumbs.clear();
  oldThumbs.length = 0;
  S.srcs.clear();
  S.pages = [];
  S.sel.clear();
  S.form = {};
  S.stamps = { numbers: null, watermark: null };
  undoStack = []; redoStack = [];
  $('#work').hidden = true;
  $('#home').hidden = false;
  document.body.classList.remove('working');
  $('#grid').replaceChildren();
}

// ---------- page boxes (shared by the grid and the editor) ----------

function dims(p) {
  const s = S.srcs.get(p.src).pages[p.i];
  const side = p.rot % 180 !== 0;
  return { w: side ? s.h : s.w, h: side ? s.w : s.h, bw: s.w, bh: s.h };
}

function pageBox(p, k, editable = false) {
  const d = dims(p);
  const box = h('div', { class: 'pbox' });
  box.style.aspectRatio = `${d.w} / ${d.h}`;
  box.style.setProperty('--r', String(d.w / d.h));
  const img = h('img', { class: 'pimg', alt: '', draggable: 'false' });
  img.style.width = `${(d.bw / d.w) * 100}%`;
  img.style.height = `${(d.bh / d.h) * 100}%`;
  img.style.transform = `translate(-50%, -50%) rotate(${p.rot}deg)`;
  box.append(img);
  for (const o of p.ov) box.append(overlayEl(o, d, editable));
  const { numbers, watermark } = S.stamps;
  if (watermark?.text) {
    const size = Math.min(watermark.size || 60, (d.w / Math.max(1, watermark.text.length)) * 1.6);
    const angle = watermark.diagonal ? (Math.atan2(d.h, d.w) * 180) / Math.PI : 0;
    box.append(h('div', {
      class: 'wm-prev',
      style: `font-size:${(size / d.w) * 100}cqw;opacity:${watermark.opacity ?? 0.2};color:${watermark.color || '#888'};transform:translate(-50%,-50%) rotate(${-angle}deg)`,
    }, watermark.text));
  }
  if (numbers && !(numbers.skipFirst && k === 0)) {
    const first = numbers.start ?? 1;
    const n = first + k - (numbers.skipFirst ? 1 : 0);
    const total = first + S.pages.length - (numbers.skipFirst ? 1 : 0) - 1;
    const [v, hz] = numbers.pos || 'bc';
    const m = numbers.margin ?? 28;
    const st = [`font-size:${((numbers.size || 11) / d.w) * 100}cqw`, `color:${numbers.color || '#333'}`];
    st.push(v === 't' ? `top:${(m / d.h) * 100 - 1}%` : `bottom:${(m / d.h) * 100 - 1}%`);
    if (hz === 'l') st.push(`left:${(m / d.w) * 100}%`);
    else if (hz === 'r') st.push(`right:${(m / d.w) * 100}%`);
    else st.push('left:50%', 'transform:translateX(-50%)');
    box.append(h('div', { class: 'num-prev', style: st.join(';') }, E.numberLabel(numbers.format, n, total)));
  }
  return { box, img, d };
}

function overlayEl(o, d, editable) {
  let el;
  if (o.kind === 'image') el = h('div', { class: 'ov ov-image' }, h('img', { src: o.data, alt: '', draggable: 'false' }));
  else if (o.kind === 'rect') el = h('div', { class: 'ov ov-rect' });
  else el = h('div', { class: 'ov ov-text' }, o.text);
  el.dataset.oid = o.id;
  el.style.left = `${o.u * 100}%`;
  el.style.top = `${o.v * 100}%`;
  if (o.kind === 'text') {
    el.style.fontSize = `${(o.size / d.w) * 100}cqw`;
    el.style.color = o.color || '#000';
  } else {
    el.style.width = `${o.w * 100}%`;
    el.style.height = `${o.h * 100}%`;
    if (o.kind === 'rect' && o.color) el.style.background = o.color;
  }
  if (editable) {
    el.append(h('span', { class: 'ov-handle', 'data-handle': '1' }));
    el.append(h('button', { class: 'ov-del', type: 'button', 'aria-label': 'Remove', html: icon('x') }));
  }
  return el;
}

// ---------- thumbnails ----------

const thumbs = new Map(); // "src:i" -> { url, w } (w = rendered width in pixels)
const oldThumbs = []; // smaller renders replaced by sharper ones; freed when the files are closed
const waiting = new Map(); // "src:i:w" -> Promise

// Thumbnails come in a few sizes so a zoomed-in grid stays sharp without constant re-rendering.
function thumbWidth() {
  const cell = $('#grid .cell')?.clientWidth || GZ_STEPS[gzIndex];
  const tier = cell <= 210 ? 240 : cell <= 380 ? 420 : 720;
  return Math.round(tier * Math.min(2, window.devicePixelRatio || 1));
}

function thumbFor(p, urgent = false) {
  const key = `${p.src}:${p.i}`;
  const need = thumbWidth();
  const have = thumbs.get(key);
  if (have && have.w >= need) return Promise.resolve(have.url);
  const wkey = `${key}:${need}`;
  if (!waiting.has(wkey)) {
    const src = S.srcs.get(p.src);
    waiting.set(wkey, E.renderPage(src, p.i, { width: need, quality: 0.8, urgent }).then((b) => {
      waiting.delete(wkey);
      const prev = thumbs.get(key);
      if (prev && prev.w >= need) return prev.url;
      const url = URL.createObjectURL(b);
      if (prev) oldThumbs.push(prev.url); // another card may still be showing it
      thumbs.set(key, { url, w: need });
      return url;
    }).catch((e) => { waiting.delete(wkey); throw e; }));
  }
  return waiting.get(wkey);
}

const io = new IntersectionObserver((entries) => {
  for (const en of entries) {
    if (!en.isIntersecting) continue;
    io.unobserve(en.target);
    const card = en.target;
    const p = S.pages.find((x) => x.id === Number(card.dataset.id));
    if (!p) continue;
    thumbFor(p).then((url) => { const img = $('.pimg', card); if (img) img.src = url; card.classList.add('ready'); }).catch(() => card.classList.add('failed'));
  }
}, { rootMargin: '800px 0px' });

// ---------- grid zoom ----------

const GZ_STEPS = [90, 118, 148, 200, 260, 340, 440, 600];
const gzDefault = () => (window.innerWidth <= 860 ? 1 : 2);
let gzIndex = (() => {
  try {
    const v = localStorage.getItem('ppdf.gridZoom');
    if (v !== null && Number(v) >= 0 && Number(v) < GZ_STEPS.length) return Number(v);
  } catch { /* private mode */ }
  return gzDefault();
})();

function applyGridSize(px) { $('#grid').style.setProperty('--thumb', `${Math.round(px)}px`); }

function setGridZoom(i) {
  gzIndex = Math.max(0, Math.min(GZ_STEPS.length - 1, i));
  try { localStorage.setItem('ppdf.gridZoom', String(gzIndex)); } catch { /* private mode */ }
  applyGridSize(GZ_STEPS[gzIndex]);
  $('#gzOut').disabled = gzIndex === 0;
  $('#gzIn').disabled = gzIndex === GZ_STEPS.length - 1;
  if (S.pages.length) renderGrid(); // fetches sharper thumbnails where needed
}

// ---------- grid ----------

function refresh() {
  renderGrid();
  renderSelbar();
  $('#undoBtn').disabled = !undoStack.length;
  $('#redoBtn').disabled = !redoStack.length;
  const n = S.pages.length;
  $('#pageCount').textContent = `${n} page${n === 1 ? '' : 's'}${S.srcs.size > 1 ? ` from ${new Set(S.pages.map((p) => p.src)).size} files` : ''}`;
  $('#saveBtn').disabled = !n;
  if (S.panel === 'split' || S.panel === 'images') renderPanel();
}

function renderGrid() {
  const grid = $('#grid');
  io.disconnect();
  const multi = new Set(S.pages.map((p) => p.src)).size > 1;
  const need = thumbWidth();
  const frag = document.createDocumentFragment();
  S.pages.forEach((p, k) => {
    const { box, img } = pageBox(p, k);
    const key = `${p.src}:${p.i}`;
    const card = h('div', { class: `card${S.sel.has(p.id) ? ' sel' : ''}`, 'data-id': p.id, role: 'listitem' },
      h('div', { class: 'cell' }, box),
      h('div', { class: 'meta' }, h('b', {}, String(k + 1)), multi ? h('span', { class: 'from', title: S.srcs.get(p.src).name }, S.srcs.get(p.src).name) : null),
      h('button', { class: 'pick', type: 'button', 'aria-label': `Select page ${k + 1}`, 'aria-pressed': S.sel.has(p.id) ? 'true' : 'false' }),
      h('div', { class: 'ctl' },
        iconBtn('rotl', 'Rotate left', () => rotate([p], -90), 'mini'),
        iconBtn('rotr', 'Rotate right', () => rotate([p], 90), 'mini'),
        iconBtn('pen', 'Sign or add text', () => openEditor(p.id), 'mini'),
        iconBtn('trash', 'Delete page', () => removePages([p]), 'mini')));
    const t = thumbs.get(key);
    if (t) { img.src = t.url; card.classList.add('ready'); }
    if (!t || t.w < need) io.observe(card);
    frag.append(card);
  });
  grid.replaceChildren(frag);
  if (!S.pages.length && !$('#work').hidden) grid.append(h('p', { class: 'empty' }, 'No pages left. Add files, or undo.'));
}

let anchorId = null;
$('#grid').addEventListener('click', (e) => {
  const card = e.target.closest('.card');
  if (!card || e.target.closest('.ctl')) return;
  if (dragJustEnded) return;
  const id = Number(card.dataset.id);
  if (e.shiftKey && anchorId != null) {
    const a = S.pages.findIndex((p) => p.id === anchorId), b = S.pages.findIndex((p) => p.id === id);
    const [lo, hi] = a < b ? [a, b] : [b, a];
    for (let k = lo; k <= hi; k++) S.sel.add(S.pages[k].id);
  } else if (S.sel.has(id)) S.sel.delete(id);
  else S.sel.add(id);
  anchorId = id;
  syncSelection();
});
$('#grid').addEventListener('dblclick', (e) => {
  const card = e.target.closest('.card');
  if (card && !e.target.closest('.ctl')) openEditor(Number(card.dataset.id));
});

function syncSelection() {
  for (const card of $$('.card', $('#grid'))) {
    const on = S.sel.has(Number(card.dataset.id));
    card.classList.toggle('sel', on);
    $('.pick', card).setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  renderSelbar();
  if (S.panel === 'split' || S.panel === 'images') renderPanel();
}

function renderSelbar() {
  const n = S.sel.size;
  $('#selInfo').textContent = n ? `${n} selected` : 'All pages';
  for (const b of $$('[data-needs-sel]')) b.disabled = !n;
  $('#selClear').hidden = !n;
}

// ---------- page actions ----------

function rotate(list, by) {
  change(() => { for (const p of list) p.rot = (((p.rot + by) % 360) + 360) % 360; });
}
function removePages(list) {
  if (!list.length) return;
  const ids = new Set(list.map((p) => p.id));
  change(() => { S.pages = S.pages.filter((p) => !ids.has(p.id)); for (const id of ids) S.sel.delete(id); });
  toast(`Deleted ${list.length} page${list.length === 1 ? '' : 's'}. Press Undo to bring ${list.length === 1 ? 'it' : 'them'} back.`);
}
function duplicate(list) {
  change(() => {
    for (const p of [...list].reverse()) {
      const k = S.pages.indexOf(p);
      S.pages.splice(k + 1, 0, { ...structuredClone(p), id: uid++, ov: p.ov.map((o) => ({ ...o, id: uid++ })) });
    }
  });
}
function moveTo(list, where) {
  const ids = new Set(list.map((p) => p.id));
  change(() => {
    const rest = S.pages.filter((p) => !ids.has(p.id));
    S.pages = where === 'start' ? [...list, ...rest] : [...rest, ...list];
  });
}
function step(list, dir) {
  const ids = new Set(list.map((p) => p.id));
  change(() => {
    const a = S.pages;
    if (dir < 0) { for (let k = 1; k < a.length; k++) if (ids.has(a[k].id) && !ids.has(a[k - 1].id)) [a[k - 1], a[k]] = [a[k], a[k - 1]]; }
    else { for (let k = a.length - 2; k >= 0; k--) if (ids.has(a[k].id) && !ids.has(a[k + 1].id)) [a[k], a[k + 1]] = [a[k + 1], a[k]]; }
  });
}

async function insertBlank() {
  await E.loadLibs();
  const ref = S.pages[Math.max(0, (insertIndex() ?? S.pages.length) - 1)];
  const d = ref ? dims(ref) : { w: 595.28, h: 841.89 };
  const doc = await PDFLib.PDFDocument.create();
  doc.addPage([d.w, d.h]);
  const src = await E.openBytes(await doc.save(), 'Blank page');
  S.srcs.set(src.id, src);
  const at = insertIndex() ?? S.pages.length;
  change(() => S.pages.splice(at, 0, { id: uid++, src: src.id, i: 0, rot: 0, ov: [] }));
}

// ---------- drag to reorder (mouse: drag; touch: long-press then drag) ----------

let dragJustEnded = false;
let cancelGridDrag = () => {};
(function dragging() {
  const grid = $('#grid');
  let st = null;
  cancelGridDrag = () => {
    if (!st) return;
    clearTimeout(st.timer);
    if (st.active) {
      st.ghost.remove();
      $$('.moving, .drop-before, .drop-after', grid).forEach((c) => c.classList.remove('moving', 'drop-before', 'drop-after'));
    }
    st = null;
  };
  grid.addEventListener('pointerdown', (e) => {
    const card = e.target.closest('.card');
    if (!card || e.button || e.target.closest('button')) return;
    st = { card, id: Number(card.dataset.id), x: e.clientX, y: e.clientY, active: false, touch: e.pointerType !== 'mouse', pid: e.pointerId };
    if (st.touch) st.timer = setTimeout(() => { if (st) begin(e); }, 380);
  });
  function begin() {
    st.active = true;
    if (navigator.vibrate) try { navigator.vibrate(15); } catch { /* not allowed */ }
    if (!S.sel.has(st.id)) { S.sel.clear(); S.sel.add(st.id); syncSelection(); }
    st.ids = new Set(S.sel);
    const r = st.card.getBoundingClientRect();
    st.ghost = st.card.cloneNode(true);
    st.ghost.classList.add('drag-ghost');
    st.ghost.style.width = `${r.width}px`;
    if (st.ids.size > 1) st.ghost.append(h('span', { class: 'count' }, String(st.ids.size)));
    document.body.append(st.ghost);
    st.dx = st.x - r.left; st.dy = st.y - r.top;
    place(st.x, st.y);
    for (const c of $$('.card', grid)) if (st.ids.has(Number(c.dataset.id))) c.classList.add('moving');
  }
  function place(x, y) {
    st.ghost.style.transform = `translate(${x - st.dx}px, ${y - st.dy}px)`;
    $$('.drop-before, .drop-after', grid).forEach((c) => c.classList.remove('drop-before', 'drop-after'));
    const over = document.elementFromPoint(x, y)?.closest('.card');
    st.target = null;
    if (over && grid.contains(over)) {
      const r = over.getBoundingClientRect();
      const after = x > r.left + r.width / 2;
      over.classList.add(after ? 'drop-after' : 'drop-before');
      st.target = { id: Number(over.dataset.id), after };
    }
    // Scroll near the edges.
    const edge = 70;
    if (y < edge) window.scrollBy(0, -12); else if (y > innerHeight - edge) window.scrollBy(0, 12);
  }
  window.addEventListener('pointermove', (e) => {
    if (!st || e.pointerId !== st.pid) return;
    if (!st.active) {
      if (Math.hypot(e.clientX - st.x, e.clientY - st.y) < 8) return;
      if (st.touch) { clearTimeout(st.timer); st = null; return; } // a scroll, not a drag
      begin();
    }
    e.preventDefault();
    place(e.clientX, e.clientY);
  }, { passive: false });
  // While a touch drag is active, stop the page from scrolling.
  window.addEventListener('touchmove', (e) => { if (st?.active) e.preventDefault(); }, { passive: false });
  const end = (e) => {
    if (!st || (e && e.pointerId !== st.pid)) return;
    clearTimeout(st.timer);
    if (st.active) {
      st.ghost.remove();
      $$('.moving, .drop-before, .drop-after', grid).forEach((c) => c.classList.remove('moving', 'drop-before', 'drop-after'));
      const t = st.target;
      if (t && !st.ids.has(t.id)) {
        const ids = st.ids;
        change(() => {
          const moving = S.pages.filter((p) => ids.has(p.id));
          const rest = S.pages.filter((p) => !ids.has(p.id));
          let at = rest.findIndex((p) => p.id === t.id) + (t.after ? 1 : 0);
          rest.splice(at, 0, ...moving);
          S.pages = rest;
        });
      }
      dragJustEnded = true;
      setTimeout(() => { dragJustEnded = false; }, 50);
    }
    st = null;
  };
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
  grid.addEventListener('contextmenu', (e) => { if (st?.touch) e.preventDefault(); });
})();

// Pinch the page grid with two fingers to make the pages bigger or smaller.
(function gridPinch() {
  const grid = $('#grid');
  const pts = new Map();
  let pinch = null;
  const dist = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
  grid.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) {
      cancelGridDrag();
      const cell = $('.card', grid)?.getBoundingClientRect().width || GZ_STEPS[gzIndex];
      pinch = { d0: dist(), size0: Math.min(cell, GZ_STEPS[GZ_STEPS.length - 1]) };
    }
  });
  window.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!pinch || pts.size < 2) return;
    e.preventDefault();
    applyGridSize(Math.max(70, Math.min(680, pinch.size0 * (dist() / pinch.d0))));
  }, { passive: false });
  window.addEventListener('touchmove', (e) => { if (pinch && e.touches.length > 1) e.preventDefault(); }, { passive: false });
  const end = (e) => {
    if (!pts.delete(e.pointerId) || !pinch || pts.size >= 2) return;
    const px = parseFloat(grid.style.getPropertyValue('--thumb')) || GZ_STEPS[gzIndex];
    let best = 0;
    GZ_STEPS.forEach((v, i) => { if (Math.abs(v - px) < Math.abs(GZ_STEPS[best] - px)) best = i; });
    pinch = null;
    setGridZoom(best);
  };
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
})();

// ---------- building and saving ----------

const fileName = (suffix = '', ext = 'pdf') => {
  const base = ($('#docName').value.trim() || S.name || 'document').replace(/[\\/:*?"<>|]+/g, '-').replace(/\.pdf$/i, '');
  return `${base}${suffix}.${ext}`;
};

function buildOutput(progress) {
  return E.build({ pages: S.pages, srcs: S.srcs, stamps: S.stamps, form: S.form }, { flatten: S.flatten, clean: S.clean, onProgress: progress });
}

async function savePdf(share = false) {
  if (!S.pages.length) return;
  const bytes = await busy('Preparing your PDF…', buildOutput);
  if (!bytes) return;
  const blob = new Blob([bytes], { type: 'application/pdf' });
  if (share) await shareBlob(blob, fileName());
  else { await saveBlob(blob, fileName()); toast(`Saved ${fileName()} (${fmtSize(blob.size)}).`); }
}

// ---------- side panel ----------

function hasFields() { return [...S.srcs.values()].some((s) => s.fields.length && S.pages.some((p) => p.src === s.id)); }

const PANELS = {
  organize: { label: 'Organize', icon: 'grid', render: panelOrganize },
  compress: { label: 'Compress', icon: 'compress', render: panelCompress },
  split: { label: 'Split', icon: 'split', render: panelSplit },
  images: { label: 'Images', icon: 'image', render: panelImages },
  sign: { label: 'Sign', icon: 'sign', render: panelSign },
  stamp: { label: 'Stamp', icon: 'stamp', render: panelStamp },
  form: { label: 'Form', icon: 'form', render: panelForm },
};
const ALIAS = { merge: 'organize', convert: 'images', topdf: 'organize' };

function setPanel(name) {
  name = ALIAS[name] || name;
  if (!PANELS[name]) name = 'organize';
  S.panel = name;
  for (const t of $$('#tabs button')) t.setAttribute('aria-selected', t.dataset.panel === name ? 'true' : 'false');
  renderPanel();
}

function renderPanel() {
  $('#tabs [data-panel="form"]').hidden = !hasFields();
  const body = $('#panelBody');
  const scroll = body.scrollTop;
  body.replaceChildren(...[PANELS[S.panel].render()].flat());
  body.scrollTop = scroll;
}

const section = (title, ...kids) => h('section', { class: 'psec' }, title ? h('h3', {}, title) : null, ...kids);
const field = (label, input, hint) => h('label', { class: 'field' }, h('span', {}, label), input, hint ? h('small', {}, hint) : null);
function choice(name, value, current, title, desc, onchange) {
  return h('label', { class: 'choice' },
    h('input', { type: 'radio', name, value, checked: value === current, onchange: () => onchange(value) }),
    h('span', {}, h('b', {}, title), desc ? h('small', {}, desc) : null));
}
function check(label, on, onchange, hint) {
  return h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: on, onchange: (e) => onchange(e.target.checked) }), h('span', {}, label, hint ? h('small', {}, hint) : null));
}

function panelOrganize() {
  return [
    section('Arrange',
      h('p', { class: 'hint' }, 'Drag pages to reorder them (on a phone, press and hold first). Click a page to select it; Shift-click selects a range.'),
      h('div', { class: 'btn-row' },
        h('label', { class: 'btn' }, h('span', { html: icon('plus') }), 'Add files', h('input', { type: 'file', multiple: true, accept: '.pdf,application/pdf,image/*', hidden: true, onchange: (e) => { openFiles(e.target.files, { insertAt: insertIndex() }); e.target.value = ''; } })),
        h('button', { class: 'btn', type: 'button', onclick: insertBlank }, 'Insert blank page'),
        h('button', { class: 'btn', type: 'button', onclick: () => change(() => S.pages.reverse()) }, 'Reverse order')),
      h('div', { class: 'btn-row' },
        h('span', { class: 'lbl' }, 'Select'),
        h('button', { class: 'link', type: 'button', onclick: () => { S.pages.forEach((p) => S.sel.add(p.id)); syncSelection(); } }, 'All'),
        h('button', { class: 'link', type: 'button', onclick: () => { S.sel.clear(); syncSelection(); } }, 'None'),
        h('button', { class: 'link', type: 'button', onclick: () => { S.sel.clear(); S.pages.forEach((p, k) => k % 2 === 0 && S.sel.add(p.id)); syncSelection(); } }, 'Odd'),
        h('button', { class: 'link', type: 'button', onclick: () => { S.sel.clear(); S.pages.forEach((p, k) => k % 2 === 1 && S.sel.add(p.id)); syncSelection(); } }, 'Even'))),
    section('When saving',
      check('Remove hidden information', S.clean, (v) => { S.clean = v; }, 'Clears the author, title, software and dates stored inside the file.'),
      hasFields() ? check('Lock form answers', S.flatten, (v) => { S.flatten = v; }, 'Turns form fields into plain text so they can\'t be changed.') : null),
  ];
}

let compressLevel = 'balanced', compressResult = null;
function panelCompress() {
  const pick = (v) => { compressLevel = v; compressResult = null; renderPanel(); };
  const res = compressResult;
  return [
    section('Compression',
      choice('lvl', 'light', compressLevel, 'Light', 'Repacks the file without changing how it looks.', pick),
      choice('lvl', 'balanced', compressLevel, 'Balanced', 'Recompresses photos and scans. Text stays sharp and searchable.', pick),
      choice('lvl', 'strong', compressLevel, 'Strong', 'Smaller, lower-quality photos. Text stays searchable.', pick),
      choice('lvl', 'max', compressLevel, 'Maximum', 'Turns each page into an image. Smallest file, but text can no longer be selected or searched.', pick),
      h('button', { class: 'btn primary wide', type: 'button', onclick: runCompress }, 'Compress')),
    res ? section('Result', h('div', { class: `result${res.better ? '' : ' muted'}` },
      res.better
        ? [h('div', { class: 'sizes' }, h('s', {}, fmtSize(res.before)), ' → ', h('b', {}, fmtSize(res.after))), h('div', {}, `${Math.round((1 - res.after / res.before) * 100)}% smaller`)]
        : h('div', {}, compressLevel === 'max' ? 'This file can\'t be made smaller.' : 'This file is already compact at this setting. Try a stronger level.'),
      res.better ? h('div', { class: 'btn-row' },
        h('button', { class: 'btn primary', type: 'button', onclick: () => saveBlob(res.blob, fileName('-compressed')) }, 'Save'),
        canShareFiles() ? h('button', { class: 'btn', type: 'button', onclick: () => shareBlob(res.blob, fileName('-compressed')) }, 'Share') : null) : null)) : null,
  ];
}

async function runCompress() {
  const r = await busy('Compressing…', async (progress) => {
    const built = await buildOutput((p) => progress(p * 0.3));
    const only = [...new Set(S.pages.map((p) => p.src))];
    const src = S.srcs.get(only[0]);
    const untouched = only.length === 1 && S.pages.length === src.pages.length && S.pages.every((p, k) => p.i === k && !p.rot && !p.ov.length) && !S.stamps.numbers && !S.stamps.watermark?.text;
    const before = untouched ? src.bytes.length : built.length;
    const out = await E.compress(built, compressLevel, (p) => progress(0.3 + p * 0.7));
    return { before, after: out.length, better: out.length < before * 0.98, blob: new Blob([out], { type: 'application/pdf' }) };
  });
  if (r) { compressResult = r; renderPanel(); }
}

let splitMode = 'each', splitN = 2, splitRanges = '';
function parseRanges(text, n) {
  const groups = [];
  for (const part of text.split(/[,;]+/).map((s) => s.trim()).filter(Boolean)) {
    const m = /^(\d*)\s*[-–]\s*(\d*)$/.exec(part) || /^(\d+)$/.exec(part);
    if (!m) throw new Error(`"${part}" isn't a page range. Use something like 1-3, 5, 8-10.`);
    const a = Number(m[1] || 1), b = m.length > 2 ? Number(m[2] || n) : a;
    if (a < 1 || b > n || a > b) throw new Error(`"${part}" is outside pages 1 to ${n}.`);
    groups.push(Array.from({ length: b - a + 1 }, (_, k) => a - 1 + k));
  }
  return groups;
}
function splitGroups() {
  const n = S.pages.length;
  if (splitMode === 'each') return S.pages.map((_, k) => [k]);
  if (splitMode === 'every') { const g = []; for (let k = 0; k < n; k += splitN) g.push(Array.from({ length: Math.min(splitN, n - k) }, (_, j) => k + j)); return g; }
  if (splitMode === 'ranges') return parseRanges(splitRanges, n);
  return [S.pages.map((p, k) => (S.sel.has(p.id) ? k : -1)).filter((k) => k >= 0)];
}
const groupLabel = (g) => (g.length === 1 ? `${g[0] + 1}` : g.every((v, j) => j === 0 || v === g[j - 1] + 1) ? `${g[0] + 1}-${g[g.length - 1] + 1}` : `${g.length}pages`);

function panelSplit() {
  const pick = (v) => { splitMode = v; renderPanel(); };
  let summary = '', ok = true;
  try {
    const g = splitGroups();
    if (!g.length || g.some((x) => !x.length)) { ok = false; summary = splitMode === 'selected' ? 'Select the pages you want first.' : 'Enter the page ranges.'; }
    else summary = g.length === 1 ? `Makes 1 PDF with ${g[0].length} page${g[0].length === 1 ? '' : 's'}.` : `Makes ${g.length} PDFs, saved together as a .zip file.`;
  } catch (e) { ok = false; summary = e.message; }
  return [
    section('Split into',
      choice('split', 'each', splitMode, 'One file per page', null, pick),
      h('div', { class: 'choice-wrap' }, choice('split', 'every', splitMode, 'A new file every', null, pick),
        h('input', { type: 'number', min: 1, max: 999, value: splitN, class: 'num', 'aria-label': 'Pages per file', oninput: (e) => { splitN = Math.max(1, Number(e.target.value) || 1); splitMode = 'every'; $('#splitSummary').textContent = ''; }, onchange: () => renderPanel() }), h('span', { class: 'lbl' }, 'pages')),
      choice('split', 'ranges', splitMode, 'Custom ranges', 'One file per range, for example: 1-3, 4, 5-9', pick),
      splitMode === 'ranges' ? h('input', { type: 'text', class: 'text', placeholder: '1-3, 4, 5-9', value: splitRanges, oninput: (e) => { splitRanges = e.target.value; }, onchange: () => renderPanel() }) : null,
      choice('split', 'selected', splitMode, 'Selected pages only', `Pulls the ${S.sel.size || ''} selected page${S.sel.size === 1 ? '' : 's'} into one new PDF.`, pick),
      h('p', { class: `hint${ok ? '' : ' warn'}`, id: 'splitSummary' }, summary),
      h('button', { class: 'btn primary wide', type: 'button', disabled: !ok, onclick: runSplit }, 'Split')),
  ];
}

async function runSplit() {
  let groups;
  try { groups = splitGroups(); } catch (e) { toast(e.message); return; }
  const res = await busy('Splitting…', async (progress) => {
    const built = await buildOutput((p) => progress(p * 0.5));
    return E.split(built, groups, (p) => progress(0.5 + p * 0.5));
  });
  if (!res) return;
  if (res.length === 1) { await saveBlob(new Blob([res[0]], { type: 'application/pdf' }), fileName(splitMode === 'selected' ? '-extract' : `-${groupLabel(groups[0])}`)); return; }
  const files = res.map((data, k) => ({ name: fileName(`-${String(k + 1).padStart(String(res.length).length, '0')}-p${groupLabel(groups[k])}`), data }));
  await saveBlob(E.zip(files), fileName('-split', 'zip'));
}

let imgFormat = 'image/jpeg', imgDpi = 150, imgWhich = 'all';
function panelImages() {
  return [
    section('PDF pages to images',
      h('div', { class: 'seg' },
        ...[['image/jpeg', 'JPG'], ['image/png', 'PNG']].map(([v, l]) => h('button', { type: 'button', 'aria-pressed': imgFormat === v ? 'true' : 'false', onclick: () => { imgFormat = v; renderPanel(); } }, l))),
      field('Resolution', h('select', { onchange: (e) => { imgDpi = Number(e.target.value); } },
        ...[[72, 'Screen (72 dpi)'], [150, 'Standard (150 dpi)'], [300, 'Print (300 dpi)']].map(([v, l]) => h('option', { value: v, selected: imgDpi === v }, l)))),
      field('Pages', h('select', { onchange: (e) => { imgWhich = e.target.value; } },
        h('option', { value: 'all', selected: imgWhich === 'all' }, `All pages (${S.pages.length})`),
        h('option', { value: 'sel', selected: imgWhich === 'sel', disabled: !S.sel.size }, `Selected pages (${S.sel.size})`))),
      h('button', { class: 'btn primary wide', type: 'button', onclick: runImages }, 'Export images')),
    section('Images to PDF',
      h('p', { class: 'hint' }, 'Add JPG, PNG or other images with "Add files". Each image becomes a page, and phone photos are turned the right way up.')),
  ];
}

async function runImages() {
  const indexes = imgWhich === 'sel' && S.sel.size ? S.pages.map((p, k) => (S.sel.has(p.id) ? k : -1)).filter((k) => k >= 0) : null;
  const ext = imgFormat === 'image/png' ? 'png' : 'jpg';
  const res = await busy('Exporting images…', async (progress) => {
    const built = await buildOutput((p) => progress(p * 0.3));
    return E.toImages(built, { dpi: imgDpi, type: imgFormat, quality: 0.9, indexes }, (p) => progress(0.3 + p * 0.7));
  });
  if (!res) return;
  const pad = String(S.pages.length).length;
  if (res.length === 1) { await saveBlob(new Blob([res[0].data], { type: imgFormat }), fileName(`-page-${res[0].index + 1}`, ext)); return; }
  await saveBlob(E.zip(res.map((r) => ({ name: fileName(`-page-${String(r.index + 1).padStart(pad, '0')}`, ext), data: r.data }))), fileName('-images', 'zip'));
}

function panelSign() {
  const sigs = savedSignatures();
  const startPage = () => (selectedPages()[0] || S.pages[0]).id;
  return [
    section('Signatures',
      sigs.length ? h('div', { class: 'sigs' }, ...sigs.map((s) => h('div', { class: 'sig' },
        h('button', { type: 'button', class: 'sig-use', title: 'Place this signature', onclick: () => openEditor(startPage(), { kind: 'image', data: s.data, ratio: s.ratio }) }, h('img', { src: s.data, alt: 'Saved signature' })),
        iconBtn('x', 'Delete this signature', () => { removeSignature(s.id); renderPanel(); }, 'mini')))) : h('p', { class: 'hint' }, 'No saved signatures yet.'),
      h('button', { class: 'btn primary wide', type: 'button', onclick: async () => { const s = await openSignatureDialog(); if (s) { renderPanel(); openEditor(startPage(), { kind: 'image', data: s.data, ratio: s.ratio }); } } }, 'Create a signature'),
      h('p', { class: 'hint' }, 'Signatures are stored only in this browser or app.')),
    section('Add text and marks',
      h('p', { class: 'hint' }, 'Open a page with its pen button (or double-click it) to type text, add the date, ticks, crosses, or white-out boxes that cover existing content.'),
      h('button', { class: 'btn wide', type: 'button', onclick: () => openEditor(startPage()) }, 'Open page editor')),
  ];
}

function panelStamp() {
  const nb = S.stamps.numbers, wm = S.stamps.watermark;
  const setN = (k, v) => { S.stamps.numbers = { ...S.stamps.numbers, [k]: v }; renderGrid(); };
  const setW = (k, v) => { S.stamps.watermark = { ...S.stamps.watermark, [k]: v }; renderGrid(); };
  const positions = [['tl', 'Top left'], ['tc', 'Top centre'], ['tr', 'Top right'], ['bl', 'Bottom left'], ['bc', 'Bottom centre'], ['br', 'Bottom right']];
  return [
    section('Page numbers',
      check('Add page numbers', !!nb, (on) => { S.stamps.numbers = on ? { pos: 'bc', format: 'n', start: 1, size: 11, skipFirst: false, color: '#333333' } : null; renderGrid(); renderPanel(); }),
      nb ? [
        h('div', { class: 'pos-grid', role: 'group', 'aria-label': 'Position' }, ...positions.map(([v, l]) => h('button', { type: 'button', title: l, 'aria-label': l, 'aria-pressed': nb.pos === v ? 'true' : 'false', onclick: () => { setN('pos', v); renderPanel(); } }))),
        field('Format', h('select', { onchange: (e) => setN('format', e.target.value) },
          ...[['n', '1'], ['of', '1 of 9'], ['page', 'Page 1'], ['pageof', 'Page 1 of 9'], ['dash', '- 1 -']].map(([v, l]) => h('option', { value: v, selected: nb.format === v }, l)))),
        h('div', { class: 'row2' },
          field('Start at', h('input', { type: 'number', min: 0, value: nb.start, oninput: (e) => setN('start', Number(e.target.value) || 0) })),
          field('Size', h('input', { type: 'number', min: 6, max: 40, value: nb.size, oninput: (e) => setN('size', Math.max(6, Number(e.target.value) || 11)) }))),
        check('Skip the first page', nb.skipFirst, (v) => setN('skipFirst', v), 'For a cover page.'),
      ] : null),
    section('Watermark',
      check('Add a watermark', !!wm, (on) => { S.stamps.watermark = on ? { text: 'CONFIDENTIAL', size: 60, opacity: 0.15, diagonal: true, color: '#888888' } : null; renderGrid(); renderPanel(); }),
      wm ? [
        field('Text', h('input', { type: 'text', value: wm.text, maxlength: 60, oninput: (e) => setW('text', e.target.value) })),
        h('div', { class: 'row2' },
          field('Opacity', h('input', { type: 'range', min: 0.05, max: 0.6, step: 0.05, value: wm.opacity, oninput: (e) => setW('opacity', Number(e.target.value)) })),
          field('Colour', h('input', { type: 'color', value: wm.color, oninput: (e) => setW('color', e.target.value) }))),
        check('Diagonal', wm.diagonal, (v) => setW('diagonal', v)),
      ] : null),
  ];
}

function panelForm() {
  const out = [];
  for (const s of S.srcs.values()) {
    if (!s.fields.length || !S.pages.some((p) => p.src === s.id)) continue;
    const vals = (S.form[s.id] ||= {});
    const set = (name, v) => { vals[name] = v; };
    const items = s.fields.map((f) => {
      const cur = f.name in vals ? vals[f.name] : f.value;
      const label = f.name.replace(/[._]+/g, ' ').replace(/\s+/g, ' ').trim();
      if (f.type === 'check') return check(label, !!cur, (v) => set(f.name, v));
      if (f.type === 'select' || f.type === 'radio') {
        return field(label, h('select', { onchange: (e) => set(f.name, e.target.value) },
          h('option', { value: '' }, '—'), ...f.options.map((o) => h('option', { value: o, selected: o === cur }, o))));
      }
      const attrs = { value: cur, oninput: (e) => set(f.name, e.target.value) };
      return field(label, f.multiline ? h('textarea', { rows: 3, oninput: attrs.oninput }, cur) : h('input', { type: 'text', ...attrs }));
    });
    out.push(section(S.srcs.size > 1 ? s.name : 'Form fields', ...items));
  }
  out.push(section(null,
    check('Lock answers when saving', S.flatten, (v) => { S.flatten = v; }, 'Turns the fields into plain text so they can\'t be changed.'),
    h('p', { class: 'hint' }, 'Answers are written into the PDF when you save. To write somewhere without a field, use Sign.')));
  return out;
}

// ---------- page editor ----------

const ED = { open: false, k: 0, sel: null, placing: null, url: null, zoom: 1, fitW: 0, ptW: 1 };
const ED_MIN = 0.5, ED_MAX = 6;

function openEditor(pageId, placing = null) {
  const k = S.pages.findIndex((p) => p.id === pageId);
  if (k < 0) return;
  ED.open = true; ED.k = k; ED.sel = null; ED.placing = placing; ED.zoom = 1;
  $('#editor').hidden = false;
  document.body.classList.add('editing');
  renderEditor();
  if (placing) hint(placing.kind === 'image' ? 'Click or tap where the signature should go.' : 'Click or tap the page to place it.');
}

function closeEditor() {
  ED.open = false; ED.placing = null; ED.sel = null;
  commitTextEdit();
  $('#editor').hidden = true;
  document.body.classList.remove('editing');
  if (ED.url) { URL.revokeObjectURL(ED.url); ED.url = null; }
  refresh();
}

function hint(text) {
  const el = $('#edHint');
  el.textContent = text || '';
  el.hidden = !text;
}

let edRenderToken = 0;
function renderEditor() {
  const p = S.pages[ED.k];
  if (!p) { closeEditor(); return; }
  $('#edPage').textContent = `Page ${ED.k + 1} of ${S.pages.length}`;
  $('#edPrev').disabled = ED.k === 0;
  $('#edNext').disabled = ED.k >= S.pages.length - 1;
  $('#edDelete').disabled = !ED.sel;
  for (const b of $$('#edTools [data-tool]')) b.setAttribute('aria-pressed', ED.placing && ED.placing.tool === b.dataset.tool ? 'true' : 'false');
  const stage = $('#edStage');
  const { box, img, d } = pageBox(p, ED.k, true);
  box.classList.add('ed-box');
  if (ED.placing) box.classList.add('placing');
  const sr = stage.getBoundingClientRect();
  const maxW = Math.max(200, sr.width - 24), maxH = Math.max(200, sr.height - 24);
  ED.fitW = Math.min(maxW, maxH * (d.w / d.h));
  ED.ptW = d.w * (96 / 72); // width in CSS pixels at 100% (actual size)
  const w = ED.fitW * ED.zoom;
  box.style.width = `${w}px`;
  updateZoomUi();
  const key = `${p.src}:${p.i}`;
  if (thumbs.has(key)) img.src = thumbs.get(key).url; // sharp version replaces it below
  const token = ++edRenderToken;
  const px = Math.min(ED.zoom > 1 ? 4200 : 2400, w * (d.bw / d.w) * Math.min(2.5, (window.devicePixelRatio || 1) * 1.25));
  if (ED.url && ED.urlKey === `${key}:${Math.round(px)}`) img.src = ED.url;
  else {
    E.renderPage(S.srcs.get(p.src), p.i, { width: px, quality: 0.9, urgent: true }).then((b) => {
      if (token !== edRenderToken) return;
      if (ED.url) URL.revokeObjectURL(ED.url);
      ED.url = URL.createObjectURL(b);
      ED.urlKey = `${key}:${Math.round(px)}`;
      img.src = ED.url;
    }).catch(() => {});
  }
  if (ED.sel) box.querySelector(`[data-oid="${ED.sel}"]`)?.classList.add('selected');
  const sl = stage.scrollLeft, stp = stage.scrollTop;
  stage.replaceChildren(box);
  stage.scrollLeft = sl; stage.scrollTop = stp; // keep the view when the page is redrawn
  stage.classList.toggle('can-pan', ED.zoom > 1.01);
}

function updateZoomUi() {
  $('#ezFit').textContent = `${Math.round(((ED.fitW * ED.zoom) / ED.ptW) * 100)}%`;
  $('#ezOut').disabled = ED.zoom <= ED_MIN + 1e-6;
  $('#ezIn').disabled = ED.zoom >= ED_MAX - 1e-6;
}

// Zooms the editor page, keeping the point under (cx, cy) where it is.
let edZoomTimer;
function setEdZoom(z, cx, cy) {
  z = Math.max(ED_MIN, Math.min(ED_MAX, z));
  if (Math.abs(z - ED.zoom) < 1e-4) return;
  const stage = $('#edStage'), box = $('.ed-box', stage);
  ED.zoom = z;
  if (!box) return;
  const sr = stage.getBoundingClientRect();
  if (cx == null) { cx = sr.left + sr.width / 2; cy = sr.top + sr.height / 2; }
  const r = box.getBoundingClientRect();
  const fx = (cx - r.left) / r.width, fy = (cy - r.top) / r.height;
  box.style.width = `${ED.fitW * z}px`;
  const n = box.getBoundingClientRect();
  stage.scrollLeft += n.left + fx * n.width - cx;
  stage.scrollTop += n.top + fy * n.height - cy;
  stage.classList.toggle('can-pan', z > 1.01);
  updateZoomUi();
  clearTimeout(edZoomTimer);
  edZoomTimer = setTimeout(() => { if (ED.open) renderEditor(); }, 220); // sharper render at the new size
}
function fitEdZoom() {
  setEdZoom(1);
  const stage = $('#edStage');
  stage.scrollLeft = 0; stage.scrollTop = 0;
}

function edPage() { return S.pages[ED.k]; }

function edTool(tool) {
  commitTextEdit();
  if (ED.placing?.tool === tool) { ED.placing = null; hint(''); renderEditor(); return; }
  if (tool === 'sign') {
    const sigs = savedSignatures();
    if (!sigs.length) {
      openSignatureDialog().then((s) => { if (s) { ED.placing = { tool, kind: 'image', data: s.data, ratio: s.ratio }; hint('Click or tap where the signature should go.'); renderEditor(); } });
      return;
    }
    openSigMenu();
    return;
  }
  const today = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  ED.placing = {
    text: { tool, kind: 'text', text: '', size: 12 },
    date: { tool, kind: 'text', text: today, size: 12 },
    tick: { tool, kind: 'text', text: '✓', size: 16 },
    cross: { tool, kind: 'text', text: '✗', size: 16 },
    rect: { tool, kind: 'rect' },
  }[tool];
  hint(tool === 'rect' ? 'Click to add a white box, then drag its corner to cover what you want hidden. This hides content visually; it doesn\'t delete it from the file.' : 'Click or tap the page to place it.');
  renderEditor();
}

function openSigMenu() {
  const menu = $('#sigMenu');
  menu.replaceChildren(
    ...savedSignatures().map((s) => h('button', { type: 'button', class: 'sig-use', onclick: () => { menu.hidden = true; ED.placing = { tool: 'sign', kind: 'image', data: s.data, ratio: s.ratio }; hint('Click or tap where the signature should go.'); renderEditor(); } }, h('img', { src: s.data, alt: 'Saved signature' }))),
    h('button', { type: 'button', class: 'btn', onclick: async () => { menu.hidden = true; const s = await openSignatureDialog(); if (s) { ED.placing = { tool: 'sign', kind: 'image', data: s.data, ratio: s.ratio }; hint('Click or tap where the signature should go.'); renderEditor(); } } }, 'New signature'));
  menu.hidden = false;
  setTimeout(() => document.addEventListener('pointerdown', function off(e) { if (!menu.contains(e.target)) { menu.hidden = true; document.removeEventListener('pointerdown', off); } }), 0);
}

function placeAt(u, v) {
  const p = edPage(), d = dims(p), pl = ED.placing;
  let o;
  if (pl.kind === 'image') {
    const w = 0.28, hgt = (w * d.w) / pl.ratio / d.h;
    o = { kind: 'image', data: pl.data, w, h: hgt, u: u - w / 2, v: v - hgt / 2 };
  } else if (pl.kind === 'rect') {
    const w = 0.3, hgt = 24 / d.h;
    o = { kind: 'rect', w, h: hgt, u: u - w / 2, v: v - hgt / 2 };
  } else {
    o = { kind: 'text', text: pl.text, size: pl.size, color: '#000000', u, v: v - (pl.size * 0.6) / d.h };
  }
  o.id = uid++;
  o.u = Math.max(0, Math.min(1 - (o.w || 0.02), o.u));
  o.v = Math.max(0, Math.min(1 - (o.h || 0.02), o.v));
  remember();
  p.ov.push(o);
  ED.sel = o.id;
  ED.placing = null;
  hint('');
  renderEditor();
  if (o.kind === 'text' && !o.text) startTextEdit(o.id);
}

let editing = null;
function startTextEdit(id) {
  const el = $(`#edStage [data-oid="${id}"]`);
  if (!el) return;
  editing = { id, before: snap() };
  el.classList.add('editing');
  const span = el.firstChild && el.firstChild.nodeType === 3 ? el.firstChild : null;
  const ed = h('div', { class: 'ov-edit', contenteditable: 'true', spellcheck: 'true' }, span ? span.textContent : '');
  try { ed.contentEditable = 'plaintext-only'; } catch { /* older engines */ }
  if (span) span.remove();
  el.prepend(ed);
  ed.focus();
  const r = document.createRange();
  r.selectNodeContents(ed);
  r.collapse(false);
  getSelection().removeAllRanges();
  getSelection().addRange(r);
  ed.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) { e.preventDefault(); commitTextEdit(); renderEditor(); }
    e.stopPropagation();
  });
  ed.addEventListener('blur', () => { setTimeout(() => { if (editing?.id === id) { commitTextEdit(); renderEditor(); } }, 0); });
}
function commitTextEdit() {
  if (!editing) return;
  const { id, before } = editing;
  editing = null;
  const el = $(`#edStage [data-oid="${id}"] .ov-edit`);
  const p = edPage();
  const o = p?.ov.find((x) => x.id === id);
  if (!o || !el) return;
  const text = el.innerText.replace(/ /g, ' ').replace(/\n$/, '');
  if (text === o.text) return;
  undoStack.push(before); redoStack = [];
  if (!text.trim()) { p.ov = p.ov.filter((x) => x.id !== id); ED.sel = null; } else o.text = text;
}

function deleteOverlay(id = ED.sel) {
  const p = edPage();
  if (!id || !p) return;
  remember();
  p.ov = p.ov.filter((o) => o.id !== id);
  ED.sel = null;
  renderEditor();
}

(function editorPointer() {
  const stage = $('#edStage');
  let drag = null, pinch = null, pan = null;
  const pts = new Map();
  const two = () => [...pts.values()].slice(0, 2);
  const scrollable = () => stage.scrollWidth > stage.clientWidth + 1 || stage.scrollHeight > stage.clientHeight + 1;
  const startPan = (e) => {
    if (!scrollable()) return;
    pan = { id: e.pointerId, x: e.clientX, y: e.clientY, sl: stage.scrollLeft, st: stage.scrollTop };
    stage.classList.add('panning');
    try { stage.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
  };
  stage.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) {
        // A second finger: stop what the first one was doing and zoom instead.
        if (drag?.moved) { undoStack.push(drag.before); redoStack = []; }
        drag = null; pan = null; stage.classList.remove('panning');
        const [a, b] = two();
        pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: ED.zoom };
        e.preventDefault();
        return;
      }
      if (pts.size > 2) return;
    }
    const box = $('.ed-box', stage);
    if (!box || !box.contains(e.target)) { if (!e.target.closest('.ov')) { commitTextEdit(); if (ED.sel) { ED.sel = null; renderEditor(); } startPan(e); } return; }
    if (e.target.closest('.ov-edit')) return;
    const r = box.getBoundingClientRect();
    const u = (e.clientX - r.left) / r.width, v = (e.clientY - r.top) / r.height;
    if (ED.placing) { e.preventDefault(); commitTextEdit(); placeAt(u, v); return; }
    const del = e.target.closest('.ov-del');
    if (del) { e.preventDefault(); deleteOverlay(Number(del.parentElement.dataset.oid)); return; }
    const ovEl = e.target.closest('.ov');
    if (!ovEl) { commitTextEdit(); if (ED.sel) { ED.sel = null; renderEditor(); } startPan(e); return; }
    e.preventDefault();
    commitTextEdit();
    const id = Number(ovEl.dataset.oid);
    const o = edPage().ov.find((x) => x.id === id);
    const wasSelected = ED.sel === id;
    if (!wasSelected) { ED.sel = id; for (const x of $$('.ov', box)) x.classList.toggle('selected', x === ovEl); $('#edDelete').disabled = false; }
    const or = ovEl.getBoundingClientRect();
    drag = { o, el: ovEl, box: r, x: e.clientX, y: e.clientY, u: o.u, v: o.v, w: o.w, h: o.h, size: o.size, ow: or.width, resize: !!e.target.closest('[data-handle]'), moved: false, before: snap(), wasSelected };
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener('pointermove', (e) => {
    if (pts.has(e.pointerId)) pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch) {
      if (pts.size < 2) return;
      const [a, b] = two();
      setEdZoom(pinch.z0 * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.d0), (a.x + b.x) / 2, (a.y + b.y) / 2);
      return;
    }
    if (pan && e.pointerId === pan.id) {
      stage.scrollLeft = pan.sl - (e.clientX - pan.x);
      stage.scrollTop = pan.st - (e.clientY - pan.y);
      return;
    }
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 3) return;
    drag.moved = true;
    const { o, el, box } = drag;
    if (drag.resize) {
      if (o.kind === 'text') {
        const f = Math.max(0.3, (drag.ow + dx) / drag.ow);
        o.size = Math.max(5, Math.min(144, drag.size * f));
        el.style.fontSize = `${(o.size / dims(edPage()).w) * 100}cqw`;
      } else if (o.kind === 'image') {
        const ratio = drag.w / drag.h;
        o.w = Math.max(0.03, Math.min(1 - o.u, drag.w + dx / box.width));
        o.h = o.w / ratio;
        el.style.width = `${o.w * 100}%`; el.style.height = `${o.h * 100}%`;
      } else {
        o.w = Math.max(0.01, Math.min(1 - o.u, drag.w + dx / box.width));
        o.h = Math.max(0.005, Math.min(1 - o.v, drag.h + dy / box.height));
        el.style.width = `${o.w * 100}%`; el.style.height = `${o.h * 100}%`;
      }
    } else {
      o.u = Math.max(-0.05, Math.min(0.98, drag.u + dx / box.width));
      o.v = Math.max(-0.02, Math.min(0.98, drag.v + dy / box.height));
      el.style.left = `${o.u * 100}%`; el.style.top = `${o.v * 100}%`;
    }
  });
  const end = (e) => {
    pts.delete(e.pointerId);
    if (pinch) { if (pts.size < 2) pinch = null; return; }
    if (pan && e.pointerId === pan.id) { pan = null; stage.classList.remove('panning'); }
    if (!drag) return;
    const d = drag;
    drag = null;
    if (d.moved) { undoStack.push(d.before); redoStack = []; }
    else if (d.wasSelected && d.o.kind === 'text') startTextEdit(d.o.id);
  };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);
  stage.addEventListener('wheel', (e) => {
    if (!e.ctrlKey && !e.metaKey) return; // Ctrl + mouse wheel, or a trackpad pinch
    e.preventDefault();
    setEdZoom(ED.zoom * Math.exp(-e.deltaY * 0.0025), e.clientX, e.clientY);
  }, { passive: false });
  stage.addEventListener('dblclick', (e) => {
    const ovEl = e.target.closest('.ov-text');
    if (ovEl && !editing) startTextEdit(Number(ovEl.dataset.oid));
  });
})();

// ---------- support ----------

function openSupport() {
  const dlg = $('#supportDlg');
  $('#supportLink').href = SUPPORT_URL;
  dlg.showModal();
}

// ---------- theme ----------

function applyTheme(t) {
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
  const dark = t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  $('#themeBtn').innerHTML = icon(dark ? 'sun' : 'moon');
  $('#themeBtn').setAttribute('aria-label', dark ? 'Use light theme' : 'Use dark theme');
  $('meta[name="theme-color"]').content = dark ? '#121214' : '#f6f6f7';
}

// ---------- wiring ----------

function init() {
  let theme = null;
  try { theme = localStorage.getItem('ppdf.theme'); } catch { /* private mode */ }
  applyTheme(theme);
  $('#themeBtn').addEventListener('click', () => {
    const dark = document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
    const next = dark ? 'light' : 'dark';
    try { localStorage.setItem('ppdf.theme', next); } catch { /* private mode */ }
    applyTheme(next);
  });

  if (SUPPORT_URL) { $('#supportBtn').hidden = false; $('#supportBtn').addEventListener('click', openSupport); $('#supportFoot').hidden = false; }
  if (isNative) $('#getApps').hidden = true;
  $('#repoLink').href = REPO;

  // Home
  const input = $('#fileInput');
  input.addEventListener('change', () => { openFiles(input.files); input.value = ''; });
  for (const b of $$('#tools [data-tool]')) {
    b.addEventListener('click', () => {
      pendingTool = b.dataset.tool;
      input.accept = pendingTool === 'topdf' ? 'image/*' : '.pdf,application/pdf,image/*';
      input.click();
    });
  }
  $('#drop').addEventListener('click', () => { pendingTool = null; input.accept = '.pdf,application/pdf,image/*'; });

  // Workspace
  $('#tabs').replaceChildren(...Object.entries(PANELS).map(([k, v]) => h('button', { type: 'button', role: 'tab', 'data-panel': k, 'aria-selected': 'false', onclick: () => { if (S.panel === k && matchMedia('(max-width: 860px)').matches) $('#panel').classList.toggle('open'); else { setPanel(k); $('#panel').classList.add('open'); } } }, h('span', { html: icon(v.icon) }), h('span', {}, v.label))));
  $('#addInput').addEventListener('change', (e) => { openFiles(e.target.files, { insertAt: insertIndex() }); e.target.value = ''; });
  $('#undoBtn').addEventListener('click', undo);
  $('#redoBtn').addEventListener('click', redo);
  $('#closeBtn').addEventListener('click', closeAll);
  $('#saveBtn').addEventListener('click', () => savePdf(false));
  if (canShareFiles()) { $('#shareBtn').hidden = false; $('#shareBtn').addEventListener('click', () => savePdf(true)); }
  $('#docName').addEventListener('change', (e) => { S.name = e.target.value.trim() || S.name; });
  $('#panelClose').addEventListener('click', () => $('#panel').classList.remove('open'));

  // Selection bar
  $('#selRotL').addEventListener('click', () => rotate(targetPages(), -90));
  $('#selRotR').addEventListener('click', () => rotate(targetPages(), 90));
  $('#selDel').addEventListener('click', () => removePages(selectedPages()));
  $('#selDup').addEventListener('click', () => duplicate(selectedPages()));
  $('#selLeft').addEventListener('click', () => step(selectedPages(), -1));
  $('#selRight').addEventListener('click', () => step(selectedPages(), 1));
  $('#selFirst').addEventListener('click', () => moveTo(selectedPages(), 'start'));
  $('#selLast').addEventListener('click', () => moveTo(selectedPages(), 'end'));
  $('#selClear').addEventListener('click', () => { S.sel.clear(); syncSelection(); });
  $('#selExtract').addEventListener('click', () => { splitMode = 'selected'; runSplit(); });

  // Editor
  $('#edBack').addEventListener('click', closeEditor);
  $('#ezIn').addEventListener('click', () => setEdZoom(ED.zoom * 1.25));
  $('#ezOut').addEventListener('click', () => setEdZoom(ED.zoom / 1.25));
  $('#ezFit').addEventListener('click', fitEdZoom);
  $('#gzIn').addEventListener('click', () => setGridZoom(gzIndex + 1));
  $('#gzOut').addEventListener('click', () => setGridZoom(gzIndex - 1));
  setGridZoom(gzIndex);
  let wheelAcc = 0;
  document.addEventListener('wheel', (e) => {
    if ((!e.ctrlKey && !e.metaKey) || ED.open || $('#work').hidden) return;
    e.preventDefault();
    wheelAcc += e.deltaY;
    if (Math.abs(wheelAcc) >= 60) { setGridZoom(gzIndex + (wheelAcc < 0 ? 1 : -1)); wheelAcc = 0; }
  }, { passive: false });
  $('#edPrev').addEventListener('click', () => { commitTextEdit(); ED.k--; ED.sel = null; renderEditor(); });
  $('#edNext').addEventListener('click', () => { commitTextEdit(); ED.k++; ED.sel = null; renderEditor(); });
  $('#edDelete').addEventListener('click', () => deleteOverlay());
  for (const b of $$('#edTools [data-tool]')) b.addEventListener('click', () => edTool(b.dataset.tool));
  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (ED.open) renderEditor(); }, 120); });

  // Keyboard
  document.addEventListener('keydown', (e) => {
    const typing = e.target.closest?.('input, textarea, select, [contenteditable]');
    const mod = e.ctrlKey || e.metaKey;
    if ($('#work').hidden) return;
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); savePdf(); return; }
    if (typing) return;
    if (mod && ['=', '+', '-', '_', '0'].includes(e.key)) {
      e.preventDefault();
      const dir = e.key === '0' ? 0 : e.key === '-' || e.key === '_' ? -1 : 1;
      if (ED.open) { if (dir === 0) fitEdZoom(); else setEdZoom(ED.zoom * (dir > 0 ? 1.25 : 0.8)); }
      else setGridZoom(dir === 0 ? gzDefault() : gzIndex + dir);
      return;
    }
    if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); if (ED.open) renderEditor(); return; }
    if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); redo(); if (ED.open) renderEditor(); return; }
    if (ED.open) {
      if (e.key === 'Escape') { if (ED.placing) { ED.placing = null; hint(''); renderEditor(); } else if (ED.sel) { ED.sel = null; renderEditor(); } else closeEditor(); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && ED.sel) { e.preventDefault(); deleteOverlay(); }
      else if (e.key === 'ArrowRight' && !ED.sel && ED.k < S.pages.length - 1) { ED.k++; renderEditor(); }
      else if (e.key === 'ArrowLeft' && !ED.sel && ED.k > 0) { ED.k--; renderEditor(); }
      return;
    }
    if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); S.pages.forEach((p) => S.sel.add(p.id)); syncSelection(); }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && S.sel.size) { e.preventDefault(); removePages(selectedPages()); }
    else if (e.key === 'Escape' && S.sel.size) { S.sel.clear(); syncSelection(); }
  });

  // Drop files anywhere
  let depth = 0;
  document.addEventListener('dragenter', (e) => { if (e.dataTransfer?.types?.includes('Files')) { depth++; document.body.classList.add('dropping'); } });
  document.addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; document.body.classList.remove('dropping'); } });
  document.addEventListener('dragover', (e) => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); });
  document.addEventListener('drop', (e) => {
    if (!e.dataTransfer?.files?.length) return;
    e.preventDefault();
    depth = 0;
    document.body.classList.remove('dropping');
    openFiles(e.dataTransfer.files, { insertAt: S.pages.length ? insertIndex() : null });
  });

  // Opened from the operating system (installed web app, or the Android app's "Open with").
  if ('launchQueue' in window) {
    window.launchQueue.setConsumer(async (params) => {
      if (!params.files?.length) return;
      openFiles(await Promise.all(params.files.map((f) => f.getFile())));
    });
  }
  window.openNativeUrls = async (list) => {
    try {
      const files = await Promise.all(list.map(async ({ name, mime, url }) => {
        const b = await (await fetch(url)).blob();
        return new File([b], name, { type: mime || b.type || 'application/pdf' });
      }));
      openFiles(files, { insertAt: S.pages.length ? insertIndex() : null });
    } catch {
      toast('That file couldn\'t be opened.');
    }
  };
  // Android back button: close the innermost thing first. Returns true if it handled it.
  window.handleBack = () => {
    const dlg = $('dialog[open]');
    if (dlg) { dlg.close(); return true; }
    if (ED.open) { closeEditor(); return true; }
    if ($('#panel').classList.contains('open')) { $('#panel').classList.remove('open'); return true; }
    if (!$('#work').hidden) { closeAll(); return true; }
    return false;
  };
  window.NativeApp?.ready?.();

  if ('serviceWorker' in navigator && location.protocol === 'https:' && !isNative) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  // Warm up the PDF engine in the background so the first file opens quickly.
  const idle = window.requestIdleCallback || ((f) => setTimeout(f, 1500));
  idle(() => E.loadLibs().catch(() => {}));
}

init();
