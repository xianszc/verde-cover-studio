// VERDE HEAT Cover Studio — the editor. Owns state, the preview canvas, uploads,
// per-panel crop and grade controls, layout and grade presets, caption editing and
// PNG export in the three post sizes. Rendering itself lives in cover.js;
// face-aware auto-crop lives in faces.js; screenshot scenes live in shots.js.
import { drawCover, computeLayout, SIZES, LAYOUTS, GRADES } from './cover.js';
import { detectFaceCenter } from './faces.js';
import { runShot } from './shots.js';

const SAMPLES = [
  { file: 'samples/hero-woman.jpg', name: 'Hero — Woman' },
  { file: 'samples/man-rooftop.jpg', name: 'Man — Rooftop' },
  { file: 'samples/friends-neon.jpg', name: 'Friends — Neon' },
  { file: 'samples/man-pier.jpg', name: 'Man — Pier' },
  { file: 'samples/boulevard.jpg', name: 'Woman — Boulevard' },
  { file: 'samples/pier.jpg', name: 'Man — Fishing' },
];

const DEFAULT_PANELS = [
  { photoIdx: 0, zoom: 1, ox: 0, oy: 0, role: 'THE QUEEN', place: 'VERDE BAY', time: 'GOLDEN HOUR', micro: 'She came back for one last summer.', warmth: 0, focus: null },
  { photoIdx: 1, zoom: 1, ox: 0, oy: 0, role: 'THE FIXER', place: 'ROOFTOP 9', time: 'DUSK', micro: 'Every deal has a sunset clause.', warmth: 0, focus: null },
  { photoIdx: 2, zoom: 1, ox: 0, oy: 0, role: 'THE WILDCARDS', place: 'NEON ROW', time: 'MIDNIGHT', micro: 'Two laughs, zero plans.', warmth: 0, focus: null },
  { photoIdx: 3, zoom: 1, ox: 0, oy: 0, role: 'THE OLD SALT', place: 'THE PIER', time: 'DAWN', micro: 'He knows where the fish hide.', warmth: 0, focus: null },
  { photoIdx: 4, zoom: 1, ox: 0, oy: 0, role: 'THE DRIVER', place: 'PALM BLVD', time: 'SUNSET', micro: 'Red car. No brakes. No regrets.', warmth: 0, focus: null },
  { photoIdx: 5, zoom: 1, ox: 0, oy: 0, role: 'THE CAPTAIN', place: 'TURQUOISE BAY', time: 'MORNING', micro: 'The tide brings everyone back.', warmth: 0, focus: null },
];

const state = {
  layout: 'hero-six',
  grade: 'sunset',
  title: 'VERDE HEAT',
  subtitle: 'salt air & fast hearts',
  tagline: 'SIX SOULS · ONE COAST · GOLDEN HOUR',
  quote: '"A sun-soaked blast."',
  quoteSource: 'VERDE GAZETTE',
  vol: 'VOL. 01',
  size: '1080x1350',
  panels: DEFAULT_PANELS.map((p) => ({ ...p })),
  photos: [],
  selected: 0,
  activePhoto: 0,
};

const $ = (id) => document.getElementById(id);
const canvas = $('cover');
const status = $('status');
let renderQueued = false;

function setStatus(text) { status.textContent = text; }

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function photosAsImages() { return state.photos.map((p) => p.img); }

function renderPreview() {
  const [W, H] = SIZES[state.size];
  if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
  const ctx = canvas.getContext('2d');
  const geo = drawCover(ctx, W, H, state, photosAsImages());
  drawSelection(ctx, geo);
}

function drawSelection(ctx, geo) {
  const rect = geo.panels[state.selected];
  if (!rect) return;
  ctx.save();
  if (rect.angle) {
    ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
    ctx.rotate((rect.angle * Math.PI) / 180);
    ctx.translate(-rect.w / 2, -rect.h / 2);
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = Math.max(3, rect.w * 0.008);
    ctx.setLineDash([14, 10]);
    ctx.strokeRect(0, 0, rect.w, rect.h);
  } else {
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = Math.max(3, rect.w * 0.008);
    ctx.setLineDash([14, 10]);
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  }
  ctx.restore();
}

function queueRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => { renderQueued = false; renderPreview(); });
}

// ---- history: undo / redo -----------------------------------------------
// Post-state stacks: each entry is a full snapshot of the editable state
// (layout, grade, captions, panels). commitHistory() records the state after
// a change; undo steps back to the previous snapshot, redo steps forward.
const history = { undo: [], redo: [] };
let commitTimer = null;

function snapshotState() {
  return JSON.stringify({
    layout: state.layout,
    grade: state.grade,
    title: state.title,
    subtitle: state.subtitle,
    tagline: state.tagline,
    quote: state.quote,
    quoteSource: state.quoteSource,
    vol: state.vol,
    size: state.size,
    selected: state.selected,
    panels: state.panels,
  });
}

function applySnapshot(json) {
  const s = JSON.parse(json);
  state.layout = s.layout;
  state.grade = s.grade;
  state.title = s.title;
  state.subtitle = s.subtitle;
  state.tagline = s.tagline;
  state.quote = s.quote;
  state.quoteSource = s.quoteSource;
  state.vol = s.vol;
  state.size = s.size;
  state.selected = s.selected;
  state.panels = s.panels.map((p) => ({ ...p }));
  state.panels.forEach((p) => { if (p.photoIdx == null || !state.photos[p.photoIdx]) p.photoIdx = 0; });
  refreshAllUI();
  queueRender();
  scheduleAutosave();
}

function commitHistory() {
  const snap = snapshotState();
  if (history.undo[history.undo.length - 1] === snap) return;
  history.undo.push(snap);
  if (history.undo.length > 60) history.undo.shift();
  history.redo.length = 0;
  updateHistoryButtons();
  scheduleAutosave();
}

/** Debounced commit for continuous input (typing, sliders, drag, wheel). */
function commitSoon() {
  clearTimeout(commitTimer);
  commitTimer = setTimeout(commitHistory, 400);
}

function updateHistoryButtons() {
  $('undo').disabled = history.undo.length < 2;
  $('redo').disabled = history.redo.length === 0;
}

function undo() {
  if (history.undo.length < 2) return;
  history.redo.push(history.undo.pop());
  applySnapshot(history.undo[history.undo.length - 1]);
  updateHistoryButtons();
  setStatus('Undone.');
}

function redo() {
  if (!history.redo.length) return;
  const snap = history.redo.pop();
  history.undo.push(snap);
  applySnapshot(snap);
  updateHistoryButtons();
  setStatus('Redone.');
}

// ---- project: autosave, save / load as JSON -------------------------------

const AUTOSAVE_KEY = 'verde-heat-project-v1';
let autosaveTimer = null;

/** Downscales an image to a JPEG data URL so an uploaded photo can be stored. */
function downscaleDataUrl(img) {
  const max = 900;
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.naturalWidth * scale));
  c.height = Math.max(1, Math.round(img.naturalHeight * scale));
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.75);
}

/** The whole project as JSON: captions, layout, grade, panels and photos. */
function serializeProject() {
  return JSON.stringify({
    app: 'verde-heat-cover-studio',
    version: 1,
    savedAt: new Date().toISOString(),
    layout: state.layout,
    grade: state.grade,
    title: state.title,
    subtitle: state.subtitle,
    tagline: state.tagline,
    quote: state.quote,
    quoteSource: state.quoteSource,
    vol: state.vol,
    size: state.size,
    selected: state.selected,
    panels: state.panels,
    photos: state.photos.map((p) => {
      if (p.file && p.file.startsWith('samples/')) return { name: p.name, file: p.file };
      if (p.dataUrl) return { name: p.name, dataUrl: p.dataUrl };
      return { name: p.name, dataUrl: downscaleDataUrl(p.img) };
    }),
  });
}

function scheduleAutosave() {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    try {
      localStorage.setItem(AUTOSAVE_KEY, serializeProject());
      const note = $('autosave-note');
      if (note) note.textContent = `Autosaved ${new Date().toLocaleTimeString()} — restores when you reopen this page.`;
    } catch { /* private mode or quota: autosave is silently off */ }
  }, 800);
}

async function restoreAutosave() {
  let raw = null;
  try { raw = localStorage.getItem(AUTOSAVE_KEY); } catch { /* no storage */ }
  if (!raw) return false;
  const ok = await loadProjectData(raw);
  if (ok) setStatus('Restored your autosaved project.');
  return ok;
}

/** Rebuilds the editor from a project JSON string. Returns false when invalid. */
async function loadProjectData(json) {
  let data;
  try { data = JSON.parse(json); } catch { return false; }
  if (!data || data.app !== 'verde-heat-cover-studio' || !Array.isArray(data.photos) || !Array.isArray(data.panels)) return false;
  const photos = [];
  for (const entry of data.photos) {
    try {
      const src = entry.file || entry.dataUrl;
      if (!src) continue;
      const img = await loadImage(src);
      photos.push({ img, name: entry.name || 'Photo', file: src, dataUrl: entry.dataUrl || null });
    } catch { /* skip unreadable photos */ }
  }
  if (!photos.length) return false;
  state.photos = photos;
  state.layout = LAYOUTS[data.layout] ? data.layout : 'hero-six';
  state.grade = GRADES[data.grade] ? data.grade : 'sunset';
  state.title = String(data.title ?? 'VERDE HEAT');
  state.subtitle = String(data.subtitle ?? '');
  state.tagline = String(data.tagline ?? '');
  state.quote = String(data.quote ?? '');
  state.quoteSource = String(data.quoteSource ?? 'VERDE GAZETTE');
  state.vol = String(data.vol ?? 'VOL. 01');
  state.size = SIZES[data.size] ? data.size : '1080x1350';
  state.selected = Math.min(Math.max(0, data.selected | 0), DEFAULT_PANELS.length - 1);
  state.panels = DEFAULT_PANELS.map((d, i) => ({ ...d, ...(data.panels[i] || {}) }));
  state.panels.forEach((p) => { if (p.photoIdx == null || !state.photos[p.photoIdx]) p.photoIdx = 0; });
  state.activePhoto = state.panels[state.selected]?.photoIdx ?? 0;
  refreshAllUI();
  queueRender();
  return true;
}

function saveProject() {
  try {
    downloadBlob(new Blob([serializeProject()], { type: 'application/json' }), 'verde-heat-project.json');
    setStatus('Project saved as verde-heat-project.json — load it back any time.');
  } catch {
    setStatus('Could not save the project in this browser.');
  }
}

function refreshOptionButtons() {
  buildOptionButtons('layout-options', LAYOUTS, state.layout, (key) => { state.layout = key; buildPanelList(); syncPanelEditor(); queueRender(); commitHistory(); });
  buildOptionButtons('grade-options', GRADES, state.grade, (key) => { state.grade = key; queueRender(); commitHistory(); });
  buildOptionButtons('size-options', { '1080x1080': '1080 × 1080', '1080x1350': '1080 × 1350', '1920x1080': '1920 × 1080' }, state.size, (key) => { state.size = key; queueRender(); commitHistory(); });
}

/** Rebuilds every control from the state (used after undo/redo/project load). */
function refreshAllUI() {
  refreshOptionButtons();
  buildPanelList();
  syncPanelEditor();
  refreshPhotoStrip();
  $('caption-title').value = state.title;
  $('caption-subtitle').value = state.subtitle;
  $('caption-tagline').value = state.tagline;
  $('caption-quote').value = state.quote;
  updateHistoryButtons();
}

/** Renders the cover at an exact post size and returns the PNG blob. */
export async function exportCoverPNG(sizeKey) {
  const [W, H] = SIZES[sizeKey];
  const off = document.createElement('canvas');
  off.width = W;
  off.height = H;
  drawCover(off.getContext('2d'), W, H, state, photosAsImages());
  return new Promise((resolve) => off.toBlob((b) => resolve(b), 'image/png'));
}

function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

async function exportOne(sizeKey) {
  const blob = await exportCoverPNG(sizeKey);
  downloadBlob(blob, `verde-heat-${sizeKey}.png`);
  setStatus(`Saved verde-heat-${sizeKey}.png`);
}

async function exportAll() {
  for (const key of Object.keys(SIZES)) {
    const blob = await exportCoverPNG(key);
    downloadBlob(blob, `verde-heat-${key}.png`);
    await new Promise((r) => setTimeout(r, 250));
  }
  setStatus('Saved all three sizes: 1080x1080, 1080x1350, 1920x1080.');
}

// ---- photo pool -------------------------------------------------------------

function refreshPhotoStrip() {
  const strip = $('photo-strip');
  strip.innerHTML = '';
  state.photos.forEach((photo, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `thumb${i === state.activePhoto ? ' active' : ''}`;
    btn.title = photo.name;
    const img = document.createElement('img');
    img.src = photo.thumb || photo.file;
    img.alt = photo.name;
    btn.appendChild(img);
    btn.addEventListener('click', () => {
      state.activePhoto = i;
      state.panels[state.selected].photoIdx = i;
      syncPanelEditor();
      refreshPhotoStrip();
      queueRender();
      commitHistory();
    });
    strip.appendChild(btn);
  });
  const select = $('panel-photo');
  select.innerHTML = '';
  state.photos.forEach((photo, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = photo.name;
    select.appendChild(opt);
  });
  select.value = String(state.panels[state.selected].photoIdx ?? 0);
}

async function loadSamples() {
  for (const s of SAMPLES) {
    try {
      const img = await loadImage(s.file);
      state.photos.push({ img, name: s.name, file: s.file });
    } catch { /* a missing sample never blocks the editor */ }
  }
  // Face-aware default crops: centre each panel on its subject's face.
  state.panels.forEach((panel) => {
    const photo = state.photos[panel.photoIdx];
    if (photo) panel.focus = detectFaceCenter(photo.img);
  });
  refreshPhotoStrip();
}

$('upload').addEventListener('change', async (e) => {
  const files = [...e.target.files].filter((f) => f.type.startsWith('image/'));
  for (const file of files) {
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      state.photos.push({ img, name: file.name, file: url });
    } catch { /* skip unreadable files */ }
  }
  if (files.length) {
    state.activePhoto = state.photos.length - 1;
    refreshPhotoStrip();
    queueRender();
    commitHistory();
    setStatus(`${files.length} photo${files.length > 1 ? 's' : ''} added. Click a thumbnail to put it in the selected panel.`);
  }
  e.target.value = '';
});

// ---- panel selection and editing --------------------------------------------

function syncPanelEditor() {
  const panel = state.panels[state.selected];
  $('panel-photo').value = String(panel.photoIdx ?? 0);
  $('panel-zoom').value = String(panel.zoom);
  $('panel-zoom-val').textContent = `${panel.zoom.toFixed(2)}×`;
  $('panel-ox').value = String(panel.ox);
  $('panel-oy').value = String(panel.oy);
  $('panel-role').value = panel.role;
  $('panel-place').value = panel.place;
  $('panel-time').value = panel.time;
  $('panel-micro').value = panel.micro;
  $('panel-warmth').value = String(panel.warmth);
  $('panel-warmth-val').textContent = panel.warmth > 0 ? `+${panel.warmth.toFixed(1)}` : panel.warmth.toFixed(1);
  $('panel-title').textContent = `Panel ${state.selected + 1} — ${panel.role}`;
  document.querySelectorAll('#panel-list .panel-row').forEach((row, i) => {
    row.classList.toggle('selected', i === state.selected);
  });
}

function selectPanel(i) {
  if (!state.panels[i]) return;
  state.selected = i;
  syncPanelEditor();
  queueRender();
}

function buildPanelList() {
  const list = $('panel-list');
  list.innerHTML = '';
  state.panels.forEach((panel, i) => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'panel-row';
    row.innerHTML = `<span class="panel-num">${i + 1}</span><span class="panel-role">${panel.role}</span><span class="panel-place">${panel.place}</span>`;
    row.addEventListener('click', () => selectPanel(i));
    list.appendChild(row);
  });
}

$('panel-photo').addEventListener('change', (e) => {
  state.panels[state.selected].photoIdx = Number(e.target.value);
  state.activePhoto = Number(e.target.value);
  refreshPhotoStrip();
  queueRender();
  commitHistory();
});
$('panel-zoom').addEventListener('input', (e) => {
  state.panels[state.selected].zoom = Number(e.target.value);
  $('panel-zoom-val').textContent = `${Number(e.target.value).toFixed(2)}×`;
  queueRender();
  commitSoon();
});
$('panel-ox').addEventListener('input', (e) => { state.panels[state.selected].ox = Number(e.target.value); queueRender(); commitSoon(); });
$('panel-oy').addEventListener('input', (e) => { state.panels[state.selected].oy = Number(e.target.value); queueRender(); commitSoon(); });
$('panel-role').addEventListener('input', (e) => { state.panels[state.selected].role = e.target.value.toUpperCase(); buildPanelList(); syncPanelEditor(); queueRender(); commitSoon(); });
$('panel-place').addEventListener('input', (e) => { state.panels[state.selected].place = e.target.value.toUpperCase(); queueRender(); commitSoon(); });
$('panel-time').addEventListener('input', (e) => { state.panels[state.selected].time = e.target.value.toUpperCase(); queueRender(); commitSoon(); });
$('panel-micro').addEventListener('input', (e) => { state.panels[state.selected].micro = e.target.value; queueRender(); commitSoon(); });
$('panel-warmth').addEventListener('input', (e) => {
  state.panels[state.selected].warmth = Number(e.target.value);
  $('panel-warmth-val').textContent = Number(e.target.value) > 0 ? `+${Number(e.target.value).toFixed(1)}` : Number(e.target.value).toFixed(1);
  queueRender();
  commitSoon();
});

$('autocrop').addEventListener('click', () => {
  const panel = state.panels[state.selected];
  const photo = state.photos[panel.photoIdx];
  if (!photo) return;
  const focus = detectFaceCenter(photo.img);
  if (focus) {
    panel.focus = focus;
    panel.ox = 0;
    panel.oy = 0;
    setStatus('Auto-crop: face centred in this panel.');
  } else {
    panel.focus = null;
    setStatus('No face found in this photo — centred on the photo instead.');
  }
  syncPanelEditor();
  queueRender();
  commitHistory();
});

$('fill-all').addEventListener('click', () => {
  const idx = state.panels[state.selected].photoIdx;
  state.panels.forEach((p) => { p.photoIdx = idx; });
  setStatus('One photo now fills every panel.');
  queueRender();
  commitHistory();
});

// ---- drag to position, wheel to zoom ----------------------------------------

function canvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * canvas.width,
    y: ((e.clientY - rect.top) / rect.height) * canvas.height,
  };
}

function panelAt(x, y) {
  const [W, H] = SIZES[state.size];
  const geo = computeLayout(W, H, state.layout);
  for (let i = geo.panels.length - 1; i >= 0; i--) {
    const r = geo.panels[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
  }
  return -1;
}

let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  const p = canvasPoint(e);
  const hit = panelAt(p.x, p.y);
  if (hit < 0) return;
  selectPanel(hit);
  const panel = state.panels[hit];
  drag = { x: p.x, y: p.y, ox: panel.ox, oy: panel.oy, rect: computeLayout(...SIZES[state.size], state.layout).panels[hit] };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const p = canvasPoint(e);
  const panel = state.panels[state.selected];
  panel.ox = Math.max(-1, Math.min(1, drag.ox + ((p.x - drag.x) / drag.rect.w) * 2.2));
  panel.oy = Math.max(-1, Math.min(1, drag.oy + ((p.y - drag.y) / drag.rect.h) * 2.2));
  $('panel-ox').value = String(panel.ox);
  $('panel-oy').value = String(panel.oy);
  queueRender();
});
canvas.addEventListener('pointerup', () => {
  if (drag) {
    // A click that only selects a panel is not an edit: committing it would
    // wipe the redo stack for nothing. Only a real move counts as a change.
    const panel = state.panels[state.selected];
    if (Math.abs(panel.ox - drag.ox) > 0.005 || Math.abs(panel.oy - drag.oy) > 0.005) commitHistory();
  }
  drag = null;
});
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const panel = state.panels[state.selected];
  panel.zoom = Math.max(1, Math.min(3, panel.zoom * Math.exp(-e.deltaY * 0.0012)));
  $('panel-zoom').value = String(panel.zoom);
  $('panel-zoom-val').textContent = `${panel.zoom.toFixed(2)}×`;
  queueRender();
  commitSoon();
}, { passive: false });

// ---- layout, grade, caption, size -------------------------------------------

function buildOptionButtons(containerId, items, current, onPick) {
  const box = $(containerId);
  box.innerHTML = '';
  for (const [key, label] of Object.entries(items)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `opt${key === current ? ' active' : ''}`;
    btn.textContent = label;
    btn.addEventListener('click', () => {
      onPick(key);
      box.querySelectorAll('.opt').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
    box.appendChild(btn);
  }
}

refreshOptionButtons();

$('shuffle').addEventListener('click', () => {
  const layouts = Object.keys(LAYOUTS);
  const grades = Object.keys(GRADES);
  state.layout = layouts[Math.floor(Math.random() * layouts.length)];
  state.grade = grades[Math.floor(Math.random() * grades.length)];
  refreshOptionButtons();
  queueRender();
  commitHistory();
  setStatus(`Shuffled: ${LAYOUTS[state.layout]} + ${GRADES[state.grade]}.`);
});

$('undo').addEventListener('click', undo);
$('redo').addEventListener('click', redo);
$('save-project').addEventListener('click', saveProject);
$('load-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  const ok = await loadProjectData(text);
  if (ok) {
    history.undo.length = 0;
    history.redo.length = 0;
    commitHistory();
    setStatus(`Project "${file.name}" loaded.`);
  } else {
    setStatus('That file is not a VERDE HEAT project — nothing changed.');
  }
  e.target.value = '';
});

// Undo/redo shortcuts (Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y), and Ctrl+S to save.
// Text fields keep their native undo: the shortcuts only fire outside them.
document.addEventListener('keydown', (e) => {
  const tag = (e.target.tagName || '').toLowerCase();
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    saveProject();
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

$('caption-title').addEventListener('input', (e) => { state.title = e.target.value; queueRender(); commitSoon(); });
$('caption-subtitle').addEventListener('input', (e) => { state.subtitle = e.target.value; queueRender(); commitSoon(); });
$('caption-tagline').addEventListener('input', (e) => { state.tagline = e.target.value; queueRender(); commitSoon(); });
$('caption-quote').addEventListener('input', (e) => { state.quote = e.target.value; queueRender(); commitSoon(); });

$('export-one').addEventListener('click', () => exportOne(state.size));
$('export-all').addEventListener('click', exportAll);

// ---- boot ---------------------------------------------------------------------

async function boot() {
  buildPanelList();
  syncPanelEditor();
  await loadSamples();
  // An autosaved project from an earlier visit replaces the defaults.
  await restoreAutosave();
  refreshAllUI();
  // Wait for the display fonts before the first paint, so the title never falls
  // back to a system font in the preview or a screenshot.
  try {
    await Promise.all([
      document.fonts.load('100px Anton'),
      document.fonts.load('100px "Bebas Neue"'),
      document.fonts.load('40px Pacifico'),
    ]);
  } catch { /* fonts still usable once loaded; render anyway */ }
  renderPreview();
  // The starting point of the undo history.
  commitHistory();
  const shot = new URLSearchParams(location.search).get('shot');
  if (shot) {
    await runShot(shot, new URLSearchParams(location.search), {
      async showCoverAlone(sizeKey) {
        document.body.classList.add('shot-cover');
        state.size = sizeKey;
        renderPreview();
      },
      async showEditor() { renderPreview(); },
    });
  }
  setStatus('Ready — pick a photo, drag any panel to reposition it, then export.');
}

window.__verde = { state, history, renderPreview, exportCoverPNG, selectPanel, undo, redo, serializeProject, loadProjectData };
boot();
