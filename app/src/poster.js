// VERDE HEAT poster painter: draws the multi-panel GTA-style cover onto any
// 2D canvas at any of the three post sizes. Pure canvas, no network, no
// libraries. Layouts, grades, the title block, role tags, story lines, the
// barcode, the seal, grain and vignette all live here; the editor in
// studio.js only owns state and input.

export const SIZES = {
  '1080x1080': [1080, 1080],
  '1080x1350': [1080, 1350],
  '1920x1080': [1920, 1080],
};

export const LAYOUT_NAMES = {
  'hero-six': 'Hero + 5 panels',
  'hero-four': 'Hero + 3 panels',
  tilted: 'Tilted snapshots',
  'full-bleed': 'Full-bleed + strip',
};

export const GRADE_NAMES = {
  sunset: 'Sunset',
  neon: 'Neon nights',
  noir: 'Noir',
};

const clamp01 = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Panel rectangles for a layout, inside the art area. Hero first.
export function layoutFor(W, H, key) {
  const m = Math.round(W * 0.03);
  const g = Math.max(6, Math.round(W * 0.012));
  const wide = W > H;
  const titleH = Math.round(H * (wide ? 0.235 : 0.15));
  const footH = Math.round(H * 0.095);
  const ax = m;
  const ay = titleH + Math.round(H * 0.01);
  const aw = W - 2 * m;
  const ah = H - ay - footH - m;
  const out = [];
  if (key === 'hero-six') {
    if (!wide) {
      const heroW = Math.round(aw * 0.56) - Math.floor(g / 2);
      const rx = ax + heroW + g;
      const rw = aw - heroW - g;
      const rH = Math.floor((ah - 2 * g) / 3);
      const cw = Math.floor((rw - g) / 2);
      out.push({ x: ax, y: ay, w: heroW, h: ah, hero: true });
      out.push({ x: rx, y: ay, w: cw, h: rH });
      out.push({ x: rx + cw + g, y: ay, w: rw - cw - g, h: rH });
      out.push({ x: rx, y: ay + rH + g, w: cw, h: rH });
      out.push({ x: rx + cw + g, y: ay + rH + g, w: rw - cw - g, h: rH });
      out.push({ x: rx, y: ay + 2 * (rH + g), w: rw, h: ah - 2 * (rH + g) });
    } else {
      const heroW = Math.round(aw * 0.4) - Math.floor(g / 2);
      const rx = ax + heroW + g;
      const rw = aw - heroW - g;
      const rH = Math.floor((ah - g) / 2);
      const cw = Math.floor((rw - 2 * g) / 3);
      out.push({ x: ax, y: ay, w: heroW, h: ah, hero: true });
      for (let i = 0; i < 3; i++) out.push({ x: rx + i * (cw + g), y: ay, w: cw, h: rH });
      const bw = Math.floor((rw - g) / 2);
      out.push({ x: rx, y: ay + rH + g, w: bw, h: rH });
      out.push({ x: rx + bw + g, y: ay + rH + g, w: rw - bw - g, h: rH });
    }
  } else if (key === 'hero-four') {
    const heroW = Math.round(aw * (wide ? 0.42 : 0.58)) - Math.floor(g / 2);
    const rx = ax + heroW + g;
    const rw = aw - heroW - g;
    const cw = Math.floor((rw - g) / 2);
    const rH = Math.floor((ah - g) / 2);
    out.push({ x: ax, y: ay, w: heroW, h: ah, hero: true });
    out.push({ x: rx, y: ay, w: cw, h: rH });
    out.push({ x: rx + cw + g, y: ay, w: rw - cw - g, h: rH });
    out.push({ x: rx, y: ay + rH + g, w: cw, h: rH });
    out.push({ x: rx + cw + g, y: ay + rH + g, w: rw - cw - g, h: rH });
  } else if (key === 'tilted') {
    if (!wide) {
      out.push({ x: ax, y: ay, w: Math.round(aw * 0.56), h: Math.round(ah * 0.58), angle: -1.5, hero: true, snap: true });
      out.push({ x: ax + Math.round(aw * 0.58), y: ay, w: aw - Math.round(aw * 0.58), h: Math.round(ah * 0.28), angle: 2, snap: true });
      out.push({ x: ax + Math.round(aw * 0.58), y: ay + Math.round(ah * 0.3), w: aw - Math.round(aw * 0.58), h: Math.round(ah * 0.28), angle: -2, snap: true });
      out.push({ x: ax, y: ay + Math.round(ah * 0.6), w: Math.round(aw * 0.49), h: ah - Math.round(ah * 0.6), angle: 2.5, snap: true });
      out.push({ x: ax + Math.round(aw * 0.51), y: ay + Math.round(ah * 0.6), w: aw - Math.round(aw * 0.51), h: ah - Math.round(ah * 0.6), angle: -2.5, snap: true });
    } else {
      out.push({ x: ax, y: ay, w: Math.round(aw * 0.44), h: ah, angle: -1.5, hero: true, snap: true });
      const rx = ax + Math.round(aw * 0.46);
      const rw = aw - Math.round(aw * 0.46);
      const cw = Math.floor((rw - g) / 2);
      const rH = Math.floor((ah - g) / 2);
      out.push({ x: rx, y: ay, w: cw, h: rH, angle: 2, snap: true });
      out.push({ x: rx + cw + g, y: ay, w: rw - cw - g, h: rH, angle: -2, snap: true });
      out.push({ x: rx, y: ay + rH + g, w: cw, h: rH, angle: -2.5, snap: true });
      out.push({ x: rx + cw + g, y: ay + rH + g, w: rw - cw - g, h: rH, angle: 2.5, snap: true });
    }
  } else {
    // full-bleed: one big photo, three small panels in a strip along the foot.
    const bigH = Math.round(ah * (wide ? 0.7 : 0.68));
    const sy = ay + bigH + g;
    const sh = ah - bigH - g;
    const cw = Math.floor((aw - 2 * g) / 3);
    out.push({ x: ax, y: ay, w: aw, h: bigH, hero: true });
    for (let i = 0; i < 3; i++) out.push({ x: ax + i * (cw + g), y: sy, w: i === 2 ? aw - 2 * (cw + g) : cw, h: sh });
  }
  return { titleH, footH, margin: m, gap: g, art: { x: ax, y: ay, w: aw, h: ah }, panels: out };
}

function photoFilter(grade, warm) {
  let f = '';
  if (grade === 'sunset') f = 'saturate(1.3) contrast(1.08) brightness(1.03) sepia(0.2)';
  else if (grade === 'neon') f = 'saturate(2) contrast(1.32) brightness(0.95) hue-rotate(-24deg)';
  else f = 'saturate(0.2) contrast(1.3) brightness(0.97)';
  if (warm > 0) f += ` sepia(${(warm * 0.3).toFixed(2)}) hue-rotate(${(warm * 8).toFixed(1)}deg)`;
  else if (warm < 0) f += ` hue-rotate(${(warm * 14).toFixed(1)}deg) saturate(${(1 + warm * 0.25).toFixed(2)})`;
  return f;
}

// Cover-fit source rectangle for a photo in a panel, honouring zoom, drag
// offsets and the detected face point.
function fitSource(img, pw, ph, panel) {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const ia = iw / ih;
  const pa = pw / ph;
  let sw;
  let sh;
  if (ia > pa) { sh = ih; sw = sh * pa; } else { sw = iw; sh = sw / pa; }
  const zoom = Math.max(1, panel.zoom || 1);
  sw /= zoom;
  sh /= zoom;
  let cx = panel.focus ? panel.focus.x * iw : iw / 2;
  let cy = panel.focus ? panel.focus.y * ih : ih * 0.38;
  cx += (panel.dx || 0) * sw * 0.45;
  cy += (panel.dy || 0) * sh * 0.45;
  cx = clamp01(cx, sw / 2, iw - sw / 2);
  cy = clamp01(cy, sh / 2, ih - sh / 2);
  return { sx: cx - sw / 2, sy: cy - sh / 2, sw, sh };
}

function roundBox(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function star5(ctx, cx, cy, r, fill) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function shrinkToFit(ctx, text, makeFont, maxWidth, start) {
  let size = start;
  ctx.font = makeFont(size);
  while (size > 10 && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = makeFont(size);
  }
  return size;
}

// One photo panel: the photo with its grade, the role tag, the story line.
function paintPanel(ctx, img, rect, panel, grade, isHero, popOut) {
  const r = Math.max(4, Math.round(rect.w * 0.012));
  const w = rect.w;
  const h = rect.h;
  // Snapshots keep their white foot strip inside the panel rect, so the
  // frame can never spill over the title or foot bands.
  const photoH = rect.snap ? Math.round(h * 0.84) : h;
  ctx.save();
  if (rect.angle) {
    ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
    ctx.rotate((rect.angle * Math.PI) / 180);
    ctx.translate(-rect.w / 2, -rect.h / 2);
  } else {
    ctx.translate(rect.x, rect.y);
  }
  if (popOut) {
    ctx.shadowColor = 'rgba(10, 0, 20, 0.65)';
    ctx.shadowBlur = w * 0.06;
    ctx.shadowOffsetY = h * 0.02;
  }
  if (rect.snap) {
    ctx.fillStyle = '#fdf8ef';
    roundBox(ctx, -w * 0.015, -h * 0.015, w * 1.03, h * 1.03, r);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }
  roundBox(ctx, 0, 0, w, photoH, r);
  ctx.clip();
  if (img) {
    const src = fitSource(img, w, photoH, panel);
    ctx.filter = photoFilter(grade, panel.warm || 0);
    ctx.drawImage(img, src.sx, src.sy, src.sw, src.sh, 0, 0, w, photoH);
    ctx.filter = 'none';
    // Grade wash.
    if (grade === 'sunset') {
      const wash = ctx.createLinearGradient(0, 0, 0, photoH);
      wash.addColorStop(0, 'rgba(255, 190, 90, 0.05)');
      wash.addColorStop(1, 'rgba(255, 80, 140, 0.30)');
      ctx.globalCompositeOperation = 'soft-light';
      ctx.fillStyle = wash;
      ctx.fillRect(0, 0, w, photoH);
      ctx.globalCompositeOperation = 'source-over';
    } else if (grade === 'neon') {
      // Neon nights: a hard magenta/cyan duotone wash, then a deep violet
      // multiply pass that crushes the shadows — unmistakably not Sunset.
      const wash = ctx.createLinearGradient(0, 0, w, photoH);
      wash.addColorStop(0, 'rgba(255, 0, 150, 0.34)');
      wash.addColorStop(1, 'rgba(0, 220, 255, 0.34)');
      ctx.globalCompositeOperation = 'overlay';
      ctx.fillStyle = wash;
      ctx.fillRect(0, 0, w, photoH);
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = 'rgba(48, 0, 96, 0.26)';
      ctx.fillRect(0, 0, w, photoH);
      ctx.globalCompositeOperation = 'source-over';
    } else {
      ctx.fillStyle = 'rgba(16, 28, 52, 0.22)';
      ctx.fillRect(0, 0, w, photoH);
    }
  } else {
    ctx.fillStyle = '#241533';
    ctx.fillRect(0, 0, w, photoH);
  }
  // Role tag: dark pill, role in Bebas, place and time beneath it.
  const pad = Math.max(8, w * 0.03);
  const roleSize = clamp01(Math.round(photoH * 0.075), 13, 44);
  const subSize = clamp01(Math.round(photoH * 0.048), 10, 26);
  ctx.font = `${roleSize}px "Bebas Neue", sans-serif`;
  const roleW = ctx.measureText(panel.role || '').width;
  ctx.font = `${subSize}px "Bebas Neue", sans-serif`;
  const sub = `${panel.place || ''} · ${panel.time || ''}`.trim();
  const subW = ctx.measureText(sub).width;
  const tagW = Math.max(roleW, subW) + pad * 2;
  const tagH = roleSize + subSize + pad * 1.6;
  ctx.fillStyle = 'rgba(12, 4, 22, 0.82)';
  roundBox(ctx, pad, pad, tagW, tagH, Math.round(tagH * 0.28));
  ctx.fill();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffffff';
  ctx.font = `${roleSize}px "Bebas Neue", sans-serif`;
  ctx.fillText(panel.role || '', pad * 2, pad + roleSize * 0.95);
  ctx.fillStyle = '#ffd23f';
  ctx.font = `${subSize}px "Bebas Neue", sans-serif`;
  ctx.fillText(sub, pad * 2, pad + roleSize + subSize * 1.05);
  // Story line along the foot of the panel. Snapshots skip it: their line is
  // written on the white foot strip instead.
  if (panel.line && !rect.snap) {
    const capH = Math.max(18, Math.round(photoH * 0.1));
    ctx.fillStyle = 'rgba(10, 2, 18, 0.6)';
    ctx.fillRect(0, photoH - capH, w, capH);
    const capSize = clamp01(Math.round(capH * 0.42), 10, 24);
    ctx.fillStyle = '#ffeef7';
    ctx.font = `${capSize}px "Bebas Neue", sans-serif`;
    let text = panel.line;
    while (ctx.measureText(text).width > w * 0.92 && text.length > 4) text = text.slice(0, -4);
    if (text !== panel.line) text = `${text.trim()}…`;
    ctx.fillText(text, pad, photoH - capH / 2 + capSize * 0.36);
  }
  ctx.restore();
  // Pop-out hero: white keyline around the panel, drawn over the shadow.
  if (popOut) {
    ctx.save();
    ctx.strokeStyle = '#fdf8ef';
    ctx.lineWidth = Math.max(3, w * 0.008);
    roundBox(ctx, rect.x, rect.y, rect.w, rect.h, r);
    ctx.stroke();
    ctx.restore();
  }
  // Neon nights: a glowing cyan keyline around every panel, so the grade
  // reads on the frame as well as in the photo.
  if (grade === 'neon') {
    ctx.save();
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = Math.max(2, w * 0.006);
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = Math.max(6, w * 0.03);
    roundBox(ctx, rect.x, rect.y, rect.w, rect.h, r);
    ctx.stroke();
    ctx.restore();
  }
  if (rect.snap && panel.line) {
    // Caption written on the snapshot's white foot strip.
    ctx.save();
    ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
    ctx.rotate((rect.angle * Math.PI) / 180);
    ctx.translate(-rect.w / 2, -rect.h / 2);
    const capSize = clamp01(Math.round(rect.h * 0.05), 11, 26);
    ctx.fillStyle = '#3a2b22';
    ctx.font = `${capSize}px "Pacifico", cursive`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(panel.line, rect.w / 2, rect.h * 0.92);
    ctx.restore();
  }
}

// The title block: stars + press quote + VOL badge, huge gradient title,
// script line underneath.
function paintMasthead(ctx, W, H, geo, doc) {
  const { titleH, margin: m } = geo;
  const topY = m * 0.4;
  const starR = Math.max(7, titleH * 0.085);
  for (let i = 0; i < 5; i++) star5(ctx, m + starR + i * starR * 2.3, topY + starR, starR, '#ffd23f');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const quoteSize = clamp01(Math.round(titleH * 0.13), 12, 28);
  ctx.fillStyle = '#ffe9f3';
  ctx.font = `${quoteSize}px "Bebas Neue", sans-serif`;
  ctx.fillText(`${doc.quote} — ${doc.source}`, W / 2, topY + starR);
  const volW = Math.max(64, W * 0.075);
  const volH = starR * 2;
  ctx.fillStyle = '#ff2e88';
  roundBox(ctx, W - m - volW, topY, volW, volH, volH * 0.3);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.round(volH * 0.52)}px system-ui, sans-serif`;
  ctx.fillText(doc.vol, W - m - volW / 2, topY + volH / 2 + 1);
  // Huge gradient title with a thick dark outline. Neon nights gets a
  // cyan-to-magenta gradient and a neon glow instead of the sunset one.
  const title = (doc.title || 'VERDE HEAT').toUpperCase();
  const maxW = W - 2 * m;
  const baseY = titleH * 0.7;
  let size = Math.round(titleH * 0.5);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  size = shrinkToFit(ctx, title, (s) => `${s}px Anton, sans-serif`, maxW, size);
  try { ctx.letterSpacing = `${Math.round(size * 0.02)}px`; } catch { /* older canvas */ }
  const grad = ctx.createLinearGradient(0, baseY - size, 0, baseY + size * 0.15);
  const neon = doc.grade === 'neon';
  if (neon) {
    grad.addColorStop(0, '#8ef6ff');
    grad.addColorStop(0.4, '#00e5ff');
    grad.addColorStop(0.72, '#ff2e88');
    grad.addColorStop(1, '#c724f2');
  } else {
    grad.addColorStop(0, '#ffd23f');
    grad.addColorStop(0.38, '#ff7a18');
    grad.addColorStop(0.68, '#ff2e88');
    grad.addColorStop(1, '#7b2ff7');
  }
  ctx.font = `${size}px Anton, sans-serif`;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = neon ? '#0d0221' : '#1a0b2e';
  ctx.lineWidth = Math.max(4, size * 0.085);
  ctx.shadowColor = neon ? '#00e5ff' : 'rgba(10, 0, 20, 0.55)';
  ctx.shadowBlur = neon ? size * 0.3 : size * 0.12;
  ctx.shadowOffsetY = size * 0.03;
  ctx.strokeText(title, W / 2, baseY);
  ctx.fillStyle = grad;
  ctx.fillText(title, W / 2, baseY);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  try { ctx.letterSpacing = '0px'; } catch { /* older canvas */ }
  // Script subtitle under the title.
  if (doc.script) {
    const subSize = clamp01(Math.round(titleH * 0.16), 14, 40);
    ctx.font = `${subSize}px Pacifico, cursive`;
    ctx.fillStyle = '#ffe9f3';
    ctx.shadowColor = doc.grade === 'neon' ? '#00e5ff' : 'rgba(10, 0, 20, 0.5)';
    ctx.shadowBlur = doc.grade === 'neon' ? subSize * 0.45 : subSize * 0.2;
    ctx.fillText(doc.script, W / 2, titleH * 0.96);
    ctx.shadowBlur = 0;
  }
}

// The foot band: seal, tagline, barcode.
function paintFooter(ctx, W, H, geo, doc) {
  const { footH, margin: m } = geo;
  const y = H - footH - m * 0.4;
  // Seal: a solid gold starburst disc with dark bold text — built to read
  // even at thumbnail size, where a thin ring and small type vanish.
  const d = footH;
  const cx = m + d / 2;
  const cy = y + footH / 2;
  ctx.save();
  ctx.fillStyle = '#e8a100';
  ctx.beginPath();
  for (let i = 0; i < 32; i++) {
    const rad = i % 2 === 0 ? d / 2 : d * 0.44;
    const a = -Math.PI / 2 + (i * Math.PI) / 16;
    const x = cx + Math.cos(a) * rad;
    const yy = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  ctx.arc(cx, cy, d * 0.42, 0, Math.PI * 2);
  ctx.fill();
  star5(ctx, cx, cy - d * 0.2, d * 0.1, '#1a0b2e');
  ctx.fillStyle = '#1a0b2e';
  ctx.font = `${Math.max(9, Math.round(d * 0.15))}px "Bebas Neue", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ORIGINAL', cx, cy + d * 0.06);
  ctx.fillText('COVER ART', cx, cy + d * 0.26);
  ctx.restore();
  // Tagline centred between seal and barcode.
  const bcW = Math.max(90, W * 0.13);
  const tagSize = clamp01(Math.round(footH * 0.4), 14, 40);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  const tag = doc.tagline || '';
  const tagMax = W - (m + d + m) - bcW - m * 2;
  const fitted = shrinkToFit(ctx, tag, (s) => `${s}px "Bebas Neue", sans-serif`, tagMax, tagSize);
  ctx.font = `${fitted}px "Bebas Neue", sans-serif`;
  try { ctx.letterSpacing = `${Math.round(fitted * 0.08)}px`; } catch { /* older canvas */ }
  ctx.fillText(tag, m + d + m + tagMax / 2, y + footH / 2);
  try { ctx.letterSpacing = '0px'; } catch { /* older canvas */ }
  // Barcode on a white strip, right side.
  const bx = W - m - bcW;
  const bh = footH * 0.78;
  const by = y + (footH - bh) / 2;
  ctx.fillStyle = '#fdf8ef';
  roundBox(ctx, bx, by, bcW, bh, 3);
  ctx.fill();
  ctx.fillStyle = '#111111';
  let x = bx + bcW * 0.08;
  let seed = 20261121;
  const next = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  while (x < bx + bcW * 0.92) {
    const bw = 1 + next() * (bcW * 0.035);
    if (next() > 0.42) ctx.fillRect(x, by + bh * 0.1, bw, bh * 0.62);
    x += bw + 1 + next() * 3;
  }
  ctx.font = `${Math.max(8, Math.round(bh * 0.14))}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('8 50231 20261 1', bx + bcW / 2, by + bh * 0.9);
}

let grainTile = null;
// Draws the whole cover. `images` maps panel.pic to an image (or null).
export function paintCover(ctx, W, H, doc, images) {
  const geo = layoutFor(W, H, doc.layout);
  // Poster paper: a warm sunset gradient — or, for Neon nights, a dark
  // indigo-to-magenta ground so the whole poster reads differently at a glance.
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  if (doc.grade === 'neon') {
    bg.addColorStop(0, '#0d0221');
    bg.addColorStop(0.4, '#2d0a4e');
    bg.addColorStop(0.72, '#8a0f6e');
    bg.addColorStop(1, '#c2187a');
  } else {
    bg.addColorStop(0, '#2a0e3f');
    bg.addColorStop(0.42, '#7a1e5c');
    bg.addColorStop(0.72, '#e84a7a');
    bg.addColorStop(1, '#ff9e4f');
  }
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  // Gold keyline frame.
  ctx.strokeStyle = 'rgba(255, 210, 120, 0.55)';
  ctx.lineWidth = Math.max(2, W * 0.002);
  ctx.strokeRect(geo.margin * 0.5, geo.margin * 0.5, W - geo.margin, H - geo.margin);
  paintMasthead(ctx, W, H, geo, doc);
  // Panels: hero last when it pops out, so it overlaps its neighbours.
  const rects = geo.panels;
  const order = rects.map((r, i) => i);
  if (doc.layout !== 'full-bleed') order.sort((a, b) => (rects[a].hero ? 1 : 0) - (rects[b].hero ? 1 : 0));
  for (const i of order) {
    const panel = doc.panels[i];
    if (!panel) continue;
    const img = panel.pic != null ? images[panel.pic] || null : null;
    paintPanel(ctx, img, rects[i], panel, doc.grade, !!rects[i].hero, (doc.layout === 'hero-six' || doc.layout === 'hero-four') && !!rects[i].hero);
  }
  paintFooter(ctx, W, H, geo, doc);
  // Vignette + grain for the printed-poster finish.
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
  vg.addColorStop(0, 'rgba(20, 0, 30, 0)');
  vg.addColorStop(1, 'rgba(20, 0, 30, 0.32)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
  if (!grainTile) {
    const n = document.createElement('canvas');
    n.width = 140;
    n.height = 140;
    const nctx = n.getContext('2d');
    const id = nctx.createImageData(140, 140);
    for (let i = 0; i < id.data.length; i += 4) {
      const v = 110 + Math.floor(Math.random() * 90);
      id.data[i] = v; id.data[i + 1] = v; id.data[i + 2] = v; id.data[i + 3] = 28;
    }
    nctx.putImageData(id, 0, 0);
    grainTile = ctx.createPattern(n, 'repeat');
  }
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = grainTile;
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';
  return geo;
}
