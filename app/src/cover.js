// VERDE HEAT cover renderer: draws the multi-panel GTA-style poster onto any 2D
// canvas at any of the three post sizes. Pure canvas, no network, no libraries.
// Layouts, grades, title block, role tags, micro-captions, barcode, seal, grain and
// vignette are all drawn here; the editor (main.js) only owns state and input.

export const SIZES = {
  '1080x1080': [1080, 1080],
  '1080x1350': [1080, 1350],
  '1920x1080': [1920, 1080],
};

export const LAYOUTS = {
  'hero-six': 'Hero + 5 panels',
  'hero-four': 'Hero + 3 panels',
  tilted: 'Tilted snapshots',
  'full-bleed': 'Full-bleed + strip',
};

export const GRADES = {
  sunset: 'Sunset',
  neon: 'Neon nights',
  noir: 'Noir',
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Panel geometry for a layout: rects inside the art area, hero first. */
export function computeLayout(W, H, layout) {
  const m = Math.round(W * 0.028);
  const g = Math.max(6, Math.round(W * 0.011));
  const titleH = Math.round(H * (H >= W ? 0.148 : 0.2));
  const footH = Math.round(H * 0.072);
  const ax = m;
  const ay = titleH + Math.round(H * 0.008);
  const aw = W - 2 * m;
  const ah = H - ay - footH - m;
  const wide = W > H;
  const P = [];
  if (layout === 'hero-six') {
    if (!wide) {
      const hw = Math.round(aw * 0.58) - Math.floor(g / 2);
      const rx = ax + hw + g;
      const rw = aw - hw - g;
      const rh = (h) => Math.round((ah - 2 * g) * h);
      P.push({ x: ax, y: ay, w: hw, h: ah, hero: true });
      const y2 = ay + rh(0.34) + g;
      const y3 = y2 + rh(0.34) + g;
      const cw = Math.floor((rw - g) / 2);
      P.push({ x: rx, y: ay, w: cw, h: rh(0.34) });
      P.push({ x: rx + cw + g, y: ay, w: rw - cw - g, h: rh(0.34) });
      P.push({ x: rx, y: y2, w: cw, h: rh(0.34) });
      P.push({ x: rx + cw + g, y: y2, w: rw - cw - g, h: rh(0.34) });
      P.push({ x: rx, y: y3, w: rw, h: ah - (y3 - ay) });
    } else {
      const hw = Math.round(aw * 0.4) - Math.floor(g / 2);
      const rx = ax + hw + g;
      const rw = aw - hw - g;
      const rh = Math.round((ah - g) / 2);
      P.push({ x: ax, y: ay, w: hw, h: ah, hero: true });
      const cw = Math.floor((rw - 2 * g) / 3);
      for (let i = 0; i < 3; i++) P.push({ x: rx + i * (cw + g), y: ay, w: cw, h: rh });
      const bw = Math.floor((rw - g) / 2);
      P.push({ x: rx, y: ay + rh + g, w: bw, h: rh });
      P.push({ x: rx + bw + g, y: ay + rh + g, w: rw - bw - g, h: rh });
    }
  } else if (layout === 'hero-four') {
    const hw = Math.round(aw * (wide ? 0.42 : 0.6)) - Math.floor(g / 2);
    const rx = ax + hw + g;
    const rw = aw - hw - g;
    const cw = Math.floor((rw - g) / 2);
    const rh = Math.floor((ah - g) / 2);
    P.push({ x: ax, y: ay, w: hw, h: ah, hero: true });
    P.push({ x: rx, y: ay, w: cw, h: rh });
    P.push({ x: rx + cw + g, y: ay, w: rw - cw - g, h: rh });
    P.push({ x: rx, y: ay + rh + g, w: cw, h: rh });
    P.push({ x: rx + cw + g, y: ay + rh + g, w: rw - cw - g, h: rh });
  } else if (layout === 'tilted') {
    if (!wide) {
      P.push({ x: ax, y: ay, w: Math.round(aw * 0.56), h: Math.round(ah * 0.6), angle: -1.5, hero: true, polaroid: true });
      P.push({ x: ax + Math.round(aw * 0.58), y: ay, w: aw - Math.round(aw * 0.58), h: Math.round(ah * 0.29), angle: 2, polaroid: true });
      P.push({ x: ax + Math.round(aw * 0.58), y: ay + Math.round(ah * 0.31), w: aw - Math.round(aw * 0.58), h: Math.round(ah * 0.29), angle: -2, polaroid: true });
      P.push({ x: ax, y: ay + Math.round(ah * 0.62), w: Math.round(aw * 0.49), h: ah - Math.round(ah * 0.62), angle: 2.5, polaroid: true });
      P.push({ x: ax + Math.round(aw * 0.51), y: ay + Math.round(ah * 0.62), w: aw - Math.round(aw * 0.51), h: ah - Math.round(ah * 0.62), angle: -2.5, polaroid: true });
    } else {
      P.push({ x: ax, y: ay, w: Math.round(aw * 0.44), h: ah, angle: -1.5, hero: true, polaroid: true });
      const rx = ax + Math.round(aw * 0.46);
      const rw = aw - Math.round(aw * 0.46);
      const cw = Math.floor((rw - g) / 2);
      const rh = Math.floor((ah - g) / 2);
      P.push({ x: rx, y: ay, w: cw, h: rh, angle: 2, polaroid: true });
      P.push({ x: rx + cw + g, y: ay, w: rw - cw - g, h: rh, angle: -2, polaroid: true });
      P.push({ x: rx, y: ay + rh + g, w: cw, h: rh, angle: -2.5, polaroid: true });
      P.push({ x: rx + cw + g, y: ay + rh + g, w: rw - cw - g, h: rh, angle: 2.5, polaroid: true });
    }
  } else {
    // full-bleed: one big photo, three small panels in a strip along the foot.
    const bigH = Math.round(ah * (wide ? 0.7 : 0.68));
    const sy = ay + bigH + g;
    const sh = ah - bigH - g;
    const cw = Math.floor((aw - 2 * g) / 3);
    P.push({ x: ax, y: ay, w: aw, h: bigH, hero: true });
    for (let i = 0; i < 3; i++) P.push({ x: ax + i * (cw + g), y: sy, w: i === 2 ? aw - 2 * (cw + g) : cw, h: sh });
  }
  return { titleH, footH, margin: m, gap: g, art: { x: ax, y: ay, w: aw, h: ah }, panels: P };
}

function gradeFilter(grade, warmth) {
  let f = '';
  if (grade === 'sunset') f = 'saturate(1.28) contrast(1.07) brightness(1.03) sepia(0.22)';
  else if (grade === 'neon') f = 'saturate(1.55) contrast(1.14) brightness(0.99) hue-rotate(-6deg)';
  else f = 'saturate(0.22) contrast(1.28) brightness(0.96)';
  if (warmth > 0) f += ` sepia(${(warmth * 0.3).toFixed(2)}) hue-rotate(${(warmth * 8).toFixed(1)}deg)`;
  else if (warmth < 0) f += ` hue-rotate(${(warmth * 14).toFixed(1)}deg) saturate(${(1 + warmth * 0.25).toFixed(2)})`;
  return f;
}

/** Cover-fit source rect for a photo in a panel, honouring zoom, drag and face focus. */
function coverSourceRect(img, pw, ph, panel) {
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
  cx += (panel.ox || 0) * sw * 0.45;
  cy += (panel.oy || 0) * sh * 0.45;
  cx = clamp(cx, sw / 2, iw - sw / 2);
  cy = clamp(cy, sh / 2, ih - sh / 2);
  return { sx: cx - sw / 2, sy: cy - sh / 2, sw, sh };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawStar(ctx, cx, cy, r, fill) {
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

function fitFont(ctx, text, font, maxWidth, startSize) {
  let size = startSize;
  ctx.font = font(size);
  while (size > 10 && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = font(size);
  }
  return size;
}

/** Draws one photo panel (photo, grade overlay, role tag, micro-caption). */
function drawPanel(ctx, img, rect, panel, grade, isHero, popOut) {
  const r = Math.max(4, Math.round(rect.w * 0.012));
  ctx.save();
  if (rect.angle) {
    ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
    ctx.rotate((rect.angle * Math.PI) / 180);
    ctx.translate(-rect.w / 2, -rect.h / 2);
  } else {
    ctx.translate(rect.x, rect.y);
  }
  const w = rect.w;
  const h = rect.h;
  if (popOut) {
    ctx.shadowColor = 'rgba(10, 0, 20, 0.65)';
    ctx.shadowBlur = w * 0.06;
    ctx.shadowOffsetY = h * 0.02;
  }
  if (rect.polaroid) {
    // White snapshot frame with a caption strip at the foot.
    ctx.fillStyle = '#fdf8ef';
    roundRect(ctx, -w * 0.02, -h * 0.02, w * 1.04, h * 1.04 + h * 0.16, r);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }
  roundRect(ctx, 0, 0, w, h, r);
  ctx.clip();
  if (img) {
    const src = coverSourceRect(img, w, h, panel);
    ctx.filter = gradeFilter(grade, panel.warmth || 0);
    ctx.drawImage(img, src.sx, src.sy, src.sw, src.sh, 0, 0, w, h);
    ctx.filter = 'none';
    // Grade wash.
    if (grade === 'sunset') {
      const wash = ctx.createLinearGradient(0, 0, 0, h);
      wash.addColorStop(0, 'rgba(255, 190, 90, 0.05)');
      wash.addColorStop(1, 'rgba(255, 80, 140, 0.30)');
      ctx.globalCompositeOperation = 'soft-light';
      ctx.fillStyle = wash;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';
    } else if (grade === 'neon') {
      const wash = ctx.createLinearGradient(0, 0, w, h);
      wash.addColorStop(0, 'rgba(255, 0, 120, 0.20)');
      wash.addColorStop(1, 'rgba(0, 220, 255, 0.20)');
      ctx.globalCompositeOperation = 'overlay';
      ctx.fillStyle = wash;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';
    } else {
      ctx.fillStyle = 'rgba(16, 28, 52, 0.22)';
      ctx.fillRect(0, 0, w, h);
    }
  } else {
    ctx.fillStyle = '#241533';
    ctx.fillRect(0, 0, w, h);
  }
  // Role tag: dark pill, role in Bebas, place and time beneath it.
  const tagPad = Math.max(8, w * 0.03);
  const roleSize = clamp(Math.round(h * 0.075), 13, 44);
  const subSize = clamp(Math.round(h * 0.048), 10, 26);
  ctx.font = `${roleSize}px "Bebas Neue", sans-serif`;
  const roleW = ctx.measureText(panel.role || '').width;
  ctx.font = `${subSize}px "Bebas Neue", sans-serif`;
  const sub = `${panel.place || ''} · ${panel.time || ''}`.trim();
  const subW = ctx.measureText(sub).width;
  const tagW = Math.max(roleW, subW) + tagPad * 2;
  const tagH = roleSize + subSize + tagPad * 1.6;
  ctx.fillStyle = 'rgba(12, 4, 22, 0.82)';
  roundRect(ctx, tagPad, tagPad, tagW, tagH, Math.round(tagH * 0.28));
  ctx.fill();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffffff';
  ctx.font = `${roleSize}px "Bebas Neue", sans-serif`;
  ctx.fillText(panel.role || '', tagPad * 2, tagPad + roleSize * 0.95);
  ctx.fillStyle = '#ffd23f';
  ctx.font = `${subSize}px "Bebas Neue", sans-serif`;
  ctx.fillText(sub, tagPad * 2, tagPad + roleSize + subSize * 1.05);
  // Micro-caption: the story line along the foot of the panel.
  if (panel.micro) {
    const capH = Math.max(18, Math.round(h * 0.1));
    ctx.fillStyle = 'rgba(10, 2, 18, 0.6)';
    ctx.fillRect(0, h - capH, w, capH);
    const capSize = clamp(Math.round(capH * 0.42), 10, 24);
    ctx.fillStyle = '#ffeef7';
    ctx.font = `${capSize}px "Bebas Neue", sans-serif`;
    let text = panel.micro;
    while (ctx.measureText(text).width > w * 0.92 && text.length > 4) text = text.slice(0, -4);
    if (text !== panel.micro) text = `${text.trim()}…`;
    ctx.fillText(text, tagPad, h - capH / 2 + capSize * 0.36);
  }
  ctx.restore();
  // Pop-out hero: white keyline + a second pass of shadow is already in the clip.
  if (popOut) {
    ctx.save();
    ctx.strokeStyle = '#fdf8ef';
    ctx.lineWidth = Math.max(3, w * 0.008);
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, r);
    ctx.stroke();
    ctx.restore();
  }
  if (rect.polaroid && panel.micro) {
    // Caption written on the snapshot's white foot strip.
    ctx.save();
    ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
    ctx.rotate((rect.angle * Math.PI) / 180);
    ctx.translate(-rect.w / 2, -rect.h / 2);
    const capSize = clamp(Math.round(rect.h * 0.055), 11, 26);
    ctx.fillStyle = '#3a2b22';
    ctx.font = `${capSize}px "Pacifico", cursive`;
    ctx.textAlign = 'center';
    ctx.fillText(panel.micro, rect.w / 2, rect.h * 1.1);
    ctx.restore();
  }
}

/** The title block: stars + press quote + VOL badge, huge gradient title, script line. */
function drawTitleBlock(ctx, W, H, geo, state) {
  const { titleH, margin: m } = geo;
  const topY = m * 0.55;
  // Top bar: five stars left, press quote centre, VOL badge right.
  const starR = Math.max(7, titleH * 0.085);
  for (let i = 0; i < 5; i++) {
    drawStar(ctx, m + starR + i * starR * 2.3, topY + starR, starR, '#ffd23f');
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const quoteSize = clamp(Math.round(titleH * 0.15), 12, 30);
  ctx.fillStyle = '#ffe9f3';
  ctx.font = `${quoteSize}px "Bebas Neue", sans-serif`;
  ctx.fillText(`${state.quote} — ${state.quoteSource}`, W / 2, topY + starR);
  const volW = Math.max(64, W * 0.075);
  const volH = starR * 2;
  ctx.fillStyle = '#ff2e88';
  roundRect(ctx, W - m - volW, topY, volW, volH, volH * 0.3);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.round(volH * 0.52)}px system-ui, sans-serif`;
  ctx.fillText(state.vol, W - m - volW / 2, topY + volH / 2 + 1);
  // Huge gradient title with a thick dark outline.
  const title = (state.title || 'VERDE HEAT').toUpperCase();
  const maxW = W - 2 * m;
  const baseY = titleH * 0.66;
  let size = Math.round(titleH * 0.52);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  size = fitFont(ctx, title, (s) => `${s}px Anton, sans-serif`, maxW, size);
  try { ctx.letterSpacing = `${Math.round(size * 0.02)}px`; } catch { /* older canvas */ }
  const grad = ctx.createLinearGradient(0, baseY - size, 0, baseY + size * 0.15);
  grad.addColorStop(0, '#ffd23f');
  grad.addColorStop(0.38, '#ff7a18');
  grad.addColorStop(0.68, '#ff2e88');
  grad.addColorStop(1, '#7b2ff7');
  ctx.font = `${size}px Anton, sans-serif`;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#1a0b2e';
  ctx.lineWidth = Math.max(4, size * 0.085);
  ctx.shadowColor = 'rgba(10, 0, 20, 0.55)';
  ctx.shadowBlur = size * 0.12;
  ctx.shadowOffsetY = size * 0.03;
  ctx.strokeText(title, W / 2, baseY);
  ctx.fillStyle = grad;
  ctx.fillText(title, W / 2, baseY);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  try { ctx.letterSpacing = '0px'; } catch { /* older canvas */ }
  // Script subtitle under the title.
  if (state.subtitle) {
    const subSize = clamp(Math.round(titleH * 0.17), 14, 40);
    ctx.font = `${subSize}px Pacifico, cursive`;
    ctx.fillStyle = '#ffe9f3';
    ctx.shadowColor = 'rgba(10, 0, 20, 0.5)';
    ctx.shadowBlur = subSize * 0.2;
    ctx.fillText(state.subtitle, W / 2, titleH * 0.93);
    ctx.shadowBlur = 0;
  }
}

/** The foot band: seal, tagline, barcode. */
function drawFootBand(ctx, W, H, geo, state) {
  const { footH, margin: m } = geo;
  const y = H - footH - m * 0.4;
  // Seal: gold ring, star, two lines.
  const d = footH * 0.92;
  const cx = m + d / 2;
  const cy = y + footH / 2;
  ctx.save();
  ctx.strokeStyle = '#ffd23f';
  ctx.lineWidth = Math.max(2, d * 0.045);
  ctx.beginPath();
  ctx.arc(cx, cy, d / 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffd23f';
  drawStar(ctx, cx, cy - d * 0.2, d * 0.11, '#ffd23f');
  ctx.font = `${Math.max(8, Math.round(d * 0.13))}px "Bebas Neue", sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('ORIGINAL', cx, cy + d * 0.1);
  ctx.fillText('COVER ART', cx, cy + d * 0.28);
  ctx.restore();
  // Tagline centred between seal and barcode.
  const bcW = Math.max(90, W * 0.13);
  const tagSize = clamp(Math.round(footH * 0.4), 14, 40);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  const tag = state.tagline || '';
  const tagMax = W - (m + d + m) - bcW - m * 2;
  const fitted = fitFont(ctx, tag, (s) => `${s}px "Bebas Neue", sans-serif`, tagMax, tagSize);
  ctx.font = `${fitted}px "Bebas Neue", sans-serif`;
  try { ctx.letterSpacing = `${Math.round(fitted * 0.08)}px`; } catch { /* older canvas */ }
  ctx.fillText(tag, m + d + m + tagMax / 2, y + footH / 2);
  try { ctx.letterSpacing = '0px'; } catch { /* older canvas */ }
  // Barcode on a white strip, right side.
  const bx = W - m - bcW;
  const bh = footH * 0.78;
  const by = y + (footH - bh) / 2;
  ctx.fillStyle = '#fdf8ef';
  roundRect(ctx, bx, by, bcW, bh, 3);
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

let grainPattern = null;
/** Draws the whole cover. `photos` maps panel.photoIdx to an image (or null). */
export function drawCover(ctx, W, H, state, photos) {
  const geo = computeLayout(W, H, state.layout);
  // Sunset backdrop: the poster paper itself.
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#2a0e3f');
  bg.addColorStop(0.42, '#7a1e5c');
  bg.addColorStop(0.72, '#e84a7a');
  bg.addColorStop(1, '#ff9e4f');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  // Gold keyline frame.
  ctx.strokeStyle = 'rgba(255, 210, 120, 0.55)';
  ctx.lineWidth = Math.max(2, W * 0.002);
  ctx.strokeRect(geo.margin * 0.5, geo.margin * 0.5, W - geo.margin, H - geo.margin);
  drawTitleBlock(ctx, W, H, geo, state);
  // Panels: hero last when it pops out, so it overlaps its neighbours.
  const rects = geo.panels;
  const order = rects.map((r, i) => i);
  if (state.layout !== 'full-bleed') order.sort((a, b) => (rects[a].hero ? 1 : 0) - (rects[b].hero ? 1 : 0));
  for (const i of order) {
    const panel = state.panels[i];
    if (!panel) continue;
    const img = panel.photoIdx != null ? photos[panel.photoIdx] || null : null;
    drawPanel(ctx, img, rects[i], panel, state.grade, !!rects[i].hero, state.layout !== 'full-bleed' && !!rects[i].hero);
  }
  drawFootBand(ctx, W, H, geo, state);
  // Vignette + grain for the printed-poster finish.
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
  vg.addColorStop(0, 'rgba(20, 0, 30, 0)');
  vg.addColorStop(1, 'rgba(20, 0, 30, 0.32)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
  if (!grainPattern) {
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
    grainPattern = ctx.createPattern(n, 'repeat');
  }
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = grainPattern;
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';
  return geo;
}
