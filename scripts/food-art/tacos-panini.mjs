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
  list.length ? `<path d="${list.map(([x, y, dx = 0.4, dy = 0]) => `M${n0(x)} ${n0(y)}l${nums([r1(dx), r1(dy)])}`).join('')}" stroke="${color}" stroke-width="${w}" stroke-linecap="round" fill="none"${extra}/>` : '';

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
  tortilla: { top: [[0, '#F9DDA0'], [0.4, '#EBB86A'], [0.8, '#CC8A3E'], [1, '#A9652A']], stripe: '#4E2309', stripeW: 11, gap: 40, angle: -24, hi: '#FFEAB8', sheen: 0.4 },
  panini: { top: [[0, '#FBE6B4'], [0.4, '#EDC780'], [0.8, '#D39A50'], [1, '#AE6E32']], stripe: '#40190A', stripeW: 12, gap: 34, angle: -34, hi: '#FFF1C8', sheen: 0.45 },
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
  return dots(lines, '#7A3A12', b.stripeW * 2.4, ` opacity=".22" filter="${D.blur(4)}"`) +
    dots(lines, b.stripe, b.stripeW, ` opacity=".82" filter="${D.blur(1.4)}"`) +
    dots(lines, '#2A0E03', b.stripeW * 0.35, ' opacity=".35"') +
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
  for (let j = 0; j < 9; j++) { const [x, y] = P(); tex += `<path d="${int(blobPath(rand, x, y, between(rand, 14, 30), { points: 7, wobble: 0.5 }))}" fill="#C0702A" opacity=".5" filter="${D.blur(3)}"/>`; }
  const spots = Array.from({ length: 26 }, () => { const [x, y] = P(); return [x, y, between(rand, -3, 3), between(rand, -1, 1)]; });
  tex += dots(spots, '#8E4314', 6, ` opacity=".55" filter="${D.blur(1.2)}"`) + dots(spots.slice(0, 12), '#5E2A0C', 2.5, ' opacity=".6"');
  // bubbles: rim shadow, pale dome, white glint
  const bub = Array.from({ length: 30 }, () => { const [x, y] = P(); return [x, y, between(rand, 3, 7)]; });
  tex += bub.map(([x, y, rr]) => `<circle cx="${n0(x)}" cy="${n0(y)}" r="${r1(rr)}" fill="#FFE9A6" stroke="#B8662A" stroke-width="1.4" stroke-opacity=".55"/>`).join('') +
    gloss(bub.map(([x, y, rr]) => [x - rr * 0.35, y - rr * 0.4, 0.3, 0]), 2.4, 0.9);
  svg += `<g clip-path="${D.clip(`grc${k}`, [s])}">${tex}</g>`;
  return svg;
}

function topFace(c, o, G, sTop) {
  const { D, rand } = c, b = BREAD[o.bread];
  let svg = use(sTop, D.rad(`top-${o.bread}`, b.top, { cx: 0.32, cy: 0.18, r: 0.95 }), ` filter="${D.grain(o.bread, { freq: 0.85, amount: 0.14 })}"`);
  let inner = grillStripes(D, G, b);
  // toasted freckles + flour / blistered spots
  const P = () => { const u = between(rand, -0.95, 0.95), t = Math.sqrt(rand()); return [u * G.hw * t + G.A[0] * (1 - t), G.A[1] + (G.yt(u) - G.A[1]) * t]; };
  inner += dots(Array.from({ length: 34 }, () => { const [x, y] = P(); return [x, y, between(rand, -2, 2), 0]; }), '#9A5420', 3, ' opacity=".35"');
  inner += dots(Array.from({ length: 26 }, () => { const [x, y] = P(); return [x, y, between(rand, -3, 3), 0]; }), '#FFF3D2', 2.4, ' opacity=".45"');
  // pillow shading: dark rim inside the edge, sheen on the upper-left
  inner += use(sTop, 'none', ` stroke="#4A1F06" stroke-width="22" stroke-opacity=".38" filter="${D.blur(7)}"`);
  const sx = (G.L[0] + G.A[0]) / 2 + G.hw * 0.12, sy = (G.L[1] + G.A[1]) / 2 + 6;
  inner += `<ellipse cx="${n0(sx)}" cy="${n0(sy)}" rx="${n0(G.hw * 0.42)}" ry="${n0(Math.abs(G.A[1] - G.L[1]) * 0.24 + 8)}" transform="rotate(-14 ${n0(sx)} ${n0(sy)})" fill="${D.rad('sheen', [[0, '#fff', b.sheen], [0.6, '#fff', b.sheen * 0.3], [1, '#fff', 0]])}"/>`;
  if (o.sugar) {
    const sug = Array.from({ length: 260 }, () => P());
    inner += dots(sug, '#FFFFFF', 2.2, ' opacity=".75"') + dots(sug.slice(0, 120).map(([x, y]) => [x + 7, y + 3]), '#FFFFFF', 3.4, ' opacity=".35"');
    inner += use(sTop, '#FFFDF6', ' opacity=".18"');
  }
  svg += `<g clip-path="${D.clip(`tc${o.k}`, [sTop])}">${inner}</g>`;
  if (o.gratin) svg += gratin(c, G, o.k);
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
    p(edge, '#D08F34', w) + p(body, '#FBD36A', w * 0.72) + p(tip, '#A9581A', w, ' opacity=".35"') + p(hl, '#FFF3C2', 3, ' opacity=".9"');
}

/** Fries cut across: small rounded squares. */
const fryEnds = (D, list) => list.map(([x, y, s, a]) =>
  `<rect x="${n0(x - s / 2)}" y="${n0(y - s / 2)}" width="${n0(s)}" height="${n0(s)}" rx="3" transform="rotate(${n0(a)} ${n0(x)} ${n0(y)})" fill="#FCE6A4" stroke="#D99A3C" stroke-width="2.2"/>`).join('') +
  gloss(list.map(([x, y, s]) => [x - s * 0.25, y - s * 0.22, s * 0.3, 0]), 2.2, 0.8);

function chickenChunks(c, pts, [r0, r1_]) {
  const { D, rand } = c;
  const fill = D.rad('chick', [[0, '#FCE3AC'], [0.45, '#EDB868'], [0.82, '#C9813A'], [1, '#9C5726']], { cx: 0.36, cy: 0.3, r: 0.75 });
  let svg = '';
  const sear = [], fib = [];
  for (const [x, y] of pts) {
    const rr = between(rand, r0, r1_);
    const d = int(blobPath(rand, x, y, rr, { points: 7, wobble: 0.34 }));
    svg += `<path d="${d}" fill="${fill}"/>`;
    for (let j = 0; j < 3; j++) sear.push([x + between(rand, -rr, rr * 0.7), y + between(rand, -rr * 0.3, rr * 0.6), between(rand, -6, 6), between(rand, -1.5, 1.5)]);
    for (let j = 0; j < 2; j++) fib.push([x + between(rand, -rr * 0.6, rr * 0.2), y + between(rand, -rr * 0.5, rr * 0.3), between(rand, 6, 11), between(rand, -2, 2)]);
  }
  return `<g filter="${D.bevel('chunk')}">${svg}</g>` + dots(sear, '#9A5020', 4, ' opacity=".55"') + dots(fib, '#FFF1CC', 1.6, ' opacity=".7"');
}

function beefMince(c, pts, rr) {
  const { D, rand } = c;
  let base = '';
  const crumbs = [[], [], []];
  for (const [x, y] of pts) {
    base += `<path d="${int(blobPath(rand, x, y, rr * between(rand, 0.85, 1.15), { points: 8, wobble: 0.5 }))}" fill="#5A2810"/>`;
    for (let j = 0; j < 12; j++) {
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
    const v = between(rand, 0.2, 0.85), u0 = between(rand, -0.95, 0.2), len = between(rand, 0.35, 0.8);
    const pts = Array.from({ length: 5 }, (_, q) => { const [x, y] = P(u0 + (len * q) / 4, v); return [x, y + between(rand, -6, 6)]; });
    const d = smooth(pts, false), w = between(rand, 8, 13);
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
  for (let j = 0; j < o.fries; j++) { const [x, y] = P(between(rand, -0.9, 0.9), between(rand, 0.18, 0.88)); fr.push({ x, y, a: between(rand, -0.32, 0.32), l: between(rand, 44, 80) }); }
  svg += fries(rand, fr, 15);
  const meatPts = place(rand, P, { n: o.meat.reduce((s, m) => s + m.n, 0), minD: o.meatGap ?? 34, u: [-0.94, 0.94], v: [0.18, 0.82] });
  let i0 = 0;
  for (const m of o.meat) {
    const pts = meatPts.slice(i0, i0 + m.n);
    i0 += m.n;
    if (m.t === 'chicken') svg += chickenChunks(c, pts, m.r);
    else if (m.t === 'beef') svg += beefMince(c, pts, m.r);
    else svg += merguez(c, pts, m.r);
  }
  svg += fryEnds(D, place(rand, P, { n: o.ends, minD: 26, avoid: meatPts, v: [0.2, 0.85] }).map(([x, y]) => [x, y, between(rand, 12, 15), between(rand, -20, 20)]));
  svg += sauceRibbons(c, P, o.ribbons ?? 4, '#FFD15A', '#FFF6D2');
  return svg;
}

/** Pressed panini cross-section: airy crumb top and bottom, a filling band in the middle. */
function paniniFilling(c, o, G) {
  const { D, rand } = c;
  const nzT = noise1(rand, 3, 9), nzB = noise1(rand, 3, 9);
  const band = (u) => { const t = G.yt(u), b = G.yb(u), th = b - t; return [t + th * 0.36 + nzT(u) * 3, t + th * 0.74 + nzB(u) * 4]; };
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
      const chick = D.lin('pchick', [[0, '#FBE8C4'], [0.55, '#EECB92'], [1, '#C98E4E']]);
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
    const bananas = Array.from({ length: 8 }, (_, j) => P(-0.86 + j * 0.245 + between(rand, -0.03, 0.03), between(rand, 0.42, 0.58)));
    const ban = D.rad('ban', [[0, '#FFF8D6'], [0.6, '#F7E7A6'], [1, '#E2C46E']], { cx: 0.4, cy: 0.35, r: 0.7 });
    const [, ya] = P(0, 0.05), [, yb] = P(0, 0.95), bh = (yb - ya) / 2;
    svg += `<g filter="${D.bevel('ban', { b: 2, o: 1.2, lo: 0.3 })}">${bananas.map(([x, y]) => `<ellipse cx="${n0(x)}" cy="${n0(y)}" rx="${n0(G.hw * 0.075)}" ry="${n0(bh * 0.92)}" fill="${ban}"/>`).join('')}</g>`;
    svg += dots(bananas.flatMap(([x, y]) => [[x - 4, y - 2], [x + 3, y - 3], [x, y + 3]]), '#9C7A3A', 2.4, ' opacity=".8"');
    // chocolate swirls lapping over the banana slices
    svg += sauceRibbons(c, (u, v) => P(u, v < 0.5 ? 0.12 : 0.9), 3, '#4A2212', '#C98A60');
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
    svg += use(sFace, D.lin('tort', [[0, '#C98A44'], [0.12, '#F6E1B0'], [0.7, '#F1D7A0'], [1, '#D7A762']]), ` filter="${D.grain('tort', { freq: 1.1, amount: 0.12 })}"`);
    const ti = o.rim ?? 8;
    const I = { hw: G.hw - 6, yt: (u) => G.yt(u) + ti, yb: (u) => G.yb(u) - ti - 4 };
    const sIn = D.shape(`in${o.k}`, smooth(outline(I.hw, I.yt, I.yb, G.capX * 0.55)));
    const yA = G.yt(0), yB = 0;
    let inner = use(sIn, D.lin('sauce', [[0, '#FFE592'], [0.55, '#F9C244'], [1, '#E2952A']], [0, n0(yA), 0, n0(yB)], true));
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

/** Sauce / cheese / chocolate drips running from a face down over its rim. Local coords. */
function drips(c, o, G, yFrom, list, pal) {
  const { D } = c;
  let svg = '';
  for (const { u, w, len } of list) {
    const x0 = u * G.hw, top = yFrom(u) - 3, pts = [];
    const bottom = G.yb(u) + len;
    for (let j = 0; j <= 10; j++) { const x = x0 - w * 1.8 + (w * 3.6 * j) / 10; pts.push([x, top]); }
    for (let j = 10; j >= 0; j--) {
      const x = x0 - w * 1.8 + (w * 3.6 * j) / 10, g = Math.exp(-(((x - x0) / (w * 0.75)) ** 2));
      pts.push([x, top + (bottom - top) * g ** 0.6 + 2]);
    }
    const tipR = w * 0.62;
    const d = smooth(pts) + `M${n0(x0 - tipR)} ${n0(bottom - tipR * 0.4)}a${r1(tipR)} ${r1(tipR)} 0 1 0 ${r1(tipR * 2)} 0a${r1(tipR)} ${r1(tipR)} 0 1 0 ${r1(-tipR * 2)} 0Z`;
    svg += `<path d="${d}" fill="${D.lin(`drip-${pal.name}`, [[0, pal.c[0]], [0.5, pal.c[1]], [1, pal.c[2]]])}" filter="${D.bevel(`drip-${pal.name}`, { b: 2.4, o: 1.6, hi: 0.75, lo: 0.3 })}"/>`;
    svg += gloss([[x0 - tipR * 0.4, bottom - tipR * 0.75, 0.2, 2], [x0 - w * 0.35, top + 6, 0, Math.max(0, (bottom - top) * 0.45)]], 2.4, 0.85);
  }
  return svg;
}

/* ------------------------------------------------------------------ wedge + item */

function wedge(c, o) {
  const { D } = c;
  const G = geo(o);
  const sTop = D.shape(`top${o.k}`, smooth(G.topPts)), sFace = D.shape(`face${o.k}`, smooth(G.face));
  let svg = topFace(c, o, G, sTop) + cutFace(c, o, G, sFace);
  if (o.drips) {
    const yFrom = o.bread === 'tortilla' ? (u) => G.yb(u) - (o.rim ?? 8) - 12 : (u) => o._band(u)[1] - 4;
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
  const { D } = c;
  return list.map(([a, b, wa, wb]) => {
    const mx = (a[0] + b[0]) / 2 + 4, my = (a[1] + b[1]) / 2, wm = Math.min(wa, wb) * 0.28;
    const L = [[a[0] - wa, a[1]], [mx - wm, my], [b[0] - wb, b[1]]], R = [[b[0] + wb, b[1]], [mx + wm, my + 2], [a[0] + wa, a[1]]];
    const d = `M${n0(L[0][0])} ${n0(L[0][1])}Q${n0(L[1][0])} ${n0(L[1][1])} ${n0(L[2][0])} ${n0(L[2][1])}L${n0(R[0][0])} ${n0(R[0][1])}Q${n0(R[1][0])} ${n0(R[1][1])} ${n0(R[2][0])} ${n0(R[2][1])}Z`;
    return `<path d="${d}" fill="${D.lin(`str-${pal.name}`, [[0, pal.c[0]], [0.5, pal.c[1]], [1, pal.c[2]]], [0, 0, 1, 0])}"/>` +
      `<path d="M${n0(a[0] - wa * 0.45)} ${n0(a[1] + 4)}Q${n0(mx - wm * 0.4)} ${n0(my)} ${n0(b[0] - wb * 0.5)} ${n0(b[1] - 6)}" fill="none" stroke="#FFFBEA" stroke-width="1.8" opacity=".8"/>`;
  }).join('');
}

const PAL = {
  sauce: { name: 'sauce', c: ['#FFE38A', '#F9C143', '#E8982C'] },
  cheese: { name: 'cheese', c: ['#FFF0B8', '#FCD064', '#EFA53A'] },
  choc: { name: 'choc', c: ['#6E3A1C', '#4A2212', '#2C1208'] },
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

const TACO = { bread: 'tortilla', taper: 0.42, bulge: 6, bow: 14, rim: 8 };
const PANINI = { bread: 'panini', taper: 0.3, bulge: 4, bow: 9 };

export const art = {
  'tacos-classique': () => item('tacos-classique', {
    base: { ...TACO, fries: 9, ends: 5, meat: [{ t: 'chicken', n: 11, r: [13, 19] }], dripPal: PAL.sauce },
    bottom: { x: 386, y: 588, w: 560, h: 108, depth: 126, apexU: 0.18, drips: [{ u: -0.42, w: 10, len: 14 }, { u: 0.3, w: 12, len: 20 }] },
    top: { x: 420, y: 448, w: 536, h: 104, depth: 118, apexU: -0.12, rot: -4, drips: [{ u: -0.5, w: 11, len: 22 }, { u: 0.12, w: 13, len: 30 }, { u: 0.62, w: 9, len: 14 }] },
  }),
  'tacos-gratine': () => item('tacos-gratine', {
    base: { ...TACO, gratin: true, fries: 9, ends: 5, meat: [{ t: 'chicken', n: 11, r: [13, 19] }], dripPal: PAL.sauce },
    bottom: { x: 386, y: 588, w: 560, h: 108, depth: 126, apexU: 0.18, drips: [{ u: 0.36, w: 12, len: 20 }] },
    top: { x: 420, y: 448, w: 536, h: 104, depth: 118, apexU: -0.12, rot: -4, drips: [{ u: -0.44, w: 11, len: 24 }, { u: 0.4, w: 12, len: 22 }] },
  }),
  'tacos-xl': () => item('tacos-xl', {
    base: { ...TACO, fries: 9, ends: 4, meatGap: 30, meat: [{ t: 'chicken', n: 6, r: [13, 18] }, { t: 'beef', n: 5, r: 15 }, { t: 'merguez', n: 6, r: [12, 15] }], dripPal: PAL.sauce },
    bottom: { x: 384, y: 596, w: 600, h: 120, depth: 136, apexU: 0.18, drips: [{ u: -0.3, w: 12, len: 18 }, { u: 0.45, w: 11, len: 14 }] },
    top: { x: 426, y: 452, w: 572, h: 116, depth: 126, apexU: -0.16, rot: -9, drips: [{ u: -0.2, w: 13, len: 30 }, { u: 0.5, w: 10, len: 18 }] },
  }),
  'panini-trois-fromages': () => item('panini-trois-fromages', {
    base: { ...PANINI, fill: 'cheese', dripPal: PAL.cheese },
    bottom: { x: 388, y: 574, w: 590, h: 74, depth: 128, apexU: 0.16, drips: [{ u: -0.55, w: 9, len: 16 }, { u: 0.1, w: 11, len: 22 }, { u: 0.62, w: 8, len: 12 }] },
    top: { x: 416, y: 438, w: 566, h: 72, depth: 122, apexU: -0.12, rot: -3, drips: [] },
    strands: [[-0.62, -0.66, 9, 11], [-0.22, -0.2, 7, 9], [0.18, 0.24, 10, 12], [0.58, 0.62, 7, 9]],
    strandPal: PAL.cheese,
  }),
  'panini-poulet': () => item('panini-poulet', {
    base: { ...PANINI, fill: 'poulet', dripPal: PAL.cheese },
    bottom: { x: 388, y: 574, w: 590, h: 76, depth: 128, apexU: 0.16, drips: [{ u: -0.36, w: 9, len: 16 }, { u: 0.52, w: 10, len: 18 }] },
    top: { x: 416, y: 446, w: 566, h: 74, depth: 122, apexU: -0.12, rot: -3, drips: [{ u: 0.06, w: 9, len: 18 }] },
  }),
  'panini-choco': () => item('panini-choco', {
    base: { ...PANINI, fill: 'choc', sugar: true, dripPal: PAL.choc },
    bottom: { x: 388, y: 574, w: 590, h: 72, depth: 128, apexU: 0.16, drips: [{ u: -0.48, w: 9, len: 18 }, { u: 0.28, w: 10, len: 22 }] },
    top: { x: 416, y: 446, w: 566, h: 70, depth: 122, apexU: -0.12, rot: -3, drips: [{ u: -0.1, w: 9, len: 20 }, { u: 0.55, w: 8, len: 12 }] },
  }),
};
