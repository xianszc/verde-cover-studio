// Face-aware crop helper: finds the face-sized skin clusters in a photo, so a
// panel can crop around the person's face instead of the dead centre.
// Pure canvas math, no network, no model: skin pixels are scored in YCbCr space,
// grouped into connected components, and each component is scored by size,
// compactness and height in the frame. A face is a compact blob high in the
// frame; a bare chest or an arm is a sprawling smear lower down, so it loses
// even when it holds more skin pixels. When two face-sized clusters are found,
// both are returned so a two-person panel can sit between them.
// All coordinates are 0..1 photo coordinates.

const SKIN_MIN_PIXELS = 0.0015; // of the downscaled frame: ignore specks
const MIN_COMPACTNESS = 0.22; // skin pixels / bounding-box area of the cluster

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

/** Connected components of the skin mask (4-connectivity, iterative flood fill). */
function componentsOf(mask, w, h) {
  const seen = new Uint8Array(w * h);
  const comps = [];
  const stack = [];
  for (let s = 0; s < w * h; s++) {
    if (!mask[s] || seen[s]) continue;
    let n = 0;
    let sx = 0;
    let sy = 0;
    let minX = w;
    let maxX = -1;
    let minY = h;
    let maxY = -1;
    stack.length = 0;
    stack.push(s);
    seen[s] = 1;
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
      if (x > 0 && mask[p - 1] && !seen[p - 1]) { seen[p - 1] = 1; stack.push(p - 1); }
      if (x < w - 1 && mask[p + 1] && !seen[p + 1]) { seen[p + 1] = 1; stack.push(p + 1); }
      if (y > 0 && mask[p - w] && !seen[p - w]) { seen[p - w] = 1; stack.push(p - w); }
      if (y < h - 1 && mask[p + w] && !seen[p + w]) { seen[p + w] = 1; stack.push(p + w); }
    }
    comps.push({ n, sx, sy, minX, maxX, minY, maxY });
  }
  return comps;
}

/**
 * Every face-sized skin cluster in the photo, best first.
 * Each entry: { x, y, score, compact } with x/y the cluster centroid.
 */
export function detectFaceClusters(img) {
  const { mask, w, h } = skinMask(img);
  const total = w * h;
  const minSize = Math.max(6, Math.round(total * SKIN_MIN_PIXELS));
  const scored = [];
  for (const c of componentsOf(mask, w, h)) {
    if (c.n < minSize) continue;
    const bw = c.maxX - c.minX + 1;
    const bh = c.maxY - c.minY + 1;
    const compact = c.n / (bw * bh);
    const cx = c.sx / c.n / w;
    const cy = c.sy / c.n / h;
    // Faces sit high in the frame: weight the upper part more, so a chest or
    // arm below the face cannot outvote it however much skin it holds.
    const upper = cy < 0.4 ? 1.6 : cy < 0.62 ? 1.15 : 0.7;
    // Size matters up to a point: a face-sized cluster scores full marks, a
    // speck scores little, a huge smear scores no more than a face.
    const sizeScore = Math.min(1, c.n / (total * 0.02));
    const score = sizeScore * Math.sqrt(Math.max(0.05, compact)) * upper;
    scored.push({ x: cx, y: cy, n: c.n, compact, score });
  }
  scored.sort((a, b) => b.score - a.score);
  const faces = scored.filter((c) => c.compact >= MIN_COMPACTNESS && c.score > 0.22);
  // Nothing passed the strict bar (stylised light, heavy grade): fall back to
  // the best cluster of any shape rather than giving up on a portrait.
  if (!faces.length && scored.length) return [scored[0]];
  return faces;
}

/** Detects the face centre of `img`, or null when no skin region is found. */
export function detectFaceCenter(img) {
  const faces = detectFaceClusters(img);
  if (!faces.length) return null;
  const best = faces[0];
  const second = faces[1];
  if (second && second.score >= best.score * 0.45) {
    // Two faces of similar strength: sit between them, so a two-person panel
    // keeps both in frame instead of centring on one and cutting the other.
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
