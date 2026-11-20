// Face-aware crop helper: finds the face-sized skin clusters in a photo, so a
// panel can crop around the person's face instead of the dead centre.
// Pure canvas math, no network, no model: skin pixels are scored in YCbCr space
// and grouped into connected components. A sunset sky, a sunlit sea or a red
// car can pass the skin test, so a component is never trusted on its colour
// alone: it is scored on its UPPER SLICE (the top half of its bounding box —
// for a face-plus-chest blob that slice is the face end, not the chest), on
// size (a face is a moderate blob: specks and whole-frame washes both lose),
// on compactness and on position (faces sit high in the frame and near its
// centre, not at a corner). When two face-sized clusters are found, both are
// returned so a two-person panel can sit between them.
// All coordinates are 0..1 photo coordinates.

const SKIN_MIN_PIXELS = 0.0015; // of the downscaled frame: ignore specks
const MIN_SCORE = 0.18;

function skinMask(img) {
  const w = 96;
  const h = Math.max(24, Math.round((96 * img.naturalHeight) / img.naturalWidth));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // Classic YCbCr skin range, plus a daylight sanity check.
      const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
      const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
      if (
        r > 95 && g > 40 && b > 20 && r > g && r > b && r - g > 12 &&
        cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173
      ) mask[y * w + x] = 1;
    }
  }
  return { mask, w, h };
}

/**
 * Connected components of the skin mask (4-connectivity, iterative flood
 * fill). Returns the components plus a label per pixel (0 = not skin).
 */
function componentsOf(mask, w, h) {
  const labels = new Uint16Array(w * h);
  const comps = [];
  const stack = [];
  for (let s = 0; s < w * h; s++) {
    if (!mask[s] || labels[s]) continue;
    const id = comps.length + 1;
    let n = 0;
    let sx = 0;
    let sy = 0;
    let minX = w;
    let maxX = -1;
    let minY = h;
    let maxY = -1;
    stack.length = 0;
    stack.push(s);
    labels[s] = id;
    while (stack.length) {
      const p = stack.pop();
      const x = p % w;
      const y = (p / w) | 0;
      n++;
      sx += x;
      sy += y;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (x > 0 && mask[p - 1] && !labels[p - 1]) { labels[p - 1] = id; stack.push(p - 1); }
      if (x < w - 1 && mask[p + 1] && !labels[p + 1]) { labels[p + 1] = id; stack.push(p + 1); }
      if (y > 0 && mask[p - w] && !labels[p - w]) { labels[p - w] = id; stack.push(p - w); }
      if (y < h - 1 && mask[p + w] && !labels[p + w]) { labels[p + w] = id; stack.push(p + w); }
    }
    comps.push({ id, n, sx, sy, minX, maxX, minY, maxY });
  }
  return { comps, labels };
}

/**
 * Stats of the top half of a component's bounding box: its centroid, pixel
 * count and compactness. For a face this is the forehead-and-eyes end; for a
 * face-plus-chest blob it is the face end; for a sky wash it is still sky,
 * which the size and position scores then reject.
 */
function upperSlice(mask, labels, w, h, c, frac = 0.5) {
  const yMax = Math.min(h - 1, c.minY + Math.round((c.maxY - c.minY + 1) * frac));
  let n = 0;
  let sx = 0;
  let sy = 0;
  for (let y = c.minY; y <= yMax; y++) {
    for (let x = c.minX; x <= c.maxX; x++) {
      if (labels[y * w + x] !== c.id) continue;
      n++;
      sx += x;
      sy += y;
    }
  }
  if (!n) return null;
  const area = (c.maxX - c.minX + 1) * (yMax - c.minY + 1);
  return { x: sx / n / w, y: sy / n / h, n, compact: n / area };
}

function scoreUpper(u, total, minYFrac) {
  const unFrac = u.n / total;
  // Position: a face's upper slice sits in the upper half. Below y 0.42 the
  // score falls steeply — an arm or a chest down the frame must not outvote
  // the face above it.
  const pos = u.y < 0.08 ? 0.5 : u.y <= 0.42 ? 1 : Math.max(0.15, 1 - (u.y - 0.42) * 4);
  const d = Math.abs(u.x - 0.5);
  const edge = d <= 0.35 ? 1 : Math.max(0.2, 1 - (d - 0.35) * 3.5);
  // A component that starts at the very top edge or low down the frame is
  // sky, water or a limb, not a face.
  const top = minYFrac < 0.05 ? 0.7 : minYFrac <= 0.3 ? 1 : Math.max(0.3, 1 - (minYFrac - 0.3) * 2);
  // Size: a face's upper slice is a moderate blob. Specks score little;
  // a whole-frame wash (sunset sky, sunlit sea) is penalised back down.
  const size = unFrac < 0.02
    ? Math.max(0.15, unFrac / 0.02)
    : unFrac <= 0.06 ? 1 : Math.max(0.5, 1 - (unFrac - 0.06) * 6);
  const compact = Math.sqrt(Math.max(0.05, u.compact));
  return pos * edge * top * size * compact;
}

/**
 * Every face-sized skin cluster in the photo, best first.
 * Each entry: { x, y, score, compact, n } with x/y the centroid of the
 * cluster's upper slice.
 */
export function detectFaceClusters(img) {
  const { mask, w, h } = skinMask(img);
  const total = w * h;
  const minSize = Math.max(6, Math.round(total * SKIN_MIN_PIXELS));
  const { comps, labels } = componentsOf(mask, w, h);
  const scored = [];
  for (const c of comps) {
    if (c.n < minSize) continue;
    const u = upperSlice(mask, labels, w, h, c);
    if (!u) continue;
    scored.push({ x: u.x, y: u.y, n: c.n, compact: u.compact, score: scoreUpper(u, total, c.minY / h) });
  }
  scored.sort((a, b) => b.score - a.score);
  const faces = scored.filter((c) => c.score > MIN_SCORE && c.compact >= 0.18);
  // Nothing passed the bar: fall back to the best cluster of any shape
  // rather than giving up on a portrait.
  if (!faces.length && scored.length) return [scored[0]];
  return faces;
}

/** Detects the face centre of `img`, or null when no skin region is found. */
export function detectFaceCenter(img) {
  const faces = detectFaceClusters(img);
  if (!faces.length) return null;
  const best = faces[0];
  const second = faces[1];
  // Two faces of similar strength, both in the face band, both near the
  // centre of the frame and a plausible distance apart: sit between them,
  // so a two-person panel keeps both in frame instead of centring on one
  // and cutting the other. A cluster at the frame's edge is sky or a wall,
  // never a second face, however it scores.
  if (
    second && second.score >= best.score * 0.5 &&
    best.y >= 0.1 && best.y <= 0.5 && second.y >= 0.1 && second.y <= 0.5 &&
    Math.abs(best.x - 0.5) <= 0.4 && Math.abs(second.x - 0.5) <= 0.4 &&
    Math.abs(best.x - second.x) >= 0.12 && Math.abs(best.x - second.x) <= 0.65
  ) {
    return {
      x: Math.min(0.92, Math.max(0.08, (best.x + second.x) / 2)),
      y: Math.min(0.9, Math.max(0.1, (best.y + second.y) / 2)),
    };
  }
  return {
    x: Math.min(0.92, Math.max(0.08, best.x)),
    y: Math.min(0.9, Math.max(0.1, best.y)),
  };
}

/**
 * Debug view of the raw skin components (used by the test harness to tune the
 * scoring): every cluster with its pixel count, bounding box, compactness,
 * centroid and the centroid of its upper slice.
 */
export function analyzePhoto(img) {
  const { mask, w, h } = skinMask(img);
  const total = w * h;
  const { comps, labels } = componentsOf(mask, w, h);
  return comps
    .filter((c) => c.n >= Math.max(6, Math.round(total * SKIN_MIN_PIXELS)))
    .map((c) => {
      const bw = c.maxX - c.minX + 1;
      const bh = c.maxY - c.minY + 1;
      const u = upperSlice(mask, labels, w, h, c);
      return {
        n: c.n,
        nFrac: +(c.n / total).toFixed(3),
        x: +(c.sx / c.n / w).toFixed(2),
        y: +(c.sy / c.n / h).toFixed(2),
        box: { x: +(c.minX / w).toFixed(2), y: +(c.minY / h).toFixed(2), w: +(bw / w).toFixed(2), h: +(bh / h).toFixed(2) },
        compact: +((c.n / (bw * bh)).toFixed(2)),
        upper: u ? { x: +u.x.toFixed(2), y: +u.y.toFixed(2), n: u.n, compact: +u.compact.toFixed(2), score: +scoreUpper(u, total, c.minY / h).toFixed(2) } : null,
      };
    })
    .sort((a, b) => b.n - a.n);
}
