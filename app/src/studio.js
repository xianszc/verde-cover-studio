// VERDE HEAT Cover Studio — the editor. Owns the document, the preview
// canvas, uploads, per-panel crop and warmth controls, layout and grade
// presets, caption editing and PNG export in the three post sizes. Painting
// itself lives in poster.js; face-aware auto-crop lives in facefind.js.
import { paintCover, layoutFor, SIZES, LAYOUT_NAMES, GRADE_NAMES } from './poster.js';
import { faceFocus } from './facefind.js';

const LIBRARY = [
  { file: 'samples/r2-hero.jpg', label: 'Hero — Woman' },
  { file: 'samples/r2-rooftop.jpg', label: 'Man — Rooftop' },
  { file: 'samples/r2-friends.jpg', label: 'Friends — Neon' },
  { file: 'samples/r2-angler.jpg', label: 'Man — Pier' },
  { file: 'samples/r2-driver.jpg', label: 'Woman — Boulevard' },
  { file: 'samples/r2-captain.jpg', label: 'Man — Fishing' },
  { file: 'samples/boulevard.jpg', label: 'Woman — Sunset Blvd' },
  { file: 'samples/pier.jpg', label: 'Pier — Morning' },
];

const DEFAULT_PANELS = [
  { pic: 0, zoom: 1, dx: 0, dy: 0, role: 'THE QUEEN', place: 'VERDE BAY', time: 'GOLDEN HOUR', line: 'She came back for one last summer.', warm: 0, focus: null },
  { pic: 1, zoom: 1, dx: 0, dy: 0, role: 'THE FIXER', place: 'ROOFTOP 9', time: 'DUSK', line: 'Every deal has a sunset clause.', warm: 0, focus: null },
  { pic: 2, zoom: 1, dx: 0, dy: 0, role: 'THE WILDCARDS', place: 'NEON ROW', time: 'MIDNIGHT', line: 'Two laughs, zero plans.', warm: 0, focus: null },
  { pic: 3, zoom: 1, dx: 0, dy: 0, role: 'THE OLD SALT', place: 'THE PIER', time: 'DAWN', line: 'He knows where the fish hide.', warm: 0, focus: null },
  { pic: 4, zoom: 1, dx: 0, dy: 0, role: 'THE DRIVER', place: 'PALM BLVD', time: 'SUNSET', line: 'Red car. No brakes. No regrets.', warm: 0, focus: null },
  { pic: 5, zoom: 1, dx: 0, dy: 0, role: 'THE CAPTAIN', place: 'TURQUOISE BAY', time: 'MORNING', line: 'The tide brings everyone back.', warm: 0, focus: null },
];

const doc = {
  layout: 'hero-six',
  grade: 'sunset',
  title: 'VERDE HEAT',
  script: 'salt air & fast hearts',
  tagline: 'SIX SOULS · ONE COAST · GOLDEN HOUR',
  quote: '"A sun-soaked blast."',
  source: 'VERDE GAZETTE',
  vol: 'VOL. 01',
  size: '1080x1350',
  panels: DEFAULT_PANELS.map((p) => ({ ...p })),
  sel: 0,
  activePic: 0,
};

// Hand-measured face points for the shipped samples. A skin-tone detector
// cannot tell a face from a warm sunset sky — their chroma is nearly
// identical (measured: face r-g 29-40, sky r-g 16-47, Cb/Cr overlapping) —
// so the samples the app ships with carry their face points measured by
// eye. Any photo the user uploads still goes through the detector
// (faceFocus), with drag and zoom as the manual fallback.
const CURATED_FOCUS = {
  'samples/r2-hero.jpg': { x: 0.6, y: 0.3 },
  'samples/r2-rooftop.jpg': { x: 0.48, y: 0.24 },
  'samples/r2-driver.jpg': { x: 0.47, y: 0.35 },
};

function focusFor(photo) {
  return CURATED_FOCUS[photo.file] || faceFocus(photo.img);
}

const pool = [];
const $ = (id) => document.getElementById(id);
const stage = $('stageCanvas');
const statusLine = $('statusLine');
let paintQueued = false;
let soloCover = false;

function say(text) { statusLine.textContent = text; }
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}
function poolImages() { return pool.map((p) => p.img); }
function visibleCount() {
  const [W, H] = SIZES[doc.size];
  return layoutFor(W, H, doc.layout).panels.length;
}

function renderStage() {
  const [W, H] = SIZES[doc.size];
  if (stage.width !== W || stage.height !== H) { stage.width = W; stage.height = H; }
  const g = stage.getContext('2d');
  const geo = paintCover(g, W, H, doc, poolImages());
  // The cover scene (?shot=cover) shows the exported cover exactly as the
  // app writes it — no editor selection box on it.
  if (soloCover) return;
  const rect = geo.panels[doc.sel];
  if (rect) {
    g.save();
    if (rect.angle) {
      g.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
      g.rotate((rect.angle * Math.PI) / 180);
      g.translate(-rect.w / 2, -rect.h / 2);
      g.strokeStyle = '#ffd23f';
      g.lineWidth = Math.max(3, rect.w * 0.008);
      g.setLineDash([14, 10]);
      g.strokeRect(0, 0, rect.w, rect.h);
    } else {
      g.strokeStyle = '#ffd23f';
      g.lineWidth = Math.max(3, rect.w * 0.008);
      g.setLineDash([14, 10]);
      g.strokeRect(rect.x, rect.y, rect.w, rect.h);
    }
    g.restore();
  }
}

function queuePaint() {
  if (paintQueued) return;
  paintQueued = true;
  requestAnimationFrame(() => { paintQueued = false; renderStage(); });
}

// ---- history: undo / redo -----------------------------------------------
// Post-state stacks: each entry is a full snapshot of the editable document
// (layout, grade, captions, panels). remember() records the state after a
// change; undo steps back to the previous snapshot, redo steps forward.
const past = [];
const future = [];
let rememberTimer = null;

function snap() {
  return JSON.stringify({
    layout: doc.layout,
    grade: doc.grade,
    title: doc.title,
    script: doc.script,
    tagline: doc.tagline,
    quote: doc.quote,
    source: doc.source,
    vol: doc.vol,
    size: doc.size,
    sel: doc.sel,
    panels: doc.panels,
  });
}

function applySnap(json) {
  const s = JSON.parse(json);
  doc.layout = s.layout;
  doc.grade = s.grade;
  doc.title = s.title;
  doc.script = s.script;
  doc.tagline = s.tagline;
  doc.quote = s.quote;
  doc.source = s.source;
  doc.vol = s.vol;
  doc.size = s.size;
  doc.sel = Math.min(s.sel, visibleCount() - 1);
  doc.panels = s.panels.map((p) => ({ ...p }));
  doc.panels.forEach((p) => { if (p.pic == null || !pool[p.pic]) p.pic = 0; });
  refreshEditor();
  queuePaint();
  persistSoon();
}

function remember() {
  const s = snap();
  if (past[past.length - 1] === s) return;
  past.push(s);
  if (past.length > 60) past.shift();
  future.length = 0;
  syncHistoryButtons();
  persistSoon();
}

// Debounced commit for continuous input (typing, sliders, drag, wheel).
function rememberSoon() {
  clearTimeout(rememberTimer);
  rememberTimer = setTimeout(remember, 400);
}

// Commits any change still waiting on its debounce right now, so an undo
// that follows a slider drag or a wheel zoom within 400 ms still reverts it
// instead of letting the late commit land after the undo and wipe redo.
function flushRemember() {
  clearTimeout(rememberTimer);
  rememberTimer = null;
  remember();
}

function syncHistoryButtons() {
  $('undoBtn').disabled = past.length < 2;
  $('redoBtn').disabled = future.length === 0;
}

function undo() {
  flushRemember();
  if (past.length < 2) return;
  future.push(past.pop());
  applySnap(past[past.length - 1]);
  syncHistoryButtons();
  say('Undone.');
}

function redo() {
  flushRemember();
  if (!future.length) return;
  const s = future.pop();
  past.push(s);
  applySnap(s);
  syncHistoryButtons();
  say('Redone.');
}

// ---- project: autosave, save / load as JSON -------------------------------

const AUTOSAVE_KEY = 'verde-heat-r2';
let persistTimer = null;

// Downscales an image to a JPEG data URL so an uploaded photo can be stored.
function thumbDataUrl(img) {
  const max = 900;
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.naturalWidth * scale));
  c.height = Math.max(1, Math.round(img.naturalHeight * scale));
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.75);
}

// The whole project as JSON: captions, layout, grade, panels and photos.
function packProject() {
  return JSON.stringify({
    app: 'verde-heat-cover-studio',
    version: 2,
    savedAt: new Date().toISOString(),
    layout: doc.layout,
    grade: doc.grade,
    title: doc.title,
    script: doc.script,
    tagline: doc.tagline,
    quote: doc.quote,
    source: doc.source,
    vol: doc.vol,
    size: doc.size,
    sel: doc.sel,
    panels: doc.panels,
    photos: pool.map((p) => {
      if (p.file && p.file.startsWith('samples/')) return { label: p.label, file: p.file };
      if (p.dataUrl) return { label: p.label, dataUrl: p.dataUrl };
      return { label: p.label, dataUrl: thumbDataUrl(p.img) };
    }),
  });
}

function persistSoon() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    try {
      localStorage.setItem(AUTOSAVE_KEY, packProject());
      const note = $('autosaveLine');
      if (note) note.textContent = `Autosaved ${new Date().toLocaleTimeString()} — restores when you reopen this page.`;
    } catch { /* private mode or quota: autosave is silently off */ }
  }, 800);
}

async function restoreAutosave() {
  let raw = null;
  try { raw = localStorage.getItem(AUTOSAVE_KEY); } catch { /* no storage */ }
  if (!raw) return false;
  const ok = await unpackProject(raw);
  if (ok) say('Restored your autosaved project.');
  return ok;
}

// Rebuilds the editor from a project JSON string. Returns false when invalid.
async function unpackProject(json) {
  let data;
  try { data = JSON.parse(json); } catch { return false; }
  if (!data || data.app !== 'verde-heat-cover-studio' || !Array.isArray(data.photos) || !Array.isArray(data.panels)) return false;
  const photos = [];
  for (const entry of data.photos) {
    try {
      const src = entry.file || entry.dataUrl;
      if (!src) continue;
      const img = await loadImage(src);
      photos.push({ img, label: entry.label || 'Photo', file: src, dataUrl: entry.dataUrl || null });
    } catch { /* skip unreadable photos */ }
  }
  if (!photos.length) return false;
  pool.length = 0;
  pool.push(...photos);
  doc.layout = LAYOUT_NAMES[data.layout] ? data.layout : 'hero-six';
  doc.grade = GRADE_NAMES[data.grade] ? data.grade : 'sunset';
  doc.title = String(data.title ?? 'VERDE HEAT');
  doc.script = String(data.script ?? '');
  doc.tagline = String(data.tagline ?? '');
  doc.quote = String(data.quote ?? '');
  doc.source = String(data.source ?? 'VERDE GAZETTE');
  doc.vol = String(data.vol ?? 'VOL. 01');
  doc.size = SIZES[data.size] ? data.size : '1080x1350';
  doc.sel = Math.min(Math.max(0, data.sel | 0), visibleCount() - 1);
  doc.panels = DEFAULT_PANELS.map((d, i) => ({ ...d, ...(data.panels[i] || {}) }));
  doc.panels.forEach((p) => { if (p.pic == null || !pool[p.pic]) p.pic = 0; });
  doc.activePic = doc.panels[doc.sel]?.pic ?? 0;
  refreshEditor();
  queuePaint();
  return true;
}

function download(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

function saveFile() {
  try {
    download(new Blob([packProject()], { type: 'application/json' }), 'verde-heat-project.json');
    say('Project saved as verde-heat-project.json — load it back any time.');
  } catch {
    say('Could not save the project in this browser.');
  }
}

// ---- export ---------------------------------------------------------------

// Renders the cover at an exact post size and returns the PNG blob.
export async function renderPNG(sizeKey) {
  const [W, H] = SIZES[sizeKey];
  const off = document.createElement('canvas');
  off.width = W;
  off.height = H;
  paintCover(off.getContext('2d'), W, H, doc, poolImages());
  return new Promise((resolve) => off.toBlob((b) => resolve(b), 'image/png'));
}

async function exportOne(sizeKey) {
  const blob = await renderPNG(sizeKey);
  download(blob, `verde-heat-${sizeKey}.png`);
  say(`Saved verde-heat-${sizeKey}.png`);
}

async function exportAll() {
  for (const key of Object.keys(SIZES)) {
    const blob = await renderPNG(key);
    download(blob, `verde-heat-${key}.png`);
    await new Promise((r) => setTimeout(r, 250));
  }
  say('Saved all three sizes: 1080x1080, 1080x1350, 1920x1080.');
}

// ---- photo pool -------------------------------------------------------------

function buildThumbRail() {
  const rail = $('thumbRail');
  rail.innerHTML = '';
  pool.forEach((photo, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `pic${i === doc.activePic ? ' picked' : ''}`;
    btn.title = photo.label;
    const img = document.createElement('img');
    img.src = photo.file;
    img.alt = photo.label;
    btn.appendChild(img);
    btn.addEventListener('click', () => {
      doc.activePic = i;
      doc.panels[doc.sel].pic = i;
      syncPanelForm();
      buildThumbRail();
      queuePaint();
      remember();
    });
    rail.appendChild(btn);
  });
  const select = $('pPhoto');
  select.innerHTML = '';
  pool.forEach((photo, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = photo.label;
    select.appendChild(opt);
  });
  select.value = String(doc.panels[doc.sel].pic ?? 0);
}

async function loadLibrary() {
  for (const s of LIBRARY) {
    try {
      const img = await loadImage(s.file);
      pool.push({ img, label: s.label, file: s.file });
    } catch { /* a missing sample never blocks the editor */ }
  }
  // Face-aware default crops: centre each panel on its subject's face.
  doc.panels.forEach((panel) => {
    const photo = pool[panel.pic];
    if (photo) panel.focus = focusFor(photo);
  });
  buildThumbRail();
}

$('uploadInput').addEventListener('change', async (e) => {
  const files = [...e.target.files].filter((f) => f.type.startsWith('image/'));
  for (const file of files) {
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      pool.push({ img, label: file.name, file: url });
    } catch { /* skip unreadable files */ }
  }
  if (files.length) {
    doc.activePic = pool.length - 1;
    buildThumbRail();
    queuePaint();
    remember();
    say(`${files.length} photo${files.length > 1 ? 's' : ''} added. Click a thumbnail to put it in the selected panel.`);
  }
  e.target.value = '';
});

// ---- panel selection and editing --------------------------------------------

function syncPanelForm() {
  const panel = doc.panels[doc.sel];
  $('pPhoto').value = String(panel.pic ?? 0);
  $('pZoom').value = String(panel.zoom);
  $('pZoomVal').textContent = `${panel.zoom.toFixed(2)}×`;
  $('pOX').value = String(panel.dx);
  $('pOY').value = String(panel.dy);
  $('pRole').value = panel.role;
  $('pPlace').value = panel.place;
  $('pTime').value = panel.time;
  $('pLine').value = panel.line;
  $('pWarm').value = String(panel.warm);
  $('pWarmVal').textContent = panel.warm > 0 ? `+${panel.warm.toFixed(1)}` : panel.warm.toFixed(1);
  $('panelHeading').textContent = `Panel ${doc.sel + 1} — ${panel.role}`;
  document.querySelectorAll('#panelRows .prow').forEach((row, i) => {
    row.classList.toggle('selected', i === doc.sel);
  });
}

function pickPanel(i) {
  if (!doc.panels[i] || i >= visibleCount()) return;
  doc.sel = i;
  syncPanelForm();
  queuePaint();
}

function buildPanelRows() {
  const list = $('panelRows');
  list.innerHTML = '';
  const n = visibleCount();
  if (doc.sel >= n) doc.sel = 0;
  for (let i = 0; i < n; i++) {
    const panel = doc.panels[i];
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'prow';
    row.innerHTML = `<span class="no">${i + 1}</span><span class="role">${panel.role}</span><span class="where">${panel.place}</span>`;
    row.addEventListener('click', () => pickPanel(i));
    list.appendChild(row);
  }
}

$('pPhoto').addEventListener('change', (e) => {
  doc.panels[doc.sel].pic = Number(e.target.value);
  doc.activePic = Number(e.target.value);
  buildThumbRail();
  queuePaint();
  remember();
});
$('pZoom').addEventListener('input', (e) => {
  doc.panels[doc.sel].zoom = Number(e.target.value);
  $('pZoomVal').textContent = `${Number(e.target.value).toFixed(2)}×`;
  queuePaint();
  rememberSoon();
});
$('pOX').addEventListener('input', (e) => { doc.panels[doc.sel].dx = Number(e.target.value); queuePaint(); rememberSoon(); });
$('pOY').addEventListener('input', (e) => { doc.panels[doc.sel].dy = Number(e.target.value); queuePaint(); rememberSoon(); });
$('pRole').addEventListener('input', (e) => { doc.panels[doc.sel].role = e.target.value.toUpperCase(); buildPanelRows(); syncPanelForm(); queuePaint(); rememberSoon(); });
$('pPlace').addEventListener('input', (e) => { doc.panels[doc.sel].place = e.target.value.toUpperCase(); queuePaint(); rememberSoon(); });
$('pTime').addEventListener('input', (e) => { doc.panels[doc.sel].time = e.target.value.toUpperCase(); queuePaint(); rememberSoon(); });
$('pLine').addEventListener('input', (e) => { doc.panels[doc.sel].line = e.target.value; queuePaint(); rememberSoon(); });
$('pWarm').addEventListener('input', (e) => {
  doc.panels[doc.sel].warm = Number(e.target.value);
  $('pWarmVal').textContent = Number(e.target.value) > 0 ? `+${Number(e.target.value).toFixed(1)}` : Number(e.target.value).toFixed(1);
  queuePaint();
  rememberSoon();
});

$('btnFace').addEventListener('click', () => {
  const panel = doc.panels[doc.sel];
  const photo = pool[panel.pic];
  if (!photo) return;
  const focus = focusFor(photo);
  if (focus) {
    panel.focus = focus;
    panel.dx = 0;
    panel.dy = 0;
    say('Auto-crop: face centred in this panel.');
  } else {
    panel.focus = null;
    say('No face found in this photo — centred on the photo instead.');
  }
  syncPanelForm();
  queuePaint();
  remember();
});

$('btnFill').addEventListener('click', () => {
  const idx = doc.panels[doc.sel].pic;
  doc.panels.forEach((p) => { p.pic = idx; });
  say('One photo now fills every panel.');
  queuePaint();
  remember();
});

// ---- drag to position, wheel to zoom ----------------------------------------

function stagePoint(e) {
  const rect = stage.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * stage.width,
    y: ((e.clientY - rect.top) / rect.height) * stage.height,
  };
}

function panelAt(x, y) {
  const [W, H] = SIZES[doc.size];
  const geo = layoutFor(W, H, doc.layout);
  for (let i = geo.panels.length - 1; i >= 0; i--) {
    const r = geo.panels[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
  }
  return -1;
}

let drag = null;
stage.addEventListener('pointerdown', (e) => {
  const p = stagePoint(e);
  const hit = panelAt(p.x, p.y);
  if (hit < 0) return;
  pickPanel(hit);
  const panel = doc.panels[hit];
  drag = { x: p.x, y: p.y, dx: panel.dx, dy: panel.dy, rect: layoutFor(...SIZES[doc.size], doc.layout).panels[hit] };
  stage.setPointerCapture(e.pointerId);
});
stage.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const p = stagePoint(e);
  const panel = doc.panels[doc.sel];
  panel.dx = Math.max(-1, Math.min(1, drag.dx + ((p.x - drag.x) / drag.rect.w) * 2.2));
  panel.dy = Math.max(-1, Math.min(1, drag.dy + ((p.y - drag.y) / drag.rect.h) * 2.2));
  $('pOX').value = String(panel.dx);
  $('pOY').value = String(panel.dy);
  queuePaint();
});
stage.addEventListener('pointerup', () => {
  if (drag) {
    // A click that only selects a panel is not an edit: committing it would
    // wipe the redo stack for nothing. Only a real move counts as a change.
    const panel = doc.panels[doc.sel];
    if (Math.abs(panel.dx - drag.dx) > 0.005 || Math.abs(panel.dy - drag.dy) > 0.005) remember();
  }
  drag = null;
});
stage.addEventListener('wheel', (e) => {
  e.preventDefault();
  const panel = doc.panels[doc.sel];
  panel.zoom = Math.max(1, Math.min(3, panel.zoom * Math.exp(-e.deltaY * 0.0012)));
  $('pZoom').value = String(panel.zoom);
  $('pZoomVal').textContent = `${panel.zoom.toFixed(2)}×`;
  queuePaint();
  rememberSoon();
}, { passive: false });

// ---- layout, grade, caption, size -------------------------------------------

function buildChips(containerId, items, current, onPick) {
  const box = $(containerId);
  box.innerHTML = '';
  for (const [key, label] of Object.entries(items)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `chip${key === current ? ' on' : ''}`;
    btn.textContent = label;
    btn.addEventListener('click', () => {
      onPick(key);
      box.querySelectorAll('.chip').forEach((b) => b.classList.remove('on'));
      btn.classList.add('on');
    });
    box.appendChild(btn);
  }
}

function refreshChips() {
  buildChips('layoutRow', LAYOUT_NAMES, doc.layout, (key) => {
    doc.layout = key;
    buildPanelRows();
    syncPanelForm();
    queuePaint();
    remember();
  });
  buildChips('gradeRow', GRADE_NAMES, doc.grade, (key) => { doc.grade = key; queuePaint(); remember(); });
  buildChips('sizeRow', { '1080x1080': '1080 × 1080', '1080x1350': '1080 × 1350', '1920x1080': '1920 × 1080' }, doc.size, (key) => { doc.size = key; queuePaint(); remember(); });
}

// Rebuilds every control from the document (used after undo/redo/load).
function refreshEditor() {
  refreshChips();
  buildPanelRows();
  syncPanelForm();
  buildThumbRail();
  $('capTitle').value = doc.title;
  $('capScript').value = doc.script;
  $('capTag').value = doc.tagline;
  $('capQuote').value = doc.quote;
  syncHistoryButtons();
}

$('shuffleBtn').addEventListener('click', () => {
  const layouts = Object.keys(LAYOUT_NAMES);
  const grades = Object.keys(GRADE_NAMES);
  doc.layout = layouts[Math.floor(Math.random() * layouts.length)];
  doc.grade = grades[Math.floor(Math.random() * grades.length)];
  refreshChips();
  buildPanelRows();
  syncPanelForm();
  queuePaint();
  remember();
  say(`Shuffled: ${LAYOUT_NAMES[doc.layout]} + ${GRADE_NAMES[doc.grade]}.`);
});

$('undoBtn').addEventListener('click', undo);
$('redoBtn').addEventListener('click', redo);
$('btnSave').addEventListener('click', saveFile);
$('loadInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  const ok = await unpackProject(text);
  if (ok) {
    past.length = 0;
    future.length = 0;
    remember();
    say(`Project "${file.name}" loaded.`);
  } else {
    say('That file is not a VERDE HEAT project — nothing changed.');
  }
  e.target.value = '';
});

// Undo/redo shortcuts (Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y), and Ctrl+S to save.
// Text fields keep their native undo: the shortcuts only fire outside them.
document.addEventListener('keydown', (e) => {
  const tag = (e.target.tagName || '').toLowerCase();
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    saveFile();
    return;
  }
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    undo();
  } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
    e.preventDefault();
    redo();
  }
});

$('capTitle').addEventListener('input', (e) => { doc.title = e.target.value; queuePaint(); rememberSoon(); });
$('capScript').addEventListener('input', (e) => { doc.script = e.target.value; queuePaint(); rememberSoon(); });
$('capTag').addEventListener('input', (e) => { doc.tagline = e.target.value; queuePaint(); rememberSoon(); });
$('capQuote').addEventListener('input', (e) => { doc.quote = e.target.value; queuePaint(); rememberSoon(); });

$('exportBtn').addEventListener('click', () => exportOne(doc.size));
$('exportAllBtn').addEventListener('click', exportAll);

// ---- boot ---------------------------------------------------------------------

async function boot() {
  buildPanelRows();
  syncPanelForm();
  await loadLibrary();
  // An autosaved project from an earlier visit replaces the defaults.
  await restoreAutosave();
  refreshEditor();
  // Wait for the display fonts before the first paint, so the title never
  // falls back to a system font in the preview or a screenshot.
  try {
    await Promise.all([
      document.fonts.load('100px Anton'),
      document.fonts.load('100px "Bebas Neue"'),
      document.fonts.load('40px Pacifico'),
    ]);
  } catch { /* fonts still usable once loaded; render anyway */ }
  renderStage();
  // The starting point of the undo history.
  remember();
  const params = new URLSearchParams(location.search);
  const shot = params.get('shot');
  if (shot) {
    if (shot === 'cover') {
      document.body.classList.add('solo-cover');
      soloCover = true;
      doc.size = params.get('size') || '1920x1080';
      renderStage();
    } else {
      renderStage();
    }
    await document.fonts.ready;
    requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
  }
  say('Ready — pick a photo, drag any panel to reposition it, then export.');
}

window.__studio = { doc, pool, past, future, renderStage, renderPNG, pickPanel, undo, redo, packProject, unpackProject, faceFocus };
boot();
