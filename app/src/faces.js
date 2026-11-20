// Face-aware crop helper: finds the centre of the largest skin-toned region in a
// photo, so a panel can crop around the person's face instead of the dead centre.
// Pure canvas math, no network, no model: skin pixels are scored in YCbCr space,
// then the centroid of the densest skin cluster (weighted toward the upper part of
// the frame, where faces sit in portraits) is returned in 0..1 photo coordinates.

/** Detects the face centre of `img`, or null when no skin region is found. */
export function detectFaceCenter(img) {
  const w = 96;
  const h = Math.max(24, Math.round((96 * img.naturalHeight) / img.naturalWidth));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;

  // Accumulate skin pixels per row band so the densest band wins over stray skin.
  const bands = 6;
  const bandWeight = new Float64Array(bands);
  const bandX = new Float64Array(bands);
  const bandY = new Float64Array(bands);
  const bandN = new Float64Array(bands);
  let total = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // Classic YCbCr skin range, plus a daylight sanity check.
      const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
      const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
      const isSkin =
        r > 95 && g > 40 && b > 20 && r > g && r > b && r - g > 12 &&
        cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173;
      if (!isSkin) continue;
      const band = Math.min(bands - 1, Math.floor((y / h) * bands));
      // Faces live in the upper two thirds: weight upper bands higher.
      const weight = y < h * 0.66 ? 1.6 : 1;
      bandWeight[band] += weight;
      bandX[band] += x * weight;
      bandY[band] += y * weight;
      bandN[band] += weight;
      total += weight;
    }
  }
  if (total < w * h * 0.004) return null; // almost no skin: not a portrait
  // Faces sit above shoulders, arms and chests: prefer the topmost band that
  // still holds a substantial share of the skin, so a bare chest below the
  // face cannot drag the centre down. Then average the skin from the top of
  // the frame down through one band below it (face plus jaw and neck).
  const maxWeight = Math.max(...bandWeight);
  let top = 0;
  for (let b = 0; b < bands; b++) {
    if (bandWeight[b] >= maxWeight * 0.35) { top = b; break; }
  }
  let sx = 0;
  let sy = 0;
  let sn = 0;
  for (let b = 0; b <= Math.min(bands - 1, top + 1); b++) {
    sx += bandX[b];
    sy += bandY[b];
    sn += bandN[b];
  }
  if (sn === 0) return null;
  return {
    x: Math.min(0.92, Math.max(0.08, sx / sn / w)),
    y: Math.min(0.9, Math.max(0.1, sy / sn / h)),
  };
}
