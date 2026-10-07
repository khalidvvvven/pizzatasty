// Demo food art: tacos-panini. See lib.mjs for helpers and build.mjs for the required ids.
// Front 3/4 view, light from the top-left. Every item is two diagonal-cut halves ("wedges")
// stacked so both cross-sections face the viewer:
//   wedge(c, o) draws one half: pillowy grilled top face (grill stripes, optional gratin / sugar)
//   + the cut face (tortilla rim with fillings, or pressed bread crumb with a filling band).
//   item(id, spec) stacks the bottom and top halves, casts the top half's shadow, adds the
//   ground shadow, sauce drips and (panini) melted strands stretching between the halves.
import { rng, between, blobPath, contactShadow, shadowFilter, grainFilter, svgDoc } from './lib.mjs';

const n0 = (v) => Math.round(v);
const r1 = (v) => Math.round(v * 10) / 10;
const nums = (a) => a.join(' ').replace(/ -/g, '-');
const fd = (v) => (Math.abs(v) >= 6 ? n0(v) : r1(v));
const int = (d) => d.replace(/-?\d+\.\d+/g, (m) => String(Math.round(+m)));

/* ------------------------------------------------------------------ geometry */

/** Catmull-Rom spline through points → compact relative cubic Bézier path. */
function smooth(pts, closed = true) {
  const n = pts.length;
  const g = (i) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  let cur = [n0(pts[0][0]), n0(pts[0][1])];
  const out = [];
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
    const c1 = [n0(p1[0] + (p2[0] - p0[0]) / 6), n0(p1[1] + (p2[1] - p0[1]) / 6)];
    const c2 = [n0(p2[0] - (p3[0] - p1[0]) / 6), n0(p2[1] - (p3[1] - p1[1]) / 6)];
    const e = [n0(p2[0]), n0(p2[1])];
    out.push(c1[0] - cur[0], c1[1] - cur[1], c2[0] - cur[0], c2[1] - cur[1], e[0] - cur[0], e[1] - cur[1]);
    cur = e;
  }
  return `M${n0(pts[0][0])} ${n0(pts[0][1])}c${nums(out)}${closed ? 'Z' : ''}`;
}

/** Smooth 1-D noise (sum of sines) → f(s) in ~[-1, 1]. */
function noise1(rand, octaves = 3, freq = 0.05) {
  const c = Array.from({ length: octaves }, (_, i) => ({ f: freq * 2 ** i * between(rand, 0.8, 1.25), p: rand() * 6.28, a: 1 / 1.7 ** i }));
  const tot = c.reduce((s, o) => s + o.a, 0);
  return (s) => c.reduce((v, o) => v + o.a * Math.sin(s * o.f + o.p), 0) / tot;
}

/** Points along P→Q bowed outward (away from `cen`) by `bul` px at the middle. */
function bow(P, Q, bul, cen, n = 7) {
  const dx = Q[0] - P[0], dy = Q[1] - P[1], l = Math.hypot(dx, dy);
  let nx = dy / l, ny = -dx / l;
  if ((P[0] + dx / 2 - cen[0]) * nx + (P[1] + dy / 2 - cen[1]) * ny < 0) { nx = -nx; ny = -ny; }
  return Array.from({ length: n - 1 }, (_, k) => { const t = (k + 1) / n, b = bul * Math.sin(Math.PI * t); return [P[0] + dx * t + nx * b, P[1] + dy * t + ny * b]; });
}

/** Closed cut-face outline: top edge yt(u), bottom edge yb(u), rounded end caps. u ∈ [-1, 1]. */
function outline(hw, yt, yb, capX, N = 14) {
  const top = [], bot = [];
  for (let k = 0; k <= N; k++) { const u = -1 + (2 * k) / N; top.push([u * hw, yt(u)]); bot.push([u * hw, yb(u)]); }
  return [[-hw - capX, (yt(-1) + yb(-1)) / 2], ...top, [hw + capX, (yt(1) + yb(1)) / 2], ...bot.reverse()];
}

/** Wedge geometry in local coords: origin = bottom-centre of the cut face, y down. */
function geo(o) {
  const hw = o.w / 2, h = o.h, taper = o.taper ?? 0.4;
  const yt = (u) => -h * (1 - taper + taper * Math.sqrt(Math.max(0, 1 - Math.abs(u) ** 3)));
  const yb = (u) => (o.bulge ?? 6) * (1 - u * u);
  const capX = h * (1 - taper) * 0.3;
  const A = [o.apexU * o.w, yt(0) - o.depth], L = [-hw - capX * 0.4, yt(-1) + 2], R = [hw + capX * 0.4, yt(1) + 2];
  const cen = [(L[0] + R[0] + A[0]) / 3, (L[1] + R[1] + A[1]) / 3];
  const front = [];
  for (let k = 13; k >= 1; k--) { const u = -1 + (2 * k) / 14; front.push([u * hw, yt(u) + 12]); }
  const a1 = bow(L, A, o.bow ?? 12, cen), a2 = bow(A, R, o.bow ?? 12, cen);
  // round the far corner a little: replace the apex by two points just before / after it
  const tip = (P, t) => [A[0] + (P[0] - A[0]) * t, A[1] + (P[1] - A[1]) * t];
  const topPts = [L, ...a1.slice(0, -1), tip(a1[a1.length - 1], 0.45), tip(a2[0], 0.45), ...a2.slice(1), R, ...front];
  return { hw, h, yt, yb, capX, A, L, R, cen, face: outline(hw, yt, yb, capX), topPts };
}

const tfOf = (o) => `translate(${n0(o.x)} ${n0(o.y)})${o.rot ? `rotate(${o.rot})` : ''}`;
const xf = (o, [x, y]) => { const a = ((o.rot || 0) * Math.PI) / 180; return [o.x + x * Math.cos(a) - y * Math.sin(a), o.y + x * Math.sin(a) + y * Math.cos(a)]; };

/** Dart-throwing placement in a (u, v) region of a face. */
function place(rand, P, { n, minD, u = [-0.9, 0.9], v = [0.1, 0.9], avoid = [] }) {
  const out = [];
  for (let t = 0; t < 3000 && out.length < n; t++) {
    const [x, y] = P(between(rand, u[0], u[1]), between(rand, v[0], v[1]));
    if ([...avoid, ...out].every((q) => (q[0] - x) ** 2 + (q[1] - y) ** 2 >= minD * minD)) out.push([x, y]);
  }
  return out;
}

/* ------------------------------------------------------------------ markup helpers */

/** Many short round-capped strokes in ONE path: cheap dots/capsules (texture, seeds, crumbs). */
const dots = (list, color, w, extra = '') =>
  list.length ? `<path d="${list.map(([x, y, dx = 0.4, dy = 0]) => `M${n0(x)} ${n0(y)}l${nums([fd(dx), fd(dy)])}`).join('')}" stroke="${color}" stroke-width="${w}" stroke-linecap="round" fill="none"${extra}/>` : '';

function defsFor(id) {
  const m = new Map();
  const add = (name, body) => { const key = `${id}-${name}`; if (!m.has(key)) m.set(key, body(key)); return key; };
  const stops = (s) => s.map(([o, c, op]) => `<stop offset="${o}" stop-color="${c}"${op != null && op !== 1 ? ` stop-opacity="${op}"` : ''}/>`).join('');
  const D = {
    add,
    lin: (name, s, v = [0, 0, 0, 1], user = false) =>
      `url(#${add(name, (k) => `<linearGradient id="${k}" x1="${v[0]}" y1="${v[1]}" x2="${v[2]}" y2="${v[3]}"${user ? ' gradientUnits="userSpaceOnUse"' : ''}>${stops(s)}</linearGradient>`)})`,
    rad: (name, s, { cx = 0.5, cy = 0.5, r = 0.5 } = {}) =>
      `url(#${add(name, (k) => `<radialGradient id="${k}" cx="${cx}" cy="${cy}" r="${r}">${stops(s)}</radialGradient>`)})`,
    shape: (name, d) => add(name, (k) => `<path id="${k}" d="${d}"/>`),
    /** clip from shapes; each item is a shape id or [shape id, transform]. */
    clip: (name, items) => `url(#${add(name, (k) => `<clipPath id="${k}">${items.map((s) => (Array.isArray(s) ? `<use href="#${s[0]}" transform="${s[1]}"/>` : `<use href="#${s}"/>`)).join('')}</clipPath>`)})`,
    grain: (name, opts) => `url(#${add(`${name}-grain`, () => grainFilter(`${id}-${name}`, opts))})`,
    blur: (sd) => `url(#${add(`blur${String(sd).replace('.', '')}`, (k) => `<filter id="${k}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${sd}"/></filter>`)})`,
    /** soft bevel from alpha: light rim top-left, shade bottom-right (chunks, slices, drips). */
    bevel: (name, { b = 2.5, o = 1.6, hi = 0.55, lo = 0.4 } = {}) => `url(#${add(`bev-${name}`, (k) =>
      `<filter id="${k}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur in="SourceAlpha" stdDeviation="${b}" result="b"/>` +
      `<feOffset in="b" dx="${o}" dy="${o}" result="b1"/><feComposite in="SourceAlpha" in2="b1" operator="arithmetic" k2="1" k3="-1" result="h"/><feFlood flood-color="#FFF7DE" flood-opacity="${hi}"/><feComposite in2="h" operator="in" result="hc"/>` +
      `<feOffset in="b" dx="${-o}" dy="${-o}" result="b2"/><feComposite in="SourceAlpha" in2="b2" operator="arithmetic" k2="1" k3="-1" result="l"/><feFlood flood-color="#3B1406" flood-opacity="${lo}"/><feComposite in2="l" operator="in" result="lc"/>` +
      `<feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="lc"/><feMergeNode in="hc"/></feMerge></filter>`)})`,
    str: () => [...m.values()].join(''),
  };
  return D;
}
const use = (s, fill, extra = '') => `<use href="#${s}" fill="${fill}"${extra}/>`;

/** Glossy specular streaks (white, round caps). */
const gloss = (list, w = 3, op = 0.8) => dots(list, '#FFFFFF', w, ` opacity="${op}"`);

/* ------------------------------------------------------------------ palettes */

const BREAD = {
  tortilla: { top: [[0, '#FDE7B0'], [0.35, '#F4C677'], [0.75, '#E1A052'], [1, '#C07A34']], stripe: '#5A2508', stripeW: 12, gap: 42, angle: -22, hi: '#FFEFC4', sheen: 0.3 },
  panini: { top: [[0, '#FEEFC6'], [0.35, '#F5D592'], [0.75, '#E2AE62'], [1, '#C58842']], stripe: '#4A1C06', stripeW: 13, gap: 36, angle: -32, hi: '#FFF4D2', sheen: 0.32 },
};

/* ------------------------------------------------------------------ top faces */

function grillStripes(D, G, b) {
  const a = (b.angle * Math.PI) / 180, dx = Math.cos(a), dy = Math.sin(a);
  let nx = -dy, ny = dx;
  if (nx + ny > 0) { nx = -nx; ny = -ny; } // normal toward the light (up-left)
  const span = G.hw * 1.5, lines = [], his = [];
  for (let t = -span; t <= span; t += b.gap) {
    const px = G.cen[0] + nx * t, py = G.cen[1] + ny * t;
    lines.push([px - dx * span, py - dy * span, 2 * dx * span, 2 * dy * span]);
    his.push([px - dx * span + nx * b.stripeW * 1.1, py - dy * span + ny * b.stripeW * 1.1, 2 * dx * span, 2 * dy * span]);
  }
  return dots(lines, '#A0521A', b.stripeW * 2.6, ` opacity=".3" filter="${D.blur(4)}"`) +
    dots(lines, b.stripe, b.stripeW, ` opacity=".82" filter="${D.blur(1.4)}"`) +
    dots(his, b.hi, 3, ' opacity=".4"');
}

/** Bubbly browned gratin cheese covering the top face, dripping over the front edge. */
function gratin(c, G, k) {
  const { D, rand } = c;
  const nz = noise1(rand, 3, 0.9);
  const inset = G.topPts.slice(0, -13).map(([x, y], i) => [x + (G.cen[0] - x) * 0.06 + nz(i) * 4, y + (G.cen[1] - y) * 0.08 + nz(i + 9) * 4]);
  const drips = Array.from({ length: 4 }, () => ({ u: between(rand, -0.8, 0.8), a: between(rand, 12, 30), w: between(rand, 0.05, 0.08) }));
  const front = [];
  for (let j = 15; j >= 1; j--) {
    const u = -0.96 + (1.92 * j) / 16;
    const d = drips.reduce((v, q) => v + q.a * Math.exp(-(((u - q.u) / q.w) ** 2)), 0);
    front.push([u * G.hw, G.yt(u) + 6 + d + nz(j * 3) * 2]);
  }
  const s = D.shape(`gr${k}`, smooth([...inset, ...front]));
  let svg = use(s, D.lin('grat', [[0, '#FFE58E'], [0.45, '#F7C24F'], [1, '#E4972E']]), ` filter="${D.bevel('grat', { b: 3, o: 2, hi: 0.7, lo: 0.35 })}"`);
  const P = () => { const u = between(rand, -0.85, 0.85), t = rand(); const y0 = G.yt(u), y1 = G.A[1] + (y0 - G.A[1]) * 0.15; return [u * G.hw * (0.35 + 0.65 * t) + G.A[0] * (1 - t) * 0.6, y1 + (y0 - y1) * t]; };
  let tex = '';
  // browned patches
  for (let j = 0; j < 14; j++) { const [x, y] = P(); tex += `<path d="${int(blobPath(rand, x, y, between(rand, 14, 32), { points: 6, wobble: 0.5 }))}" fill="${j % 3 ? '#C06422' : '#8E3E10'}" opacity=".7" filter="${D.blur(3.5)}"/>`; }
  const spots = Array.from({ length: 14 }, () => { const [x, y] = P(); return [x, y, between(rand, -3, 3), between(rand, -1, 1)]; });
  tex += dots(spots, '#8E4314', 6, ` opacity=".55" filter="${D.blur(1.2)}"`) + dots(spots.slice(0, 12), '#5E2A0C', 2.5, ' opacity=".6"');
  // bubbles: rim shadow, pale dome, white glint
  const bub = Array.from({ length: 13 }, () => { const [x, y] = P(); return [x, y, between(rand, 5, 10)]; });
  tex += `<g fill="#FCD467" stroke="#A85A1E" stroke-width="1.6" stroke-opacity=".5">${bub.map(([x, y, rr]) => `<ellipse cx="${n0(x)}" cy="${n0(y)}" rx="${n0(rr)}" ry="${n0(rr * 0.7)}"/>`).join('')}</g>` +
    gloss(bub.map(([x, y, rr]) => [x - rr * 0.4, y - rr * 0.3, rr * 0.3, 0]), 2.4, 0.85);
  svg += `<g clip-path="${D.clip(`grc${k}`, [s])}">${tex}</g>`;
  return svg;
}

function topFace(c, o, G, sTop) {
  const { D, rand } = c, b = BREAD[o.bread];
  let svg = use(sTop, D.rad(`top-${o.bread}`, b.top, { cx: 0.32, cy: 0.18, r: 0.95 }), ` filter="${D.grain(o.bread, { freq: 0.85, amount: 0.07 })}"`);
  const P = () => { const u = between(rand, -0.95, 0.95), t = Math.sqrt(rand()); return [u * G.hw * t + G.A[0] * (1 - t), G.A[1] + (G.yt(u) - G.A[1]) * t]; };
  let inner = '';
  // grill stripes, toasted freckles + flour / blistered spots (hidden under a gratin)
  if (!o.gratin) inner += grillStripes(D, G, b) + dots(Array.from({ length: 20 }, () => { const [x, y] = P(); return [x, y, between(rand, -2, 2), 0]; }), '#9A5420', 3, ' opacity=".35"');
  if (!o.gratin) inner += dots(Array.from({ length: 16 }, () => { const [x, y] = P(); return [x, y, between(rand, -3, 3), 0]; }), '#FFF3D2', 2.4, ' opacity=".45"');
  // pillow shading: dark rim inside the edge, sheen on the upper-left
  inner += use(sTop, 'none', ` stroke="#7A3A0E" stroke-width="20" stroke-opacity=".3" filter="${D.blur(7)}"`);
  const sx = (G.L[0] + G.A[0]) / 2 + G.hw * 0.12, sy = (G.L[1] + G.A[1]) / 2 + 6;
  inner += `<ellipse cx="${n0(sx)}" cy="${n0(sy)}" rx="${n0(G.hw * 0.42)}" ry="${n0(Math.abs(G.A[1] - G.L[1]) * 0.24 + 8)}" transform="rotate(-14 ${n0(sx)} ${n0(sy)})" fill="${D.rad('sheen', [[0, '#FFF6DA', b.sheen], [0.6, '#FFF6DA', b.sheen * 0.3], [1, '#FFF6DA', 0]])}"/>`;
  if (o.sugar) {
    const sug = Array.from({ length: 170 }, () => P());
    inner += dots(sug, '#FFFFFF', 2.4, ' opacity=".8"') + dots(sug.slice(0, 70).map(([x, y]) => [x + 9, y + 4]), '#FFFFFF', 4, ' opacity=".35"');
    inner += use(sTop, '#FFFDF6', ' opacity=".18"');
  }
  svg += `<g clip-path="${D.clip(`tc${o.k}`, [sTop])}">${inner}</g>`;
  return svg;
}

/* ------------------------------------------------------------------ fillings */

/** French fries as layered butt-capped strokes: shaded edge, body, browned end, highlight. */
function fries(rand, list, w = 15) {
  const edge = [], body = [], hl = [], tip = [];
  for (const { x, y, a, l } of list) {
    const ca = Math.cos(a), sa = Math.sin(a), dx = ca * l, dy = sa * l;
    let nx = -sa, ny = ca;
    if (nx + ny > 0) { nx = -nx; ny = -ny; }
    const x0 = x - dx / 2, y0 = y - dy / 2;
    edge.push([x0, y0, dx, dy]);
    body.push([x0 + nx * 1.6 + ca * 1.5, y0 + ny * 1.6 + sa * 1.5, dx - ca * 3, dy - sa * 3]);
    hl.push([x0 + nx * w * 0.32 + ca * 8, y0 + ny * w * 0.32 + sa * 8, dx * 0.6, dy * 0.6]);
    tip.push(rand() < 0.5 ? [x0, y0, ca * 8, sa * 8] : [x0 + dx, y0 + dy, -ca * 8, -sa * 8]);
  }
  const p = (l, col, ww, ex = '') => dots(l, col, ww, ex).replace('stroke-linecap="round"', 'stroke-linecap="butt"');
  return dots(edge.map(([x, y, dx, dy]) => [x + 2, y + 3, dx, dy]), '#6A2E08', w, ' opacity=".28"') +
    p(edge, '#D98A26', w) + p(body, '#FFD458', w * 0.72) + p(tip, '#A9581A', w, ' opacity=".35"') + p(hl, '#FFF3C2', 3, ' opacity=".9"');
}

/** Fries cut across: small rounded squares. */
const fryEnds = (D, list) => list.map(([x, y, s, a]) =>
  `<rect x="${n0(x - s / 2)}" y="${n0(y - s / 2)}" width="${n0(s)}" height="${n0(s)}" rx="3" transform="rotate(${n0(a)} ${n0(x)} ${n0(y)})" fill="#FCE6A4" stroke="#D99A3C" stroke-width="2.2"/>`).join('') +
  gloss(list.map(([x, y, s]) => [x - s * 0.25, y - s * 0.22, s * 0.3, 0]), 2.2, 0.8);

function chickenChunks(c, pts, [r0, r1_]) {
  const { D, rand } = c;
  const fill = D.rad('chick', [[0, '#FBD796'], [0.35, '#E9A957'], [0.75, '#C9792F'], [1, '#97501C']], { cx: 0.32, cy: 0.26, r: 0.8 });
  let svg = '';
  const sear = [], fib = [];
  for (const [x, y] of pts) {
    const rr = between(rand, r0, r1_);
    const nC = rand() < 0.5 ? 4 : 5, a0 = rand() * 6.28, poly = [];
    for (let j = 0; j < nC; j++) {
      const a = a0 + (j / nC) * 6.28 + between(rand, -0.25, 0.25), rad = rr * between(rand, 0.8, 1.15);
      poly.push([x + Math.cos(a - 0.22) * rad * 0.93, y + Math.sin(a - 0.22) * rad * 0.8], [x + Math.cos(a + 0.22) * rad * 0.93, y + Math.sin(a + 0.22) * rad * 0.8]);
    }
    svg += `<path d="${smooth(poly)}" fill="${fill}"/>`;
    sear.push([x + rr * 0.1, y + rr * 0.55, rr * 0.55, -rr * 0.2]);
    fib.push([x - rr * 0.55, y - rr * 0.15, rr * 0.7, -rr * 0.12], [x - rr * 0.4, y + rr * 0.15, rr * 0.55, -rr * 0.1]);
  }
  return `<g filter="${D.bevel('chunk', { hi: 0.75, lo: 0.45 })}">${svg}</g>` + dots(sear, '#A4521C', 3.4, ' opacity=".45"') + dots(fib, '#FFF4D4', 1.6, ' opacity=".6"');
}

function beefMince(c, pts, rr) {
  const { D, rand } = c;
  let base = '';
  const crumbs = [[], [], []];
  for (const [x, y] of pts) {
    base += `<path d="${int(blobPath(rand, x, y, rr * between(rand, 0.85, 1.15), { points: 6, wobble: 0.5 }))}" fill="#5A2810"/>`;
    for (let j = 0; j < 8; j++) {
      const a = rand() * 6.28, d = Math.sqrt(rand()) * rr;
      crumbs[j % 3].push([x + Math.cos(a) * d, y + Math.sin(a) * d * 0.85, between(rand, -1.5, 1.5), between(rand, -1, 1)]);
    }
  }
  return `<g filter="${D.bevel('beef', { hi: 0.35 })}">${base}</g>` + dots(crumbs[0], '#3A1606', 6.5) + dots(crumbs[1], '#7E3E1A', 5.5) + dots(crumbs[2].map(([x, y]) => [x - 1, y - 1.5]), '#B5713E', 2.6, ' opacity=".85"');
}

function merguez(c, pts, [ra, rb]) {
  const { D, rand } = c;
  const fill = D.rad('merg', [[0, '#D8673E'], [0.6, '#B23E1F'], [1, '#8A2812']], { cx: 0.4, cy: 0.36, r: 0.7 });
  let svg = '';
  const fat = [], spice = [], hl = [];
  for (const [x, y] of pts) {
    const rr = between(rand, ra, rb), ry = rr * between(rand, 0.82, 0.95);
    svg += `<ellipse cx="${n0(x)}" cy="${n0(y)}" rx="${n0(rr + 2.5)}" ry="${n0(ry + 2.5)}" fill="#5A160A"/><ellipse cx="${n0(x)}" cy="${n0(y)}" rx="${n0(rr)}" ry="${n0(ry)}" fill="${fill}"/>`;
    for (let j = 0; j < 5; j++) { const a = rand() * 6.28, d = Math.sqrt(rand()) * rr * 0.75; (j % 2 ? fat : spice).push([x + Math.cos(a) * d, y + Math.sin(a) * d * 0.9]); }
    hl.push([x - rr * 0.55, y - ry * 0.55, rr * 0.45, -ry * 0.12]);
  }
  return `<g filter="${D.bevel('merg', { hi: 0.4 })}">${svg}</g>` + dots(fat, '#F0A27A', 3, ' opacity=".85"') + dots(spice, '#5A140A', 2.4, ' opacity=".8"') + gloss(hl, 2.4, 0.7);
}

/** Glossy sauce ribbons across a face region. */
function sauceRibbons(c, P, n, col, hi) {
  const { rand } = c;
  let svg = '';
  for (let j = 0; j < n; j++) {
    const v = between(rand, 0.25, 0.8), u0 = between(rand, -0.9, 0.4), len = between(rand, 0.18, 0.4);
    const pts = Array.from({ length: 5 }, (_, q) => { const [x, y] = P(u0 + (len * q) / 4, v); return [x, y + between(rand, -8, 8)]; });
    const d = smooth(pts, false), w = between(rand, 14, 20);
    svg += `<path d="${d}" fill="none" stroke="${col}" stroke-width="${n0(w)}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${hi}" stroke-width="2.6" stroke-linecap="round" transform="translate(-1 -${n0(w * 0.25)})" opacity=".85"/>`;
  }
  return svg;
}

/** French tacos cross-section: creamy cheese sauce studded with fries and meats. */
function tacoFilling(c, o, I) {
  const { D, rand } = c;
  const P = (u, v) => [u * I.hw, I.yt(u) + (I.yb(u) - I.yt(u)) * v];
  let svg = '';
  const fr = [];
  for (let j = 0; j < o.fries; j++) { const [x, y] = P(between(rand, -0.9, 0.9), between(rand, 0.18, 0.88)); fr.push({ x, y, a: between(rand, -0.3, 0.3), l: between(rand, 60, 104) }); }
  svg += sauceRibbons(c, P, 1, '#FCC94A', '#FFF3C8');
  svg += fries(rand, fr, 20);
  const meatPts = place(rand, P, { n: o.meat.reduce((s, m) => s + m.n, 0), minD: o.meatGap ?? 34, u: [-0.94, 0.94], v: [0.18, 0.82] });
  let i0 = 0;
  for (const m of o.meat) {
    const pts = meatPts.slice(i0, i0 + m.n);
    i0 += m.n;
    if (m.t === 'chicken') svg += chickenChunks(c, pts, m.r);
    else if (m.t === 'beef') svg += beefMince(c, pts, m.r);
    else svg += merguez(c, pts, m.r);
  }
  svg += fryEnds(D, place(rand, P, { n: o.ends, minD: 26, avoid: meatPts, v: [0.2, 0.85] }).map(([x, y]) => [x, y, between(rand, 16, 20), between(rand, -20, 20)]));
  svg += sauceRibbons(c, P, o.ribbons ?? 2, '#FFD660', '#FFF8DC');
  return svg;
}

/** Pressed panini cross-section: airy crumb top and bottom, a filling band in the middle. */
function paniniFilling(c, o, G) {
  const { D, rand } = c;
  const nzT = noise1(rand, 3, 9), nzB = noise1(rand, 3, 9);
  const band = (u) => { const t = G.yt(u), b = G.yb(u), th = b - t; return [t + th * 0.27 + nzT(u) * 3, t + th * 0.77 + nzB(u) * 4]; };
  const pts = [];
  for (let j = 0; j <= 20; j++) { const u = -1.02 + (2.04 * j) / 20; pts.push([u * G.hw, band(u)[0]]); }
  for (let j = 20; j >= 0; j--) { const u = -1.02 + (2.04 * j) / 20; pts.push([u * G.hw, band(u)[1]]); }
  const sBand = D.shape(`band${o.k}`, smooth(pts));
  const yMid = G.yt(0) * 0.45;
  const P = (u, v) => { const [a, b] = band(u); return [u * G.hw, a + (b - a) * v]; };
  let svg = '';
  const F = o.fill;
  if (F === 'cheese' || F === 'poulet') {
    svg += use(sBand, D.lin('melt', [[0, '#FFF2C4'], [0.45, '#FCD565'], [1, '#EFA53A']], [0, n0(yMid - 18), 0, n0(yMid + 18)], true));
    if (F === 'cheese') {
      // three cheeses: white mozzarella ribbon, holey emmental, orange cheddar, all melting together
      const wave = (v, amp) => { const p = []; for (let j = 0; j <= 16; j++) { const u = -1 + j / 8; const [x, y] = P(u, v); p.push([x, y + Math.sin(u * 9 + v * 7) * amp]); } return smooth(p, false); };
      svg += `<path d="${wave(0.26, 2.5)}" fill="none" stroke="#FFFBEA" stroke-width="7" stroke-linecap="round" opacity=".95"/>` +
        `<path d="${wave(0.78, 3)}" fill="none" stroke="#F49A2E" stroke-width="7" stroke-linecap="round" opacity=".9"/>`;
      const holes = place(rand, P, { n: 8, minD: 40, v: [0.42, 0.6] });
      svg += holes.map(([x, y]) => `<ellipse cx="${n0(x)}" cy="${n0(y)}" rx="${n0(between(rand, 4, 7))}" ry="3.2" fill="#E3A33A"/>`).join('');
      svg += gloss(holes.map(([x, y]) => [x - 2, y + 2.2, 4, 0]), 1.6, 0.8);
    } else {
      // chicken slices and tomato rounds embedded in melted cheese
      const xs = Array.from({ length: 9 }, (_, j) => -0.9 + j * 0.225 + between(rand, -0.03, 0.03));
      const chick = D.lin('pchick', [[0, '#FCE2AE'], [0.45, '#EDB86C'], [1, '#C98038']]);
      const tom = D.lin('ptom', [[0, '#F7765A'], [0.5, '#E2422B'], [1, '#B42718']]);
      let ch = '', tm = '';
      const seeds = [], marks = [];
      xs.forEach((u, j) => {
        const [x, y] = P(u, 0.5), [, ya] = P(u, 0.08), [, yb] = P(u, 0.92), hh = (yb - ya) / 2, ww = G.hw * 0.1;
        if (j % 2 === 0) {
          ch += `<rect x="${n0(x - ww)}" y="${n0(y - hh)}" width="${n0(ww * 2)}" height="${n0(hh * 2)}" rx="${n0(hh * 0.8)}" fill="${chick}"/>`;
          marks.push([x - ww * 0.6, y - hh * 0.55, ww * 0.9, 0], [x - ww * 0.3, y + hh * 0.35, ww * 0.8, 0]);
        } else {
          tm += `<rect x="${n0(x - ww * 0.95)}" y="${n0(y - hh * 0.8)}" width="${n0(ww * 1.9)}" height="${n0(hh * 1.6)}" rx="${n0(hh * 0.75)}" fill="${tom}" stroke="#9E1C10" stroke-width="2"/>`;
          for (let q = -2; q <= 2; q++) seeds.push([x + q * ww * 0.32, y + (q % 2 ? 1.5 : -1.5)]);
        }
      });
      svg += `<g filter="${D.bevel('pslice', { b: 2, o: 1.2 })}">${ch}${tm}</g>` + dots(marks, '#B67A3C', 2.2, ' opacity=".55"') + dots(seeds, '#FFE9A0', 3.4) + dots(seeds.map(([x, y]) => [x, y]), '#C8961E', 1.2, ' opacity=".6"');
      svg += sauceRibbons(c, P, 2, '#FCD565', '#FFF8DA');
    }
    svg += gloss(Array.from({ length: 6 }, () => { const [x, y] = P(between(rand, -0.9, 0.7), 0.22); return [x, y, between(rand, 10, 22), 0]; }), 2.4, 0.75);
  } else {
    // chocolate & banana
    svg += use(sBand, D.lin('choc', [[0, '#7A4020'], [0.5, '#4E2412'], [1, '#2E1308']], [0, n0(yMid - 16), 0, n0(yMid + 16)], true));
    const bananas = Array.from({ length: 6 }, (_, j) => P(-0.8 + j * 0.32 + between(rand, -0.04, 0.04), between(rand, 0.44, 0.56)));
    const ban = D.rad('ban', [[0, '#FFF4C4'], [0.55, '#F8E294'], [0.85, '#EBC966'], [1, '#C9A044']], { cx: 0.42, cy: 0.38, r: 0.66 });
    const [, ya] = P(0, 0.05), [, yb] = P(0, 0.95), bh = (yb - ya) / 2;
    svg += `<g filter="${D.bevel('ban', { b: 2, o: 1.2, lo: 0.3 })}">${bananas.map(([x, y]) => `<ellipse cx="${n0(x)}" cy="${n0(y)}" rx="${n0(G.hw * 0.1)}" ry="${n0(bh * 0.9)}" fill="${ban}"/>`).join('')}</g>`;
    // seed ring: a soft caramel core with a halo of tiny seeds (no "face" read)
    svg += dots(bananas.map(([x, y]) => [x, y]), '#D9B460', 9, ' opacity=".55"') +
      dots(bananas.flatMap(([x, y]) => Array.from({ length: 6 }, (_, q) => [x + Math.cos(q * 1.047) * 5.5, y + Math.sin(q * 1.047) * 3.6])), '#8C6A2E', 1.6, ' opacity=".7"');
    // chocolate lapping over the slices' upper and lower edges
    const lap = (v, sgn) => { const p = []; for (let j = 0; j <= 24; j++) { const u = -1.02 + (2.04 * j) / 24; const [x, y] = P(u, v); p.push([x, y + sgn * 5 * Math.abs(Math.sin(u * 14))]); } return p; };
    const lt = lap(0.2, 1), lb = lap(0.82, -1);
    svg += `<path d="${smooth([...lt, ...lt.slice().reverse().map(([x, y]) => [x, y - 14])])}" fill="#5A2A14"/><path d="${smooth([...lb, ...lb.slice().reverse().map(([x, y]) => [x, y + 14])])}" fill="#3A1A0A"/>`;
    // chocolate swirls lapping over the banana slices
    svg += gloss(Array.from({ length: 7 }, () => { const [x, y] = P(between(rand, -0.95, 0.75), between(rand, 0.15, 0.3)); return [x, y, between(rand, 8, 18), 0]; }), 2.2, 0.55);
  }
  // shadow under the top crumb
  svg += `<g clip-path="${D.clip(`bandc${o.k}`, [sBand])}">${use(sBand, 'none', ` stroke="#3A1606" stroke-width="10" stroke-opacity=".35" transform="translate(0 4)" filter="${D.blur(3)}"`)}</g>`;
  return { svg, band, sBand };
}

/* ------------------------------------------------------------------ cut faces */

function cutFace(c, o, G, sFace) {
  const { D, rand } = c;
  let svg = '';
  if (o.bread === 'tortilla') {
    svg += use(sFace, D.lin('tort', [[0, '#B8732E'], [0.08, '#EFCB86'], [0.5, '#F4DCA6'], [1, '#CF9550']]), ` filter="${D.grain('tort', { freq: 1.1, amount: 0.12 })}"`) +
      use(sFace, 'none', ' stroke="#B97A36" stroke-width="2.4"');
    const ti = o.rim ?? 8;
    const I = { hw: G.hw - 2, yt: (u) => G.yt(u) + ti, yb: (u) => G.yb(u) - ti - 3 };
    const sIn = D.shape(`in${o.k}`, smooth(outline(I.hw, I.yt, I.yb, G.capX * 0.8)));
    const yA = G.yt(0), yB = 0;
    let inner = use(sIn, D.lin('sauce', [[0, '#FFEDB0'], [0.5, '#FCCF5A'], [1, '#EFA33A']], [0, n0(yA), 0, n0(yB)], true));
    inner += tacoFilling(c, o, I);
    inner += use(sIn, 'none', ` stroke="#4A1F06" stroke-width="16" stroke-opacity=".45" transform="translate(0 5)" filter="${D.blur(4)}"`);
    svg += `<g clip-path="${D.clip(`inc${o.k}`, [sIn])}">${inner}</g>`;
    // tortilla folds in the thicker bottom rim + crisp outer skin lines
    svg += `<path d="${smooth(Array.from({ length: 13 }, (_, j) => { const u = -0.92 + (1.84 * j) / 12; return [u * G.hw, G.yb(u) - 5]; }), false)}" fill="none" stroke="#C69050" stroke-width="1.6" opacity=".7"/>`;
    o._I = I;
  } else {
    svg += use(sFace, D.lin('crumb', [[0, '#F9EBC8'], [0.6, '#F3DCAA'], [1, '#E2BE7E']]), ` filter="${D.grain('crumb', { freq: 1.3, amount: 0.16 })}"`);
    // airy crumb holes
    const holes = [];
    for (let j = 0; j < 70; j++) { const u = between(rand, -0.97, 0.97), v = rand(); holes.push([u * G.hw, G.yt(u) + 5 + (G.yb(u) - G.yt(u) - 10) * v, between(rand, -3, 3), between(rand, -1, 1)]); }
    let inner = dots(holes, '#D4AE6C', 4.4, ' opacity=".55"') + dots(holes.map(([x, y, dx]) => [x, y + 2, dx, 0]), '#FFF8E2', 2, ' opacity=".6"');
    const pf = paniniFilling(c, o, G);
    inner += pf.svg;
    inner += use(sFace, 'none', ` stroke="#B47434" stroke-width="9"`);
    svg += `<g clip-path="${D.clip(`fc${o.k}`, [sFace])}">${inner}</g>`;
    o._band = pf.band;
  }
  // grilled outer skin on the top edge, catching the light just below it
  const topLine = Array.from({ length: 15 }, (_, j) => { const u = -1 + j / 7; return [u * G.hw, G.yt(u)]; });
  svg += `<path d="${smooth(topLine, false)}" fill="none" stroke="#8A4A1A" stroke-width="3.2" stroke-linecap="round"/>` +
    `<path d="${smooth(topLine.slice(1, 9).map(([x, y]) => [x, y + 3.5]), false)}" fill="none" stroke="#FFF1CC" stroke-width="1.8" stroke-linecap="round" opacity=".75"/>`;
  return svg;
}

/** Sauce / cheese / chocolate overflowing the lower rim of a face: a smooth bump narrowing into a drip. Local coords. */
function drips(c, o, G, yFrom, list, pal) {
  const { D } = c;
  let shapes = '';
  const glints = [];
  for (const { u, w, len } of list) {
    const x0 = u * G.hw, half = w * 1.8, rim = G.yb(u) + 1, tipR = w * 0.6, pts = [];
    const bottom = rim + len;
    for (let j = 0; j <= 8; j++) { const x = x0 - half + (2 * half * j) / 8; pts.push([x, yFrom(x / G.hw)]); }
    for (let j = 16; j >= 0; j--) {
      const x = x0 - half + (2 * half * j) / 16, t = (x - x0) / half, yf = yFrom(x / G.hw);
      const env = Math.max(0, Math.cos((Math.PI * Math.min(1, Math.abs(t))) / 2)) ** 2.5, g = Math.exp(-(((x - x0) / (w * 0.62)) ** 4));
      pts.push([x, yf + (G.yb(x / G.hw) + 1 - yf) * env + (bottom - tipR - rim) * g]);
    }
    shapes += smooth(pts) + `M${n0(x0 - tipR)} ${n0(bottom - tipR)}a${r1(tipR)} ${r1(tipR)} 0 1 0 ${r1(tipR * 2)} 0a${r1(tipR)} ${r1(tipR)} 0 1 0 ${r1(-tipR * 2)} 0Z`;
    if (o.pool && false) shapes += `M${n0(x0 - w * 2.2)} ${n0(bottom - 2)}a${r1(w * 2.2)} ${r1(tipR * 0.55)} 0 1 0 ${r1(w * 4.4)} 0a${r1(w * 2.2)} ${r1(tipR * 0.55)} 0 1 0 ${r1(-w * 4.4)} 0Z`;
    glints.push([x0 - tipR * 0.45, bottom - tipR * 1.3, 0.2, 2], [x0 - half * 0.4, rim - 3, half * 0.3, 1], [x0 - w * 0.3, rim + 4, 0, Math.max(0, len - tipR * 2.2)]);
  }
  return `<path d="${shapes}" fill="${D.lin(`drip-${pal.name}`, [[0, pal.c[0]], [0.5, pal.c[1]], [1, pal.c[2]]])}" filter="${D.bevel(`drip-${pal.name}`, { b: 2.4, o: 1.6, hi: pal.hi ?? 0.6, lo: 0.14 })}"/>` +
    dots(glints, pal.g ?? '#FFFFFF', 2.4, ` opacity="${pal.go ?? 0.85}"`);
}

/* ------------------------------------------------------------------ wedge + item */

function wedge(c, o) {
  const { D } = c;
  const G = geo(o);
  const sTop = D.shape(`top${o.k}`, smooth(G.topPts)), sFace = D.shape(`face${o.k}`, smooth(G.face));
  let svg = topFace(c, o, G, sTop) + cutFace(c, o, G, sFace) + (o.gratin ? gratin(c, G, o.k) : '');
  if (o.drips) {
    const yFrom = o.bread === 'tortilla' ? (u) => G.yb(u) - (o.rim ?? 8) - 10 : (u) => o._band(Math.max(-1, Math.min(1, u)))[1] - 5;
    svg += drips(c, o, G, yFrom, o.drips, o.dripPal);
  }
  return { svg: `<g transform="${tfOf(o)}">${svg}</g>`, G, sTop, sFace };
}

function ground(id, D, cx, cy, rx) {
  D.add('shadow', () => shadowFilter(id, 16));
  return contactShadow(id, { cx: cx + 10, cy, rx, ry: 30, opacity: 0.34 }) +
    `<ellipse cx="${n0(cx + 6)}" cy="${n0(cy - 8)}" rx="${n0(rx * 0.82)}" ry="10" fill="#3a1f10" opacity=".32" filter="${D.blur(7)}"/>`;
}

/** Melted strands stretching from the top half's filling down to the bottom half's. Absolute coords. */
function strands(c, list, pal) {
  const { D, rand } = c;
  const fill = D.lin(`str-${pal.name}`, [[0, pal.c[0]], [0.5, pal.c[1]], [1, pal.c[2]]], [0, 0, 1, 0]);
  let d = '', hl = '';
  for (const [a, b, wa, wb] of list) {
    const sway = between(rand, -14, 14), wm = Math.min(wa, wb) * 0.32;
    const m = [(a[0] + b[0]) / 2 + sway, a[1] + (b[1] - a[1]) * 0.58];
    d += `M${n0(a[0] - wa)} ${n0(a[1] - 2)}C${n0(a[0] - wa * 0.5)} ${n0(a[1] + 12)} ${n0(m[0] - wm)} ${n0(m[1] - 14)} ${n0(m[0] - wm)} ${n0(m[1])}S${n0(b[0] - wb * 0.6)} ${n0(b[1] - 10)} ${n0(b[0] - wb)} ${n0(b[1] + 2)}` +
      `L${n0(b[0] + wb)} ${n0(b[1] + 2)}C${n0(b[0] + wb * 0.5)} ${n0(b[1] - 10)} ${n0(m[0] + wm)} ${n0(m[1] + 14)} ${n0(m[0] + wm)} ${n0(m[1])}S${n0(a[0] + wa * 0.6)} ${n0(a[1] + 12)} ${n0(a[0] + wa)} ${n0(a[1] - 2)}Z`;
    hl += `M${n0(a[0] - wa * 0.4)} ${n0(a[1] + 6)}Q${n0(m[0] - wm * 0.3)} ${n0(m[1] - 10)} ${n0(m[0] - wm * 0.4)} ${n0(m[1] + 8)}`;
  }
  return `<path d="${d}" fill="${fill}" filter="${D.bevel('str', { b: 1.6, o: 1, hi: 0.6, lo: 0.2 })}"/><path d="${hl}" fill="none" stroke="#FFFBEA" stroke-width="1.8" stroke-linecap="round" opacity=".8"/>`;
}

const PAL = {
  sauce: { name: 'sauce', c: ['#FFE38A', '#F9C143', '#E8982C'] },
  cheese: { name: 'cheese', c: ['#FFF0B8', '#FCD064', '#EFA53A'] },
  choc: { name: 'choc', c: ['#6E3A1C', '#55280F', '#3A1A0A'], g: '#E8B48C', go: 0.7, hi: 0.22 },
};

function item(id, spec) {
  const rand = rng(id), D = defsFor(id), c = { id, D, rand };
  const b = { ...spec.base, ...spec.bottom, k: 'b' }, t = { ...spec.base, ...spec.top, k: 't' };
  let body = ground(id, D, b.x, b.y + 14, b.w * 0.56);
  const wb = wedge(c, b);
  body += wb.svg;
  // top half: soft shadow cast on the bottom half's top face, then the half itself
  const wt = wedge(c, t);
  const shadowTf = `translate(${n0(t.x + 8)} ${n0(t.y + 16)})${t.rot ? `rotate(${t.rot})` : ''}`;
  body += `<g clip-path="${D.clip('cast', [[wb.sTop, tfOf(b)]])}" opacity=".55"><g transform="${shadowTf}" filter="${D.blur(9)}"><use href="#${wt.sTop}" fill="#3a1606"/><use href="#${wt.sFace}" fill="#3a1606"/></g></g>`;
  body += wt.svg;
  if (spec.strands) {
    const pairs = spec.strands.map(([ut, ub, wa, wbb]) => {
      const a = xf(t, [ut * wt.G.hw, t._band(ut)[1] - 3]), bb = xf(b, [ub * wb.G.hw, b._band(ub)[0] + 3]);
      return [a, bb, wa, wbb];
    });
    body += strands(c, pairs, spec.strandPal);
  }
  return svgDoc({ defs: D.str(), body });
}

/* ------------------------------------------------------------------ menu */

const TACO = { bread: 'tortilla', taper: 0.42, bulge: 6, bow: 14, rim: 6 };
const PANINI = { bread: 'panini', taper: 0.3, bulge: 4, bow: 9 };

export const art = {
  'tacos-classique': () => item('tacos-classique', {
    base: { ...TACO, fries: 13, ends: 5, meatGap: 40, meat: [{ t: 'chicken', n: 12, r: [21, 28] }], dripPal: PAL.sauce },
    bottom: { x: 386, y: 604, w: 570, h: 150, depth: 104, apexU: 0.18, drips: [{ u: -0.42, w: 11, len: 2 }, { u: 0.3, w: 13, len: 6 }] },
    top: { x: 420, y: 420, w: 548, h: 144, depth: 98, apexU: -0.12, rot: -4, drips: [{ u: -0.5, w: 12, len: 22 }, { u: 0.12, w: 15, len: 30 }, { u: 0.62, w: 10, len: 14 }] },
  }),
  'tacos-gratine': () => item('tacos-gratine', {
    base: { ...TACO, gratin: true, fries: 13, ends: 5, meatGap: 40, meat: [{ t: 'chicken', n: 12, r: [21, 28] }], dripPal: PAL.sauce },
    bottom: { x: 386, y: 604, w: 570, h: 150, depth: 104, apexU: 0.18, drips: [{ u: 0.36, w: 14, len: 12 }] },
    top: { x: 420, y: 420, w: 548, h: 144, depth: 98, apexU: -0.12, rot: -4, drips: [{ u: -0.44, w: 12, len: 24 }, { u: 0.4, w: 13, len: 22 }] },
  }),
  'tacos-xl': () => item('tacos-xl', {
    base: { ...TACO, fries: 12, ends: 3, meatGap: 40, meat: [{ t: 'chicken', n: 6, r: [21, 26] }, { t: 'beef', n: 6, r: 22 }, { t: 'merguez', n: 7, r: [17, 20] }], dripPal: PAL.sauce },
    bottom: { x: 384, y: 612, w: 612, h: 164, depth: 106, apexU: 0.18, drips: [{ u: -0.3, w: 14, len: 10 }, { u: 0.45, w: 12, len: 10 }] },
    top: { x: 428, y: 420, w: 580, h: 154, depth: 98, apexU: -0.16, rot: -8, drips: [{ u: -0.2, w: 15, len: 30 }, { u: 0.5, w: 11, len: 18 }] },
  }),
  'panini-trois-fromages': () => item('panini-trois-fromages', {
    base: { ...PANINI, fill: 'cheese', dripPal: PAL.cheese },
    bottom: { x: 388, y: 590, w: 600, h: 112, depth: 112, apexU: 0.16, drips: [{ u: -0.55, w: 10, len: 12 }, { u: 0.1, w: 12, len: 14 }, { u: 0.62, w: 9, len: 10 }] },
    top: { x: 414, y: 424, w: 576, h: 106, depth: 104, apexU: -0.12, rot: -3, drips: [] },
    strands: [[-0.7, -0.74, 8, 10], [-0.38, -0.36, 10, 12], [-0.05, -0.02, 7, 9], [0.27, 0.3, 11, 13], [0.6, 0.64, 7, 9]],
    strandPal: PAL.cheese,
  }),
  'panini-poulet': () => item('panini-poulet', {
    base: { ...PANINI, fill: 'poulet', dripPal: PAL.cheese },
    bottom: { x: 388, y: 590, w: 600, h: 116, depth: 112, apexU: 0.16, drips: [{ u: -0.36, w: 10, len: 12 }, { u: 0.52, w: 11, len: 12 }] },
    top: { x: 414, y: 430, w: 576, h: 100, depth: 112, apexU: -0.12, rot: -3, drips: [{ u: 0.06, w: 10, len: 20 }] },
  }),
  'panini-choco': () => item('panini-choco', {
    base: { ...PANINI, fill: 'choc', sugar: true, dripPal: PAL.choc },
    bottom: { x: 388, y: 590, w: 600, h: 112, depth: 112, apexU: 0.16, drips: [{ u: -0.48, w: 10, len: 12 }, { u: 0.28, w: 11, len: 14 }] },
    top: { x: 414, y: 430, w: 576, h: 106, depth: 104, apexU: -0.12, rot: -3, drips: [{ u: -0.1, w: 10, len: 22 }, { u: 0.55, w: 9, len: 14 }] },
  }),
};
