// Demo food art: salad-drink-dessert. See lib.mjs for helpers and build.mjs for the required ids.
// Light from the top-left everywhere.
//  - salad(id, spec): TOP-DOWN ceramic bowl (rim highlight, rim shadow on the inner wall), a mound of
//    layered leaves (each leaf casts its own soft shadow, the whole mound gets one dome light) and
//    parametric toppings (every topping group gets an alpha-driven bevel + drop shadow).
//  - glassDrink(id, spec): FRONT VIEW tumbler with perspective ellipses: liquid, ice, bubbles, straw
//    (refracted below the surface), garnish on the rim, condensation drops.
//  - waterBottle(id): unbranded clear bottle with a light blue cap.
//  - tiramisu / brownie: 3/4 view blocks; each face is drawn flat in its own coordinates and mapped
//    onto the block with an affine matrix (layers, sponge sections, crackly crust).
import { rng, between, scatterInCircle, mix, contactShadow, shadowFilter, grainFilter, svgDoc } from './lib.mjs';

const CX = 400;
const TAU = Math.PI * 2;
const n0 = (v) => Math.round(v);
const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;
const nums = (a) => a.join(' ').replace(/ -/g, '-');
const deg = (a) => (a * 180) / Math.PI;

/* ------------------------------------------------------------------ geometry */

/** Catmull-Rom spline through points → cubic Bézier path. */
function smooth(pts, closed = true, prec = 0) {
  const f = prec ? r1 : n0;
  const n = pts.length;
  const g = (i) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
    d += `C${nums([f(p1[0] + (p2[0] - p0[0]) / 6), f(p1[1] + (p2[1] - p0[1]) / 6), f(p2[0] - (p3[0] - p1[0]) / 6), f(p2[1] - (p3[1] - p1[1]) / 6), f(p2[0]), f(p2[1])])}`;
  }
  return d + (closed ? 'Z' : '');
}
const poly = (pts) => 'M' + pts.map((p) => `${n0(p[0])} ${n0(p[1])}`).join('L') + 'Z';
const circleD = (x, y, rr) => `M${r1(x - rr)} ${r1(y)}a${r1(rr)} ${r1(rr)} 0 1 1 ${r1(2 * rr)} 0a${r1(rr)} ${r1(rr)} 0 1 1 ${r1(-2 * rr)} 0Z`;

/** Many short round-capped strokes in ONE path: cheap dots (specks, pores, crumbs, drops). */
const dots = (list, color, w, extra = '') =>
  list.length ? `<path d="${list.map(([x, y, dx = 0.4, dy = 0]) => `M${n0(x)} ${n0(y)}l${nums([r1(dx), r1(dy)])}`).join('')}" stroke="${color}" stroke-width="${w}" stroke-linecap="round" fill="none"${extra}/>` : '';

/* ------------------------------------------------------------------ defs manager */

function defsFor(id) {
  const m = new Map();
  const add = (name, body) => { const key = `${id}-${name}`; if (!m.has(key)) m.set(key, body(key)); return key; };
  const f3 = (v) => Math.round(v * 1000) / 1000;
  const stops = (s) => s.map(([o, c, op]) => `<stop offset="${f3(o)}" stop-color="${c}"${op != null && op !== 1 ? ` stop-opacity="${op}"` : ''}/>`).join('');
  const FU = 'filterUnits="userSpaceOnUse" x="-40" y="-40" width="880" height="880" color-interpolation-filters="sRGB"';
  const D = {
    id, add, has: (k) => m.has(k),
    lin: (name, s, v = [0, 0, 0, 1], user = false) =>
      `url(#${add(name, (k) => `<linearGradient id="${k}" x1="${v[0]}" y1="${v[1]}" x2="${v[2]}" y2="${v[3]}"${user ? ' gradientUnits="userSpaceOnUse"' : ''}>${stops(s)}</linearGradient>`)})`,
    rad: (name, s, { cx = 0.5, cy = 0.5, r = 0.5, user = false } = {}) =>
      `url(#${add(name, (k) => `<radialGradient id="${k}" cx="${cx}" cy="${cy}" r="${r}"${user ? ' gradientUnits="userSpaceOnUse"' : ''}>${stops(s)}</radialGradient>`)})`,
    shape: (name, d) => add(name, (k) => `<path id="${k}" d="${d}"/>`),
    sym: (name, body) => add(name, (k) => `<g id="${k}">${body}</g>`),
    clip: (name, inner) => `url(#${add(name, (k) => `<clipPath id="${k}">${inner}</clipPath>`)})`,
    blur: (sd) => `url(#${add(`b${String(sd).replace('.', '_')}`, (k) => `<filter id="${k}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${sd}"/></filter>`)})`,
    /** Alpha-driven bevel (light top-left, shade bottom-right) + soft drop shadow, for topping groups. */
    bevel: (name = 'bv', { b = 2.5, o = 1.6, hi = 0.45, lo = 0.4, ds = 0.42, dsB = 3.5, dx = 3, dy = 5 } = {}) =>
      `url(#${add(name, (k) => `<filter id="${k}" ${FU}><feGaussianBlur in="SourceAlpha" stdDeviation="${dsB}"/><feOffset dx="${dx}" dy="${dy}" result="so"/><feFlood flood-color="#2A1004" flood-opacity="${ds}"/><feComposite in2="so" operator="in" result="ds"/>` +
        `<feGaussianBlur in="SourceAlpha" stdDeviation="${b}" result="b"/><feOffset in="b" dx="${o}" dy="${o}" result="b1"/><feComposite in="SourceAlpha" in2="b1" operator="arithmetic" k2="1" k3="-1" result="h"/>` +
        `<feFlood flood-color="#FFF8E6" flood-opacity="${hi}"/><feComposite in2="h" operator="in" result="hc"/>` +
        `<feOffset in="b" dx="${-o}" dy="${-o}" result="b2"/><feComposite in="SourceAlpha" in2="b2" operator="arithmetic" k2="1" k3="-1" result="l"/>` +
        `<feFlood flood-color="#3A1405" flood-opacity="${lo}"/><feComposite in2="l" operator="in" result="lc"/>` +
        `<feMerge><feMergeNode in="ds"/><feMergeNode in="SourceGraphic"/><feMergeNode in="lc"/><feMergeNode in="hc"/></feMerge></filter>`)})`,
    grain: (name, opts) => `url(#${add(`${name}-grain`, () => grainFilter(`${id}-${name}`, opts))})`,
    white: () => `url(#${add('white', (k) => `<filter id="${k}" ${FU}><feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"/></filter>`)})`,
    mask: (name, gid) => `url(#${add(name, (k) => `<mask id="${k}" maskUnits="userSpaceOnUse" x="0" y="0" width="800" height="800"><use href="#${gid}" filter="${D.white()}"/></mask>`)})`,
    str: () => [...m.values()].join(''),
  };
  return D;
}
const use = (k, fill, extra = '') => `<use href="#${k}" fill="${fill}"${extra}/>`;
const place = (k, x, y, a = 0, s = 1, sy = s) => `<use href="#${k}" transform="translate(${n0(x)} ${n0(y)})${a ? `rotate(${n0(a)})` : ''}${s !== 1 || sy !== s ? `scale(${r2(s)}${sy !== s ? ` ${r2(sy)}` : ''})` : ''}"/>`;

/** Ground contact shadow for front-view items: wide soft warm ellipse + tighter darker core. */
function ground(D, cx, cy, rx, op = 0.34) {
  D.add('shadow', () => shadowFilter(D.id, 16));
  return contactShadow(D.id, { cx: cx + 10, cy, rx, ry: 28, opacity: op }) +
    `<ellipse cx="${n0(cx + 6)}" cy="${n0(cy - 5)}" rx="${n0(rx * 0.74)}" ry="9" fill="#3a1f10" opacity=".32" filter="${D.blur(6)}"/>`;
}

/* ================================================================== SALADS (top-down) */

const BOWL = {
  cream: { hi: '#FFFFFF', mid: '#F5EDE0', lo: '#D6C6AC', edge: '#9E8667', wallLo: '#CDBDA2', wall: '#ECE2D1', wallHi: '#FBF7F0', speck: '#8E7558' },
  terracotta: { hi: '#F6B590', mid: '#DA7A4C', lo: '#A44E2A', edge: '#6A2C12', wallLo: '#8E4021', wall: '#B9603A', wallHi: '#DE8C5E', speck: '#6E2E12' },
  creamBand: { hi: '#FFFFFF', mid: '#F4EBDC', lo: '#D3C2A6', edge: '#9A8061', wallLo: '#CBBA9E', wall: '#EBE0CE', wallHi: '#FAF6EE', speck: '#8E7558', band: '#B4572F' },
};

function bowl(D, rand, { cx, cy, R, rim }, p) {
  const Ri = R - rim, f3 = (v) => Math.round(v * 1000) / 1000;
  D.add('shadow', () => shadowFilter(D.id, 16));
  const arc = (rad, a0, a1) => `M${n0(cx + rad * Math.cos(a0))} ${n0(cy + rad * Math.sin(a0))}A${n0(rad)} ${n0(rad)} 0 0 1 ${n0(cx + rad * Math.cos(a1))} ${n0(cy + rad * Math.sin(a1))}`;
  const o = f3(Ri / R);
  let s = contactShadow(D.id, { cx: cx + 14, cy: cy + 22, rx: R + 4, ry: R - 8, opacity: 0.36 }) +
    `<circle cx="${cx + 7}" cy="${cy + 10}" r="${R}" fill="#2a1206" opacity=".34" filter="${D.blur(7)}"/>` +
    `<circle cx="${cx + 3}" cy="${cy + 5}" r="${R}" fill="${p.edge}"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${D.rad('rim', [[0, p.hi], [0.55, p.mid], [1, p.lo]], { cx: 0.3, cy: 0.27, r: 0.9 })}"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${D.rad('lip', [[o, '#fff', 0], [o + (1 - o) * 0.42, '#fff', 0.4], [o + (1 - o) * 0.78, '#fff', 0], [1, '#000', 0.22]])}"/>`;
  if (p.band) s += `<circle cx="${cx}" cy="${cy}" r="${n0(R - rim * 0.3)}" fill="none" stroke="${p.band}" stroke-width="4" opacity=".9"/>`;
  const sp = [];
  for (let i = 0; i < 70; i++) { const a = rand() * TAU, d = between(rand, Ri + 3, R - 3); sp.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d]); }
  s += dots(sp, p.speck, 1.8, ' opacity=".45"');
  s += `<circle cx="${cx}" cy="${cy}" r="${Ri}" fill="${D.lin('wall', [[0, p.wallLo], [0.5, p.wall], [1, p.wallHi]], [0.2, 0.15, 0.8, 0.85])}"/>`;
  s += `<g clip-path="${D.clip('inner', `<circle cx="${cx}" cy="${cy}" r="${Ri}"/>`)}"><circle cx="${cx + 10}" cy="${cy + 13}" r="${Ri + 6}" fill="none" stroke="#2a1206" stroke-opacity=".4" stroke-width="26" filter="${D.blur(8)}"/></g>`;
  s += `<path d="${arc((R + Ri) / 2, 3.4, 4.5)}" stroke="#fff" stroke-width="9" stroke-linecap="round" fill="none" opacity=".75" filter="${D.blur(2.5)}"/>` +
    `<path d="${arc((R + Ri) / 2 - 2, 3.7, 4.12)}" stroke="#fff" stroke-width="3.5" stroke-linecap="round" fill="none"/>` +
    `<path d="${arc(Ri + 2, 0.15, 1.35)}" stroke="#fff" stroke-width="3" stroke-linecap="round" fill="none" opacity=".55"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${R - 1}" fill="none" stroke="${p.edge}" stroke-opacity=".5" stroke-width="2"/>`;
  return s;
}

const LEAF = {
  romaine: { len: 210, wid: 38, waves: 7, amp: 0.1, tipPow: 1.25, curve: 7, rib: 9, pal: ['#EAF4BC', '#A3CF5E', '#4F9C35', '#2C6E25'], edge: '#163F10', eo: 0.6, vein: '#EEF8C8', rim: '#F2FAD0' },
  romaine2: { len: 190, wid: 42, waves: 9, amp: 0.12, tipPow: 1.35, curve: -9, rib: 9, pal: ['#F3F8CC', '#B9DB6C', '#62AB3B', '#317A29'], edge: '#163F10', eo: 0.55, vein: '#F2FAD0', rim: '#F4FBD8' },
  oak: { len: 130, wid: 44, waves: 4.5, amp: 0.26, tipPow: 1.1, curve: 5, rib: 5, pal: ['#DCEFA4', '#8FCA50', '#4E9C33', '#2D7226'], edge: '#1B4A14', eo: 0.55, vein: '#E6F4BA', rim: '#EAF7C4' },
  red: { len: 120, wid: 46, waves: 5, amp: 0.28, tipPow: 1.05, curve: -5, rib: 5, pal: ['#D2E393', '#98A54C', '#90304A', '#5E112B'], edge: '#4A0A22', eo: 0.85, vein: '#F4E6CC', rim: '#E8A0B4' },
  mache: { len: 66, wid: 20, waves: 0, amp: 0, tipPow: 1.6, curve: 2, rib: 2.5, pal: ['#86BE52', '#559A37', '#337A2A', '#24611F'], edge: '#123A0E', eo: 0.5, vein: '#B4DC86', rim: '#C8EA9A' },
  mint: { len: 74, wid: 22, waves: 8, amp: 0.09, tipPow: 1.2, curve: 3, rib: 2.5, pal: ['#C2E68A', '#74C24E', '#3C9A3C', '#287A30'], edge: '#145018', eo: 0.5, vein: '#DDF6B6', rim: '#E4F8C4' },
};

/** A leaf symbol (base at 0,0 pointing +x) and its soft shadow symbol. Returns the symbol key. */
function makeLeaf(D, rand, kind) {
  const L = LEAF[kind], key = `${D.id}-lf-${kind}`;
  if (D.has(key)) return key;
  const N = 20, top = [], bot = [], ph1 = rand() * TAU, ph2 = rand() * TAU;
  const cl = (t) => L.curve * Math.sin(Math.PI * t);
  const wd = (t) => L.wid * Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(t, L.tipPow))), 0.7);
  for (let i = 0; i <= N; i++) {
    const t = i / N, x = t * L.len, w = wd(t);
    const wv = (ph) => 1 + L.amp * (Math.sin(t * L.waves * TAU + ph) + 0.45 * Math.sin(t * L.waves * 2.3 * TAU + 2 * ph));
    top.push([x, cl(t) - w * wv(ph1)]);
    bot.push([x, cl(t) + w * wv(ph2)]);
  }
  const sh = D.shape(`lf-${kind}-p`, smooth([...top, ...bot.slice(1, -1).reverse()], true, L.len < 100 ? 1 : 0));
  let veins = '';
  for (let j = 1; j <= 6; j++) {
    const t = j / 8, x = t * L.len, t2 = Math.min(0.95, t + 0.14);
    for (const sg of [-1, 1]) veins += `M${r1(x)} ${r1(cl(t))}Q${r1(x + L.len * 0.08)} ${r1(cl(t) + sg * wd(t) * 0.45)} ${r1(t2 * L.len)} ${r1(cl(t2) + sg * wd(t2) * 0.78)}`;
  }
  const rib = `M0 ${-L.rib}Q${r1(L.len * 0.45)} ${r1(cl(0.45) - L.rib * 0.4)} ${r1(L.len * 0.86)} ${r1(cl(0.86))}Q${r1(L.len * 0.45)} ${r1(cl(0.45) + L.rib * 0.4)} 0 ${L.rib}Z`;
  D.sym(`lf-${kind}`,
    use(sh, D.lin(`lf-${kind}-g`, [[0, L.pal[0]], [0.3, L.pal[1]], [0.68, L.pal[2]], [1, L.pal[3]]], [0, 0, 1, 0])) +
    use(sh, D.lin(`lf-${kind}-e`, [[0, L.edge, L.eo], [0.3, L.edge, 0], [0.7, L.edge, 0], [1, L.edge, L.eo]])) +
    `<path d="${veins}" stroke="${L.vein}" stroke-opacity=".5" stroke-width="1.4" fill="none" stroke-linecap="round"/>` +
    `<path d="${rib}" fill="${D.lin(`lf-${kind}-r`, [[0, '#FBFDEB', 0.95], [1, L.vein, 0.35]], [0, 0, 1, 0])}"/>` +
    use(sh, 'none', ` stroke="${L.rim}" stroke-opacity=".5" stroke-width="1.3"`));
  return key;
}
const leafUse = (key, x, y, a, sx, sy) => `<use href="#${key}" transform="translate(${n0(x)} ${n0(y)})rotate(${n0(a)})scale(${r2(sx)} ${r2(sy)})"/>`;

/** Fill the bowl with leaves: an outer ring pointing at the wall, then a mound sorted outside → in. */
function greens(D, rand, B, g) {
  const { cx, cy } = B, Ri = B.R - B.rim;
  const keys = g.mix.map((m) => ({ ...m, key: makeLeaf(D, rand, m.kind) }));
  const tot = keys.reduce((s, m) => s + m.w, 0);
  const choose = () => { let t = rand() * tot; for (const m of keys) if ((t -= m.w) <= 0) return m; return keys[0]; };
  const pts = [];
  for (let i = 0; i < g.ring; i++) { const a = ((i + between(rand, -0.2, 0.2)) / g.ring) * TAU; pts.push({ x: cx + Math.cos(a) * Ri * 0.72, y: cy + Math.sin(a) * Ri * 0.72, ring: true }); }
  const inner = scatterInCircle(rand, { cx, cy, radius: Ri - 40, count: g.count, minDist: g.minDist });
  inner.sort((p, q) => Math.hypot(q.x - cx, q.y - cy) - Math.hypot(p.x - cx, p.y - cy));
  let out = '', grp = '', cnt = 0;
  const flush = () => { if (grp) out += `<g filter="${D.bevel('bvl', { b: 3, o: 2, hi: 0.35, lo: 0.4, ds: 0.55, dsB: 5, dx: 5, dy: 8 })}">${grp}</g>`; grp = ''; };
  for (const p of [...pts, ...inner]) {
    if (cnt++ % g.per === 0) flush();
    const m = choose(), L = LEAF[m.kind];
    const dist = Math.hypot(p.x - cx, p.y - cy), a = Math.atan2(p.y - cy, p.x - cx);
    const dir = dist < 45 ? rand() * TAU : a + between(rand, -0.6, 0.6) * (p.ring ? 0.5 : 1);
    const sc = between(rand, ...g.scale) * (m.s ?? 1), len = L.len * sc;
    const ux = Math.cos(dir), uy = Math.sin(dir);
    let bx = p.x - ux * len * 0.45, by = p.y - uy * len * 0.45;
    for (let t = 0; t < 40 && Math.hypot(bx + ux * len - cx, by + uy * len - cy) > Ri + 2; t++) { bx -= ux * 5; by -= uy * 5; }
    grp += leafUse(m.key, bx, by, deg(dir), sc, sc * (rand() < 0.5 ? -1 : 1));
  }
  flush();
  return out;
}

function salad(id, spec) {
  const rand = rng(id), D = defsFor(id);
  const B = { cx: CX, cy: 392, R: 322, rim: 30 }, Ri = B.R - B.rim;
  let body = bowl(D, rand, B, BOWL[spec.bowl]);
  body += `<circle cx="${B.cx}" cy="${B.cy}" r="${Ri - 22}" fill="${spec.floor ?? '#2A561D'}" filter="${D.blur(9)}"/>`;
  const gid = D.sym('greens', greens(D, rand, B, spec.greens));
  body += `<use href="#${gid}"/><circle cx="${B.cx}" cy="${B.cy}" r="${Ri + 8}" fill="${D.rad('mound', [[0, '#FFFBD6', 0.32], [0.38, '#FFFBD6', 0.05], [0.6, '#000', 0], [1, '#081404', 0.45]], { cx: 0.38, cy: 0.35, r: 0.72 })}" mask="${D.mask('gm', gid)}"/>`;
  body += spec.top({ D, rand, cx: B.cx, cy: B.cy, Ri });
  return svgDoc({ defs: D.str(), body });
}

/* ------------------------------------------------------------------ salad toppings */

function drizzle(D, rand, { x0, y0, x1, y1, amp, waves, n = 18 }, col, dash = '') {
  const pts = [], nx = -(y1 - y0), ny = x1 - x0, nl = Math.hypot(nx, ny), ph = rand() * TAU;
  for (let i = 0; i <= n; i++) {
    const t = i / n, o = amp * Math.sin(t * waves * TAU + ph) + between(rand, -5, 5);
    pts.push([x0 + (x1 - x0) * t + (nx / nl) * o, y0 + (y1 - y0) * t + (ny / nl) * o]);
  }
  const d = smooth(pts, false), da = dash ? ` stroke-dasharray="${dash}"` : '';
  return `<path d="${d}" fill="none" stroke="${col.lo}" stroke-width="${col.w + 3}" stroke-linecap="round" opacity=".4" transform="translate(2 4)" filter="${D.blur(2)}"${da}/>` +
    `<path d="${d}" fill="none" stroke="${col.mid}" stroke-width="${col.w}" stroke-linecap="round"${da}/>` +
    `<path d="${d}" fill="none" stroke="${col.hi}" stroke-width="${r1(col.w * 0.32)}" stroke-linecap="round" opacity=".9" transform="translate(-1 -1.4)"${da}/>`;
}
const DRESSING = { lo: '#7A5A2A', mid: '#FFF6DF', hi: '#FFFFFF', w: 6 };
const HONEY = { lo: '#7A3A02', mid: '#EFA21C', hi: '#FFEBA0', w: 5.5 };

function pepper(rand, cx, cy, rad, n) {
  const p = [];
  for (let i = 0; i < n; i++) { const a = rand() * TAU, d = Math.sqrt(rand()) * rad; p.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d, between(rand, -0.8, 0.8), between(rand, -0.8, 0.8)]); }
  return dots(p, '#2A1D14', 2.6, ' opacity=".8"');
}

function chickenSym(D) {
  const len = 150, wid = 48, pts = [];
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * TAU, c = Math.cos(a), s = Math.sin(a);
    const x = Math.sign(c) * Math.abs(c) ** 0.45 * (len / 2), u = x / (len / 2);
    pts.push([x, Math.sign(s) * Math.abs(s) ** 0.7 * (wid / 2) - 6 * (1 - u * u)]);
  }
  const ck = D.shape('ck', smooth(pts, true));
  let marks = '';
  for (let x = -len / 2 + 8; x < len / 2 - 10; x += 34) marks += `M${x} -22l16 40`;
  return D.sym('chicken',
    use(ck, D.lin('ckg', [[0, '#F8D38C'], [0.42, '#E6A453'], [1, '#B4622A']])) +
    `<g clip-path="${D.clip('ckc', `<use href="#${ck}"/>`)}"><path d="${marks}" stroke="#7A3610" stroke-width="15" stroke-linecap="round" opacity=".35"/><path d="${marks}" stroke="#3A1606" stroke-width="7.5" stroke-linecap="round" opacity=".85"/>` +
    `${use(ck, '#F5E4C8', ' transform="translate(0 37)"')}<path d="M-56 19h14M-30 21h18M2 21h16M30 18h14" stroke="#DDBB90" stroke-width="1.6"/></g>` +
    use(ck, 'none', ' stroke="#8A4416" stroke-opacity=".4" stroke-width="1.5"') +
    `<path d="M-50 -17Q0 -32 48 -17" stroke="#FFF2D0" stroke-opacity=".55" stroke-width="3" fill="none" stroke-linecap="round"/>`);
}

function croutonSym(D, name, s, cols) {
  const h = s / 2;
  return D.sym(name,
    `<rect x="${-h + 4}" y="${-h + 6}" width="${s}" height="${s - 2}" rx="${n0(s * 0.22)}" fill="${cols[2]}"/>` +
    `<rect x="${-h}" y="${-h}" width="${s - 3}" height="${s - 4}" rx="${n0(s * 0.22)}" fill="${D.lin(`${name}g`, [[0, cols[0]], [0.55, cols[1]], [1, mix(cols[1], cols[2], 0.5)]], [0, 0, 1, 1])}"/>` +
    dots([[-h * 0.4, -h * 0.3], [h * 0.3, -h * 0.5], [h * 0.1, h * 0.2], [-h * 0.5, h * 0.45], [h * 0.55, h * 0.4], [-h * 0.05, -h * 0.65]], '#B06A26', 3.4, ' opacity=".6"') +
    dots([[-h * 0.15, h * 0.05, 2, 1], [h * 0.4, -h * 0.05, 1.5, -1.5]], '#5F7F28', 2.4, ' opacity=".8"') +
    `<path d="M${n0(-h + 5)} ${n0(-h + 2)}h${n0(s * 0.55)}" stroke="#fff" stroke-opacity=".6" stroke-width="2.5" stroke-linecap="round"/>`);
}

function shavings(rand, list) {
  let d = '', hl = '', lo = '';
  for (const [x, y, sz] of list) {
    const n = 6, a0 = rand() * TAU, el = between(rand, 1.4, 2), pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + between(rand, -0.25, 0.25), rr = sz * between(rand, 0.6, 1.1), px = Math.cos(a) * rr * el, py = Math.sin(a) * rr;
      pts.push([x + px * Math.cos(a0) - py * Math.sin(a0), y + px * Math.sin(a0) + py * Math.cos(a0)]);
    }
    d += poly(pts);
    const top = pts.reduce((b, p, i) => (p[0] + p[1] < pts[b][0] + pts[b][1] ? i : b), 0), nx = pts[(top + 1) % n];
    hl += `M${n0(pts[top][0])} ${n0(pts[top][1])}L${n0(nx[0])} ${n0(nx[1])}`;
    lo += `M${n0(pts[0][0])} ${n0(pts[0][1])}Q${n0(x)} ${n0(y)} ${n0(pts[3][0])} ${n0(pts[3][1])}`;
  }
  return `<path d="${d}" fill="#FFF3CE" stroke="#FAE6B0" stroke-width="3" stroke-linejoin="round"/><path d="${lo}" fill="none" stroke="#E2C27E" stroke-width="1.6" opacity=".75"/><path d="${hl}" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/>`;
}

function tomatoSyms(D) {
  const whole = D.sym('tom',
    `<circle r="25" fill="${D.rad('tomg', [[0, '#FF9F80'], [0.28, '#F2462A'], [0.75, '#C5200E'], [1, '#8A1308']], { cx: 0.36, cy: 0.33, r: 0.72 })}"/>` +
    `<ellipse cx="-9" cy="-10" rx="7" ry="4" transform="rotate(-35 -9 -10)" fill="#fff" opacity=".85"/><ellipse cx="-6" cy="-6" rx="13" ry="8" transform="rotate(-35 -6 -6)" fill="#fff" opacity=".14"/>` +
    `<path d="M4 -3l7 -4-5 6 7 3-8 0 1 7-4-6-5 4 3-7-6-3z" fill="#3F7A22"/><circle cx="4" cy="-2" r="2.4" fill="#8CC152"/>`);
  const half = D.sym('tomh',
    `<circle r="25" fill="#C9220F"/><circle r="22" fill="${D.rad('tomf', [[0, '#FFA184'], [0.6, '#F45A3A'], [1, '#E0381F']], { cx: 0.42, cy: 0.4, r: 0.6 })}"/>` +
    `<ellipse cx="-9" cy="1" rx="7.5" ry="12" fill="#F7B260"/><ellipse cx="9" cy="1" rx="7.5" ry="12" fill="#F7B260"/>` +
    dots([[-10, -6], [-8, 2], [-10, 8], [10, -6], [8, 2], [10, 8]], '#FFF1C2', 3.2) +
    `<path d="M0 -20v40" stroke="#FFB49C" stroke-width="5" stroke-linecap="round"/><path d="M-15 -14Q-8 -21 2 -21" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".8"/>`);
  return { whole, half };
}

function walnutSym(D) {
  const pts = [];
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * TAU, notch = 5 * Math.exp(-(((Math.abs(Math.sin(a)) - 1) / 0.06) ** 2) / 1);
    const rr = 25 * (1 - 0.09 * Math.cos(4 * a)) + 1.4 * Math.cos(9 * a) - (Math.abs(Math.sin(a)) > 0.97 ? notch : 0);
    pts.push([Math.cos(a) * rr * 1.22, Math.sin(a) * rr]);
  }
  return D.sym('wal',
    `<path d="${smooth(pts, true, 1)}" fill="${D.rad('walg', [[0, '#E8BC7C'], [0.5, '#C08240'], [1, '#7A4416']], { cx: 0.4, cy: 0.35, r: 0.75 })}"/>` +
    `<path d="M0 -24C-4 -8 4 8 0 24M-30 1C-22 -5-14 5-6 -1M30 1C22 -5 14 5 6 -1" stroke="#3E1C06" stroke-width="3.6" fill="none" stroke-linecap="round" opacity=".85"/>` +
    `<path d="M-22 -16C-18 -10-24 -6-26 -8M-12 -20C-10 -14-14 -10-10 -6M22 -16C18 -10 24 -6 26 -8M12 -20C10 -14 14 -10 10 -6M-20 14C-16 8-10 14-12 18M20 14C16 8 10 14 12 18M-24 6C-20 10-26 12-28 10M24 6C20 10 26 12 28 10" stroke="#5A2E0C" stroke-width="2" fill="none" stroke-linecap="round" opacity=".7"/>` +
    `<path d="M-26 -10C-22 -18-14 -21-8 -18M6 -19C12 -22 20 -18 24 -12M-25 9C-20 4-14 8-10 5M8 6C12 3 18 5 22 8" stroke="#FBE0AC" stroke-width="2.2" fill="none" stroke-linecap="round" opacity=".7"/>`);
}

function caesarTop({ D, rand, cx, cy, Ri }) {
  const ck = chickenSym(D);
  const cr1 = croutonSym(D, 'cr1', 46, ['#FDE6AA', '#F0B65C', '#A3561B']), cr2 = croutonSym(D, 'cr2', 40, ['#FBDD94', '#E6A548', '#94491A']);
  const fx = cx + 62, fy = cy - 18, ang = (-58 * Math.PI) / 180, nx = -Math.sin(ang), ny = Math.cos(ang);
  let chick = '';
  for (let i = 0; i < 5; i++) {
    const o = (i - 2) * 46, sl = (i - 2) * 10;
    chick += place(ck, fx + nx * o + Math.cos(ang) * sl + between(rand, -4, 4), fy + ny * o + Math.sin(ang) * sl + between(rand, -4, 4), deg(ang) + between(rand, -6, 6), between(rand, 0.95, 1.05));
  }
  const cpts = scatterInCircle(rand, { cx, cy, radius: Ri - 56, count: 40, minDist: 72 }).filter((p) => Math.hypot(p.x - fx, p.y - fy) > 140).slice(0, 10);
  const crout = cpts.map((p, i) => place(i % 3 ? cr1 : cr2, p.x, p.y, between(rand, -40, 40), between(rand, 0.9, 1.1))).join('');
  const parm = scatterInCircle(rand, { cx, cy, radius: Ri - 44, count: 15, minDist: 60 }).map((p) => [p.x, p.y, between(rand, 11, 17)]);
  return `<g filter="${D.bevel('bvc', { b: 3, o: 2, ds: 0.5, dsB: 4, dx: 4, dy: 7 })}">${chick}</g>` +
    `<g filter="${D.bevel()}">${crout}</g>` +
    drizzle(D, rand, { x0: cx - 220, y0: cy + 40, x1: cx + 200, y1: cy - 110, amp: 34, waves: 3.2 }, DRESSING, '150 22 90 16 200 20') +
    drizzle(D, rand, { x0: cx - 170, y0: cy + 170, x1: cx + 210, y1: cy + 40, amp: 26, waves: 2.6 }, { ...DRESSING, w: 5 }, '120 26 160 18') +
    `<g filter="${D.bevel('bvp', { b: 1.5, o: 1, hi: 0.6, lo: 0.3, ds: 0.35, dsB: 2.5, dx: 2, dy: 4 })}">${shavings(rand, parm)}</g>` +
    pepper(rand, cx, cy, Ri - 40, 70);
}

function chevreTop({ D, rand, cx, cy, Ri }) {
  const toast = D.sym('toast',
    `<ellipse rx="70" ry="57" fill="${D.rad('crust', [[0, '#D9A05A'], [0.72, '#A9622A'], [1, '#713812']], { cx: 0.4, cy: 0.38, r: 0.62 })}"/>` +
    `<ellipse cx="-2" cy="-3" rx="61" ry="48" fill="${D.rad('crumb', [[0, '#FBE8BA'], [0.8, '#EDC682'], [1, '#C98A42']])}"/>` +
    dots([[-48, -18], [-44, 14], [48, -12], [42, 22], [-30, 34], [30, -36], [-20, -40], [52, 4]], '#C98A42', 4, ' opacity=".7"') +
    `<circle cx="4" cy="4" r="52" fill="#D8C4A2"/><circle cx="-1" cy="-1" r="50" fill="${D.rad('chev', [[0, '#EDB863'], [0.45, '#F2C77C'], [0.72, '#F9E2B2'], [0.9, '#FFF6E4'], [1, '#F1E4CC']], { cx: 0.45, cy: 0.43, r: 0.55 })}"/>` +
    `<g fill="${D.rad('spot', [[0, '#A9541A', 0.75], [0.6, '#C26E24', 0.4], [1, '#C26E24', 0]])}"><ellipse cx="8" cy="4" rx="15" ry="10"/><ellipse cx="-14" cy="12" rx="12" ry="8"/><ellipse cx="14" cy="-16" rx="10" ry="7"/><ellipse cx="-14" cy="-10" rx="9" ry="7"/><ellipse cx="22" cy="16" rx="8" ry="6"/><ellipse cx="-2" cy="-28" rx="8" ry="5"/><ellipse cx="-28" cy="2" rx="6" ry="5"/></g>` +
    `<ellipse cx="-20" cy="-22" rx="14" ry="6" transform="rotate(-35 -20 -22)" fill="#fff" opacity=".6"/>` +
    dots([[-6, -24, 2, 1], [20, 10, 2, -1], [-22, 4, 1, 2], [4, 22, 2, 0]], '#5D7A2A', 2.6));
  const { whole, half } = tomatoSyms(D), wal = walnutSym(D);
  const tp = [];
  const a0 = between(rand, -0.3, 0.3);
  for (let i = 0; i < 3; i++) { const a = a0 - Math.PI / 2 + (i * TAU) / 3 + between(rand, -0.12, 0.12); tp.push([cx + Math.cos(a) * 92, cy + Math.sin(a) * 92, a]); }
  tp.sort((p, q) => p[1] - q[1]);
  const toasts = tp.map(([x, y]) => place(toast, x, y, between(rand, -25, 25))).join('');
  let toms = '', wals = '';
  for (let i = 0; i < 6; i++) { const a = a0 - Math.PI / 2 + (i * TAU) / 6 + Math.PI / 3 + between(rand, -0.15, 0.15), d = i % 2 ? 196 : 212; toms += place(i % 3 === 1 ? whole : half, cx + Math.cos(a) * d, cy + Math.sin(a) * d, between(rand, 0, 360), between(rand, 0.95, 1.1)); }
  for (let i = 0; i < 7; i++) { const a = a0 + (i * TAU) / 7 + between(rand, -0.15, 0.15), d = between(rand, 168, 232); wals += place(wal, cx + Math.cos(a) * d, cy + Math.sin(a) * d, between(rand, 0, 360), between(rand, 1.15, 1.3)); }
  const honey = (pts, w) => { const d = smooth(pts, false); return `<path d="${d}" fill="none" stroke="#6A3002" stroke-width="${w + 4}" stroke-linecap="round" opacity=".35" transform="translate(3 5)" filter="${D.blur(2.5)}"/><path d="${d}" fill="none" stroke="#E0900F" stroke-width="${w}" stroke-linecap="round" opacity=".95"/><path d="${d}" fill="none" stroke="#F7B733" stroke-width="${w * 0.55}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#FFF2C0" stroke-width="2" stroke-linecap="round" transform="translate(-1.5 -1.5)"/>`; };
  return `<g filter="${D.bevel()}">${wals}</g><g filter="${D.bevel('bvt', { b: 2, o: 1.5, hi: 0.5, lo: 0.35, ds: 0.45 })}">${toms}</g>` +
    `<g filter="${D.bevel('bvk', { b: 3, o: 2, ds: 0.55, dsB: 5, dx: 5, dy: 8 })}">${toasts}</g>` +
    tp.map(([x, y]) => { const a = between(rand, -0.5, 0.5), c = Math.cos(a), sn = Math.sin(a), P = (u, v) => [x + u * c - v * sn, y + u * sn + v * c];
      return honey([P(-62, -6), P(-30, -18), P(0, -2), P(28, 12), P(64, 2)], 6.5) + honey([P(-40, 22), P(-8, 10), P(30, 26)], 4.5); }).join('') +
    pepper(rand, cx, cy, Ri - 40, 40);
}

function thonTop({ D, rand, cx, cy, Ri }) {
  const { half } = tomatoSyms(D);
  const egg = D.sym('egg',
    `<ellipse rx="44" ry="32" fill="${D.rad('eggw', [[0, '#FFFFFF'], [0.65, '#F9F5EC'], [1, '#DCD1BD']], { cx: 0.42, cy: 0.38, r: 0.62 })}"/>` +
    `<circle cx="4" cy="3" r="21" fill="#D8A12A" opacity=".35" filter="${D.blur(2)}"/>` +
    `<circle cx="2" cy="1" r="19.5" fill="${D.rad('yolk', [[0, '#FFE88E'], [0.5, '#FFC833'], [1, '#EB930E']], { cx: 0.4, cy: 0.38, r: 0.65 })}"/>` +
    `<ellipse cx="-5" cy="-6" rx="6" ry="3.4" transform="rotate(-30 -5 -6)" fill="#fff" opacity=".6"/>` +
    `<path d="M-32 -14Q-24 -26-8 -28" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round"/>`);
  const olive = D.sym('olive',
    `<path d="${circleD(0, 0, 13)}${circleD(0, 0, 5.5)}" fill-rule="evenodd" fill="${D.rad('olg', [[0, '#6E5A66'], [0.55, '#2E2329'], [1, '#120C10']], { cx: 0.38, cy: 0.35, r: 0.7 })}"/>` +
    `<path d="M-9 -4A10 10 0 0 1 -2 -10" stroke="#fff" stroke-opacity=".65" stroke-width="2.4" fill="none" stroke-linecap="round"/>`);
  // flaked tuna: an irregular heap; each chunk has short fibre lines along its own grain direction
  let tuna = '', fl = '', fd = '';
  const chunks = scatterInCircle(rand, { cx: cx - 6, cy: cy + 4, radius: 70, count: 15, minDist: 28 });
  chunks.sort((p, q) => p.y - q.y);
  const tg = D.rad('tuna', [[0, '#F6DCBC'], [0.55, '#DDAD82'], [1, '#A87050']], { cx: 0.36, cy: 0.3, r: 0.78 });
  for (const p of chunks) {
    const rr = between(rand, 20, 29), g = rand() * Math.PI, c = Math.cos(g), sn = Math.sin(g), pts = [];
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU, q = rr * between(rand, 0.7, 1.15), u = Math.cos(a) * q * 1.3, v = Math.sin(a) * q * 0.8; pts.push([p.x + u * c - v * sn, p.y + u * sn + v * c]); }
    tuna += `<path d="${smooth(pts)}" fill="${tg}"/>`;
    for (const k of [-0.42, 0, 0.4]) {
      const ox = p.x - sn * k * rr, oy = p.y + c * k * rr, l = rr * between(rand, 0.5, 0.9), b = between(rand, -3, 3);
      fl += `M${n0(ox - c * l - 1)} ${n0(oy - sn * l - 1.5)}q${n0(c * l - sn * b)} ${n0(sn * l + c * b)} ${n0(2 * c * l)} ${n0(2 * sn * l)}`;
      if (k === 0) fd += `M${n0(ox - c * l * 0.8 + 1)} ${n0(oy - sn * l * 0.8 + 3)}l${n0(1.6 * c * l)} ${n0(1.6 * sn * l)}`;
    }
  }
  tuna += `<path d="${fd}" stroke="#8E5636" stroke-width="2" fill="none" stroke-linecap="round" opacity=".45"/><path d="${fl}" stroke="#FFF1DE" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".8"/>`;
  let eggs = '', toms = '', olives = '';
  const a0 = between(rand, 0, TAU);
  const used = [];
  for (let i = 0; i < 4; i++) { const a = a0 + (i * TAU) / 4 + between(rand, -0.15, 0.15), x = cx + Math.cos(a) * 172, y = cy + Math.sin(a) * 172; used.push([x, y]); eggs += place(egg, x, y, deg(a) + 90 + between(rand, -20, 20)); }
  for (let i = 0; i < 4; i++) { const a = a0 + Math.PI / 4 + (i * TAU) / 4 + between(rand, -0.15, 0.15), x = cx + Math.cos(a) * 190, y = cy + Math.sin(a) * 190; used.push([x, y]); toms += place(half, x, y, between(rand, 0, 360), 1.05); }
  const op = scatterInCircle(rand, { cx, cy, radius: Ri - 40, count: 60, minDist: 46 }).filter((p) => Math.hypot(p.x - cx, p.y - cy) > 100 && used.every(([x, y]) => Math.hypot(p.x - x, p.y - y) > 58)).slice(0, 9);
  olives = op.map((p) => place(olive, p.x, p.y, 0, between(rand, 0.9, 1.1))).join('');
  // sweetcorn clusters
  const kern = [];
  const cc = scatterInCircle(rand, { cx, cy, radius: Ri - 50, count: 80, minDist: 40 }).filter((p) => Math.hypot(p.x - cx, p.y - cy) > 95 && used.every(([x, y]) => Math.hypot(p.x - x, p.y - y) > 52) && op.every((q) => Math.hypot(p.x - q.x, p.y - q.y) > 30)).slice(0, 6);
  for (const p of cc) for (let j = 0; j < 6; j++) kern.push([p.x + between(rand, -17, 17), p.y + between(rand, -13, 13), between(rand, -1.5, 1.5), between(rand, -1, 1)]);
  const corn = dots(kern.map(([x, y, dx, dy]) => [x + 1.5, y + 2.5, dx, dy]), '#8A5208', 11, ' opacity=".4"') + dots(kern, '#F2B526', 10) +
    dots(kern.map(([x, y, dx, dy]) => [x - 0.8, y - 1, dx * 0.5, dy * 0.5]), '#FFD95C', 6.5) + dots(kern.map(([x, y]) => [x - 2.4, y - 2.6]), '#FFF8DA', 2.6);
  return `<g filter="${D.bevel()}">${toms}${olives}</g><g filter="${D.bevel('bvk', { b: 3, o: 2, ds: 0.5, dsB: 4, dx: 4, dy: 7 })}">${eggs}</g><g filter="${D.bevel('bvf', { b: 2, o: 1.5, hi: 0.55, lo: 0.45, ds: 0.5, dsB: 4, dx: 4, dy: 6 })}">${tuna}</g>${corn}` + pepper(rand, cx, cy, Ri - 40, 40);
}

/* ================================================================== DRINKS (front view) */

function glassGeo({ cx = CX, yT, yB, rt, rb, k = 0.13 }) {
  const rAt = (y) => rt + ((rb - rt) * (y - yT)) / (yB - yT);
  const body = (y0, y1, ins = 0) => {
    const a = rAt(y0) - ins, b = rAt(y1) - ins;
    return `M${r1(cx - a)} ${n0(y0)}A${r1(a)} ${r1(a * k)} 0 0 1 ${r1(cx + a)} ${n0(y0)}L${r1(cx + b)} ${n0(y1)}A${r1(b)} ${r1(b * k)} 0 0 1 ${r1(cx - b)} ${n0(y1)}Z`;
  };
  const arcF = (y, ins = 0) => { const a = rAt(y) - ins; return `M${r1(cx - a)} ${n0(y)}A${r1(a)} ${r1(a * k)} 0 0 0 ${r1(cx + a)} ${n0(y)}`; };
  const arcB = (y, ins = 0) => { const a = rAt(y) - ins; return `M${r1(cx - a)} ${n0(y)}A${r1(a)} ${r1(a * k)} 0 0 1 ${r1(cx + a)} ${n0(y)}`; };
  return { cx, yT, yB, rt, rb, k, rAt, body, arcF, arcB };
}

function iceCube(D, x, y, s, a, tint, under) {
  const h = s * 0.9, t = `translate(${n0(x)} ${n0(y)})rotate(${n0(a)})`, R = `x="${n0(-s / 2)}" y="${n0(-h / 2)}" width="${n0(s)}" height="${n0(h)}" rx="${n0(s * 0.2)}"`;
  if (under) {
    return `<g transform="${t}"><rect ${R} fill="${mix(tint, '#ffffff', 0.4)}" fill-opacity=".42" stroke="${mix(tint, '#ffffff', 0.75)}" stroke-opacity=".6" stroke-width="2.5"/>` +
      `<path d="M${n0(-s / 2 + 7)} ${n0(-h / 2 + 9)}q${n0(s * 0.3)} -3 ${n0(s * 0.6)} 1" stroke="#fff" stroke-opacity=".55" stroke-width="2.5" fill="none" stroke-linecap="round"/></g>`;
  }
  return `<g transform="${t}"><rect ${R} fill="${D.lin('ice', [[0, '#F6FCFE', 0.8], [0.55, '#D9EBF0', 0.55], [1, tint, 0.6]])}" stroke="#8FAEB8" stroke-opacity=".75" stroke-width="2"/>` +
    `<rect x="${n0(-s / 2 + 6)}" y="${n0(-h / 2 + 5)}" width="${n0(s - 14)}" height="${n0(h * 0.42)}" rx="${n0(s * 0.14)}" fill="#fff" fill-opacity=".45"/>` +
    `<path d="M${n0(-s / 2 + 6)} ${n0(h / 2 - 10)}V${n0(-h / 2 + 10)}q0 -5 6 -5H${n0(s / 2 - 12)}" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>` +
    `<path d="M${n0(-s * 0.1)} ${n0(-h * 0.05)}l${n0(s * 0.2)} ${n0(h * 0.25)}" stroke="#fff" stroke-opacity=".5" stroke-width="1.5"/></g>`;
}

function strawSvg(x0, y0, x1, y1, w, col, stripe) {
  const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy), px = (-dy / l) * w, py = (dx / l) * w;
  const L = (ox, oy) => `M${r1(x0 + ox)} ${r1(y0 + oy)}L${r1(x1 + ox)} ${r1(y1 + oy)}`;
  return `<path d="${L(0, 0)}" stroke="${col}" stroke-width="${w}"/>` +
    (stripe ? `<path d="${L(0, 0)}" stroke="${stripe}" stroke-width="${w}" stroke-dasharray="11 11"/>` : '') +
    `<path d="${L(px * 0.3, py * 0.3)}" stroke="#000" stroke-opacity=".18" stroke-width="${r1(w * 0.4)}"/>` +
    `<path d="${L(-px * 0.22, -py * 0.22)}" stroke="#fff" stroke-opacity=".6" stroke-width="${r1(w * 0.2)}"/>` +
    `<ellipse cx="${r1(x1)}" cy="${r1(y1)}" rx="${r1(w / 2)}" ry="${r1(w / 4)}" transform="rotate(${n0(deg(Math.atan2(dy, dx)) + 90)} ${r1(x1)} ${r1(y1)})" fill="${mix(col, '#000000', 0.35)}"/>`;
}

function condensation(rand, G, y0, y1, n, tint) {
  const buckets = [[], [], []], streaks = [];
  for (let i = 0; i < n; i++) {
    const y = between(rand, y0, y1), u = between(rand, -0.93, 0.93), x = G.cx + u * G.rAt(y), b = rand() < 0.55 ? 0 : rand() < 0.7 ? 1 : 2;
    buckets[b].push([x, y]);
    if (b === 2 && rand() < 0.5) streaks.push(`M${n0(x)} ${n0(y - between(rand, 20, 50))}V${n0(y - 4)}`);
  }
  const W = [4.2, 6.5, 9];
  let s = streaks.length ? `<path d="${streaks.join('')}" stroke="${mix(tint, '#ffffff', 0.55)}" stroke-width="2.6" stroke-linecap="round" opacity=".35"/>` : '';
  buckets.forEach((B, k) => {
    const w = W[k];
    s += dots(B.map(([x, y]) => [x + 0.7, y + 1.4, 0, w * 0.3]), mix(tint, '#000000', 0.55), w, ' opacity=".4"') +
      dots(B.map(([x, y]) => [x, y, 0, w * 0.3]), mix(tint, '#ffffff', 0.5), w * 0.82, ' opacity=".75"') +
      dots(B.map(([x, y]) => [x - w * 0.18, y - w * 0.12]), '#fff', r1(w * 0.34), ' opacity=".95"');
  });
  return s;
}

function bubbles(rand, G, y0, y1, n, ins, col = '#fff', op = 0.55) {
  let d = '';
  for (let i = 0; i < n; i++) {
    const y = between(rand, y0, y1), w = G.rAt(y) - ins - 8, x = G.cx + between(rand, -w, w), rr = between(rand, 1.4, 4.2) * (rand() < 0.15 ? 1.6 : 1);
    d += circleD(x, y, rr);
  }
  return `<path d="${d}" fill="${col}" fill-opacity=".14" stroke="${col}" stroke-opacity="${op}" stroke-width="1.2"/>`;
}

/** Generic tumbler drink. Hooks: inside (in liquid), above (inside the glass, above the surface), front (outside). */
function glassDrink(id, o) {
  const rand = rng(id), D = defsFor(id), G = glassGeo(o.glass);
  const { cx, yT, yB, rb } = G, yL = o.level, yLb = yB - (o.base ?? 26), ins = 5, L = o.liq;
  const ctx = { D, rand, G, yL, yLb, ins, L };
  let s = ground(D, cx, yB + 2, rb * 1.5, 0.32);
  if (L.caustic) s += `<ellipse cx="${n0(cx + 40)}" cy="${n0(yB + 8)}" rx="${n0(rb * 0.85)}" ry="13" fill="${L.caustic}" opacity=".5" filter="${D.blur(7)}"/>`;
  // glass: back wall and back rim
  const gb = D.shape('gb', G.body(yT, yB));
  s += use(gb, D.lin('glass', [[0, '#DCE8EB', 0.55], [0.12, '#F2F7F8', 0.25], [0.5, '#fff', 0.08], [0.86, '#F2F7F8', 0.22], [1, '#D2E0E4', 0.55]], [0, 0, 1, 0]));
  s += `<path d="${G.arcB(yT, 4)}" stroke="#fff" stroke-opacity=".7" stroke-width="2.2" fill="none"/>`;
  if (o.straw) s += `<g transform="translate(7 0)">${o.straw}</g>`;
  // liquid
  const lk = D.shape('liq', G.body(yL, yLb, ins));
  s += use(lk, D.lin('liqv', [[0, L.top], [0.45, L.mid], [1, L.bot]]), L.op ? ` opacity="${L.op}"` : '');
  s += use(lk, D.lin('liqh', [[0, '#fff', 0.3], [0.14, '#fff', 0.06], [0.42, '#fff', 0], [0.72, '#000', 0.05], [1, '#000', 0.3]], [0, 0, 1, 0]));
  s += `<g clip-path="${D.clip('lc', `<use href="#${lk}"/>`)}">${o.inside ? o.inside(ctx) : ''}</g>`;
  // surface
  const ra = G.rAt(yL) - ins;
  s += `<ellipse cx="${cx}" cy="${yL}" rx="${r1(ra)}" ry="${r1(ra * G.k)}" fill="${L.surf}"/>` +
    `<path d="${G.arcF(yL, ins + 1)}" stroke="${L.ring ?? '#fff'}" stroke-opacity=".7" stroke-width="2.5" fill="none"/>`;
  if (o.straw) s += `<g clip-path="${D.clip('above', `<rect x="0" y="0" width="800" height="${yL}"/>`)}">${o.straw}</g>`;
  if (o.above) s += o.above(ctx);
  // thick glass base, tinted by the drink
  s += `<path d="${G.body(yLb, yB)}" fill="${mix(L.mid, '#ffffff', 0.55)}" opacity=".5"/>` +
    `<path d="${G.arcF(yLb, ins)}" stroke="${mix(L.bot, '#000000', 0.2)}" stroke-opacity=".5" stroke-width="2" fill="none"/>` +
    `<path d="${G.arcF(yB - 6, 6)}" stroke="#fff" stroke-opacity=".7" stroke-width="2.5" fill="none"/>`;
  // glass front: edges, rim, highlight strips
  const strip = (f0, f1, y0, y1, op) => `<path d="${poly([[cx - G.rAt(y0) * f0, y0], [cx - G.rAt(y0) * f1, y0], [cx - G.rAt(y1) * f1, y1], [cx - G.rAt(y1) * f0, y1]])}" fill="${D.lin('hl', [[0, '#fff', 0], [0.1, '#fff', 1], [0.85, '#fff', 0.8], [1, '#fff', 0]])}" opacity="${op}"/>`;
  s += use(gb, 'none', ' stroke="#4E5E63" stroke-opacity=".42" stroke-width="2.5"') +
    `<path d="M${r1(cx - G.rt + 4)} ${yT + 8}L${r1(cx - rb + 4)} ${yB - 12}M${r1(cx + G.rt - 4)} ${yT + 8}L${r1(cx + rb - 4)} ${yB - 12}" stroke="#fff" stroke-opacity=".55" stroke-width="2"/>` +
    strip(0.84, 0.7, yT + 26, yB - 30, 0.6) + strip(0.6, 0.56, yT + 40, yB - 60, 0.4) + strip(-0.8, -0.86, yT + 30, yB - 40, 0.35) +
    `<path d="${G.arcF(yT)}" stroke="#fff" stroke-opacity=".95" stroke-width="3" fill="none"/><path d="${G.arcF(yT + 4, 6)}" stroke="#fff" stroke-opacity=".4" stroke-width="1.5" fill="none"/>`;
  if (o.drops) s += condensation(rand, G, Math.max(yL + 18, yT + 30), yB - 34, o.drops, L.mid);
  if (o.front) s += o.front(ctx);
  return svgDoc({ defs: D.str(), body: s });
}

function lemonWheel(D, x, y, rr, op = 1) {
  const seg = [];
  for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU; seg.push(`M${r1(x + Math.cos(a) * rr * 0.12)} ${r1(y + Math.sin(a) * rr * 0.12)}L${r1(x + Math.cos(a) * rr * 0.76)} ${r1(y + Math.sin(a) * rr * 0.76)}`); }
  return `<g opacity="${op}"><circle cx="${x}" cy="${y}" r="${rr}" fill="${D.rad('rind', [[0.85, '#FFE45C'], [0.93, '#F7C51B'], [1, '#D99A0A']])}"/>` +
    `<circle cx="${x}" cy="${y}" r="${r1(rr * 0.86)}" fill="#FFF7D6"/><circle cx="${x}" cy="${y}" r="${r1(rr * 0.8)}" fill="${D.rad('pulp', [[0, '#FFF6C0'], [0.5, '#FFE36A'], [1, '#F9CF3A']])}"/>` +
    `<path d="${seg.join('')}" stroke="#FFF8DC" stroke-width="${r1(rr * 0.07)}" stroke-linecap="round"/><circle cx="${x}" cy="${y}" r="${r1(rr * 0.12)}" fill="#FFF8DC"/>` +
    `<path d="M${r1(x - rr * 0.6)} ${r1(y - rr * 0.35)}A${r1(rr * 0.7)} ${r1(rr * 0.7)} 0 0 1 ${r1(x - rr * 0.1)} ${r1(y - rr * 0.68)}" stroke="#fff" stroke-width="${r1(rr * 0.08)}" stroke-linecap="round" fill="none" opacity=".8"/></g>`;
}

function mintSprig(D, rand, x, y, angles, sc = 1) {
  const key = makeLeaf(D, rand, 'mint');
  return `<g filter="${D.bevel('bvmint', { b: 2, o: 1.4, hi: 0.4, lo: 0.3, ds: 0.4, dsB: 3, dx: 3, dy: 5 })}">${angles.map((a) => leafUse(key, x, y, a, sc * between(rand, 0.9, 1.1), sc * (a < -90 ? -1 : 1))).join('')}</g>`;
}

const DRINK_GLASS = { cx: CX, yT: 118, yB: 632, rt: 132, rb: 108, k: 0.13 };

function cola(id) {
  return glassDrink(id, {
    glass: DRINK_GLASS, level: 178, drops: 70,
    liq: { top: '#5A200C', mid: '#2C0D05', bot: '#4C1808', op: 0.97, surf: '#9A6038', ring: '#F4D8B8', caustic: '#B5481C' },
    inside: ({ D, rand, G, yL, yLb, ins }) =>
      `<ellipse cx="${CX + 20}" cy="${yLb - 20}" rx="${G.rb * 0.8}" ry="70" fill="#A23E14" opacity=".45" filter="${D.blur(18)}"/>` +
      iceCube(D, CX - 52, yL + 70, 62, -14, '#5A200C', true) + iceCube(D, CX + 46, yL + 110, 58, 18, '#5A200C', true) + iceCube(D, CX - 20, yL + 190, 54, 8, '#5A200C', true) +
      bubbles(rand, G, yL + 10, yLb - 6, 70, ins, '#F9D9B9', 0.5),
    above: ({ D, rand, G, yL }) => {
      const fz = [];
      for (let i = 0; i < 26; i++) fz.push([CX + between(rand, -1, 1) * (G.rAt(yL) - 16), yL + between(rand, -5, 6)]);
      return dots(fz, '#F7E2C6', 3.4, ' opacity=".8"') + iceCube(D, CX - 56, yL - 16, 66, -12, '#7A2E10', false) + iceCube(D, CX + 50, yL - 22, 70, 14, '#7A2E10', false) + iceCube(D, CX - 2, yL - 4, 56, 4, '#7A2E10', false) +
        dots(Array.from({ length: 14 }, () => [CX + between(rand, -100, 100), yL - between(rand, 14, 60)]), '#fff', 2.2, ' opacity=".7"');
    },
  });
}

function peachWedge(D, x, y, rot, s) {
  return `<g transform="translate(${n0(x)} ${n0(y)})rotate(${rot})scale(${s})">` +
    `<path d="M-66 8C-56 -52 56 -52 66 8C44 -6-44 -6-66 8Z" fill="${D.lin('pflesh', [[0, '#FFB44E'], [0.55, '#FFC873'], [1, '#FFDFA0']])}"/>` +
    `<path d="M-66 8C-56 -52 56 -52 66 8" fill="none" stroke="${D.lin('pskin', [[0, '#F06A32'], [0.5, '#D9362A'], [1, '#F29A3A']], [0, 0, 1, 0])}" stroke-width="9" stroke-linecap="round"/>` +
    `<path d="M-40 -6Q-30 -30-8 -34M8 -34Q30 -30 40 -6M-18 -8Q-12 -24 0 -28" stroke="#FFE6B8" stroke-width="2" fill="none" opacity=".7"/>` +
    `<path d="M-50 -16Q-36 -40-10 -42" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".7"/></g>`;
}

function theGlace(id) {
  const G = glassGeo(DRINK_GLASS), { yT, yB, rt } = DRINK_GLASS;
  const straw = strawSvg(CX + 38, yB - 66, CX - 150, yT - 112, 15, '#FFF8EE', '#F08A4B');
  return glassDrink(id, {
    glass: DRINK_GLASS, level: 196, drops: 60, straw,
    liq: { top: '#F2A245', mid: '#D9731C', bot: '#A3450C', op: 0.9, surf: '#F7B45C', ring: '#FFE6B8', caustic: '#F59A2A' },
    inside: ({ D, rand, G, yL, yLb, ins }) =>
      iceCube(D, CX - 48, yL + 64, 64, -14, '#F2A245', true) + iceCube(D, CX + 50, yL + 96, 60, 20, '#F2A245', true) + iceCube(D, CX - 14, yL + 168, 58, 6, '#F2A245', true) + iceCube(D, CX + 34, yL + 236, 52, -10, '#F2A245', true) +
      `<ellipse cx="${CX - 30}" cy="${yL + 140}" rx="40" ry="160" fill="#FFE2A8" opacity=".25" filter="${D.blur(14)}"/>` +
      bubbles(rand, G, yL + 10, yLb - 6, 30, ins, '#FFF0D2', 0.55),
    above: ({ D, yL }) => iceCube(D, CX - 52, yL - 14, 64, -12, '#D9731C', false) + iceCube(D, CX + 44, yL - 18, 66, 16, '#D9731C', false),
    front: ({ D }) => peachWedge(D, CX + rt - 6, yT - 2, 22, 1.05) +
      `<path d="M${CX + rt} ${yT}L${r1(G.rAt(yT + 46) + CX)} ${yT + 46}" stroke="#fff" stroke-opacity=".75" stroke-width="2.5"/>`,
  });
}

function limonade(id) {
  const G = glassGeo(DRINK_GLASS), { yT, yB, rt } = DRINK_GLASS;
  const straw = strawSvg(CX + 30, yB - 66, CX - 158, yT - 108, 15, '#FFFDF4', '#7CC452');
  return glassDrink(id, {
    glass: DRINK_GLASS, level: 196, drops: 60, straw,
    liq: { top: '#FFF3B8', mid: '#F9E07A', bot: '#EDC44A', op: 0.94, surf: '#FFF6CC', ring: '#fff', caustic: '#F7D84A' },
    inside: ({ D, rand, G, yL, yLb, ins }) =>
      lemonWheel(D, CX + 26, yL + 200, 56, 0.55) +
      iceCube(D, CX - 50, yL + 70, 64, -14, '#F9E07A', true) + iceCube(D, CX + 48, yL + 110, 60, 18, '#F9E07A', true) + iceCube(D, CX - 30, yL + 250, 54, 10, '#F9E07A', true) +
      dots(Array.from({ length: 50 }, () => [CX + between(rand, -110, 110), between(rand, yL + 10, yLb - 10)]), '#FFFBE6', 3, ' opacity=".5"') +
      bubbles(rand, G, yL + 10, yLb - 6, 26, ins, '#fff', 0.6),
    above: ({ D, rand, yL }) => iceCube(D, CX - 40, yL - 14, 64, -10, '#F9E07A', false) + iceCube(D, CX + 50, yL - 16, 62, 14, '#F9E07A', false) +
      mintSprig(D, rand, CX + 6, yL - 8, [-150, -110, -72, -40], 1.05),
    front: ({ D }) => lemonWheel(D, CX + rt - 4, yT + 6, 62) +
      `<path d="M${CX + rt} ${yT}L${r1(G.rAt(yT + 62) + CX)} ${yT + 62}" stroke="#fff" stroke-opacity=".8" stroke-width="2.5"/><path d="M${CX + rt - 30} ${yT + 4}Q${CX + rt - 10} ${yT + 6} ${CX + rt} ${yT}" stroke="#fff" stroke-opacity=".7" stroke-width="2" fill="none"/>`,
  });
}

function orangeHalf(D, rand, x, y, R) {
  const fk = 0.52, dim = [];
  for (let i = 0; i < 40; i++) { const a = between(rand, 0.15, Math.PI - 0.15), q = between(rand, 0.3, 0.95); dim.push([x + Math.cos(a) * R * q, y + Math.sin(a) * R * 0.9 * q + 6]); }
  const seg = [];
  for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; seg.push(`M${r1(Math.cos(a) * 9)} ${r1(Math.sin(a) * 9)}L${r1(Math.cos(a) * (R - 15))} ${r1(Math.sin(a) * (R - 15))}`); }
  const sacs = [];
  for (let i = 0; i < 10; i++) { const a = ((i + 0.5) / 10) * TAU; for (const q of [0.35, 0.58]) sacs.push([Math.cos(a) * R * q, Math.sin(a) * R * q, Math.cos(a) * R * 0.14, Math.sin(a) * R * 0.14]); }
  return `<path d="M${x - R} ${y}A${R} ${n0(R * 0.92)} 0 0 0 ${x + R} ${y}Z" fill="${D.rad('peel', [[0, '#FFC062'], [0.45, '#F79222'], [1, '#B9520A']], { cx: 0.32, cy: 0.1, r: 0.95 })}"/>` +
    dots(dim, '#C9620C', 2.4, ' opacity=".45"') +
    `<path d="M${x - R + 14} ${y + 16}Q${x - R + 30} ${y + R * 0.6} ${x - 10} ${y + R * 0.82}" stroke="#FFE0A0" stroke-width="5" fill="none" stroke-linecap="round" opacity=".45"/>` +
    `<g transform="translate(${x} ${y})rotate(-4)scale(1 ${fk})"><circle r="${R}" fill="#EE840F"/><circle r="${R - 5}" fill="#FFF3DC"/>` +
    `<circle r="${R - 12}" fill="${D.rad('fl', [[0, '#FFE6A4'], [0.3, '#FFC447'], [1, '#FA9A1C']])}"/>` +
    dots(sacs, '#FFDC88', 5, ' opacity=".7"') +
    `<path d="${seg.join('')}" stroke="#FFF2D2" stroke-width="3.2" stroke-linecap="round"/><circle r="10" fill="#FFF4DC"/>` +
    `<ellipse cx="${n0(-R * 0.35)}" cy="${n0(-R * 0.4)}" rx="${n0(R * 0.32)}" ry="${n0(R * 0.14)}" transform="rotate(-25 ${n0(-R * 0.35)} ${n0(-R * 0.4)})" fill="#fff" opacity=".45"/></g>`;
}

function jusOrange(id) {
  const GL = { cx: 322, yT: 236, yB: 632, rt: 124, rb: 104, k: 0.13 };
  return glassDrink(id, {
    glass: GL, level: 280, drops: 40,
    liq: { top: '#FFB238', mid: '#FF9416', bot: '#EC700A', op: 1, surf: '#FFC25A', ring: '#FFF0C8', caustic: '#FFA22A' },
    inside: ({ D, rand, G, yL, yLb }) =>
      `<ellipse cx="${GL.cx - 40}" cy="${(yL + yLb) / 2}" rx="30" ry="${(yLb - yL) / 2}" fill="#FFE3A0" opacity=".35" filter="${D.blur(12)}"/>` +
      dots(Array.from({ length: 70 }, () => [GL.cx + between(rand, -110, 110), between(rand, yL + 12, yLb - 6), between(rand, -2, 2), between(rand, 2, 5)]), '#FFD07A', 2.6, ' opacity=".55"') +
      dots(Array.from({ length: 40 }, () => [GL.cx + between(rand, -110, 110), between(rand, yL + 12, yLb - 6), between(rand, -2, 2), between(rand, 2, 4)]), '#E06A08', 2.2, ' opacity=".4"'),
    above: ({ rand, G, yL }) => dots(Array.from({ length: 30 }, () => [GL.cx + between(rand, -1, 1) * (G.rAt(yL) - 18), yL + between(rand, -6, 6)]), '#FFF2D0', 4, ' opacity=".8"'),
    front: ({ D, rand }) => `<ellipse cx="530" cy="664" rx="108" ry="16" fill="#3a1f10" opacity=".35" filter="${D.blur(8)}"/>` + orangeHalf(D, rand, 522, 586, 94),
  });
}

function waterBottle(id) {
  const rand = rng(id), D = defsFor(id), cx = CX, k = 0.12;
  const prof = [[190, 31], [200, 31], [203, 37], [212, 37], [215, 31], [236, 32], [262, 46], [296, 76], [330, 96], [356, 104], [420, 104], [436, 98], [452, 104], [474, 104], [490, 98], [506, 104], [528, 104], [544, 98], [560, 104], [620, 104], [640, 100], [650, 92]];
  const right = prof.map(([y, r]) => [cx + r, y]), left = prof.map(([y, r]) => [cx - r, y]).reverse();
  const bottom = [];
  for (let i = 1; i < 8; i++) { const t = (i / 8) * Math.PI; bottom.push([cx + 92 * Math.cos(t), 650 + 15 * Math.sin(t)]); }
  const bk = D.shape('bot', smooth([...right, ...bottom, ...left], true));
  const rAt = (y) => { for (let i = 1; i < prof.length; i++) if (y <= prof[i][0]) { const [y0, a] = prof[i - 1], [y1, b] = prof[i]; return a + ((b - a) * (y - y0)) / (y1 - y0); } return 92; };
  const yW = 286, rw = rAt(yW);
  const arcF = (y, rr, dy = 0) => `M${r1(cx - rr)} ${y + dy}A${r1(rr)} ${r1(rr * k)} 0 0 0 ${r1(cx + rr)} ${y + dy}`;
  let s = ground(D, cx, 664, 140, 0.26) + `<ellipse cx="${cx + 34}" cy="672" rx="96" ry="13" fill="#7CC3E8" opacity=".5" filter="${D.blur(7)}"/>`;
  s += use(bk, D.lin('pet', [[0, '#9CC6DA', 0.75], [0.1, '#D5EAF3', 0.5], [0.4, '#F1F8FB', 0.22], [0.62, '#F1F8FB', 0.18], [0.88, '#C3DFEC', 0.45], [1, '#83B4CC', 0.8]], [0, 0, 1, 0]));
  s += `<g clip-path="${D.clip('wc', `<use href="#${bk}"/>`)}"><rect x="200" y="${yW}" width="400" height="400" fill="${D.lin('water', [[0, '#3F92C4', 0.7], [0.16, '#8CCAEC', 0.45], [0.45, '#CDEBF8', 0.3], [0.75, '#8CCAEC', 0.42], [1, '#2F80B4', 0.75]], [0, 0, 1, 0])}"/>` +
    `<rect x="200" y="${yW}" width="400" height="400" fill="${D.lin('wdepth', [[0, '#fff', 0], [1, '#2A7FB0', 0.22]])}"/>` +
    `<ellipse cx="${cx}" cy="648" rx="94" ry="12" fill="#A7D6EE" opacity=".45" stroke="#3F7FA3" stroke-opacity=".3" stroke-width="2"/>` +
    `<ellipse cx="${cx - 20}" cy="480" rx="26" ry="150" fill="#fff" opacity=".25" filter="${D.blur(12)}"/></g>`;
  s += `<ellipse cx="${cx}" cy="${yW}" rx="${r1(rw - 2)}" ry="${r1((rw - 2) * k)}" fill="#E4F4FB" fill-opacity=".7" stroke="#fff" stroke-opacity=".8" stroke-width="2"/>`;
  for (const y of [436, 490, 544]) s += `<path d="${arcF(y, 98)}" stroke="#3A779A" stroke-opacity=".45" stroke-width="2.2" fill="none"/><path d="${arcF(y, 100, 6)}" stroke="#fff" stroke-opacity=".8" stroke-width="2" fill="none"/>`;
  s += `<path d="${arcF(356, 102)}" stroke="#3A779A" stroke-opacity=".25" stroke-width="2" fill="none"/>` +
    `<path d="M${cx - 64} 652q16 10 32 8M${cx - 16} 664q16 2 32 0M${cx + 32} 660q16 -2 32 -8" stroke="#3A779A" stroke-opacity=".35" stroke-width="2" fill="none"/>`;
  const hs = (x0, x1, y0, y1, op) => `<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" rx="${(x1 - x0) / 2}" fill="${D.lin('hl', [[0, '#fff', 0], [0.08, '#fff', 1], [0.9, '#fff', 0.85], [1, '#fff', 0]])}" opacity="${op}"/>`;
  s += hs(cx - 82, cx - 68, 366, 428, 0.85) + hs(cx - 82, cx - 68, 446, 482, 0.85) + hs(cx - 82, cx - 68, 500, 536, 0.85) + hs(cx - 82, cx - 68, 554, 630, 0.85) +
    hs(cx - 58, cx - 54, 372, 620, 0.45) + hs(cx + 76, cx + 84, 370, 626, 0.4) +
    `<path d="M${cx - 50} 262Q${cx - 74} 290 ${cx - 84} 340" stroke="#fff" stroke-width="7" stroke-linecap="round" fill="none" opacity=".75"/><path d="M${cx - 22} 222V244" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".7"/>`;
  s += use(bk, 'none', ' stroke="#2C6A8E" stroke-opacity=".55" stroke-width="2.2"');
  // cap
  const capG = D.lin('cap', [[0, '#2A7DB0'], [0.14, '#5DB4E0'], [0.34, '#B4E3F7'], [0.56, '#71C3EA'], [0.84, '#3A92C6'], [1, '#215C86']], [0, 0, 1, 0]);
  let ridges = '', rh = '';
  for (let x = -33; x <= 33; x += 5.5) { ridges += `M${r1(cx + x)} 132V184`; rh += `M${r1(cx + x + 1.8)} 132V184`; }
  s += `<path d="M${cx - 36} 191A36 4.3 0 0 0 ${cx + 36} 191V200A36 4.3 0 0 1 ${cx - 36} 200Z" fill="${capG}"/>` +
    `<path d="M${cx - 37} 124V184A37 4.4 0 0 0 ${cx + 37} 184V124Z" fill="${capG}"/>` +
    `<path d="${ridges}" stroke="#1C5A84" stroke-opacity=".35" stroke-width="1.6"/><path d="${rh}" stroke="#E8F8FF" stroke-opacity=".35" stroke-width="1.2"/>` +
    `<ellipse cx="${cx}" cy="124" rx="37" ry="4.4" fill="#C6EBFA" stroke="#5FAED6" stroke-width="1.5"/>` +
    `<path d="M${cx - 37} 184A37 4.4 0 0 0 ${cx + 37} 184" stroke="#1C5A84" stroke-opacity=".5" stroke-width="2" fill="none"/>` +
    `<rect x="${cx - 24}" y="130" width="7" height="52" rx="3.5" fill="#fff" opacity=".45"/>`;
  return svgDoc({ defs: D.str(), body: `<g transform="translate(400 662)scale(1.08)translate(-400 -662)">${s}</g>` });
}

/* ================================================================== DESSERTS (3/4 view) */

/** A block seen from 3/4 above. Faces are drawn in local coordinates and mapped with matrix(). */
function block({ cx, cy, w, d, h, th, tilt = 0.42 }) {
  const c = Math.cos(th), s = Math.sin(th), hw = w / 2, hd = d / 2;
  const P = (X, Y, Z) => [cx + X * c + Z * s, cy - Y + (-X * s + Z * c) * tilt];
  const mat = (m) => `matrix(${m.map((v) => Math.round(v * 1000) / 1000).join(' ')})`;
  return {
    P, w, d, h, hw, hd, tilt,
    front: mat([c, -s * tilt, 0, 1, cx - hw * c + hd * s, cy + (hw * s + hd * c) * tilt]), // Z = +hd, u along X (0..w), v = -Y
    left: mat([s, c * tilt, 0, 1, cx - hw * c - hd * s, cy + (hw * s - hd * c) * tilt]), // X = -hw, u along Z (0..d)
    top: mat([c, -s * tilt, s, c * tilt, cx, cy - h]), // local (X, Z)
    outline: [P(-hw, h, -hd), P(hw, h, -hd), P(hw, h, hd), P(hw, 0, hd), P(-hw, 0, hd), P(-hw, 0, -hd)],
    topPoly: [P(-hw, h, -hd), P(hw, h, -hd), P(hw, h, hd), P(-hw, h, hd)],
    foot: [P(-hw, 0, -hd), P(hw, 0, -hd), P(hw, 0, hd), P(-hw, 0, hd)],
  };
}

/** Wavy boundary across a face (u from 0..L) at height v0, returns point list. */
function wave(rand, L, v0, amp, n = 14) {
  const ph = rand() * TAU, f = between(rand, 1.5, 3);
  return Array.from({ length: n + 1 }, (_, i) => { const u = (i / n) * L; return [u, v0 + amp * Math.sin((u / L) * f * TAU + ph) + between(rand, -amp, amp) * 0.4]; });
}
const band = (lo, hi) => 'M' + [...lo, ...[...hi].reverse()].map((p) => `${r1(p[0])} ${r1(p[1])}`).join('L') + 'Z';

function tiraFace(D, rand, L, H, lit) {
  const spec = [['s', 56], ['c', 48], ['s', 46], ['c', 42], ['k', 8]];
  const tot = spec.reduce((a, b) => a + b[1], 0), k = H / tot;
  let acc = 0, prev = [[0, 0], [L, 0]], out = '';
  spec.forEach(([t, hh], i) => {
    acc += hh * k;
    const top = i === spec.length - 1 ? [[0, -H], [L, -H]] : wave(rand, L, -acc, t === 's' ? 2.5 : 3.5);
    const vb = -acc + hh * k, vt = -acc;
    if (t === 's') {
      out += `<path d="${band(prev, top)}" fill="#7A4524"/>`;
      const n = Math.max(3, Math.round(L / 78)), cw = L / n;
      for (let j = 0; j < n; j++) {
        const ux = cw * (j + 0.5) + between(rand, -4, 4), my = (vb + vt) / 2;
        out += `<rect x="${r1(ux - cw * 0.46)}" y="${r1(my - hh * k * 0.36)}" width="${r1(cw * 0.92)}" height="${r1(hh * k * 0.72)}" rx="${r1(hh * k * 0.34)}" fill="${D.rad('lady', [[0, '#D9A46A'], [0.55, '#B07440'], [1, '#7E4722']])}"/>`;
      }
      const pores = Array.from({ length: n * 9 }, () => [between(rand, 4, L - 4), between(rand, vt + 6, vb - 6)]);
      out += dots(pores, '#5A2E14', 2.6, ' opacity=".45"') + dots(pores.slice(0, n * 4).map(([x, y]) => [x + 3, y - 3]), '#EBC08A', 2, ' opacity=".5"');
    } else if (t === 'c') {
      out += `<path d="${band(prev, top)}" fill="${D.lin('cream', [[0, '#FFFAF0'], [0.7, '#F7EBD3'], [1, '#E7CFA8']])}"/>`;
      out += dots(Array.from({ length: 12 }, () => [between(rand, 6, L - 6), between(rand, vt + 6, vb - 6)]), '#E9D7B6', 2.4, ' opacity=".7"');
    } else {
      out += `<path d="${band(prev, top)}" fill="#4A2210"/>`;
    }
    prev = top;
  });
  out += `<rect x="0" y="${-H}" width="${L}" height="${H}" fill="${D.lin(lit ? 'litF' : 'shdF', lit ? [[0, '#fff', 0.1], [1, '#fff', 0.02]] : [[0, '#000', 0.04], [1, '#000', 0.26]], [0, 0, 1, 0])}"/>` +
    `<rect x="0" y="${-H}" width="${L}" height="${H}" fill="${D.lin('ao', [[0, '#000', 0], [0.85, '#000', 0], [1, '#000', 0.22]])}"/>`;
  return out;
}

function coffeeBean(D, x, y, a, s = 1) {
  return `<g transform="translate(${n0(x)} ${n0(y)})rotate(${n0(a)})scale(${s})"><ellipse rx="13" ry="9" fill="${D.rad('bean', [[0, '#8A5230'], [0.6, '#4A2410'], [1, '#2A1206']], { cx: 0.35, cy: 0.3, r: 0.75 })}"/>` +
    `<path d="M-10 1C-4 -4 4 5 10 -1" stroke="#1A0A02" stroke-width="2.2" fill="none" stroke-linecap="round"/><ellipse cx="-4" cy="-5" rx="5" ry="2" fill="#fff" opacity=".3"/></g>`;
}

function tiramisu(id) {
  const rand = rng(id), D = defsFor(id);
  const B = block({ cx: CX - 4, cy: 520, w: 292, d: 292, h: 204, th: 0.52 });
  const pc = { x: CX + 4, y: 534 }, prx = 322, pry = 136;
  D.add('shadow', () => shadowFilter(id, 16));
  let s = contactShadow(id, { cx: pc.x + 12, cy: pc.y + 22, rx: prx + 6, ry: pry + 10, opacity: 0.32 });
  // plate
  s += `<ellipse cx="${pc.x + 2}" cy="${pc.y + 12}" rx="${prx}" ry="${pry}" fill="#BFAE92"/>` +
    `<ellipse cx="${pc.x}" cy="${pc.y}" rx="${prx}" ry="${pry}" fill="${D.rad('plate', [[0, '#FFFFFF'], [0.7, '#F6F0E6'], [1, '#DCCFBA']], { cx: 0.42, cy: 0.35, r: 0.7 })}"/>` +
    `<ellipse cx="${pc.x}" cy="${pc.y + 4}" rx="${n0(prx * 0.72)}" ry="${n0(pry * 0.68)}" fill="${D.lin('well', [[0, '#E4D9C6'], [0.5, '#F3ECE0'], [1, '#FBF8F2']])}"/>` +
    `<path d="M${pc.x - prx + 30} ${pc.y - 30}Q${pc.x - 160} ${pc.y - pry - 4} ${pc.x + 20} ${pc.y - pry + 2}" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" opacity=".9"/>`;
  // cocoa dust on the plate
  const dust = [];
  for (let i = 0; i < 120; i++) { const a = rand() * TAU, q = Math.sqrt(between(rand, 0.1, 1)); dust.push([pc.x + Math.cos(a) * prx * 0.68 * q, pc.y + 4 + Math.sin(a) * pry * 0.64 * q]); }
  s += dots(dust, '#6B3A1E', 2.2, ' opacity=".55"');
  // shadow of the portion on the plate
  s += `<path d="${poly(B.foot.map(([x, y]) => [x + 16, y + 6]))}" fill="#3A1A08" opacity=".45" filter="${D.blur(10)}"/>`;
  s += `<g transform="${B.left}">${tiraFace(D, rand, B.d, B.h, true)}</g><g transform="${B.front}">${tiraFace(D, rand, B.w, B.h, false)}</g>`;
  // cocoa-dusted top (local X,Z coordinates)
  const hw = B.hw, pw = [];
  for (let i = 0; i < 260; i++) pw.push([between(rand, -hw, hw), between(rand, -hw, hw), between(rand, -1, 1), between(rand, -1, 1)]);
  s += `<g transform="${B.top}"><rect x="${-hw - 2}" y="${-hw - 2}" width="${B.w + 4}" height="${B.d + 4}" rx="6" fill="${D.rad('cocoa', [[0, '#A2683F'], [0.55, '#834C29'], [1, '#673618']], { cx: 0.3, cy: 0.3, r: 0.9 })}" filter="${D.grain('cc', { freq: 1.1, amount: 0.35 })}"/>` +
    dots(pw.slice(0, 150), '#C08A5E', 3, ' opacity=".55"') + dots(pw.slice(150), '#4A220E', 3, ' opacity=".45"') +
    `<path d="M${-hw} ${hw}H${hw}M${-hw} ${-hw}V${hw}" stroke="#B07A50" stroke-width="4" stroke-linecap="round" opacity=".55"/></g>`;
  s += `<path d="M${n0(B.outline[4][0])} ${n0(B.outline[4][1] - 4)}V${n0(B.topPoly[3][1] + 6)}" stroke="#fff" stroke-width="2.5" opacity=".35"/>`;
  // garnish: mint sprig + coffee beans
  const t3 = B.topPoly[3], tc = [(B.topPoly[0][0] + B.topPoly[2][0]) / 2, (B.topPoly[0][1] + B.topPoly[2][1]) / 2];
  const mk = makeLeaf(D, rand, 'mint');
  s += `<g filter="${D.bevel('bvm', { b: 2, o: 1.4, hi: 0.4, lo: 0.3, ds: 0.45, dsB: 3, dx: 4, dy: 6 })}">` +
    leafUse(mk, tc[0] + 14, tc[1] + 6, -150, 1.05, 0.7) + leafUse(mk, tc[0] + 14, tc[1] + 6, -60, 1.0, -0.7) + leafUse(mk, tc[0] + 14, tc[1] + 6, -105, 0.8, 0.65) +
    coffeeBean(D, tc[0] - 54, tc[1] + 26, 20) + coffeeBean(D, tc[0] + 70, tc[1] + 30, -30, 0.95) + coffeeBean(D, t3[0] + 10, t3[1] - 30, 70, 0.9) + `</g>`;
  return svgDoc({ defs: D.str(), body: s });
}

function brownieFace(D, rand, L, H, lit) {
  let out = `<rect x="0" y="${-H}" width="${L}" height="${H}" fill="${D.lin('bf', [[0, '#5E3019'], [0.18, '#4A2412'], [1, '#2C1309']])}"/>`;
  const cr = wave(rand, L, -H + 12, 3);
  out += `<path d="${band(cr, [[0, -H], [L, -H]])}" fill="#7A4528"/>` + `<path d="M${cr.map((p) => `${r1(p[0])} ${r1(p[1])}`).join('L')}" stroke="#B07850" stroke-width="2" fill="none" opacity=".6"/>`;
  const p = Array.from({ length: 140 }, () => [between(rand, 4, L - 4), between(rand, -H + 18, -6), between(rand, -1.5, 1.5), between(rand, -1, 1)]);
  out += dots(p.slice(0, 70), '#1E0C05', 3.4, ' opacity=".55"') + dots(p.slice(70, 120), '#7A4426', 2.6, ' opacity=".6"') + dots(p.slice(120), '#D8A07A', 1.8, ' opacity=".45"');
  for (let i = 0; i < 3; i++) {
    const x = between(rand, 30, L - 30), y = between(rand, -H + 34, -22), pts = [];
    for (let j = 0; j < 7; j++) { const a = (j / 7) * TAU, q = between(rand, 7, 13); pts.push([x + Math.cos(a) * q * 1.3, y + Math.sin(a) * q]); }
    out += `<path d="${smooth(pts, true, 1)}" fill="${D.rad('wn', [[0, '#E2B57A'], [1, '#9A6634']], { cx: 0.35, cy: 0.3, r: 0.8 })}" stroke="#3A1A08" stroke-opacity=".5" stroke-width="1.5"/>`;
  }
  out += `<rect x="0" y="${-H}" width="${L}" height="${H}" fill="${D.lin(lit ? 'blit' : 'bshd', lit ? [[0, '#fff', 0.12], [1, '#fff', 0.03]] : [[0, '#000', 0.05], [1, '#000', 0.3]], [0, 0, 1, 0])}"/>`;
  return out;
}

function brownieTop(D, rand, B, name) {
  const hw = B.hw, pts = [];
  const per = (t) => { // perimeter param 0..4 → square point
    const k = Math.floor(t), f = t - k, a = -hw + f * 2 * hw;
    return [[a, -hw], [hw, a], [-a, hw], [-hw, -a]][k % 4];
  };
  for (let i = 0; i < 48; i++) { const [x, y] = per((i / 48) * 4); const o = between(rand, -1.5, 5); const l = Math.hypot(x, y); pts.push([x + (x / l) * o, y + (y / l) * o]); }
  let s = `<path d="${smooth(pts, true)}" fill="${D.rad(`${name}t`, [[0, '#9A6440'], [0.5, '#6E3C1F'], [1, '#4E2711']], { cx: 0.3, cy: 0.3, r: 0.95 })}"/>`;
  // crackly shiny crust: flakes with light edges and dark cracks
  let cracks = '', lite = '', flakes = '';
  for (let i = 0; i < 16; i++) {
    let x = between(rand, -hw * 0.85, hw * 0.85), y = between(rand, -hw * 0.85, hw * 0.85), a = rand() * TAU, seg = `M${n0(x)} ${n0(y)}`;
    for (let j = 0; j < 4; j++) { a += between(rand, -0.9, 0.9); const l = between(rand, 16, 34); x += Math.cos(a) * l; y += Math.sin(a) * l; x = Math.max(-hw, Math.min(hw, x)); y = Math.max(-hw, Math.min(hw, y)); seg += `L${n0(x)} ${n0(y)}`; }
    cracks += seg;
  }
  for (let i = 0; i < 9; i++) { const x = between(rand, -hw * 0.7, hw * 0.7), y = between(rand, -hw * 0.7, hw * 0.7), q = between(rand, 18, 34); flakes += poly(Array.from({ length: 5 }, (_, j) => { const a = (j / 5) * TAU + between(rand, -0.3, 0.3); return [x + Math.cos(a) * q * between(rand, 0.6, 1), y + Math.sin(a) * q * between(rand, 0.6, 1)]; })); }
  s += `<path d="${flakes}" fill="#A26C46" opacity=".35"/>` +
    `<path d="${cracks}" stroke="#C99468" stroke-width="2" fill="none" opacity=".55" transform="translate(-2 -2)" stroke-linejoin="round"/>` +
    `<path d="${cracks}" stroke="#241006" stroke-width="2.6" fill="none" opacity=".75" stroke-linejoin="round"/>` +
    `<ellipse cx="${n0(-hw * 0.3)}" cy="${n0(-hw * 0.25)}" rx="${n0(hw * 0.6)}" ry="${n0(hw * 0.3)}" transform="rotate(-40 ${n0(-hw * 0.3)} ${n0(-hw * 0.25)})" fill="#FFE8D0" opacity=".2" filter="${D.blur(9)}"/>` +
    `<path d="M${-hw} ${hw}H${hw}M${-hw} ${-hw}V${hw}" stroke="#B98258" stroke-width="3" stroke-linecap="round" opacity=".5"/>`;
  return `<g transform="${B.top}">${s}</g>`;
}

function brownie(id) {
  const rand = rng(id), D = defsFor(id);
  const A = block({ cx: CX - 6, cy: 548, w: 340, d: 340, h: 112, th: 0.36 });
  const Bk = block({ cx: CX + 8, cy: 548 - 112 + 4, w: 312, d: 312, h: 106, th: 0.8 });
  const wal = walnutSym(D);
  let s = ground(D, CX, 640, 300, 0.36);
  s += `<path d="${poly(A.foot.map(([x, y]) => [x + 10, y + 4]))}" fill="#2A1206" opacity=".4" filter="${D.blur(8)}"/>`;
  s += `<g transform="${A.left}">${brownieFace(D, rand, A.d, A.h, true)}</g><g transform="${A.front}">${brownieFace(D, rand, A.w, A.h, false)}</g>` + brownieTop(D, rand, A, 'a');
  s += `<g clip-path="${D.clip('atop', `<path d="${poly(A.topPoly)}"/>`)}"><path d="${poly(Bk.foot.map(([x, y]) => [x + 14, y + 10]))}" fill="#1A0904" opacity=".6" filter="${D.blur(9)}"/></g>`;
  s += `<g transform="${Bk.left}">${brownieFace(D, rand, Bk.d, Bk.h, true)}</g><g transform="${Bk.front}">${brownieFace(D, rand, Bk.w, Bk.h, false)}</g>` + brownieTop(D, rand, Bk, 'b');
  const tc = [(Bk.topPoly[0][0] + Bk.topPoly[2][0]) / 2, (Bk.topPoly[0][1] + Bk.topPoly[2][1]) / 2];
  s += `<g filter="${D.bevel('bvw', { b: 2, o: 1.4, hi: 0.4, lo: 0.35, ds: 0.55, dsB: 3, dx: 4, dy: 6 })}">` +
    place(wal, tc[0] - 46, tc[1] - 2, 20, 1.45, 1.05) + place(wal, tc[0] + 44, tc[1] + 20, -30, 1.35, 0.95) +
    place(wal, A.outline[5][0] - 20, A.outline[5][1] + 74, 10, 1.4, 1) + place(wal, A.outline[3][0] + 14, A.outline[3][1] - 4, -20, 1.45, 1.02) + place(wal, A.outline[4][0] + 130, A.outline[4][1] + 8, 40, 1.1, 0.8) + `</g>`;
  return svgDoc({ defs: D.str(), body: s });
}

/* ================================================================== items */

export const art = {
  cesar: () => salad('cesar', {
    bowl: 'cream',
    greens: { mix: [{ kind: 'romaine', w: 3 }, { kind: 'romaine2', w: 2 }], ring: 14, count: 26, minDist: 58, per: 10, scale: [0.82, 1.08] },
    top: caesarTop,
  }),
  'chevre-chaud': () => salad('chevre-chaud', {
    bowl: 'terracotta',
    greens: { mix: [{ kind: 'oak', w: 3 }, { kind: 'red', w: 2 }, { kind: 'mache', w: 2, s: 1.3 }], ring: 16, count: 40, minDist: 44, per: 12, scale: [0.9, 1.15] },
    top: chevreTop,
  }),
  'salade-thon': () => salad('salade-thon', {
    bowl: 'creamBand',
    greens: { mix: [{ kind: 'romaine2', w: 2, s: 0.75 }, { kind: 'oak', w: 3 }, { kind: 'mache', w: 1, s: 1.3 }], ring: 16, count: 44, minDist: 42, per: 12, scale: [0.9, 1.15] },
    top: thonTop,
  }),
  cola: () => cola('cola'),
  'the-glace': () => theGlace('the-glace'),
  eau: () => waterBottle('eau'),
  limonade: () => limonade('limonade'),
  'jus-orange': () => jusOrange('jus-orange'),
  tiramisu: () => tiramisu('tiramisu'),
  brownie: () => brownie('brownie'),
};
