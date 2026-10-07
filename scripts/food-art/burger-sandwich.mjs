// Demo food art: burger-sandwich. See lib.mjs for helpers and build.mjs for the required ids.
// Side view (front, slightly from above), light from the top-left.
//  - burger(id, spec): stacks parametric layers bottom → top; each layer casts a soft shadow on the ones below.
//  - baguette(id, spec): long crusty half-baguette sandwich with configurable fillings.
//  - kebab(id): folded pita pocket stuffed with shaved meat and salad.
import { rng, between, contactShadow, shadowFilter, grainFilter, svgDoc } from './lib.mjs';

const CX = 400;
const K = 0.1; // perspective: ellipse ry / rx ("slightly from above")
const n0 = (v) => Math.round(v);
const r1 = (v) => Math.round(v * 10) / 10;
const pick = (rand, arr) => arr[Math.floor(rand() * arr.length)];
const nums = (a) => a.join(' ').replace(/ -/g, '-');

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

/** Outline of a horizontal disc (cylinder) seen slightly from above, clockwise on screen. */
function discPts({ cx = CX, rx, ry, yT, h, step = 12, bulge = 0.3 }) {
  const pts = [];
  const arc = (y0, a0, a1) => {
    const n = Math.max(6, Math.ceil((Math.PI * rx) / step));
    for (let i = 0; i < n; i++) { const t = a0 + ((a1 - a0) * i) / n; pts.push([cx + rx * Math.cos(t), y0 + ry * Math.sin(t)]); }
  };
  const side = (x, dir, down) => {
    const n = Math.max(2, Math.ceil(h / step));
    for (let i = 0; i < n; i++) { const s = down ? i / n : 1 - i / n; pts.push([x + dir * h * bulge * Math.sin(Math.PI * s), yT + h * s]); }
  };
  arc(yT, Math.PI, 2 * Math.PI);
  side(cx + rx, 1, true);
  arc(yT + h, 0, Math.PI);
  side(cx - rx, -1, false);
  return pts;
}

/** Push every point along its outward normal by amp(i, p). */
function roughen(pts, amp) {
  const n = pts.length;
  return pts.map((p, i) => {
    const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    const tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1, o = amp(i, p);
    return [p[0] + (ty / l) * o, p[1] - (tx / l) * o];
  });
}

/** Rounded nubs along a closed outline: returns amp(i, p) for roughen(). */
function nubs(rand, pts, { count, w, h, weight = () => 1 }) {
  const s = [0];
  for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const P = s[s.length - 1];
  const b = Array.from({ length: count }, () => ({ c: rand() * P, w: between(rand, w[0], w[1]), h: between(rand, h[0], h[1]) }));
  return (i, p) => {
    let v = 0;
    for (const q of b) { let d = Math.abs(s[i] - q.c); d = Math.min(d, P - d); if (d < q.w * 2.5) v = Math.max(v, q.h * Math.exp(-((d / q.w) ** 2))); }
    return v * weight(p);
  };
}

/** Rotated ellipse as a clockwise path (unions with other clockwise subpaths). */
function ellipseD(cx, cy, rx, ry, deg = 0) {
  const a = (deg * Math.PI) / 180, dx = Math.cos(a) * rx, dy = Math.sin(a) * rx;
  return `M${n0(cx - dx)} ${n0(cy - dy)}A${n0(rx)} ${n0(ry)} ${n0(deg)} 1 1 ${n0(cx + dx)} ${n0(cy + dy)}A${n0(rx)} ${n0(ry)} ${n0(deg)} 1 1 ${n0(cx - dx)} ${n0(cy - dy)}Z`;
}
const circleD = (x, y, rr) => `M${n0(x - rr)} ${n0(y)}a${r1(rr)} ${r1(rr)} 0 1 1 ${r1(2 * rr)} 0a${r1(rr)} ${r1(rr)} 0 1 1 ${r1(-2 * rr)} 0Z`;

/** Many short round-capped strokes in ONE path: cheap dots/capsules (texture, seeds, crumbs). */
const dots = (list, color, w, extra = '') =>
  list.length ? `<path d="${list.map(([x, y, dx = 0.4, dy = 0]) => `M${n0(x)} ${n0(y)}l${nums([r1(dx), r1(dy)])}`).join('')}" stroke="${color}" stroke-width="${w}" stroke-linecap="round" fill="none"${extra}/>` : '';

/* ------------------------------------------------------------------ defs manager */

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
    /** Register a path in defs, return its id (drawn via <use>, reused for clip + shadow). */
    shape: (name, d) => add(name, (k) => `<path id="${k}" d="${d}"/>`),
    clip: (name, ids) => `url(#${add(name, (k) => `<clipPath id="${k}">${ids.map((s) => `<use href="#${s}"/>`).join('')}</clipPath>`)})`,
    grain: (name, opts) => `url(#${add(`${name}-grain`, () => grainFilter(`${id}-${name}`, opts))})`,
    cyl: () => D.lin('cyl', [[0, '#fff', 0.26], [0.2, '#fff', 0.06], [0.5, '#fff', 0], [0.8, '#000', 0.1], [1, '#000', 0.3]], [0, 0, 1, 0]),
    soft: () => `url(#${add('soft', (k) => `<filter id="${k}" filterUnits="userSpaceOnUse" x="0" y="0" width="800" height="800"><feGaussianBlur stdDeviation="5"/></filter>`)})`,
    blur: (sd) => `url(#${add(`blur${sd}`, (k) => `<filter id="${k}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${sd}"/></filter>`)})`,
    str: () => [...m.values()].join(''),
  };
  return D;
}
const use = (s, fill, extra = '') => `<use href="#${s}" fill="${fill}"${extra}/>`;

/** Ground contact shadow: wide soft warm ellipse plus a tighter darker core. */
function ground(id, D, cy, rx) {
  D.add('shadow', () => shadowFilter(id, 16));
  return contactShadow(id, { cx: CX + 10, cy, rx, ry: 30, opacity: 0.34 }) +
    `<ellipse cx="${CX + 6}" cy="${n0(cy - 8)}" rx="${n0(rx * 0.8)}" ry="10" fill="#3a1f10" opacity=".3" filter="${D.blur(7)}"/>`;
}

/* ------------------------------------------------------------------ palettes */

const BUN = {
  sesame: { hi: '#FACF84', mid: '#E0913D', lo: '#B05A1D', edge: '#86400F', band: '#F5D89C', crumb: '#F8E5BA', gloss: 0.6 },
  potato: { hi: '#FDDB8C', mid: '#F0B04F', lo: '#CC822C', edge: '#A05E1C', band: '#FCE7B2', crumb: '#FDF0CC', gloss: 0.5 },
  brioche: { hi: '#F3B160', mid: '#CC722A', lo: '#963F10', edge: '#6E2B0B', band: '#EDBE78', crumb: '#F8E0AA', gloss: 0.8 },
  multigrain: { hi: '#E9B068', mid: '#BC7432', lo: '#8A4618', edge: '#66300C', band: '#E2BB80', crumb: '#F1DBAE', gloss: 0.45 },
};
const CHEDDAR = ['#FFD45A', '#F9AE25', '#E07A16', '#FFF1B8'];
const AMERICAN = ['#FFD04D', '#FCAA26', '#EC8618', '#FFF3BE'];
const MAYO = ['#FFFCF2', '#FFF4DA', '#E9D3A6', '#FFFFFF'];

/* ------------------------------------------------------------------ burger layers
 * c = { id, D, rand, W, y, i }: y is the centre of the layer's bottom ellipse.
 * Each returns { svg, shapes } (defs ids, used for casting shadows / clipping).        */

function bunBottom(c, o) {
  const { D, W } = c, p = BUN[o.bun];
  const rx = W * (o.w ?? 0.97), ry = rx * K, h = o.h, yB = c.y, yT = yB - h, L = CX - rx, R = CX + rx, rc = 38;
  const d = `M${n0(L)} ${n0(yT)}A${n0(rx)} ${n0(ry)} 0 0 1 ${n0(R)} ${n0(yT)}C${n0(R + 7)} ${n0(yT + h * 0.5)} ${n0(R + 2)} ${n0(yB + ry * 0.1)} ${n0(R - rc)} ${n0(yB + ry * 0.5)}A${n0(rx - rc)} ${n0(ry * 1.1)} 0 0 1 ${n0(L + rc)} ${n0(yB + ry * 0.5)}C${n0(L - 2)} ${n0(yB + ry * 0.1)} ${n0(L - 7)} ${n0(yT + h * 0.5)} ${n0(L)} ${n0(yT)}Z`;
  const s = D.shape(`s${c.i}`, d);
  const svg =
    use(s, D.lin('bunb', [[0, p.band], [0.3, p.hi], [0.72, p.mid], [1, p.lo]]), ` filter="${D.grain('bun', { freq: 0.75, amount: 0.12 })}"`) +
    use(s, D.cyl()) +
    `<ellipse cx="${CX}" cy="${n0(yT)}" rx="${n0(rx - 4)}" ry="${n0(ry - 1)}" fill="${D.lin('crumb', [[0, p.crumb], [1, p.band]])}"/>` +
    `<path d="M${n0(L + 26)} ${n0(yT + h * 0.4)}Q${n0(L + 60)} ${n0(yB + ry * 0.5)} ${n0(CX - rx * 0.35)} ${n0(yB + ry * 0.7)}" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="7" stroke-linecap="round"/>`;
  return { svg, shapes: [s] };
}

function bunTop(c, o) {
  const { D, W, rand } = c, p = BUN[o.bun];
  const rx = W * (o.w ?? 1), ry = rx * K, H = o.H, yB = c.y, L = CX - rx, ex = o.ex ?? 0.52;
  const domeY = (u) => yB - H * Math.pow(Math.max(0, 1 - u * u), ex / 2);
  const pts = [];
  for (let k = 0; k <= 30; k++) {
    const t = (k / 30) * Math.PI;
    pts.push([CX - rx * Math.cos(t) * (1 + 0.03 * Math.sin(t) ** 2), yB - H * Math.sin(t) ** ex]);
  }
  const s = D.shape(`s${c.i}`, `${smooth(pts, false)}A${n0(rx)} ${n0(ry)} 0 0 1 ${n0(L)} ${n0(yB)}Z`);
  let svg =
    use(s, D.rad('bunt', [[0, p.hi], [0.42, p.mid], [0.8, p.lo], [1, p.edge]], { cx: 0.36, cy: 0.28, r: 0.8 }), ` filter="${D.grain('bun', { freq: 0.75, amount: 0.12 })}"`) +
    use(s, D.lin('band', [[0, p.band, 0], [0.55, p.band, 0.4], [1, p.band, 0.85]], [0, n0(yB - H * 0.3), 0, n0(yB + ry)], true)) +
    use(s, D.cyl());
  if (o.seeds) {
    const placed = [];
    for (let t = 0; t < 4000 && placed.length < o.seedsN; t++) {
      const u = between(rand, -0.9, 0.9), v = between(rand, 0.05, 0.72);
      const top = domeY(u), y = top + v * (yB - top), x = CX + u * rx;
      if (y > yB - 26 || placed.some((q) => (q.x - x) ** 2 + (q.y - y) ** 2 < 25 * 25)) continue;
      placed.push({ x, y, u, v });
    }
    const sh = [], light = [], light2 = [], dark = [], hl = [];
    for (const { x, y, u, v } of placed) {
      const sx = 0.45 + 0.55 * Math.sqrt(1 - u * u), sy = 0.4 + 0.6 * Math.min(1, v * 3);
      const a = between(rand, -1, 1) * 0.9 + (u > 0 ? 0.25 : -0.25), len = 8.5;
      const dx = Math.cos(a) * len * sx, dy = Math.sin(a) * len * sy;
      const seg = [x - dx / 2, y - dy / 2, dx, dy];
      sh.push([seg[0] + 1.3, seg[1] + 2, dx, dy]);
      (o.seeds === 'multi' && rand() < 0.38 ? dark : rand() < 0.35 ? light2 : light).push(seg);
      hl.push([seg[0] - 0.8, seg[1] - 1.2, dx * 0.6, dy * 0.6]);
    }
    svg += dots(sh, '#6b300c', 7.2, ' opacity=".33"') + dots(light, '#FCF2D8', 6.4) + dots(light2, '#F1DBA8', 6.4) + dots(dark, '#C08A4A', 9, ' opacity=".9"') + dots(dark.map(([x, y, dx, dy]) => [x - 1, y - 1.5, dx * 0.7, dy * 0.7]), '#EBCB8E', 4.5) + dots(hl, '#fff', 2, ' opacity=".85"');
  }
  const gx = CX - rx * 0.36, gy = yB - H * 0.66;
  svg += `<ellipse cx="${n0(gx)}" cy="${n0(gy)}" rx="${n0(rx * 0.4)}" ry="${n0(H * 0.2)}" transform="rotate(-18 ${n0(gx)} ${n0(gy)})" fill="${D.rad('gloss', [[0, '#fff', p.gloss], [0.55, '#fff', p.gloss * 0.3], [1, '#fff', 0]])}"/>` +
    `<ellipse cx="${n0(gx - rx * 0.1)}" cy="${n0(gy - H * 0.09)}" rx="${n0(rx * 0.14)}" ry="${n0(H * 0.055)}" transform="rotate(-24 ${n0(gx - rx * 0.1)} ${n0(gy - H * 0.09)})" fill="${D.rad('spec', [[0, '#fff', 0.75], [1, '#fff', 0]])}"/>`;
  return { svg, shapes: [s] };
}

const PATTY = {
  beef: { g: [[0, '#9A5530'], [0.28, '#77391B'], [0.72, '#57290F'], [1, '#3E1B09']], dark: '#2A1106', lite: '#B06A3A' },
  smash: { g: [[0, '#A9612F'], [0.45, '#7C3D1A'], [1, '#4E230D']], dark: '#2E1206', lite: '#D08A48' },
  veg: { g: [[0, '#D9873A'], [0.4, '#BE6A2A'], [0.85, '#8E4619'], [1, '#6C3412']], dark: '#5A2A0E', lite: '#F2B266' },
};

function patty(c, o) {
  const { D, W, rand } = c;
  const cx = o.cx ?? CX, rx = o.rx ?? W * (o.w ?? 1.04), ry = o.ry ?? rx * K, h = o.h, yB = c.y, yT = yB - h;
  const base = discPts({ cx, rx, ry, yT, h, step: 7, bulge: o.kind === 'smash' ? 0.18 : 0.3 });
  const nz = noise1(rand, 3, 0.09);
  const lace = o.kind === 'smash' ? nubs(rand, base, { count: 70, w: [4, 9], h: [3, 10], weight: (p) => Math.abs((p[0] - cx) / rx) ** 4 }) : () => 0;
  const s = D.shape(`s${c.i}`, smooth(roughen(base, (i, p) => 2.6 * nz(i * 7) + lace(i, p) + between(rand, -0.6, 0.6))));
  const P = PATTY[o.kind];
  let svg = use(s, D.lin(`patty-${o.kind}`, P.g), ` filter="${D.grain(`meat-${o.kind}`, { freq: 1.3, amount: 0.3 })}"`) + use(s, D.cyl());
  const inside = () => { const u = between(rand, -0.97, 0.97), f = Math.sqrt(1 - u * u); return [cx + u * rx, between(rand, yT - ry * f + 3, yB + ry * f - 2)]; };
  const sets = o.kind === 'veg'
    ? [['#4F8F2E', 5, 34], ['#7DB847', 4, 22], ['#F39A3A', 4.5, 24], ['#F4CE4C', 4, 16], ['#5A2A0E', 3, 30], [P.lite, 6, 20]]
    : [[P.dark, 4, 40], [P.dark, 2.5, 40], [P.lite, 3.5, 34], [P.lite, 2, 30]];
  let tex = sets.map(([col, w, n]) => dots(Array.from({ length: n }, () => { const [x, y] = inside(); return [x, y, between(rand, -3, 3), between(rand, -1.2, 1.2)]; }), col, w, ' opacity=".8"')).join('');
  tex += dots(Array.from({ length: 16 }, () => { const [x, y] = inside(); return [Math.min(x, cx + rx * 0.2), y, between(rand, 1, 3), 0]; }), '#FFE6C8', 1.8, ' opacity=".55"');
  svg += `<g clip-path="${D.clip(`c${c.i}`, [s])}">${tex}</g>` +
    use(s, D.lin('sear', [[0, '#1a0802', 0.3], [0.18, '#1a0802', 0], [0.8, '#1a0802', 0], [1, '#1a0802', 0.4]]));
  return { svg, shapes: [s] };
}

/** Melted cheese / sauce drape with rounded drips (gaussian necks + bulbous tips). */
function drape(c, o) {
  const { D, W, rand } = c;
  const cx = o.cx ?? CX, rx = o.rx ?? W * (o.w ?? 1.05), ry = o.ry ?? rx * K, yB = c.y, h = o.h, yT = yB - h, L = cx - rx, R = cx + rx;
  const drips = [];
  if (o.corners) drips.push({ x: cx - rx * 0.86, a: between(rand, 46, 58), w: 26 }, { x: cx + rx * 0.85, a: between(rand, 42, 54), w: 24 });
  for (let t = 0; t < 300 && drips.length < (o.corners ? 2 : 0) + o.drips; t++) {
    const x = cx + rx * between(rand, -0.72, 0.72);
    if (drips.some((q) => Math.abs(q.x - x) < 52)) continue;
    drips.push({ x, a: between(rand, o.len * 0.4, o.len), w: between(rand, 10, 14) });
  }
  const front = (x) => yB + ry * Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2));
  const dy = (x) => drips.reduce((v, q) => v + q.a * Math.exp(-(((x - q.x) / q.w) ** 2)), 0);
  const pts = [];
  for (let k = 0; k <= 12; k++) { const t = Math.PI + (k / 12) * Math.PI; pts.push([cx + rx * Math.cos(t), yT + ry * Math.sin(t)]); }
  pts.push([R + 5, yB + 1]);
  for (let x = R - 4; x > L + 4; x -= 6) pts.push([x, front(x) + 2 + dy(x)]);
  pts.push([L - 5, yB + 1]);
  const tips = drips.filter((q) => q.a > 18).map((q) => { const rt = q.w * 0.6; return { x: q.x, y: front(q.x) + 2 + q.a - rt * 0.75, rt }; });
  const s = D.shape(`s${c.i}`, smooth(pts) + tips.map((t) => circleD(t.x, t.y, t.rt)).join(''));
  const p = o.pal;
  let svg = use(s, D.lin(`drape${c.i}`, [[0, p[0]], [0.3, p[1]], [1, p[2]]], [0, n0(yT - ry), 0, n0(yB + ry + o.len + 16)], true)) +
    use(s, D.lin('cylsoft', [[0, '#fff', 0.18], [0.35, '#fff', 0], [0.8, '#000', 0], [1, '#000', 0.14]], [0, 0, 1, 0]));
  svg += tips.map((t) => `<ellipse cx="${r1(t.x - t.rt * 0.32)}" cy="${r1(t.y - t.rt * 0.22)}" rx="${r1(t.rt * 0.3)}" ry="${r1(t.rt * 0.45)}" fill="${p[3]}" opacity=".8"/>`).join('') +
    `<path d="M${n0(L + 8)} ${n0(yB + 4)}q${n0(rx * 0.25)} ${n0(ry * 0.9)} ${n0(rx * 0.55)} ${n0(ry * 1.05)}" fill="none" stroke="${p[3]}" stroke-width="2.2" stroke-linecap="round" opacity=".7"/>`;
  return { svg, shapes: [s] };
}

function lettuce(c, o) {
  const { D, W, rand } = c;
  const cx = o.cx ?? CX, rx = o.rx ?? W * (o.w ?? 1.08), ry = o.ry ?? rx * K, yB = c.y, h = o.h, yT = yB - h, L = cx - rx, R = cx + rx;
  const front = (x) => yB + ry * Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2));
  const frill = (depth, shift) => {
    const pts = [], valleys = [], mids = [];
    for (let k = 0; k <= 12; k++) { const t = Math.PI + (k / 12) * Math.PI; pts.push([cx + rx * Math.cos(t), yT + ry * Math.sin(t)]); }
    pts.push([R + 10, yT + h * 0.3], [R + 14, yB + 2]);
    let x = R + 4 - shift;
    while (x > L - 6) {
      const big = rand() < 0.18, wl = big ? between(rand, 40, 56) : between(rand, o.lobe?.[0] ?? 16, o.lobe?.[1] ?? 34), dl = big ? depth * between(rand, 1.2, 1.5) : between(rand, depth * 0.35, depth);
      for (const sv of [0, 0.22, 0.5, 0.78]) {
        const xx = x - sv * wl;
        if (xx < L - 8) break;
        pts.push([xx, front(xx) + (sv === 0 ? -3 : dl * Math.sin(Math.PI * sv) ** 0.6 + dl * 0.12 * Math.sin(3 * Math.PI * sv))]);
      }
      valleys.push([x, front(x) - 3]);
      mids.push([x - wl / 2, front(x - wl / 2) + dl * 0.6]);
      x -= wl;
    }
    pts.push([L - 14, yB + 2], [L - 10, yT + h * 0.3]);
    return { pts, valleys, mids, n: pts.length };
  };
  const back = frill(o.depth * 1.25, 11), fr = frill(o.depth, 0);
  const sb = D.shape(`s${c.i}b`, smooth(back.pts)), sf = D.shape(`s${c.i}`, smooth(fr.pts));
  const g = (name, st) => D.lin(`${name}${c.i}`, st, [0, n0(yT - ry), 0, n0(yB + ry + o.depth)], true);
  let svg = use(sb, g('lb', [[0, '#25592B'], [1, '#3F8031']])) +
    use(sf, g('lf', [[0, '#3A7C31'], [0.55, '#5FA23A'], [1, '#A4D154']])) +
    use(sf, D.lin('cylsoft2', [[0, '#fff', 0.12], [0.4, '#fff', 0], [0.85, '#000', 0], [1, '#000', 0.2]], [0, 0, 1, 0]));
  svg += dots(fr.valleys.map(([x, y]) => [x, y + 2, between(rand, -5, 5), -between(rand, 10, 17)]), '#2A6229', 2.2, ' opacity=".55"') +
    dots(fr.mids.map(([x, y]) => [x, y, between(rand, -3, 3), -between(rand, 8, 14)]), '#D5EE8C', 1.4, ' opacity=".55"') +
    `<path d="${smooth(fr.pts.slice(15, -2), false)}" fill="none" stroke="#DDF29A" stroke-width="1.5" opacity=".8"/>`;
  return { svg, shapes: [sb, sf] };
}

function tomato(c, o) {
  const { D, W } = c;
  const yB = c.y, h = o.h;
  const slices = [{ cx: CX + W * 0.42, rx: W * 0.66, dy: -3 }, { cx: CX - W * 0.4, rx: W * 0.68, dy: 0 }];
  const shapes = [];
  let svg = '';
  slices.forEach((sl, k) => {
    const ry = sl.rx * K, yT = yB - h + sl.dy;
    const s = D.shape(`s${c.i}${k}`, smooth(discPts({ cx: sl.cx, rx: sl.rx, ry, yT, h, step: 16, bulge: 0.35 })));
    shapes.push(s);
    svg += use(s, D.lin('tom', [[0, '#F36A4E'], [0.3, '#DE3D22'], [0.75, '#B52816'], [1, '#8F1F12']])) + use(s, D.cyl()) +
      `<ellipse cx="${n0(sl.cx)}" cy="${n0(yT)}" rx="${n0(sl.rx - 3)}" ry="${n0(ry - 1)}" fill="#E8492E" stroke="#F79A7C" stroke-width="2" stroke-opacity=".6"/>` +
      `<path d="M${n0(sl.cx - sl.rx * 0.84)} ${n0(yT + h * 0.42 + ry * 0.45)}Q${n0(sl.cx - sl.rx * 0.62)} ${n0(yT + h * 0.42 + ry * 0.9)} ${n0(sl.cx - sl.rx * 0.3)} ${n0(yT + h * 0.42 + ry)}" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" opacity=".5"/>`;
  });
  return { svg, shapes };
}

function pickles(c, o) {
  const { D, W, rand } = c;
  const ryL = W * K;
  const fl = D.rad('pickle', [[0, '#E6EAA8'], [0.55, '#BCC860'], [1, '#809532']]);
  let d = '';
  const items = o.at.map((u) => {
    const x = CX + W * u, y = c.y + ryL * Math.sqrt(1 - u * u) + 4, rot = between(rand, -7, 7);
    d += ellipseD(x, y, 40, 14, rot);
    return { x, y, rot };
  });
  const s = D.shape(`s${c.i}`, d);
  const svg = use(s, '#46641A') + items.map(({ x, y, rot }) =>
    `<g transform="translate(${n0(x)} ${n0(y)})rotate(${n0(rot)})"><ellipse rx="36" ry="11" fill="${fl}"/><ellipse rx="39" ry="13" fill="none" stroke="#2F450D" stroke-width="2.4" stroke-dasharray="3.5 3"/>${dots([[-20, -1], [-11, 4], [0, 5], [11, 4], [20, -1], [9, -4], [-9, -4]], '#F6F7DA', 3.2)}<ellipse cx="-16" cy="-6" rx="10" ry="1.8" fill="#fff" opacity=".45"/></g>`).join('');
  return { svg, shapes: [s] };
}

function onions(c, o) {
  const { D, W, rand } = c;
  const rx = W * 1.02, ry = rx * K, yB = c.y, h = o.h, yT = yB - h;
  const s = D.shape(`s${c.i}`, smooth(roughen(discPts({ rx, ry, yT, h, step: 14, bulge: 0.2 }), () => between(rand, -3, 3))));
  const front = (x) => yB + ry * Math.sqrt(Math.max(0, 1 - ((x - CX) / rx) ** 2));
  const cols = ['#B5641E', '#D78B35', '#ECB257', '#9A4D16'];
  const groups = cols.map(() => []);
  for (let k = 0; k < 40; k++) {
    const x = CX + rx * between(rand, -1.02, 0.96), y = between(rand, yT + 4, front(x) + 10);
    const len = between(rand, 22, 40), ang = between(rand, -0.5, 0.5), bend = between(rand, 7, 13) * (rand() < 0.75 ? -1 : 1);
    const dx = Math.cos(ang) * len, dyy = Math.sin(ang) * len;
    groups[k % 4].push(`M${n0(x)} ${n0(y)}q${nums([n0(dx / 2 - Math.sin(ang) * bend), n0(dyy / 2 + Math.cos(ang) * bend), n0(dx), n0(dyy)])}`);
  }
  let svg = use(s, '#8E4815') +
    groups.map((g, k) => `<path d="${g.join('')}" fill="none" stroke="#5E2A0A" stroke-width="${[11, 10, 9.5, 11][k]}" stroke-linecap="round" opacity=".5"/><path d="${g.join('')}" fill="none" stroke="${cols[k]}" stroke-width="${[8.5, 8, 7, 8.5][k]}" stroke-linecap="round"/><path d="${g.join('')}" fill="none" stroke="#FFD58A" stroke-width="2" stroke-linecap="round" opacity=".55" transform="translate(-1 -2.5)"/>`).join('');
  svg += dots(Array.from({ length: 16 }, () => { const x = CX + rx * between(rand, -0.95, 0.4); return [x, front(x) - between(rand, 1, 12), between(rand, 8, 16), between(rand, -2, 2)]; }), '#FFDA8E', 2, ' opacity=".75"');
  return { svg, shapes: [s] };
}

function redOnion(c, o) {
  const { D, W, rand } = c;
  const ryL = W * K;
  let d = '', svg = '';
  o.at.forEach((u) => {
    const x = CX + W * u, y = c.y + ryL * Math.sqrt(1 - u * u) - 3, rot = between(rand, -6, 6), rr = between(rand, 38, 46);
    d += ellipseD(x, y, rr + 5, 13, rot);
    svg += `<g transform="translate(${n0(x)} ${n0(y)})rotate(${n0(rot)})" fill="none"><ellipse rx="${n0(rr)}" ry="11" stroke="#6E1A52" stroke-width="9"/><ellipse rx="${n0(rr - 6)}" ry="7" stroke="#EBC3DC" stroke-width="3"/><ellipse rx="${n0(rr - 10)}" ry="5" stroke="#8E2D6C" stroke-width="3"/><path d="M${n0(-rr * 0.9)} -2q${n0(rr * 0.4)} 9 ${n0(rr * 0.9)} 10" stroke="#D27CB0" stroke-width="2.5" stroke-linecap="round"/></g>`;
  });
  return { svg, shapes: [D.shape(`s${c.i}`, d)] };
}

function avocado(c, o) {
  const { D, W, rand } = c;
  const ryL = W * K;
  D.add('avo', (k) => `<g id="${k}"><path d="M-66 -8C-58 18 24 38 58 10C70 0 66-12 54-13C20-6-30-4-66 -8Z" fill="${D.lin('avog', [[0, '#ECE7A4'], [0.45, '#D2DD78'], [0.78, '#8DBA40'], [1, '#4C7E22']])}"/><path d="M-66 -8C-58 18 24 38 58 10C70 0 66-12 54-13" fill="none" stroke="#1E2D0B" stroke-width="3.6" stroke-linecap="round"/><path d="M-48 -3Q-10 8 30 2" fill="none" stroke="#FBF8D2" stroke-width="2.6" stroke-linecap="round" opacity=".6"/></g>`);
  let d = '', svg = '';
  o.at.forEach((u, k) => {
    const x = CX + W * u, y = c.y + ryL * Math.sqrt(1 - u * u) - 2 + (k % 2 ? -3 : 3), rot = (k % 2 ? 1 : -1) * between(rand, 4, 11), sc = between(rand, 0.8, 0.92);
    d += ellipseD(x, y + 8 * sc, 62 * sc, 18 * sc, rot);
    const tf = `rotate(${n0(rot)})scale(${k % 2 ? -r1(sc) : r1(sc)} ${r1(sc)})`;
    svg += `<use href="#${c.id}-avo" transform="translate(${n0(x + 4)} ${n0(y + 5)})${tf}" opacity=".3" filter="${D.blur(3)}"/><use href="#${c.id}-avo" transform="translate(${n0(x)} ${n0(y)})${tf}"/>`;
  });
  return { svg, shapes: [D.shape(`s${c.i}`, d)] };
}

function chicken(c, o) {
  const { D, W, rand } = c;
  const rx = W * (o.w ?? 1.15), ry = rx * K, h = o.h, yB = c.y, yT = yB - h;
  const base = discPts({ rx, ry, yT, h, step: 6, bulge: 0.34 });
  const nz = noise1(rand, 2, 0.05);
  const nb = nubs(rand, base, { count: 150, w: [4, 10], h: [3, 11] });
  const s = D.shape(`s${c.i}`, smooth(roughen(base, (i, p) => 5 * nz(i * 6) + nb(i, p) - 3)));
  let svg = use(s, D.lin('fillet', [[0, '#FAD27A'], [0.36, '#EBAA4A'], [0.78, '#C97B2C'], [1, '#9A561C']]), ` filter="${D.grain('crumb', { freq: 1.2, amount: 0.3 })}"`) + use(s, D.cyl());
  const inside = () => { const u = between(rand, -1.02, 1.02), f = Math.sqrt(Math.max(0, 1 - u * u)); return [CX + u * rx, between(rand, yT - ry * f - 2, yB + ry * f + 6)]; };
  const crumbs = Array.from({ length: 170 }, () => { const [x, y] = inside(); return { x, y, w: between(rand, 3, 9) }; });
  const by = (lo, hi) => crumbs.filter((q) => q.w >= lo && q.w < hi);
  let tex = '';
  for (const [lo, hi, w] of [[3, 5, 4], [5, 7, 6.5], [7, 9.1, 9]]) {
    const g = by(lo, hi);
    tex += dots(g.map((q) => [q.x + w * 0.25, q.y + w * 0.35]), '#7A3A10', w, ' opacity=".22"') +
      dots(g.map((q) => [q.x, q.y]), '#F4C062', w * 0.92, ' opacity=".9"') +
      dots(g.map((q) => [q.x - w * 0.2, q.y - w * 0.22]), '#FFE6A6', w * 0.42, ' opacity=".8"');
  }
  tex += dots(Array.from({ length: 60 }, () => { const [x, y] = inside(); return [x, y, between(rand, -6, 6), between(rand, -2, 2)]; }), '#8A4512', 2.2, ' opacity=".4"');
  svg += `<g clip-path="${D.clip(`c${c.i}`, [s])}">${tex}</g>` +
    use(s, D.lin('fryedge', [[0, '#5a2a08', 0.22], [0.15, '#5a2a08', 0], [0.8, '#5a2a08', 0], [1, '#5a2a08', 0.38]]));
  return { svg, shapes: [s] };
}

const LAYERS = { bunBottom, bunTop, patty, drape, lettuce, tomato, pickles, onions, redOnion, avocado, chicken };

function burger(id, spec) {
  const rand = rng(id), D = defsFor(id), W = spec.W ?? 290;
  const total = spec.layers.reduce((s, l) => s + (l.t === 'bunTop' ? l.H : l.h), 0);
  const base = n0(392 + total / 2);
  let y = base, body = '';
  const below = [];
  spec.layers.forEach((o, i) => {
    const res = LAYERS[o.t]({ id, D, rand, W, y, i }, o);
    if (below.length) body += `<g clip-path="${D.clip(`b${i}`, below)}" opacity=".45">${res.shapes.map((s) => `<use href="#${s}" x="5" y="9" fill="#3a1606" filter="${D.soft()}"/>`).join('')}</g>`;
    body += res.svg;
    below.push(...res.shapes);
    y -= o.t === 'bunTop' ? 0 : o.h;
  });
  const sh = ground(id, D, base + W * K + 6, W * 1.02);
  return svgDoc({ defs: D.str(), body: sh + body });
}

/* ------------------------------------------------------------------ baguette sandwiches */

function baguetteBottom(D, { y0, W, Hb }) {
  const L = CX - W, pts = [];
  for (let k = 0; k <= 26; k++) { const t = (k / 26) * Math.PI; pts.push([CX - W * Math.cos(t), y0 + Hb * Math.sin(t) ** 0.7 - 6 * Math.cos(t) ** 8]); }
  const back = (t) => y0 - 9 * Math.sin(t) ** 0.5, frontE = (t) => y0 + 9 * Math.sin(t) ** 0.5;
  const s = D.shape('bb', smooth(pts, false) + `L${n0(CX + W)} ${n0(y0 - 6)}` + Array.from({ length: 13 }, (_, k) => { const t = Math.PI - (k / 12) * Math.PI; return `L${n0(CX - W * Math.cos(t))} ${n0(back(t))}`; }).join('') + 'Z');
  const face = [];
  for (let k = 0; k <= 16; k++) { const t = (k / 16) * Math.PI; face.push([CX - (W - 6) * Math.cos(t), back(t) + 1]); }
  for (let k = 16; k >= 0; k--) { const t = (k / 16) * Math.PI; face.push([CX - (W - 6) * Math.cos(t), frontE(t)]); }
  return use(s, D.lin('crustb', [[0, '#EDB766'], [0.45, '#D18A3A'], [1, '#9A531E']]), ` filter="${D.grain('crust', { freq: 0.8, amount: 0.16 })}"`) + use(s, D.cyl()) +
    `<path d="${smooth(face)}" fill="#F7E6BF" stroke="#C98436" stroke-width="2.5"/>` +
    `<path d="M${n0(L + 40)} ${n0(y0 + Hb * 0.45)}Q${n0(L + 110)} ${n0(y0 + Hb * 0.78)} ${n0(CX - W * 0.2)} ${n0(y0 + Hb * 0.84)}" fill="none" stroke="#fff" stroke-opacity=".2" stroke-width="7" stroke-linecap="round"/>`;
}

function baguetteTop(D, rand, { yT, W, Ht, rot = 0 }) {
  const L = CX - W, pts = [];
  const domeY = (u) => yT - Ht * Math.max(0, 1 - u * u) ** 0.39;
  for (let k = 0; k <= 30; k++) { const t = (k / 30) * Math.PI; pts.push([CX - W * Math.cos(t), yT - Ht * Math.sin(t) ** 0.78 + 4 * Math.cos(t) ** 8]); }
  for (let k = 1; k < 16; k++) { const t = (k / 16) * Math.PI; pts.push([CX + W * Math.cos(t), yT + 8 * Math.sin(t) ** 0.5]); }
  const s = D.shape('bt', smooth(pts));
  let svg = use(s, D.rad('crustt', [[0, '#F8CF7E'], [0.4, '#E3A24A'], [0.78, '#C07428'], [1, '#8E4A18']], { cx: 0.36, cy: 0.2, r: 0.75 }), ` filter="${D.grain('crust', { freq: 0.8, amount: 0.16 })}"`) + use(s, D.cyl());
  // grignes: five slanted score slashes along the crest (opened lighter crumb-crust + shadowed lip)
  D.add('score', (k) => `<g id="${k}"><path d="M-64 2C-34-14 30-16 64-4C30 10-34 14-64 2Z" fill="${D.lin('scoreg', [[0, '#B8662A'], [0.35, '#F3CE84'], [1, '#FBE3A8']])}"/><path d="M-60 0C-30-13 30-15 62-4" fill="none" stroke="#7A3A12" stroke-width="3" stroke-linecap="round" opacity=".55"/><path d="M-56-4C-28-17 26-19 58-8" fill="none" stroke="#FFE6AE" stroke-width="2.2" stroke-linecap="round" opacity=".8"/></g>`);
  let sc = '';
  for (let j = 0; j < 5; j++) {
    const u = -0.7 + j * 0.35 + between(rand, -0.03, 0.03), x = CX + u * W, y = domeY(u) + Ht * (0.36 + 0.12 * Math.abs(u));
    sc += `<use href="#${D.add('score', () => '')}" transform="translate(${n0(x)} ${n0(y)})rotate(${n0(-13 + u * 10)})scale(${r1(1 - 0.25 * Math.abs(u))} 1)"/>`;
  }
  svg += `<g clip-path="${D.clip('btc', [s])}">${sc}</g>` +
    dots(Array.from({ length: 26 }, () => { const u = between(rand, -0.85, 0.85); return [CX + u * W, domeY(u) + between(rand, 6, Ht * 0.7), between(rand, 1, 4), 0]; }), '#FFF6E0', 2.2, ' opacity=".35"') +
    `<ellipse cx="${n0(CX - W * 0.38)}" cy="${n0(yT - Ht * 0.68)}" rx="${n0(W * 0.34)}" ry="${n0(Ht * 0.2)}" transform="rotate(-6 ${n0(CX - W * 0.38)} ${n0(yT - Ht * 0.68)})" fill="${D.rad('gloss', [[0, '#fff', 0.45], [1, '#fff', 0]])}"/>`;
  return rot ? `<g transform="rotate(${rot} ${CX} ${yT})">${svg}</g>` : svg;
}

/** French fries as layered butt-capped strokes: shaded edge, body, browned end, highlight. */
function fries(rand, list) {
  const edge = [], body = [], hl = [], tip = [];
  for (const { x, y, a, l } of list) {
    const ca = Math.cos(a), sa = Math.sin(a), dx = ca * l, dy = sa * l;
    let nx = -sa, ny = ca;
    if (nx + ny > 0) { nx = -nx; ny = -ny; } // normal toward the light (up-left)
    const x0 = x - dx / 2, y0 = y - dy / 2;
    edge.push([x0, y0, dx, dy]);
    body.push([x0 + nx * 2 + ca * 1.5, y0 + ny * 2 + sa * 1.5, dx - ca * 3, dy - sa * 3]);
    hl.push([x0 + nx * 5 + ca * 9, y0 + ny * 5 + sa * 9, dx * 0.66, dy * 0.66]);
    tip.push(rand() < 0.5 ? [x0, y0, ca * 9, sa * 9] : [x0 + dx, y0 + dy, -ca * 9, -sa * 9]);
  }
  const p = (l, col, w, ex = '') => dots(l, col, w, ex).replace('stroke-linecap="round"', 'stroke-linecap="butt"');
  return p(edge, '#CF8429', 19) + p(body, '#F8C653', 13) + p(tip, '#A9581A', 19, ' opacity=".4"') + p(hl, '#FFEDB2', 3.6, ' opacity=".9"');
}

/** Glossy sauce line (ketchup / mayo) following a zigzag. */
function sauceLine(pts, col, hi, w) {
  const d = smooth(pts, false);
  return `<path d="${d}" fill="none" stroke="#3a1606" stroke-opacity=".25" stroke-width="${w + 1}" stroke-linecap="round" transform="translate(1.5 3)"/><path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${hi}" stroke-width="${r1(w * 0.3)}" stroke-linecap="round" transform="translate(-1 -1.6)" opacity=".85"/>`;
}

function curryChunks(D, rand, list) {
  const g = D.rad('curry', [[0, '#FFE07A'], [0.4, '#F6B638'], [0.8, '#D8821E'], [1, '#A85A16']], { cx: 0.36, cy: 0.3, r: 0.75 });
  let svg = '';
  const sear = [], herb = [], spice = [], hl = [];
  for (const { x, y, rr } of list) {
    const rot = between(rand, -0.5, 0.5), ex = between(rand, 1.1, 1.45);
    const pts = Array.from({ length: 8 }, (_, k) => {
      const a = (k / 8) * Math.PI * 2, j = between(rand, 0.78, 1.15), px = Math.cos(a) * rr * ex * j, py = Math.sin(a) * rr * 0.78 * j;
      return [x + px * Math.cos(rot) - py * Math.sin(rot), y + px * Math.sin(rot) + py * Math.cos(rot)];
    });
    const d = smooth(pts);
    svg += `<path d="${d}" fill="#3a1606" opacity=".32" transform="translate(4 6)" filter="${D.blur(3)}"/><path d="${d}" fill="${g}" stroke="#8E4612" stroke-width="1.2" stroke-opacity=".5"/>`;
    for (let k = 0; k < 3; k++) sear.push([x + between(rand, -rr, rr * 0.9), y + between(rand, -rr * 0.2, rr * 0.55), between(rand, -7, 7), between(rand, -2, 2)]);
    if (rand() < 0.7) herb.push([x + between(rand, -rr * 0.8, rr * 0.6), y - between(rand, 0, rr * 0.5), between(rand, -4, 4), between(rand, -2.5, 2.5)]);
    spice.push([x + between(rand, -rr, rr), y + between(rand, -rr * 0.5, rr * 0.5)]);
    hl.push([x - rr * 0.6, y - rr * 0.38, rr * 0.55, -rr * 0.12]);
  }
  return svg + dots(sear, '#B05E1A', 4.5, ' opacity=".5"') + dots(spice, '#9A2E10', 2.6, ' opacity=".7"') + dots(herb, '#2F7A28', 6.5) + dots(herb.map(([x, y, dx, dy]) => [x - 1, y - 1, dx * 0.5, dy * 0.5]), '#6DB848', 2.6) + dots(hl, '#FFF4C8', 3.4, ' opacity=".75"');
}

function tomatoRounds(D, rand, list) {
  const flesh = D.rad('tomf', [[0, '#F5704C'], [0.6, '#E5432A'], [1, '#CC2E1A']]);
  return list.map(({ x, y, rx, rot }) => {
    const ry = rx * 0.5, P = (a, f) => `${r1(Math.cos(a) * rx * f)} ${r1(Math.sin(a) * ry * f)}`;
    let wedges = '';
    const seeds = [];
    for (let k = 0; k < 4; k++) {
      const a0 = (k / 4) * Math.PI * 2 + 0.25, a1 = a0 + 1.15, am = (a0 + a1) / 2;
      wedges += `M${P(a0, 0.24)}L${P(a0, 0.74)}Q${P(am, 0.92)} ${P(a1, 0.74)}L${P(a1, 0.24)}Q${P(am, 0.26)} ${P(a0, 0.24)}Z`;
      seeds.push([Math.cos(am - 0.18) * rx * 0.5, Math.sin(am - 0.18) * ry * 0.5], [Math.cos(am + 0.2) * rx * 0.56, Math.sin(am + 0.2) * ry * 0.56]);
    }
    return `<g transform="translate(${n0(x)} ${n0(y)})rotate(${n0(rot)})"><ellipse cx="3" cy="6" rx="${rx}" ry="${n0(ry)}" fill="#3a1606" opacity=".3" filter="${D.blur(3)}"/><ellipse rx="${rx}" ry="${n0(ry)}" fill="#A91E14"/><ellipse cy="-1" rx="${rx - 4}" ry="${n0(ry - 3)}" fill="${flesh}"/><path d="${wedges}" fill="#FFA04E" opacity=".9"/>${dots(seeds.map(([sx, sy]) => [sx - 1.5, sy, 3, 0.6]), '#FFF0A8', 3.2)}<ellipse cx="${n0(-rx * 0.4)}" cy="${n0(-ry * 0.55)}" rx="${n0(rx * 0.3)}" ry="2.5" fill="#fff" opacity=".6"/></g>`;
  }).join('');
}

function baguette(id, spec) {
  const rand = rng(id), D = defsFor(id);
  const W = 336, y0 = spec.y0, Hb = 74;
  const yT = y0 - spec.gap;
  let body = ground(id, D, y0 + Hb + 8, W * 0.98) + baguetteBottom(D, { y0, W, Hb });
  const c = { id, D, rand, W, y: y0, i: 0 };
  const drizzle = (yA, yB, step) => { const p = []; let up = true; for (let x = CX - W + 62; x < CX + W - 50; x += between(rand, step * 0.6, step * 1.3)) { p.push([x, (up ? yA : yB) + between(rand, -7, 7)]); if (rand() < 0.82) up = !up; } return p; };
  if (spec.kind === 'americain') {
    // two steaks hachés
    const pA = patty({ ...c, y: y0 + 8, i: 1 }, { kind: 'beef', cx: CX - 158, rx: 182, ry: 13, h: 44 });
    const pB = patty({ ...c, y: y0 + 4, i: 2 }, { kind: 'beef', cx: CX + 160, rx: 180, ry: 13, h: 44 });
    body += `<ellipse cx="${CX + 6}" cy="${y0 + 12}" rx="${W * 0.9}" ry="12" fill="#3a1606" opacity=".35" filter="${D.soft()}"/>` + pB.svg + pA.svg;
    // fries pile between the steaks and the top crust, spilling out of both ends
    const fr = [];
    for (let k = 0; k < 38; k++) fr.push({ x: CX + between(rand, -W + 46, W - 46), y: between(rand, yT - 2, y0 - 46), a: between(rand, -0.38, 0.38) * (rand() < 0.15 ? 1.8 : 1), l: between(rand, 74, 112) });
    for (const sgn of [-1, 1]) for (let k = 0; k < 3; k++) fr.push({ x: CX + sgn * (W - between(rand, -6, 22)), y: yT + 8 + k * 16 + between(rand, -4, 4), a: sgn * between(rand, -0.45, 0.45), l: between(rand, 84, 112) });
    body += fries(rand, fr);
    body += `<ellipse cx="${CX + 8}" cy="${yT + 10}" rx="${W * 0.9}" ry="13" fill="#3a1606" opacity=".4" filter="${D.soft()}"/>`;
    body += baguetteTop(D, rand, { yT, W: W - 4, Ht: 92 });
    // a few fries poking out in front of the top crust
    body += fries(rand, [-0.78, -0.4, 0.05, 0.42, 0.8].map((u, k) => ({ x: CX + u * W, y: yT + 14, a: (k % 2 ? 1 : -1) * between(rand, 0.35, 0.6), l: between(rand, 96, 118) })));
    body += sauceLine(drizzle(yT + 12, y0 - 50, 36), '#C8261A', '#F57D63', 7) + sauceLine(drizzle(yT + 20, y0 - 42, 44), '#FFF4DA', '#FFFFFF', 6);
  } else {
    // poulet curry: lettuce, tomato rounds, curry chicken chunks
    body += lettuce({ ...c, y: y0 + 6, i: 1 }, { rx: W - 4, ry: 10, h: 8, depth: 15, lobe: [32, 54] }).svg;
    const sauce = [];
    for (let k = 0; k <= 12; k++) { const u = -1 + k / 6; sauce.push([CX + u * (W - 30), yT + 12 - 6 * (1 - u * u)]); }
    sauce.push([CX + W - 40, y0 + 4], [CX - W + 40, y0 + 4]);
    body += `<path d="${smooth(sauce)}" fill="#C9701A"/>`;
    const ch = [];
    for (let k = 0; k < 10; k++) ch.push({ x: CX - W + 56 + k * ((2 * W - 112) / 9) + between(rand, -8, 8), y: yT + 24 + between(rand, -5, 3), rr: between(rand, 24, 31) });
    for (let k = 0; k < 9; k++) ch.push({ x: CX - W + 80 + k * ((2 * W - 160) / 8) + between(rand, -10, 10), y: yT + 50 + between(rand, -4, 4), rr: between(rand, 24, 30) });
    body += curryChunks(D, rand, ch);
    body += tomatoRounds(D, rand, [-0.66, -0.22, 0.22, 0.66].map((u, k) => ({ x: CX + u * W, y: y0 + 8 + between(rand, -2, 2), rx: 52, rot: k % 2 ? 4 : -4 })));
    body += curryChunks(D, rand, [-0.88, -0.44, 0, 0.44, 0.86].map((u) => ({ x: CX + u * W + between(rand, -8, 8), y: y0 - 8 + between(rand, -3, 3), rr: between(rand, 22, 27) })));
    body += `<ellipse cx="${CX + 8}" cy="${yT + 10}" rx="${W * 0.9}" ry="13" fill="#3a1606" opacity=".38" filter="${D.soft()}"/>`;
    body += baguetteTop(D, rand, { yT, W: W - 4, Ht: 92 });
  }
  return svgDoc({ defs: D.str(), body });
}

/* ------------------------------------------------------------------ kebab (pita pocket) */

/** Ruffled leaf: ellipse whose radius alternates, giving a lettuce-like wavy edge. */
function ruffle(rand, x, y, rx, ry, n = 16) {
  const p1 = rand() * 6.28, p2 = rand() * 6.28;
  return smooth(Array.from({ length: n }, (_, k) => {
    const a = (k / n) * Math.PI * 2, j = 0.9 + 0.08 * Math.sin(k * 1.9 + p1) + 0.05 * Math.sin(k * 4.7 + p2) + between(rand, -0.03, 0.03);
    return [x + Math.cos(a) * rx * j, y + Math.sin(a) * ry * j];
  }));
}

/** Lens-shaped ribbon from A to B bulging by `bend`, thickness t (consistent winding so subpaths union). */
function ribbon(x, y, ang, len, bend, t) {
  const dx = Math.cos(ang) * len, dy = Math.sin(ang) * len, nx = -Math.sin(ang), ny = Math.cos(ang);
  const ax = x - dx / 2, ay = y - dy / 2, cx = x + nx * bend, cy = y + ny * bend;
  return `M${n0(ax)} ${n0(ay)}Q${n0(cx + nx * t)} ${n0(cy + ny * t)} ${n0(ax + dx)} ${n0(ay + dy)}Q${n0(cx - nx * t)} ${n0(cy - ny * t)} ${n0(ax)} ${n0(ay)}Z`;
}

function kebab(id) {
  const rand = rng(id), D = defsFor(id);
  const Rw = 272, yr = 410, Hd = 188, L = CX - Rw, R = CX + Rw;
  const rimY = (x) => { const u = (x - CX) / Rw; return yr - 6 + 16 * (1 - u * u); };
  const heap = (x) => { const u = (x - CX) / (Rw - 16); return yr - 10 - 176 * Math.max(0, 1 - u * u) ** 0.55; };
  const lg = D.lin('leafg', [[0, '#8CCB52'], [0.5, '#5DA83E'], [1, '#3C8432']]), lg2 = D.lin('leafg2', [[0, '#6DB646'], [1, '#2F6E2C']]);
  const leaf = (x, y, rx, ry, col) => `<path d="${ruffle(rand, x, y, rx, ry, 30)}" fill="${col === 1 ? lg : lg2}" stroke="#C2E57A" stroke-width="2"/><path d="M${n0(x - rx * 0.6)} ${n0(y + ry * 0.3)}q${n0(rx * 0.6)} ${n0(-ry * 0.5)} ${n0(rx * 1.1)} ${n0(-ry * 0.45)}" fill="none" stroke="#D8F09A" stroke-width="2" opacity=".6"/>`;
  let g = '';
  // back layer of the folded pita, rising behind the filling (visible at the ends)
  const back = [];
  for (let k = 0; k <= 16; k++) { const u = -1 + (2 * k) / 16; back.push([CX + u * (Rw - 2), yr - 6 - 70 * (1 - u * u) ** 0.8]); }
  back.push([R - 30, yr + 40], [L + 30, yr + 40]);
  g += `<path d="${smooth(back)}" fill="${D.lin('pitab', [[0, '#E9C17E'], [0.6, '#D9A25C'], [1, '#B97C3C']])}" stroke="#F6E2B4" stroke-width="5"/>`;
  // lettuce leaves around the back of the heap
  for (let k = 0; k < 9; k++) {
    const u = -0.9 + k * (1.8 / 8) + between(rand, -0.04, 0.04), x = CX + u * Rw;
    g += leaf(x, heap(x) + 18 - (Math.abs(u) > 0.7 ? 0 : 6), between(rand, 34, 46), between(rand, 22, 30), k % 2 ? 2 : 1);
  }
  // heap base (deep shadow between pieces)
  const hp = [];
  for (let x = L + 26; x <= R - 26; x += 22) hp.push([x, heap(x) + 12]);
  hp.push([R - 30, yr + 30], [L + 30, yr + 30]);
  g += `<path d="${smooth(hp)}" fill="#7C3B17"/>`;
  // shaved, roasted meat: curled flakes, each lit from above (light caramel top → dark bottom)
  const fl = [
    D.lin('m1', [[0, '#E9A65E'], [0.45, '#BA6830'], [1, '#6E3214']]),
    D.lin('m2', [[0, '#E39A52'], [0.5, '#B0602C'], [1, '#6A3014']]),
    D.lin('m3', [[0, '#F2B874'], [0.5, '#C87A3A'], [1, '#7E3A18']]),
  ];
  const flakes = [];
  for (let k = 0; k < 66; k++) {
    const x = between(rand, L + 40, R - 40), top = heap(x);
    flakes.push({ x, y: between(rand, top + 6, rimY(x) + 14), w: between(rand, 30, 52), h: between(rand, 11, 18), a: between(rand, -28, 28) });
  }
  flakes.sort((a, b) => a.y - b.y);
  g += flakes.map((q) => `<path d="M${n0(-q.w)} 4C${n0(-q.w * 0.7)} ${n0(-q.h)} ${n0(q.w * 0.7)} ${n0(-q.h * 1.1)} ${n0(q.w)} 2C${n0(q.w * 0.5)} ${n0(q.h * 0.25)} ${n0(-q.w * 0.5)} ${n0(q.h * 0.3)} ${n0(-q.w)} 4Z" transform="translate(${n0(q.x)} ${n0(q.y)})rotate(${n0(q.a)})" fill="${pick(rand, fl)}"/>`).join('');
  g += dots(flakes.filter((_, k) => k % 2).map((q) => [q.x - q.w * 0.45, q.y - q.h * 0.55, q.w * 0.6, -1]), '#FFD39A', 2.4, ' opacity=".7"');
  const shreds = [];
  for (let k = 0; k < 12; k++) { const x = between(rand, L + 50, R - 50), y = heap(x) + between(rand, 18, 70); shreds.push(`M${n0(x)} ${n0(y)}q${nums([n0(between(rand, 6, 12)), n0(-between(rand, 8, 14)), n0(between(rand, 18, 30)), n0(between(rand, -4, 4))])}`); }
  g += `<path d="${shreds.join('')}" fill="none" stroke="#3F8A33" stroke-width="9" stroke-linecap="round"/><path d="${shreds.join('')}" fill="none" stroke="#9AD25A" stroke-width="4" stroke-linecap="round" transform="translate(-1 -2)"/>`;
  // tomato half-slices and red onion slivers
  const tw = [];
  for (let k = 0; k < 8; k++) { const x = L + 70 + k * ((2 * Rw - 140) / 7) + between(rand, -12, 12); tw.push({ x, y: heap(x) + between(rand, 24, 64), rx: between(rand, 22, 28), rot: between(rand, -25, 25) }); }
  g += tw.map(({ x, y, rx, rot }) => `<g transform="translate(${n0(x)} ${n0(y)})rotate(${n0(rot)})"><path d="M${-rx} 0A${rx} ${n0(rx * 0.75)} 0 0 0 ${rx} 0Z" fill="#B3221A"/><path d="M${-rx + 4} 0A${rx - 4} ${n0(rx * 0.75 - 4)} 0 0 0 ${rx - 4} 0Z" fill="#EE5232"/>${dots([[-rx * 0.45, 6, 6, 0], [rx * 0.2, 6, 6, 0]], '#FF9A4E', 6)}${dots([[-rx * 0.4, 6], [-rx * 0.25, 7], [rx * 0.25, 6], [rx * 0.4, 7]], '#FFE27A', 2.2)}<path d="M${-rx} 0H${rx}" stroke="#FF8A6A" stroke-width="2.5"/></g>`).join('');
  const on = [];
  for (let k = 0; k < 14; k++) { const x = between(rand, L + 60, R - 60), y = heap(x) + between(rand, 14, 70); on.push(`M${n0(x)} ${n0(y)}q${nums([n0(between(rand, 8, 14)), n0(-between(rand, 9, 14)), n0(between(rand, 24, 34)), n0(between(rand, -3, 4))])}`); }
  g += `<path d="${on.join('')}" fill="none" stroke="#741B57" stroke-width="8" stroke-linecap="round"/><path d="${on.join('')}" fill="none" stroke="#F2D4E6" stroke-width="2.4" stroke-linecap="round" transform="translate(0 2)"/><path d="${on.join('')}" fill="none" stroke="#B5509A" stroke-width="2" stroke-linecap="round" transform="translate(-1 -2)"/>`;
  // white garlic sauce: loose random drizzle
  for (const [x0, x1, step] of [[L + 70, R - 64, 40], [L + 110, R - 100, 52]]) {
    const zz = [];
    let up = true;
    for (let x = x0; x <= x1; x += between(rand, step * 0.6, step * 1.2)) { zz.push([x + between(rand, -6, 6), heap(x) + (up ? between(rand, 8, 24) : between(rand, 34, 66))]); if (rand() < 0.8) up = !up; }
    g += sauceLine(zz, '#FFF8EA', '#FFFFFF', 6);
  }
  // the front of the pita
  const rim = [];
  for (let k = 0; k <= 16; k++) { const x = L + (2 * Rw * k) / 16; rim.push([x, rimY(x) + between(rand, -2, 2)]); }
  g += `<path d="${smooth(rim, false)}" fill="none" stroke="#2a1006" stroke-width="22" opacity=".35" filter="${D.blur(7)}" transform="translate(4 -6)"/>`;
  const fp = [...rim];
  for (let k = 1; k < 24; k++) { const t = (k / 24) * Math.PI; fp.push([CX + Rw * Math.cos(t) * (1 + 0.04 * Math.sin(t)), yr + 10 + Hd * Math.sin(t) ** 0.7]); }
  const sf = D.shape('pitaf', smooth(fp));
  g += use(sf, D.lin('pita', [[0, '#F9E5B4'], [0.5, '#F1CC88'], [0.85, '#DEA862'], [1, '#C68A48']]), ` filter="${D.grain('pita', { freq: 0.9, amount: 0.14 })}"`) +
    use(sf, D.lin('cylp', [[0, '#fff', 0.2], [0.3, '#fff', 0], [0.75, '#000', 0], [1, '#000', 0.16]], [0, 0, 1, 0]));
  const spot = D.rad('spot', [[0, '#A85E24', 0.65], [0.55, '#C27A38', 0.28], [1, '#C27A38', 0]]);
  let spots = '';
  for (let k = 0; k < 18; k++) {
    const u = between(rand, -0.88, 0.88), x = CX + u * Rw * 0.95, top = rimY(x) + 14, bot = yr + 10 + Hd * Math.sqrt(1 - u * u) * 0.9;
    spots += `<ellipse cx="${n0(x)}" cy="${n0(top + rand() * (bot - top))}" rx="${n0(between(rand, 10, 24))}" ry="${n0(between(rand, 6, 12))}" fill="${spot}"/>`;
  }
  g += `<g clip-path="${D.clip('pc', [sf])}">${spots}${dots(Array.from({ length: 24 }, () => { const u = between(rand, -0.85, 0.85), x = CX + u * Rw; return [x, rimY(x) + 14 + rand() * (Hd * Math.sqrt(1 - u * u) * 0.8)]; }), '#7A3E14', 2.6, ' opacity=".45"')}</g>`;
  // rim lip (bread thickness)
  g += `<path d="${smooth(rim, false)}" fill="none" stroke="#C88A46" stroke-width="2.5" transform="translate(0 6)" opacity=".6"/><path d="${smooth(rim, false)}" fill="none" stroke="#FCF0D2" stroke-width="8" stroke-linecap="round"/>`;
  // filling spilling over the front rim: lettuce, meat flakes, sauce drips
  for (const [u, rx, col] of [[-0.82, 34, 1], [-0.3, 28, 2], [0.36, 30, 1], [0.84, 30, 2]]) { const x = CX + u * Rw; g += leaf(x, rimY(x) + 8, rx, 15, col); }
  g += [-0.56, 0.08, 0.6].map((u) => { const x = CX + u * Rw, y = rimY(x) + 2; return `<path d="M-30 4C-21 -16 21 -18 30 2C15 7-15 8-30 4Z" transform="translate(${n0(x)} ${n0(y)})rotate(${n0(between(rand, -14, 14))})" fill="${fl[0]}"/>`; }).join('');
  const drip = (x, len) => { const y = rimY(x) + 2; return `M${n0(x - 7)} ${n0(y)}q6 ${n0(len * 0.5)} 3 ${len}a5.5 5.5 0 0 0 11 0q-3 ${n0(-len * 0.6)} 3 ${-len}Z`; };
  g += `<path d="${drip(CX - 150, 28)}${drip(CX + 196, 40)}" fill="#FFF8EA" stroke="#E6D3B4" stroke-width="1"/>`;
  const sh = ground(id, D, yr + Hd + 14, Rw * 0.92);
  return svgDoc({ defs: D.str(), body: sh + `<g transform="rotate(-10 ${CX} ${yr + 40})">${g}</g>` });
}

/* ------------------------------------------------------------------ items */

export const art = {
  cheeseburger: () => burger('cheeseburger', {
    layers: [
      { t: 'bunBottom', bun: 'sesame', h: 64 },
      { t: 'patty', kind: 'beef', h: 70 },
      { t: 'drape', h: 10, pal: CHEDDAR, corners: true, drips: 3, len: 40 },
      { t: 'pickles', h: 4, at: [-0.52, 0.1, 0.6] },
      { t: 'tomato', h: 30 },
      { t: 'lettuce', h: 12, depth: 14 },
      { t: 'bunTop', bun: 'sesame', H: 178, seeds: true, seedsN: 44 },
    ],
  }),
  'double-smash': () => burger('double-smash', {
    layers: [
      { t: 'bunBottom', bun: 'potato', h: 60 },
      { t: 'patty', kind: 'smash', h: 38, w: 1.1 },
      { t: 'drape', h: 10, pal: AMERICAN, corners: true, drips: 3, len: 34 },
      { t: 'patty', kind: 'smash', h: 38, w: 1.1 },
      { t: 'drape', h: 10, pal: AMERICAN, corners: true, drips: 4, len: 42 },
      { t: 'onions', h: 24 },
      { t: 'bunTop', bun: 'potato', H: 170, ex: 0.6 },
    ],
  }),
  'chicken-crispy': () => burger('chicken-crispy', {
    layers: [
      { t: 'bunBottom', bun: 'brioche', h: 58 },
      { t: 'chicken', h: 90 },
      { t: 'lettuce', h: 12, depth: 18 },
      { t: 'drape', h: 6, pal: MAYO, corners: false, drips: 4, len: 40, w: 0.98 },
      { t: 'bunTop', bun: 'brioche', H: 178, ex: 0.56 },
    ],
  }),
  'veggie-burger': () => burger('veggie-burger', {
    layers: [
      { t: 'bunBottom', bun: 'multigrain', h: 58 },
      { t: 'lettuce', h: 10, depth: 18 },
      { t: 'patty', kind: 'veg', h: 62, w: 1.0 },
      { t: 'avocado', h: 18, at: [-0.72, -0.44, -0.15, 0.14, 0.43, 0.71] },
      { t: 'tomato', h: 26 },
      { t: 'redOnion', h: 6, at: [-0.48, 0.02, 0.5] },
      { t: 'bunTop', bun: 'multigrain', H: 172, seeds: 'multi', seedsN: 48 },
    ],
  }),
  kebab: () => kebab('kebab'),
  americain: () => baguette('americain', { kind: 'americain', y0: 500, gap: 92 }),
  'poulet-curry': () => baguette('poulet-curry', { kind: 'curry', y0: 492, gap: 74 }),
};
