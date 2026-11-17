// PDF engine: opening, rendering and writing PDFs. Everything runs on this device;
// pdf.js (Mozilla) draws pages and pdf-lib writes the files.

const V = 'vendor/';
let ready = null;

/** Loads the two PDF libraries the first time a file is opened (keeps the start screen instant). */
export function loadLibs() {
  ready ||= Promise.all([addScript(V + 'pdf-lib.min.js'), addScript(V + 'pdf.min.js')])
    .then(() => { pdfjsLib.GlobalWorkerOptions.workerSrc = V + 'pdf.worker.min.js'; })
    .catch((e) => { ready = null; throw e; });
  return ready;
}

function addScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Could not load the PDF engine. Check your connection and reload.'));
    document.head.append(s);
  });
}

export const isPdf = (f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
export const isImage = (f) => /^image\//.test(f.type) || /\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(f.name);

let nextId = 1;

/** Opens a PDF or an image (images become one-page PDFs). Returns null if the user cancels a password prompt. */
export async function openFile(file, askPassword) {
  await loadLibs();
  const name = file.name.replace(/\.[^.]+$/, '') || 'document';
  let bytes = new Uint8Array(await file.arrayBuffer());
  if (!isPdf(file) && sniff(bytes) !== 'pdf') {
    if (!isImage(file) && !sniff(bytes)) throw new Error(`${file.name} isn't a PDF or an image.`);
    bytes = await imageToPdf(bytes, file.type);
    return openBytes(bytes, name, askPassword, 'image');
  }
  return openBytes(bytes, name, askPassword, 'pdf');
}

export async function openBytes(bytes, name, askPassword = async () => null, kind = 'pdf') {
  await loadLibs();
  const task = pdfjsLib.getDocument({
    data: bytes.slice(),
    cMapUrl: V + 'cmaps/',
    cMapPacked: true,
    standardFontDataUrl: V + 'standard_fonts/',
    isEvalSupported: false,
    enableXfa: false,
  });
  let cancelled = false;
  task.onPassword = (update, reason) => {
    askPassword(name, reason === pdfjsLib.PasswordResponses.INCORRECT_PASSWORD).then((pw) => {
      if (pw == null) { cancelled = true; task.destroy(); } else update(pw);
    });
  };
  let js;
  try {
    js = await task.promise;
  } catch {
    if (cancelled) return null;
    throw new Error(`${name} couldn't be opened. It may be damaged, or not a PDF.`);
  }
  // pdf-lib can't write encrypted or badly damaged files; their pages are saved as images instead.
  let locked = false, fields = [];
  try {
    const lib = await PDFLib.PDFDocument.load(bytes, { updateMetadata: false });
    try { fields = lib.getForm().getFields().map(describeField).filter(Boolean); } catch { /* no usable form */ }
  } catch {
    locked = true;
  }
  const pages = await Promise.all(Array.from({ length: js.numPages }, (_, i) => js.getPage(i + 1).then((p) => {
    const vp = p.getViewport({ scale: 1 });
    return { w: vp.width, h: vp.height };
  })));
  return { id: nextId++, name, bytes, js, locked, pages, fields, kind };
}

export function closeSource(src) {
  try { src.js.destroy(); } catch { /* already closed */ }
}

function describeField(f) {
  const L = PDFLib;
  try {
    if (f.isReadOnly()) return null;
    const name = f.getName();
    if (f instanceof L.PDFTextField) return { name, type: 'text', value: f.getText() || '', multiline: f.isMultiline() };
    if (f instanceof L.PDFCheckBox) return { name, type: 'check', value: f.isChecked() };
    if (f instanceof L.PDFDropdown || f instanceof L.PDFOptionList) return { name, type: 'select', options: f.getOptions(), value: f.getSelected()[0] || '' };
    if (f instanceof L.PDFRadioGroup) return { name, type: 'radio', options: f.getOptions(), value: f.getSelected() || '' };
  } catch { /* unusual field */ }
  return null;
}

// ---------- images ----------

function sniff(b) {
  if (b[0] === 0xFF && b[1] === 0xD8) return 'jpg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return 'png';
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return 'pdf';
  if (b[0] === 0x47 && b[1] === 0x49) return 'gif';
  if (b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'webp';
  if (b[0] === 0x42 && b[1] === 0x4D) return 'bmp';
  return null;
}

/** EXIF orientation of a JPEG (1 = upright). Phone photos are often stored sideways with this flag. */
function jpegOrientation(b) {
  let p = 2;
  while (p + 10 < b.length) {
    if (b[p] !== 0xFF) return 1;
    const m = b[p + 1], len = (b[p + 2] << 8) | b[p + 3];
    if (m === 0xDA) return 1;
    if (m === 0xE1 && b[p + 4] === 0x45 && b[p + 5] === 0x78 && b[p + 6] === 0x69 && b[p + 7] === 0x66) {
      const t = p + 10, le = b[t] === 0x49;
      const u16 = (o) => (le ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1]);
      const u32 = (o) => (le ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) : ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3])) >>> 0;
      const ifd = t + u32(t + 4);
      if (ifd + 2 > b.length) return 1;
      for (let i = 0, n = u16(ifd); i < n; i++) {
        const e = ifd + 2 + i * 12;
        if (e + 10 > b.length) break;
        if (u16(e) === 0x0112) return u16(e + 8);
      }
      return 1;
    }
    p += 2 + len;
  }
  return 1;
}

async function imageToPdf(bytes, type) {
  const doc = await PDFLib.PDFDocument.create();
  const kind = sniff(bytes);
  let img = null;
  try {
    if (kind === 'jpg' && jpegOrientation(bytes) <= 1) img = await doc.embedJpg(bytes);
    else if (kind === 'png') img = await doc.embedPng(bytes);
  } catch { img = null; }
  if (!img) {
    // Other formats (and rotated phone photos) go through the browser's own decoder.
    const bmp = await createImageBitmap(new Blob([bytes], { type: type || '' }));
    const c = document.createElement('canvas');
    c.width = bmp.width; c.height = bmp.height;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(bmp, 0, 0);
    bmp.close?.();
    img = await doc.embedJpg(await canvasBytes(c, 'image/jpeg', 0.92));
    c.width = c.height = 0;
  }
  // Long side the height of an A4 page, keeping the image's shape.
  const s = 842 / Math.max(img.width, img.height);
  const page = doc.addPage([img.width * s, img.height * s]);
  page.drawImage(img, { x: 0, y: 0, width: img.width * s, height: img.height * s });
  return doc.save();
}

// ---------- rendering ----------

const jobs = [];
let running = 0;
function schedule(fn, urgent) {
  return new Promise((resolve, reject) => {
    const job = { fn, resolve, reject };
    if (urgent) jobs.unshift(job); else jobs.push(job);
    pump();
  });
}
function pump() {
  while (running < 2 && jobs.length) {
    const { fn, resolve, reject } = jobs.shift();
    running++;
    fn().then(resolve, reject).finally(() => { running--; pump(); });
  }
}

const MAX_PIXELS = 16e6;

/** Draws one page (as it looks with its own rotation) to an image Blob. */
export function renderPage(src, index, { width, scale, type = 'image/jpeg', quality = 0.85, urgent = false } = {}) {
  return schedule(async () => {
    const page = await src.js.getPage(index + 1);
    const base = page.getViewport({ scale: 1 });
    let s = scale || width / base.width;
    s = Math.min(s, Math.sqrt(MAX_PIXELS / (base.width * base.height)));
    const vp = page.getViewport({ scale: s });
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.floor(vp.width));
    c.height = Math.max(1, Math.floor(vp.height));
    const ctx = c.getContext('2d', { alpha: false });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: ctx, viewport: vp, annotationMode: pdfjsLib.AnnotationMode.ENABLE_STORAGE }).promise;
    const blob = await canvasBlob(c, type, quality);
    c.width = c.height = 0;
    page.cleanup();
    return blob;
  }, urgent);
}

function canvasBlob(c, type, q) {
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('Not enough memory to draw this page.'))), type, q));
}
async function canvasBytes(c, type, q) {
  return new Uint8Array(await (await canvasBlob(c, type, q)).arrayBuffer());
}

// ---------- building the output ----------

/** Where a point on the page as displayed (in points, y down) lands in PDF space, for a page shown at `rot` degrees. */
function geometry(page, rot) {
  const b = page.getCropBox();
  const side = rot % 180 !== 0;
  const DW = side ? b.height : b.width, DH = side ? b.width : b.height;
  return {
    rot, DW, DH,
    at(dx, dy) {
      const u = dx / DW, v = dy / DH;
      switch (rot) {
        case 90: return [b.x + v * b.width, b.y + u * b.height];
        case 180: return [b.x + (1 - u) * b.width, b.y + v * b.height];
        case 270: return [b.x + (1 - v) * b.width, b.y + (1 - u) * b.height];
        default: return [b.x + u * b.width, b.y + (1 - v) * b.height];
      }
    },
  };
}

const norm = (a) => ((Math.round(a / 90) * 90) % 360 + 360) % 360;

export function hexColor(hex) {
  const n = parseInt((hex || '#000000').slice(1), 16);
  return PDFLib.rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Line height and baseline used for typed text, matching the editor (Arial/Helvetica at line-height 1.2). */
export const LINE = 1.2, BASELINE = 0.947;

/**
 * Writes the document described by `st`:
 *   st.pages  [{ src, i, rot, ov: [overlay] }] in output order
 *   st.srcs   Map of source id -> opened source
 *   st.stamps { numbers, watermark }
 *   st.form   { [srcId]: { fieldName: value } }
 */
export async function build(st, { flatten = false, clean = false, onProgress = () => {} } = {}) {
  await loadLibs();
  const { PDFDocument, PDFPage, degrees, StandardFonts } = PDFLib;
  const pages = st.pages;
  if (!pages.length) throw new Error('There are no pages to save.');
  const used = [...new Set(pages.map((p) => p.src))].map((id) => st.srcs.get(id));
  // One untouched source in its original order is edited in place, which keeps bookmarks, links and editable form fields.
  const inPlace = used.length === 1 && !used[0].locked && pages.length === used[0].pages.length && pages.every((p, k) => p.i === k);

  const libs = new Map();
  for (const s of used) {
    if (s.locked) continue;
    const d = await PDFDocument.load(s.bytes, { updateMetadata: false });
    fillForm(d, st.form?.[s.id], flatten || !inPlace);
    libs.set(s.id, d);
  }

  let out, outPages;
  if (inPlace) {
    out = libs.get(used[0].id);
    outPages = out.getPages();
  } else {
    out = await PDFDocument.create({ updateMetadata: false });
    outPages = new Array(pages.length);
    let done = 0;
    for (const s of used) {
      const ks = pages.map((p, k) => (p.src === s.id ? k : -1)).filter((k) => k >= 0);
      if (s.locked) {
        for (const k of ks) {
          outPages[k] = await rasterPage(out, PDFPage, s, pages[k].i, 150, 0.82);
          onProgress(++done / pages.length * 0.8);
        }
        continue;
      }
      // Copy each page's first use in one batch (shared fonts and images are copied once); repeats separately.
      const seen = new Set(), first = [], again = [];
      for (const k of ks) {
        if (seen.has(pages[k].i)) again.push(k); else { seen.add(pages[k].i); first.push(k); }
      }
      const copied = await out.copyPages(libs.get(s.id), first.map((k) => pages[k].i));
      first.forEach((k, j) => { outPages[k] = copied[j]; });
      for (const k of again) [outPages[k]] = await out.copyPages(libs.get(s.id), [pages[k].i]);
      done += ks.length;
      onProgress(done / pages.length * 0.8);
    }
    for (const p of outPages) out.addPage(p);
    if (used.length === 1 && libs.get(used[0].id)) {
      const t = libs.get(used[0].id).getTitle();
      if (t) out.setTitle(t);
    }
  }

  const font = await out.embedFont(StandardFonts.Helvetica);
  const images = new Map();
  const ctx = { out, font, images };
  const { numbers, watermark } = st.stamps || {};
  const first = numbers ? (numbers.start ?? 1) : 1;
  const counted = numbers ? pages.length - (numbers.skipFirst ? 1 : 0) : 0;
  for (let k = 0; k < pages.length; k++) {
    const page = outPages[k], p = pages[k];
    const rot = norm(page.getRotation().angle + (p.rot || 0));
    page.setRotation(degrees(rot));
    const g = geometry(page, rot);
    for (const o of p.ov || []) await drawOverlay(ctx, page, g, o);
    if (watermark?.text) await drawWatermark(ctx, page, g, watermark);
    if (numbers && !(numbers.skipFirst && k === 0)) {
      const n = first + k - (numbers.skipFirst ? 1 : 0);
      await drawPageNumber(ctx, page, g, numbers, numberLabel(numbers.format, n, first + counted - 1));
    }
    if (k % 10 === 9) onProgress(0.8 + (k / pages.length) * 0.15);
  }

  if (clean) {
    for (const k of ['Title', 'Author', 'Subject', 'Keywords', 'Creator', 'Producer', 'CreationDate', 'ModDate']) {
      try { out.getInfoDict().delete(PDFLib.PDFName.of(k)); } catch { /* not there */ }
    }
    out.catalog.delete(PDFLib.PDFName.of('Metadata'));
  } else {
    out.setProducer('Private PDF');
    out.setModificationDate(new Date());
  }
  onProgress(0.97);
  try {
    return await out.save({ useObjectStreams: true });
  } catch (e) {
    if (/WinAnsi cannot encode/.test(String(e))) throw new Error('A form field contains characters this form\'s font can\'t show. Use "Sign & edit" to type them on the page instead.');
    throw e;
  }
}

function fillForm(doc, values, flatten) {
  if (!values || !Object.keys(values).length) return;
  const L = PDFLib;
  const form = doc.getForm();
  for (const [name, v] of Object.entries(values)) {
    try {
      const f = form.getField(name);
      if (f instanceof L.PDFTextField) f.setText(String(v ?? ''));
      else if (f instanceof L.PDFCheckBox) (v ? f.check() : f.uncheck());
      else if (f instanceof L.PDFDropdown || f instanceof L.PDFOptionList) (v ? f.select(v) : f.clear());
      else if (f instanceof L.PDFRadioGroup) (v ? f.select(v) : f.clear());
    } catch { /* field changed or unsupported */ }
  }
  if (flatten) {
    try { form.flatten(); } catch { /* keep fields if flattening fails */ }
  }
}

async function rasterPage(out, PDFPage, src, i, dpi, quality) {
  const blob = await renderPage(src, i, { scale: dpi / 72, quality });
  const img = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()));
  const { w, h } = src.pages[i];
  const page = PDFPage.create(out);
  page.setSize(w, h);
  page.drawImage(img, { x: 0, y: 0, width: w, height: h });
  return page;
}

function dataUrlBytes(url) {
  const bin = atob(url.slice(url.indexOf(',') + 1));
  const b = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  return b;
}

async function drawOverlay(ctx, page, g, o) {
  const { degrees, rgb } = PDFLib;
  if (o.kind === 'rect') {
    const [x, y] = g.at(o.u * g.DW, (o.v + o.h) * g.DH);
    page.drawRectangle({ x, y, width: o.w * g.DW, height: o.h * g.DH, color: o.color ? hexColor(o.color) : rgb(1, 1, 1), rotate: degrees(g.rot) });
  } else if (o.kind === 'image') {
    let img = ctx.images.get(o.data);
    if (!img) { img = await ctx.out.embedPng(dataUrlBytes(o.data)); ctx.images.set(o.data, img); }
    const [x, y] = g.at(o.u * g.DW, (o.v + o.h) * g.DH);
    page.drawImage(img, { x, y, width: o.w * g.DW, height: o.h * g.DH, rotate: degrees(g.rot) });
  } else if (o.kind === 'text') {
    const lines = String(o.text || '').split('\n');
    const top = o.v * g.DH, left = o.u * g.DW;
    for (let i = 0; i < lines.length; i++) {
      await drawLine(ctx, page, g, lines[i], left, top + o.size * (BASELINE + LINE * i), o.size, 0, hexColor(o.color), 1);
    }
  }
}

/** Draws one line of text with its baseline starting at (bx, by) on the displayed page, turned `angle` degrees anticlockwise. */
async function drawLine(ctx, page, g, text, bx, by, size, angle, color, opacity) {
  if (!text.trim()) return;
  const { degrees } = PDFLib;
  try {
    ctx.font.encodeText(text);
    const [x, y] = g.at(bx, by);
    page.drawText(text, { x, y, size, font: ctx.font, color, opacity, rotate: degrees(g.rot + angle) });
  } catch {
    // Characters the built-in font can't draw (ticks, emoji, other scripts) are drawn as a sharp image instead.
    const t = await textImage(text, size, color);
    let img = ctx.images.get(t.key);
    if (!img) { img = await ctx.out.embedPng(t.png); ctx.images.set(t.key, img); }
    const a = (angle * Math.PI) / 180;
    const [x, y] = g.at(bx + Math.sin(a) * t.descent, by + Math.cos(a) * t.descent);
    page.drawImage(img, { x, y, width: t.w, height: t.h, rotate: degrees(g.rot + angle), opacity });
  }
}

async function textImage(text, size, color) {
  const k = 4, px = size * k;
  const c = document.createElement('canvas');
  const x = c.getContext('2d');
  const fontCss = `${px}px Helvetica, Arial, "Segoe UI Symbol", "Noto Sans", sans-serif`;
  x.font = fontCss;
  const m = x.measureText(text);
  const asc = m.fontBoundingBoxAscent ?? px * 0.905, desc = m.fontBoundingBoxDescent ?? px * 0.212;
  c.width = Math.ceil(m.width) + 2;
  c.height = Math.ceil(asc + desc);
  x.font = fontCss;
  const { red, green, blue } = color;
  x.fillStyle = `rgb(${red * 255},${green * 255},${blue * 255})`;
  x.textBaseline = 'alphabetic';
  x.fillText(text, 1, asc);
  const png = await canvasBytes(c, 'image/png');
  return { png, w: c.width / k, h: c.height / k, descent: desc / k, key: `t:${fontCss}:${x.fillStyle}:${text}` };
}

function textWidth(ctx, text, size) {
  try { return ctx.font.widthOfTextAtSize(text, size); } catch { return text.length * size * 0.55; }
}

export function numberLabel(format, n, total) {
  switch (format) {
    case 'of': return `${n} of ${total}`;
    case 'page': return `Page ${n}`;
    case 'pageof': return `Page ${n} of ${total}`;
    case 'dash': return `- ${n} -`;
    default: return String(n);
  }
}

async function drawPageNumber(ctx, page, g, opt, label) {
  const size = opt.size || 11, m = opt.margin ?? 28;
  const w = textWidth(ctx, label, size);
  const [vert, horiz] = opt.pos || 'bc';
  const bx = horiz === 'l' ? m : horiz === 'r' ? g.DW - m - w : (g.DW - w) / 2;
  const by = vert === 't' ? m + size * 0.72 : g.DH - m;
  await drawLine(ctx, page, g, label, bx, by, size, 0, hexColor(opt.color || '#333333'), 1);
}

async function drawWatermark(ctx, page, g, wm) {
  const size = Math.min(wm.size || 60, g.DW / Math.max(1, wm.text.length) * 1.6);
  const angle = wm.diagonal ? (Math.atan2(g.DH, g.DW) * 180) / Math.PI : 0;
  const a = (angle * Math.PI) / 180;
  const w = textWidth(ctx, wm.text, size), cap = size * 0.72;
  const cx = g.DW / 2, cy = g.DH / 2;
  // Centre the text: back off half its width along its direction, and half its cap height below.
  const bx = cx - Math.cos(a) * w / 2 + Math.sin(a) * cap / 2;
  const by = cy + Math.sin(a) * w / 2 + Math.cos(a) * cap / 2;
  await drawLine(ctx, page, g, wm.text, bx, by, size, angle, hexColor(wm.color || '#888888'), wm.opacity ?? 0.2);
}

// ---------- compress ----------

const LEVELS = {
  light: null,
  balanced: { maxSide: 2000, quality: 0.72 },
  strong: { maxSide: 1400, quality: 0.55 },
};

/** Makes a PDF smaller. "light" only repacks; "balanced"/"strong" recompress photos and scans; "max" redraws every page as an image. */
export async function compress(bytes, level, onProgress = () => {}) {
  await loadLibs();
  if (level === 'max') return rasterize(bytes, 110, 0.5, onProgress);
  const L = PDFLib;
  const doc = await L.PDFDocument.load(bytes, { updateMetadata: false });
  const opt = LEVELS[level];
  if (opt) {
    const ctx = doc.context;
    const all = ctx.enumerateIndirectObjects();
    const masks = new Set();
    for (const [, obj] of all) {
      if (obj instanceof L.PDFRawStream) {
        const sm = obj.dict.get(L.PDFName.of('SMask'));
        if (sm instanceof L.PDFRef) masks.add(sm.toString());
      }
    }
    const imgs = all.filter(([ref, obj]) => obj instanceof L.PDFRawStream
      && obj.dict.get(L.PDFName.of('Subtype')) === L.PDFName.of('Image') && !masks.has(ref.toString()));
    for (let i = 0; i < imgs.length; i++) {
      const [ref, obj] = imgs[i];
      try {
        const smaller = await recompressImage(L, ctx, obj, opt);
        if (smaller) ctx.assign(ref, smaller);
      } catch { /* leave this image as it was */ }
      onProgress((i + 1) / imgs.length * 0.9);
    }
  }
  return doc.save({ useObjectStreams: true });
}

async function recompressImage(L, ctx, obj, { maxSide, quality }) {
  const d = obj.dict;
  const num = (k) => { const v = d.lookup(L.PDFName.of(k)); return v instanceof L.PDFNumber ? v.asNumber() : null; };
  const w = num('Width'), h = num('Height');
  if (!w || !h || num('BitsPerComponent') !== 8) return null;
  if (d.get(L.PDFName.of('ImageMask')) || d.get(L.PDFName.of('Decode')) || d.get(L.PDFName.of('Mask'))) return null;
  let filter = d.lookup(L.PDFName.of('Filter'));
  if (filter instanceof L.PDFArray) filter = filter.size() === 1 ? filter.lookup(0) : null;
  if (!filter) return null;
  const n = channels(L, d.lookup(L.PDFName.of('ColorSpace')));
  if (n !== 1 && n !== 3) return null;
  const old = obj.contents.length;
  if (old < 20000) return null;

  let source;
  if (filter === L.PDFName.of('DCTDecode')) {
    source = await createImageBitmap(new Blob([obj.contents], { type: 'image/jpeg' }));
  } else if (filter === L.PDFName.of('FlateDecode')) {
    const parms = d.lookup(L.PDFName.of('DecodeParms'));
    if (parms instanceof L.PDFDict) {
      const p = parms.lookup(L.PDFName.of('Predictor'));
      if (p instanceof L.PDFNumber && p.asNumber() > 1) return null;
    }
    const raw = L.decodePDFRawStream(obj).decode();
    if (raw.length < w * h * n) return null;
    const rgba = new ImageData(w, h);
    const px = rgba.data;
    for (let i = 0, j = 0; i < w * h; i++, j += n) {
      const o = i * 4;
      if (n === 1) { px[o] = px[o + 1] = px[o + 2] = raw[j]; } else { px[o] = raw[j]; px[o + 1] = raw[j + 1]; px[o + 2] = raw[j + 2]; }
      px[o + 3] = 255;
    }
    source = await createImageBitmap(rgba);
  } else {
    return null;
  }

  const s = Math.min(1, maxSide / Math.max(w, h));
  const W = Math.max(1, Math.round(w * s)), H = Math.max(1, Math.round(h * s));
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d', { alpha: false });
  x.fillStyle = '#fff';
  x.fillRect(0, 0, W, H);
  x.imageSmoothingQuality = 'high';
  x.drawImage(source, 0, 0, W, H);
  source.close?.();
  const jpg = await canvasBytes(c, 'image/jpeg', quality);
  c.width = c.height = 0;
  if (jpg.length > old * 0.85) return null;
  const dict = { Type: 'XObject', Subtype: 'Image', Width: W, Height: H, ColorSpace: 'DeviceRGB', BitsPerComponent: 8, Filter: 'DCTDecode' };
  const sm = d.get(L.PDFName.of('SMask'));
  if (sm) dict.SMask = sm;
  return ctx.stream(jpg, dict);
}

function channels(L, cs) {
  if (cs === L.PDFName.of('DeviceRGB') || cs === L.PDFName.of('CalRGB')) return 3;
  if (cs === L.PDFName.of('DeviceGray') || cs === L.PDFName.of('CalGray')) return 1;
  if (cs instanceof L.PDFArray && cs.lookup(0) === L.PDFName.of('ICCBased')) {
    const icc = cs.lookup(1);
    const n = icc?.dict?.lookup(L.PDFName.of('N'));
    return n instanceof L.PDFNumber ? n.asNumber() : 0;
  }
  return 0;
}

async function rasterize(bytes, dpi, quality, onProgress) {
  const src = await openBytes(bytes, 'document');
  const out = await PDFLib.PDFDocument.create();
  for (let i = 0; i < src.pages.length; i++) {
    out.addPage(await rasterPage(out, PDFLib.PDFPage, src, i, dpi, quality));
    onProgress((i + 1) / src.pages.length * 0.95);
  }
  closeSource(src);
  return out.save({ useObjectStreams: true });
}

// ---------- split / extract ----------

/** Splits a finished PDF into several, one per group of page indexes. */
export async function split(bytes, groups, onProgress = () => {}) {
  await loadLibs();
  const doc = await PDFLib.PDFDocument.load(bytes, { updateMetadata: false });
  const outs = [];
  for (let g = 0; g < groups.length; g++) {
    const out = await PDFLib.PDFDocument.create({ updateMetadata: false });
    const copied = await out.copyPages(doc, groups[g]);
    copied.forEach((p) => out.addPage(p));
    out.setProducer('Private PDF');
    outs.push(await out.save({ useObjectStreams: true }));
    onProgress((g + 1) / groups.length);
  }
  return outs;
}

// ---------- PDF to images ----------

export async function toImages(bytes, { dpi = 150, type = 'image/jpeg', quality = 0.9, indexes = null } = {}, onProgress = () => {}) {
  const src = await openBytes(bytes, 'document');
  const list = indexes || src.pages.map((_, i) => i);
  const out = [];
  for (let k = 0; k < list.length; k++) {
    const blob = await renderPage(src, list[k], { scale: dpi / 72, type, quality });
    out.push({ index: list[k], data: new Uint8Array(await blob.arrayBuffer()) });
    onProgress((k + 1) / list.length);
  }
  closeSource(src);
  return out;
}

// ---------- zip (stored, no compression: PDFs and JPEGs are already compressed) ----------

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(b) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

export function zip(files) {
  const enc = new TextEncoder();
  const now = new Date();
  const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const parts = [], central = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name), crc = crc32(f.data), size = f.data.length;
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true);
    local.setUint16(10, time, true); local.setUint16(12, date, true);
    local.setUint32(14, crc, true); local.setUint32(18, size, true); local.setUint32(22, size, true);
    local.setUint16(26, name.length, true);
    parts.push(local, name, f.data);
    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true); cen.setUint16(4, 20, true); cen.setUint16(6, 20, true); cen.setUint16(8, 0x0800, true);
    cen.setUint16(12, time, true); cen.setUint16(14, date, true);
    cen.setUint32(16, crc, true); cen.setUint32(20, size, true); cen.setUint32(24, size, true);
    cen.setUint16(28, name.length, true); cen.setUint32(42, offset, true);
    central.push(cen, name);
    offset += 30 + name.length + size;
  }
  const cenSize = central.reduce((n, p) => n + p.byteLength, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cenSize, true); end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end], { type: 'application/zip' });
}
