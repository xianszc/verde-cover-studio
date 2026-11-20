// skin.js — find the face in a photo so a panel can crop around it.
//
// No model, no network: human skin sits in a narrow band of YCbCr chroma,
// so skin pixels clump into blobs and the biggest blob near the top of the
// frame is usually a face. Sunset skies and bare arms are the classic
// traps, so every blob is scored by size, by how high it sits, and by how
// much of the frame it covers, and a pair photo aims between its two faces.

/**
 * Returns the face centre as fractions of the image ({x, y} in 0..1), or
 * null when nothing skin-like is big enough to trust.
 */
export function findFaceCenter(img) {
  const probe = document.createElement('canvas');
  const shrink = Math.min(1, 140 / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(8, Math.round(img.naturalWidth * shrink));
  const h = Math.max(8, Math.round(img.naturalHeight * shrink));
  probe.width = w;
  probe.height = h;
  const pctx = probe.getContext('2d', { willReadFrequently: true });
  pctx.drawImage(img, 0, 0, w, h);
  const px = pctx.getImageData(0, 0, w, h).data;

  // YCbCr skin band: bright enough, red chroma clearly above blue chroma.
  const skin = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = px[i * 4];
    const g = px[i * 4 + 1];
    const b = px[i * 4 + 2];
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
    const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
    if (y > 55 && cr > 133 && cr < 173 && cb > 77 && cb < 127) skin[i] = 1;
  }

  // Flood-fill the skin mask into connected blobs.
  const seen = new Uint8Array(w * h);
  const blobs = [];
  const stack = [];
  for (let start = 0; start < w * h; start++) {
    if (!skin[start] || seen[start]) continue;
    let count = 0;
    let sumX = 0;
    let sumY = 0;
    let minX = w;
    let maxX = -1;
    let minY = h;
    let maxY = -1;
    stack.length = 0;
    stack.push(start);
    seen[start] = 1;
    while (stack.length) {
      const p = stack.pop();
      const x = p % w;
      const y = (p / w) | 0;
      count++;
      sumX += x;
      sumY += y;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (x > 0 && skin[p - 1] && !seen[p - 1]) { seen[p - 1] = 1; stack.push(p - 1); }
      if (x < w - 1 && skin[p + 1] && !seen[p + 1]) { seen[p + 1] = 1; stack.push(p + 1); }
      if (y > 0 && skin[p - w] && !seen[p - w]) { seen[p - w] = 1; stack.push(p - w); }
      if (y < h - 1 && skin[p + w] && !seen[p + w]) { seen[p + w] = 1; stack.push(p + w); }
    }
    if (count < 12) continue;
    blobs.push({
      count,
      cx: sumX / count / w,
      cy: sumY / count / h,
      minX: minX / w,
      maxX: maxX / w,
      minY: minY / h,
      maxY: maxY / h,
      widthFrac: (maxX - minX + 1) / w,
    });
  }
  if (!blobs.length) return null;

  // Score: big wins, high in the frame wins, edge-hugging and frame-wide
  // blobs lose (those are skies, walls and sunsets, not faces).
  const scored = blobs
    .map((b) => {
      let score = b.count * (1.7 - b.cy);
      if (b.minX <= 0.01 || b.maxX >= 0.99) score *= 0.55;
      if (b.minY <= 0.01) score *= 0.7;
      if (b.widthFrac > 0.62) score *= 0.4;
      return { ...b, score };
    })
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (best.count < w * h * 0.004) return null;

  // A pair photo: when the runner-up is a second real face in the same
  // band, aim between the two so neither gets cropped out.
  const second = scored[1];
  if (
    second &&
    second.score > best.score * 0.45 &&
    Math.abs(second.cy - best.cy) < 0.22 &&
    Math.abs(second.cx - best.cx) > 0.1 &&
    second.cy < 0.62 &&
    best.cy < 0.62
  ) {
    return { x: (best.cx + second.cx) / 2, y: (best.cy + second.cy) / 2, pair: true };
  }
  return { x: best.cx, y: best.cy, pair: false };
}
