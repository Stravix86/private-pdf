// Signature creation: draw, type or upload. Signatures are kept only in this browser's storage.

const KEY = 'ppdf.signatures';
const $ = (s) => document.querySelector(s);

export function savedSignatures() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}
function store(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 6))); return true; } catch { return false; }
}
export function removeSignature(id) {
  store(savedSignatures().filter((s) => s.id !== id));
}

const FONTS = ['"Segoe Script"', '"Brush Script MT"', '"Lucida Handwriting"', '"Snell Roundhand"', '"Bradley Hand"', 'cursive'];

let mode = 'draw', ink = '#111111', strokes = [], wired = false;

function pad() { return $('#sigPad'); }

function resizePad() {
  const c = pad();
  const r = c.getBoundingClientRect();
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  c.width = Math.max(1, Math.round(r.width * dpr));
  c.height = Math.max(1, Math.round(r.height * dpr));
  redraw();
}

function redraw() {
  const c = pad(), x = c.getContext('2d');
  x.clearRect(0, 0, c.width, c.height);
  const s = c.width / c.getBoundingClientRect().width || 1;
  x.lineCap = 'round';
  x.lineJoin = 'round';
  x.strokeStyle = ink;
  for (const st of strokes) {
    if (!st.length) continue;
    x.lineWidth = 2.6 * s;
    x.beginPath();
    x.moveTo(st[0][0] * s, st[0][1] * s);
    if (st.length === 1) x.lineTo(st[0][0] * s + 0.1, st[0][1] * s);
    for (let i = 1; i < st.length - 1; i++) {
      const mx = (st[i][0] + st[i + 1][0]) / 2, my = (st[i][1] + st[i + 1][1]) / 2;
      x.quadraticCurveTo(st[i][0] * s, st[i][1] * s, mx * s, my * s);
    }
    if (st.length > 1) x.lineTo(st[st.length - 1][0] * s, st[st.length - 1][1] * s);
    x.stroke();
  }
  $('#sigPadHint').hidden = strokes.length > 0;
}

function drawTyped() {
  const c = $('#sigTypePreview'), x = c.getContext('2d');
  const text = $('#sigText').value.trim();
  c.width = 1200; c.height = 300;
  x.clearRect(0, 0, c.width, c.height);
  if (!text) return;
  let size = 150;
  x.font = `${size}px ${$('#sigFont').value}`;
  while (x.measureText(text).width > c.width - 60 && size > 30) { size -= 6; x.font = `${size}px ${$('#sigFont').value}`; }
  x.fillStyle = ink;
  x.textBaseline = 'middle';
  x.fillText(text, 30, c.height / 2);
}

/** Crops to the ink, and returns a PNG data URL with its width/height ratio. */
function trimmed(src) {
  const x = src.getContext('2d');
  const { width: w, height: h } = src;
  const d = x.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let i = 0; i < w; i++) {
      if (d[(y * w + i) * 4 + 3] > 8) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
  }
  if (x1 < 0) return null;
  const m = Math.round(Math.max(w, h) * 0.01);
  x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m); x1 = Math.min(w - 1, x1 + m); y1 = Math.min(h - 1, y1 + m);
  const out = document.createElement('canvas');
  out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
  out.getContext('2d').drawImage(src, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return { data: out.toDataURL('image/png'), ratio: out.width / out.height };
}

/** Turns a photo or scan of a signature into ink on a transparent background. */
async function fromUpload(file) {
  const bmp = await createImageBitmap(file);
  const max = 1400, s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  const x = c.getContext('2d');
  x.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  const img = x.getImageData(0, 0, c.width, c.height), d = img.data;
  // Paper is the bright background: anything near it becomes transparent, darker strokes stay.
  let sum = 0;
  for (let i = 0; i < d.length; i += 4) sum += (d[i] + d[i + 1] + d[i + 2]) / 3;
  const paper = sum / (d.length / 4);
  const cut = Math.min(225, paper - 35);
  for (let i = 0; i < d.length; i += 4) {
    const l = (d[i] + d[i + 1] + d[i + 2]) / 3;
    if (d[i + 3] < 10 || l >= cut) d[i + 3] = 0;
    else d[i + 3] = Math.min(255, Math.round(((cut - l) / Math.max(1, cut - 40)) * 255 * 1.4));
  }
  x.putImageData(img, 0, 0);
  return c;
}

let uploaded = null;

function setMode(m) {
  mode = m;
  for (const b of document.querySelectorAll('#sigTabs button')) b.setAttribute('aria-selected', b.dataset.mode === m ? 'true' : 'false');
  for (const p of document.querySelectorAll('[data-sigpane]')) p.hidden = p.dataset.sigpane !== m;
  if (m === 'draw') requestAnimationFrame(resizePad);
  if (m === 'type') { drawTyped(); $('#sigText').focus(); }
}

function wire() {
  if (wired) return;
  wired = true;
  const c = pad();
  let cur = null;
  const pt = (e) => { const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  c.addEventListener('pointerdown', (e) => { e.preventDefault(); c.setPointerCapture(e.pointerId); cur = [pt(e)]; strokes.push(cur); redraw(); });
  c.addEventListener('pointermove', (e) => {
    if (!cur) return;
    for (const ev of e.getCoalescedEvents?.() || [e]) cur.push(pt(ev));
    redraw();
  });
  const end = () => { cur = null; };
  c.addEventListener('pointerup', end);
  c.addEventListener('pointercancel', end);
  $('#sigClear').addEventListener('click', () => { strokes = []; uploaded = null; redraw(); });
  for (const b of document.querySelectorAll('#sigTabs button')) b.addEventListener('click', () => setMode(b.dataset.mode));
  for (const b of document.querySelectorAll('#sigInks button')) {
    b.addEventListener('click', () => {
      ink = b.dataset.ink;
      for (const o of document.querySelectorAll('#sigInks button')) o.setAttribute('aria-pressed', o === b ? 'true' : 'false');
      redraw(); drawTyped();
    });
  }
  const sel = $('#sigFont');
  sel.replaceChildren(...FONTS.map((f) => { const o = document.createElement('option'); o.value = f; o.textContent = f.replace(/"/g, ''); o.style.fontFamily = f; return o; }));
  sel.addEventListener('change', drawTyped);
  $('#sigText').addEventListener('input', drawTyped);
  $('#sigFile').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      uploaded = await fromUpload(f);
      const prev = $('#sigUploadPreview');
      prev.src = uploaded.toDataURL('image/png');
      prev.hidden = false;
    } catch { uploaded = null; }
  });
}

export function openSignatureDialog() {
  const dlg = $('#signDlg');
  wire();
  strokes = []; uploaded = null;
  $('#sigUploadPreview').hidden = true;
  dlg.returnValue = '';
  dlg.showModal();
  setMode(mode);
  return new Promise((resolve) => {
    dlg.addEventListener('close', () => {
      if (dlg.returnValue !== 'ok') { resolve(null); return; }
      let res = null;
      if (mode === 'draw' && strokes.length) res = trimmed(pad());
      else if (mode === 'type') { drawTyped(); res = trimmed($('#sigTypePreview')); }
      else if (mode === 'upload' && uploaded) res = trimmed(uploaded);
      if (!res) { resolve(null); return; }
      const sig = { id: Date.now(), ...res };
      if ($('#sigRemember').checked) store([sig, ...savedSignatures()]);
      resolve(sig);
    }, { once: true });
  });
}
