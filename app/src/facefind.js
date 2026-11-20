// Face finding for VERDE HEAT: locates the face-sized skin regions in a photo
// so a panel can crop around the subject instead of the dead centre.
// Pure canvas arithmetic — no network, no model. Skin pixels are picked out in
// YCbCr space and grouped into blobs; a blob is only trusted as a face after
// its TOP HALF is scored (for a face-plus-chest blob the top half is the face
// end; for a sunset sky it is still sky, which the size and height scores then
// throw out). All coordinates are 0..1 photo coordinates.

const FLOOR = 0.16; // lowest score a blob needs to count as a face
const MIN_FRAC = 0.0012; // of the small frame: anything tinier is a speck

// Downscale the photo and mark every skin pixel. Returns the mask and size.
function skinGrid(photo) {
  const w = 100;
  const h = Math.max(24, Math.round((100 * photo.naturalHeight) / photo.naturalWidth));
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  const g = off.getContext('2d', { willReadFrequently: true });
  g.drawImage(photo, 0, 0, w, h);
  const px = g.getImageData(0, 0, w, h).data;
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = px[i];
      const gr = px[i + 1];
      const b = px[i + 2];
      // Classic YCbCr skin window, with a daylight sanity check.
      const cb = 128 - 0.168736 * r - 0.331264 * gr + 0.5 * b;
      const cr = 128 + 0.5 * r - 0.418688 * gr - 0.081312 * b;
      if (r > 95 && gr > 40 && b > 20 && r > gr && r > b && r - gr > 12 && cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173) {
        mask[y * w + x] = 1;
      }
    }
  }
  return { mask, w, h };
}

// Flood-fill the mask into blobs (4-neighbour). Each blob keeps its pixel
// count, bounding box and centroid sums, plus a label map for later passes.
function collectBlobs(mask, w, h) {
  const tags = new Uint16Array(w * h);
  const blobs = [];
  const pile = [];
  for (let start = 0; start < w * h; start++) {
    if (!mask[start] || tags[start]) continue;
    const id = blobs.length + 1;
    const blob = { id, n: 0, sx: 0, sy: 0, x0: w, x1: -1, y0: h, y1: -1 };
    pile.length = 0;
    pile.push(start);
    tags[start] = id;
    while (pile.length) {
      const p = pile.pop();
      const x = p % w;
      const y = (p / w) | 0;
      blob.n++;
      blob.sx += x;
      blob.sy += y;
      if (x < blob.x0) blob.x0 = x;
      if (x > blob.x1) blob.x1 = x;
      if (y < blob.y0) blob.y0 = y;
      if (y > blob.y1) blob.y1 = y;
      if (x > 0 && mask[p - 1] && !tags[p - 1]) { tags[p - 1] = id; pile.push(p - 1); }
      if (x < w - 1 && mask[p + 1] && !tags[p + 1]) { tags[p + 1] = id; pile.push(p + 1); }
      if (y > 0 && mask[p - w] && !tags[p - w]) { tags[p - w] = id; pile.push(p - w); }
      if (y < h - 1 && mask[p + w] && !tags[p + w]) { tags[p + w] = id; pile.push(p + w); }
    }
    blobs.push(blob);
  }
  return { blobs, tags };
}

// Centroid and compactness of the top half of a blob's box. For a face this
// is forehead-and-eyes; for a face-plus-chest blob it is the face end.
function topHalf(blob, tags, w, h) {
  const yEnd = Math.min(h - 1, blob.y0 + Math.round((blob.y1 - blob.y0 + 1) * 0.5));
  let n = 0;
  let sx = 0;
  let sy = 0;
  for (let y = blob.y0; y <= yEnd; y++) {
    for (let x = blob.x0; x <= blob.x1; x++) {
      if (tags[y * w + x] !== blob.id) continue;
      n++;
      sx += x;
      sy += y;
    }
  }
  if (!n) return null;
  const box = (blob.x1 - blob.x0 + 1) * (yEnd - blob.y0 + 1);
  return { x: sx / n / w, y: sy / n / h, n, density: n / box };
}

// How face-like a blob's top half is: height in the frame, distance from the
// centre column, where its box starts, size and density, multiplied together.
function rateBlob(top, total, topEdge) {
  const frac = top.n / total;
  const height = top.y < 0.08 ? 0.5 : top.y <= 0.42 ? 1 : Math.max(0.15, 1 - (top.y - 0.42) * 4);
  const offCentre = Math.abs(top.x - 0.5);
  // A blob hugging the frame edge is sky, a wall or a limb, never the
  // subject: the falloff past |x - 0.5| = 0.3 is steep on purpose.
  const centred = offCentre <= 0.3 ? 1 : Math.max(0.1, 1 - (offCentre - 0.3) * 6);
  const starts = topEdge < 0.05 ? 0.7 : topEdge <= 0.3 ? 1 : Math.max(0.3, 1 - (topEdge - 0.3) * 2);
  const bulk = frac < 0.02 ? Math.max(0.15, frac / 0.02) : frac <= 0.06 ? 1 : Math.max(0.5, 1 - (frac - 0.06) * 6);
  const dense = Math.sqrt(Math.max(0.05, top.density));
  return height * centred * starts * bulk * dense;
}

// Every face-sized skin blob in the photo, best first. Each entry carries the
// centroid of its top half plus its score, density and pixel count.
export function findFaces(photo) {
  const { mask, w, h } = skinGrid(photo);
  const total = w * h;
  const smallest = Math.max(6, Math.round(total * MIN_FRAC));
  const { blobs, tags } = collectBlobs(mask, w, h);
  const rated = [];
  for (const blob of blobs) {
    if (blob.n < smallest) continue;
    const top = topHalf(blob, tags, w, h);
    if (!top) continue;
    rated.push({
      x: top.x,
      y: top.y,
      n: blob.n,
      density: top.density,
      score: rateBlob(top, total, blob.y0 / h),
    });
  }
  rated.sort((a, b) => b.score - a.score);
  const faces = rated.filter((c) => c.score > FLOOR && c.density >= 0.16);
  // Nothing cleared the bar: keep the best blob of any shape rather than
  // giving up on a portrait outright.
  if (!faces.length && rated.length) return [rated[0]];
  return faces;
}

// The point a panel should centre on: the best face, or the midpoint of two
// faces of similar strength when both sit in the face band near the middle of
// the frame — so a two-person panel keeps both in frame instead of centring
// on one and cutting the other. Returns null when no skin region is found.
export function faceFocus(photo) {
  const faces = findFaces(photo);
  if (!faces.length) return null;
  const first = faces[0];
  const second = faces[1];
  const clamp01 = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  if (
    second && second.score >= first.score * 0.5 &&
    first.y >= 0.1 && first.y <= 0.5 && second.y >= 0.1 && second.y <= 0.5 &&
    Math.abs(first.x - 0.5) <= 0.4 && Math.abs(second.x - 0.5) <= 0.4 &&
    Math.abs(first.x - second.x) >= 0.12 && Math.abs(first.x - second.x) <= 0.65
  ) {
    return {
      x: clamp01((first.x + second.x) / 2, 0.08, 0.92),
      y: clamp01((first.y + second.y) / 2, 0.1, 0.9),
    };
  }
  return { x: clamp01(first.x, 0.08, 0.92), y: clamp01(first.y, 0.1, 0.9) };
}

// Debug view of the raw blobs (used by the test harness while tuning): every
// blob with its size, box, density, centroid and top-half score.
export function inspectPhoto(photo) {
  const { mask, w, h } = skinGrid(photo);
  const total = w * h;
  const { blobs, tags } = collectBlobs(mask, w, h);
  return blobs
    .filter((b) => b.n >= Math.max(6, Math.round(total * MIN_FRAC)))
    .map((b) => {
      const bw = b.x1 - b.x0 + 1;
      const bh = b.y1 - b.y0 + 1;
      const top = topHalf(b, tags, w, h);
      return {
        n: b.n,
        share: +(b.n / total).toFixed(3),
        cx: +(b.sx / b.n / w).toFixed(2),
        cy: +(b.sy / b.n / h).toFixed(2),
        box: { x: +(b.x0 / w).toFixed(2), y: +(b.y0 / h).toFixed(2), w: +(bw / w).toFixed(2), h: +(bh / h).toFixed(2) },
        density: +((b.n / (bw * bh)).toFixed(2)),
        top: top ? { x: +top.x.toFixed(2), y: +top.y.toFixed(2), n: top.n, density: +top.density.toFixed(2), score: +rateBlob(top, total, b.y0 / h).toFixed(2) } : null,
      };
    })
    .sort((a, b) => b.n - a.n);
}
