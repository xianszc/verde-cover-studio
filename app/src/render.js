// render.js — draws the VERDE HEAT cover onto a canvas.
//
// Everything is drawn in the export's own pixel space, so the live preview
// and the exported PNG are the same picture. Layouts are plain geometry:
// each one returns the panel rectangles (plus a rotation for the tilted
// one), and drawCover paints the chrome — stars, striped title, role tags,
// seal, tagline, barcode — around them.

export const SIZES = {
  '1080x1080': [1080, 1080],
  '1080x1350': [1080, 1350],
  '1920x1080': [1920, 1080],
};

export const LAYOUTS = {
  'hero-six': 'Hero + 5 panels',
  'hero-three': 'Hero + 3 panels',
  tilted: 'Tilted snapshots',
  bleed: 'Full-bleed + strip',
};

export const GRADES = {
  sunset: 'Sunset',
  neon: 'Neon nights',
  noir: 'Noir',
};

const GOLD = '#f5c542';
const PLUM = '#2a0a3d';

/** Panel rectangles for a layout, in canvas pixels. */
export function computePanels(W, H, layout) {
  const m = W * 0.018;
  const g = W * 0.012;
  const topH = H * (W > H ? 0.2 : 0.16);
  const bottomH = H * 0.098;
  const ax = m;
  const ay = topH;
  const aw = W - 2 * m;
  const ah = H - topH - bottomH;
  const rect = (x, y, w, h, angle = 0) => ({ x, y, w, h, angle });

  if (layout === 'hero-three') {
    const heroW = aw * 0.58;
    const panels = [rect(ax, ay, heroW, ah)];
    const rx = ax + heroW + g;
    const rw = aw - heroW - g;
    const rh = (ah - 2 * g) / 3;
    for (let i = 0; i < 3; i++) panels.push(rect(rx, ay + i * (rh + g), rw, rh));
    return { panels, topH, bottomH };
  }

  if (layout === 'tilted') {
    const angles = [-4, 3.5, -2.5, 2.5, -3.5, 4];
    const cw = (aw - 2 * g) / 3;
    const ch = (ah - g) / 2;
    const panels = [];
    for (let i = 0; i < 6; i++) {
      const col = i % 3;
      const row = (i / 3) | 0;
      panels.push(rect(ax + col * (cw + g), ay + row * (ch + g), cw, ch, angles[i]));
    }
    return { panels, topH, bottomH };
  }

  if (layout === 'bleed') {
    const stripH = ah * 0.3;
    const sy = ay + ah - stripH;
    const sw = (aw - 4 * g) / 5;
    const panels = [rect(0, 0, W, H)]; // panel 0 is the whole backdrop
    for (let i = 0; i < 5; i++) panels.push(rect(ax + i * (sw + g), sy, sw, stripH));
    return { panels, topH, bottomH, bleed: true };
  }

  // hero-six (the default): a big hero on the left, five panels on the right.
  const heroW = aw * 0.46;
  const panels = [rect(ax, ay, heroW, ah)];
  const rx = ax + heroW + g;
  const rw = aw - heroW - g;
  if (W >= H) {
    const topRowH = ah * 0.52;
    const tw = (rw - 2 * g) / 3;
    for (let i = 0; i < 3; i++) panels.push(rect(rx + i * (tw + g), ay, tw, topRowH));
    const bw = (rw - g) / 2;
    const by = ay + topRowH + g;
    const bh = ah - topRowH - g;
    panels.push(rect(rx, by, bw, bh));
    panels.push(rect(rx + bw + g, by, bw, bh));
  } else {
    const cw = (rw - g) / 2;
    const r0 = ah * 0.34;
    const r1 = ah * 0.33;
    const r2 = ah - r0 - r1 - 2 * g;
    panels.push(rect(rx, ay, cw, r0));
    panels.push(rect(rx + cw + g, ay, cw, r0));
    panels.push(rect(rx, ay + r0 + g, cw, r1));
    panels.push(rect(rx + cw + g, ay + r0 + g, cw, r1));
    panels.push(rect(rx, ay + r0 + r1 + 2 * g, rw, r2));
  }
  return { panels, topH, bottomH };
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function gradeFilter(grade) {
  if (grade === 'neon') return 'saturate(1.95) contrast(1.3) hue-rotate(-22deg)';
  if (grade === 'noir') return 'grayscale(1) contrast(1.28) brightness(1.06)';
  return 'saturate(1.18) contrast(1.06) brightness(1.02)';
}

/**
 * Paints one photo into a panel, centred on its focus point, with the
 * panel's zoom and offsets applied. `warmth` (-1..1) tints the photo warm
 * or cool after the grade filter.
 */
export function drawPhotoInto(ctx, img, panel, focus, zoom, ox, oy, grade, warmth) {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const scale = Math.max(panel.w / iw, panel.h / ih) * Math.max(1, zoom);
  const sw = panel.w / scale;
  const sh = panel.h / scale;
  const cx = clamp(focus.x * iw + ox * sw * 0.45, sw / 2, iw - sw / 2);
  const cy = clamp(focus.y * ih + oy * sh * 0.45, sh / 2, ih - sh / 2);
  const sx = cx - sw / 2;
  const sy = cy - sh / 2;

  ctx.save();
  if (panel.angle) {
    ctx.translate(panel.x + panel.w / 2, panel.y + panel.h / 2);
    ctx.rotate((panel.angle * Math.PI) / 180);
    ctx.translate(-panel.w / 2, -panel.h / 2);
  } else {
    ctx.translate(panel.x, panel.y);
  }
  roundRectPath(ctx, 0, 0, panel.w, panel.h, Math.max(4, panel.w * 0.008));
  ctx.clip();
  ctx.filter = gradeFilter(grade);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, panel.w, panel.h);
  ctx.filter = 'none';
  if (warmth > 0.01) {
    ctx.fillStyle = `rgba(255,110,30,${(warmth * 0.16).toFixed(3)})`;
    ctx.fillRect(0, 0, panel.w, panel.h);
  } else if (warmth < -0.01) {
    ctx.fillStyle = `rgba(70,130,255,${(-warmth * 0.16).toFixed(3)})`;
    ctx.fillRect(0, 0, panel.w, panel.h);
  }
  ctx.restore();

  // Gold frame, drawn in the same rotated space as the photo.
  ctx.save();
  if (panel.angle) {
    ctx.translate(panel.x + panel.w / 2, panel.y + panel.h / 2);
    ctx.rotate((panel.angle * Math.PI) / 180);
    ctx.translate(-panel.w / 2, -panel.h / 2);
  } else {
    ctx.translate(panel.x, panel.y);
  }
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = Math.max(2, panel.w * 0.006);
  roundRectPath(ctx, 0, 0, panel.w, panel.h, Math.max(4, panel.w * 0.008));
  ctx.stroke();
  ctx.restore();
}

// ---- chrome: the poster furniture around the panels -----------------------

function starPath(ctx, cx, cy, outer, inner, points = 5) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i * Math.PI) / points - Math.PI / 2;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawStars(ctx, x, y, size) {
  ctx.save();
  ctx.fillStyle = '#ffd23f';
  ctx.strokeStyle = '#8a6d00';
  ctx.lineWidth = Math.max(1, size * 0.06);
  for (let i = 0; i < 5; i++) {
    starPath(ctx, x + i * size * 1.25, y, size / 2, size / 2.1);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawTitle(ctx, W, H, title, subtitle, topH) {
  // The top band holds three stacked lines — quote, title, script — so the
  // title is sized to the band, not just to the width: it must clear the
  // quote above and leave the script line inside the band below.
  const quoteBottom = H * 0.032 + H * 0.014;
  const bandBottom = topH - H * 0.008;
  const titleSize = Math.round(Math.min(W * 0.096, H * 0.17, (bandBottom - quoteBottom) / 1.35));
  // Title block runs from cy - 0.55*size to cy + 0.80*size (script line
  // included); centre that block in the space below the quote.
  const cy = quoteBottom + (bandBottom - quoteBottom - titleSize * 1.35) / 2 + titleSize * 0.55;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  try { ctx.letterSpacing = `${(titleSize * 0.02).toFixed(1)}px`; } catch { /* older canvas */ }
  ctx.font = `${titleSize}px Anton, 'Bebas Neue', sans-serif`;
  const grad = ctx.createLinearGradient(0, cy - titleSize * 0.55, 0, cy + titleSize * 0.55);
  grad.addColorStop(0, '#ffe95e');
  grad.addColorStop(0.3, '#ffb02e');
  grad.addColorStop(0.52, '#ff5e3a');
  grad.addColorStop(0.75, '#ff2e88');
  grad.addColorStop(1, '#b04dff');
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = titleSize * 0.08;
  ctx.shadowOffsetY = titleSize * 0.03;
  ctx.lineWidth = titleSize * 0.05;
  ctx.strokeStyle = '#2a0a3d';
  ctx.lineJoin = 'round';
  ctx.strokeText(title, W / 2, cy);
  ctx.fillStyle = grad;
  ctx.fillText(title, W / 2, cy);
  // Chrome sheen: the same glyphs filled again with a white gradient that
  // fades out down the letters. (A separate sheen rectangle would need
  // source-atop, which composites against the whole canvas and leaves a
  // pale band on the background — refilling the text keeps it on the
  // letters only.)
  const sheen = ctx.createLinearGradient(0, cy - titleSize * 0.55, 0, cy + titleSize * 0.1);
  sheen.addColorStop(0, 'rgba(255,255,255,0.34)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fillText(title, W / 2, cy);
  ctx.restore();

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${Math.round(titleSize * 0.36)}px Pacifico, cursive`;
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = titleSize * 0.04;
  ctx.shadowOffsetY = titleSize * 0.015;
  ctx.fillText(subtitle, W / 2, cy + titleSize * 0.62);
  ctx.restore();
}

function drawSeal(ctx, cx, cy, r) {
  ctx.save();
  ctx.translate(cx, cy);
  // 16-point starburst.
  ctx.beginPath();
  for (let i = 0; i < 32; i++) {
    const rad = i % 2 === 0 ? r : r * 0.8;
    const a = (i * Math.PI) / 16 - Math.PI / 2;
    const x = rad * Math.cos(a);
    const y = rad * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = '#f7c948';
  ctx.fill();
  ctx.strokeStyle = '#8a6d00';
  ctx.lineWidth = Math.max(1, r * 0.04);
  ctx.stroke();
  // Inner disc + wording.
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.68, 0, Math.PI * 2);
  ctx.fillStyle = '#ffd94d';
  ctx.fill();
  ctx.fillStyle = '#3a2400';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  starPath(ctx, 0, -r * 0.36, r * 0.14, r * 0.06);
  ctx.fill();
  ctx.font = `bold ${Math.round(r * 0.24)}px 'Bebas Neue', sans-serif`;
  ctx.fillText('ORIGINAL', 0, -r * 0.02);
  ctx.fillText('COVER ART', 0, r * 0.26);
  ctx.restore();
}

function drawBarcode(ctx, x, y, w, h) {
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, w, h);
  const digits = [8, 5, 0, 2, 3, 1, 2, 0, 2, 6, 1, 1];
  const unit = w / 66;
  let bx = x + w * 0.05;
  ctx.fillStyle = '#111111';
  for (const d of digits) {
    const bw = unit * (1 + (d % 3));
    ctx.fillRect(bx, y + h * 0.08, bw, h * 0.68);
    bx += bw + unit * (1 + ((d * 7) % 2));
  }
  ctx.fillStyle = '#111111';
  ctx.font = `${Math.max(8, Math.round(h * 0.13))}px 'Bebas Neue', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('8 50231 20261 1', x + w / 2, y + h * 0.88);
  ctx.restore();
}

function drawRoleTag(ctx, panel, role, place, time, big) {
  const pad = Math.max(6, panel.w * 0.03);
  let roleSize = Math.max(11, Math.round(panel.h * (big ? 0.105 : 0.082)));
  let subSize = Math.max(9, Math.round(roleSize * 0.58));
  // Fit the tag inside its own panel: a tag wider than the panel would be
  // painted over by the neighbour panel drawn after it, clipping the text.
  for (let tries = 0; tries < 3; tries++) {
    ctx.font = `${roleSize}px Anton, 'Bebas Neue', sans-serif`;
    const roleW = ctx.measureText(role).width;
    ctx.font = `${subSize}px 'Bebas Neue', sans-serif`;
    const subW = ctx.measureText(`${place} · ${time}`).width;
    const boxW = Math.max(roleW, subW) + pad * 2;
    if (boxW <= panel.w * 0.94) break;
    const shrink = (panel.w * 0.94) / boxW;
    roleSize = Math.max(9, Math.floor(roleSize * shrink));
    subSize = Math.max(8, Math.floor(subSize * shrink));
  }
  ctx.save();
  if (panel.angle) {
    ctx.translate(panel.x + panel.w / 2, panel.y + panel.h / 2);
    ctx.rotate((panel.angle * Math.PI) / 180);
    ctx.translate(-panel.w / 2, -panel.h / 2);
  } else {
    ctx.translate(panel.x, panel.y);
  }
  ctx.font = `${roleSize}px Anton, 'Bebas Neue', sans-serif`;
  const roleW = ctx.measureText(role).width;
  ctx.font = `${subSize}px 'Bebas Neue', sans-serif`;
  const subW = ctx.measureText(`${place} · ${time}`).width;
  const boxW = Math.max(roleW, subW) + pad * 2;
  const boxH = roleSize + subSize + pad * 1.9;
  const bx = panel.w * 0.03;
  const by = panel.h * 0.035;
  ctx.fillStyle = 'rgba(10,5,20,0.82)';
  roundRectPath(ctx, bx, by, boxW, boxH, Math.max(4, boxH * 0.22));
  ctx.fill();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.font = `${roleSize}px Anton, 'Bebas Neue', sans-serif`;
  ctx.fillText(role, bx + pad, by + pad + roleSize * 0.5);
  ctx.fillStyle = GOLD;
  ctx.font = `${subSize}px 'Bebas Neue', sans-serif`;
  ctx.fillText(`${place} · ${time}`, bx + pad, by + pad + roleSize + subSize * 0.55);
  ctx.restore();
}

function drawMicro(ctx, panel, text) {
  const size = Math.max(9, Math.round(panel.h * 0.052));
  const bandH = size * 2.1;
  ctx.save();
  if (panel.angle) {
    ctx.translate(panel.x + panel.w / 2, panel.y + panel.h / 2);
    ctx.rotate((panel.angle * Math.PI) / 180);
    ctx.translate(-panel.w / 2, -panel.h / 2);
  } else {
    ctx.translate(panel.x, panel.y);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, panel.h - bandH, panel.w, bandH);
  ctx.fillStyle = '#ffffff';
  ctx.font = `${size}px 'Bebas Neue', sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text.toUpperCase(), panel.w * 0.03, panel.h - bandH / 2, panel.w * 0.94);
  ctx.restore();
}

// ---- the whole cover ------------------------------------------------------

export function drawCover(ctx, W, H, state, photos) {
  const grade = state.grade;
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  if (grade === 'neon') {
    bg.addColorStop(0, '#150833');
    bg.addColorStop(0.55, '#3d0b4a');
    bg.addColorStop(1, '#7a1048');
  } else if (grade === 'noir') {
    bg.addColorStop(0, '#0d0d0f');
    bg.addColorStop(0.6, '#232326');
    bg.addColorStop(1, '#3a3a40');
  } else {
    bg.addColorStop(0, '#2a0a3d');
    bg.addColorStop(0.55, '#6d1850');
    bg.addColorStop(1, '#e8734a');
  }
  ctx.save();
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const geo = computePanels(W, H, state.layout);
  const { topH, bottomH } = geo;
  const visible = state.layout === 'hero-three' ? [0, 1, 2, 3] : [0, 1, 2, 3, 4, 5];

  // Full-bleed backdrop: panel 0's photo behind everything.
  if (geo.bleed) {
    const hero = state.panels[0];
    const img = photos[hero.photoIdx];
    if (img) {
      const focus = hero.focus || { x: 0.5, y: 0.4 };
      ctx.filter = gradeFilter(grade);
      const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
      const sw = W / scale;
      const sh = H / scale;
      const sx = Math.max(0, Math.min(img.naturalWidth - sw, focus.x * img.naturalWidth - sw / 2));
      const sy = Math.max(0, Math.min(img.naturalHeight - sh, focus.y * img.naturalHeight - sh / 2));
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
      ctx.filter = 'none';
      const shade = ctx.createLinearGradient(0, 0, 0, H);
      shade.addColorStop(0, 'rgba(10,4,24,0.72)');
      shade.addColorStop(0.25, 'rgba(10,4,24,0)');
      shade.addColorStop(0.75, 'rgba(10,4,24,0)');
      shade.addColorStop(1, 'rgba(10,4,24,0.78)');
      ctx.fillStyle = shade;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // Top chrome: stars, press quote, VOL pill, striped title, script line.
  const starSize = Math.max(14, Math.round(H * 0.026));
  drawStars(ctx, W * 0.03, H * 0.032, starSize);
  ctx.save();
  ctx.font = `${Math.max(11, Math.round(H * 0.02))}px 'Bebas Neue', sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${state.quote} — ${state.quoteSource}`, W / 2, H * 0.032);
  ctx.restore();
  const volText = state.vol;
  ctx.save();
  ctx.font = `bold ${Math.max(11, Math.round(H * 0.02))}px 'Bebas Neue', sans-serif`;
  const volW = ctx.measureText(volText).width + H * 0.02;
  const volH = H * 0.032;
  ctx.fillStyle = '#ff2e88';
  roundRectPath(ctx, W - W * 0.03 - volW, H * 0.032 - volH / 2, volW, volH, volH / 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(volText, W - W * 0.03 - volW / 2, H * 0.032 + 1);
  ctx.restore();
  drawTitle(ctx, W, H, state.title, state.subtitle, topH);

  // Panels. In the bleed layout panel 0 is the backdrop, so it carries no
  // tag of its own; the five strip panels carry theirs.
  for (const idx of visible) {
    const panel = geo.panels[idx];
    const p = state.panels[idx];
    if (!p || !panel) continue;
    if (geo.bleed && idx === 0) continue;
    const img = photos[p.photoIdx];
    if (!img) continue;
    drawPhotoInto(ctx, img, panel, p.focus || { x: 0.5, y: 0.4 }, p.zoom, p.ox, p.oy, grade, p.warmth);
    drawRoleTag(ctx, panel, p.role, p.place, p.time, idx === 0 && state.layout !== 'tilted');
    drawMicro(ctx, panel, p.micro);
  }

  // Grade wash over the panel area, under the tags already painted above.
  // (The wash is deliberately faint: the photos carry the grade already.)
  if (grade === 'neon') {
    ctx.fillStyle = 'rgba(255,0,160,0.12)';
    ctx.fillRect(0, topH, W, H - topH - bottomH);
    ctx.fillStyle = 'rgba(0,220,255,0.06)';
    ctx.fillRect(0, topH, W, H - topH - bottomH);
  } else if (grade === 'sunset') {
    ctx.fillStyle = 'rgba(255,140,60,0.05)';
    ctx.fillRect(0, topH, W, H - topH - bottomH);
  }

  // Bottom band: gold seal, tagline, barcode.
  const bandY = H - bottomH;
  const sealR = bottomH * 0.44;
  drawSeal(ctx, W * 0.03 + sealR + W * 0.008, bandY + bottomH / 2, sealR);
  ctx.save();
  ctx.font = `${Math.max(12, Math.round(bottomH * 0.36))}px 'Bebas Neue', sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  try { ctx.letterSpacing = `${(W * 0.003).toFixed(1)}px`; } catch { /* older canvas */ }
  ctx.fillText(state.tagline, W / 2, bandY + bottomH / 2);
  ctx.restore();
  drawBarcode(ctx, W - W * 0.03 - W * 0.085, bandY + bottomH * 0.16, W * 0.085, bottomH * 0.68);

  ctx.restore();
  return geo;
}
