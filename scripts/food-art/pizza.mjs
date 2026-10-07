// Demo food art: pizza. See lib.mjs for helpers and build.mjs for the required ids.
// Perfect overhead view, no plate: the puffy crust is the silhouette. Light from the top-left.
// One parametric renderer — pizza(id, spec) — builds every item:
//   crust ring → sauce base → spec.steps (cheese pools, topping layers, finishing touches) → light overlay.
// Every layer group gets a soft "bevel" filter (highlight on top-left edges, shade on bottom-right
// edges, small drop shadow) computed from the group's alpha, so lighting stays consistent even on
// rotated toppings and at every display size.
import { rng, r, between, scatterInCircle, blobPath, contactShadow, shadowFilter, grainFilter, svgDoc } from './lib.mjs';

const CX = 400, CY = 392, R = 312, RS = Math.round(R * 0.835); // centre, crust radius, sauce radius
const TAU = Math.PI * 2;
const P = (x, y) => `${r(x)} ${r(y)}`;
const I = (x, y) => `${Math.round(x)} ${Math.round(y)}`;
/** Round every number in a path to an integer (big organic shapes don't need decimals). */
const int = (d) => d.replace(/-?\d+\.\d+/g, (m) => String(Math.round(+m)));
const polar = (a, d, cx = CX, cy = CY) => [cx + Math.cos(a) * d, cy + Math.sin(a) * d];

/* ------------------------------------------------------------------ markup helpers */

const stops = (list) => list.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a === undefined ? '' : ` stop-opacity="${a}"`}/>`).join('');
const radialG = (gid, list, o = {}) =>
  `<radialGradient id="${gid}"${o.u ? ' gradientUnits="userSpaceOnUse"' : ''} cx="${o.cx ?? 0.5}" cy="${o.cy ?? 0.5}" r="${o.r ?? 0.5}">${stops(list)}</radialGradient>`;
const linearG = (gid, list, o = {}) =>
  `<linearGradient id="${gid}"${o.u ? ' gradientUnits="userSpaceOnUse"' : ''} x1="${o.x1 ?? 0}" y1="${o.y1 ?? 0}" x2="${o.x2 ?? 1}" y2="${o.y2 ?? 1}">${stops(list)}</linearGradient>`;
// all filters share one generous user-space region (content may be translated, e.g. the hero slice)
const FU = 'filterUnits="userSpaceOnUse" x="-60" y="-60" width="920" height="920"';
const blurF = (fid, s) => `<filter id="${fid}" ${FU}><feGaussianBlur stdDeviation="${s}"/></filter>`;

/** Dots as zero-length round-capped subpaths: tiny files for specks, flecks and crumbs. */
const dots = (pts, w, col, op = 1) =>
  pts.length ? `<path d="${pts.map(([x, y]) => `M${P(x, y)}h0`).join('')}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"${op < 1 ? ` opacity="${op}"` : ''}/>` : '';

/**
 * Soft bevel driven only by the group's alpha: highlight crescent on top-left edges, shade on
 * bottom-right edges, optional drop shadow and optional "melt" halo (dilated, blurred, tinted).
 */
function bevelF(fid, { b = 3, o = 2, hi = 0.4, lo = 0.35, hiCol = '#FFF6DC', loCol = '#3B1406', ds = 0, dsB = 3, dsX = 2, dsY = 3, dsCol = '#2A0C03', halo, haloR = 4, haloB = 5, haloOp = 0.6 } = {}) {
  const melt = halo
    ? `<feMorphology in="SourceAlpha" operator="dilate" radius="${haloR}"/><feGaussianBlur stdDeviation="${haloB}" result="hb"/><feFlood flood-color="${halo}" flood-opacity="${haloOp}"/><feComposite in2="hb" operator="in" result="halo"/>`
    : '';
  const shadow = ds
    ? `<feGaussianBlur in="SourceAlpha" stdDeviation="${dsB}"/><feOffset dx="${dsX}" dy="${dsY}" result="so"/><feFlood flood-color="${dsCol}" flood-opacity="${ds}"/><feComposite in2="so" operator="in" result="ds"/>`
    : '';
  return `<filter id="${fid}" ${FU}>${melt}${shadow}<feGaussianBlur in="SourceAlpha" stdDeviation="${b}" result="b"/>` +
    `<feOffset in="b" dx="${o}" dy="${o}" result="b1"/><feComposite in="SourceAlpha" in2="b1" operator="arithmetic" k2="1" k3="-1" result="h"/>` +
    `<feFlood flood-color="${hiCol}" flood-opacity="${hi}"/><feComposite in2="h" operator="in" result="hc"/>` +
    `<feOffset in="b" dx="${-o}" dy="${-o}" result="b2"/><feComposite in="SourceAlpha" in2="b2" operator="arithmetic" k2="1" k3="-1" result="l"/>` +
    `<feFlood flood-color="${loCol}" flood-opacity="${lo}"/><feComposite in2="l" operator="in" result="lc"/>` +
    `<feMerge>${halo ? '<feMergeNode in="halo"/>' : ''}${ds ? '<feMergeNode in="ds"/>' : ''}<feMergeNode in="SourceGraphic"/><feMergeNode in="lc"/><feMergeNode in="hc"/></feMerge></filter>`;
}

/** Low-frequency noise mottling (oven browning, sauce depth) tinted `col`, kept inside the shape. */
const mottleF = (fid, col, { freq = 0.025, gain = 2.2, cut = 1.0, seed = 5 } = {}) => {
  const [cr, cg, cb] = col.match(/\w\w/g).map((h) => r(parseInt(h, 16) / 255, 2));
  return `<filter id="${fid}" ${FU}><feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="3" seed="${seed}" result="n"/>` +
    `<feColorMatrix in="n" type="matrix" values="0 0 0 0 ${cr} 0 0 0 0 ${cg} 0 0 0 0 ${cb} 0 0 0 ${gain} ${-cut}" result="m"/>` +
    `<feComposite in="m" in2="SourceGraphic" operator="in" result="mc"/><feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="mc"/></feMerge></filter>`;
};

/** Catmull-Rom spline through points → cubic Bézier path. */
function smooth(pts, closed = true, fmt = P) {
  const n = pts.length;
  const at = (i) => pts[closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
  let d = `M${fmt(...pts[0])}`;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    d += `C${fmt(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)} ${fmt(p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)} ${fmt(...p2)}`;
  }
  return closed ? d + 'Z' : d;
}

/** Organic blob with independent x/y radii and rotation (radians). */
function blobXY(rand, cx, cy, rx, ry, { points = 8, wobble = 0.25, rot = 0, fmt = P } = {}) {
  const c = Math.cos(rot), s = Math.sin(rot);
  return smooth(Array.from({ length: points }, (_, i) => {
    const a = ((i + between(rand, -0.2, 0.2)) / points) * TAU;
    const k = 1 - wobble / 2 + rand() * wobble;
    const x = Math.cos(a) * rx * k, y = Math.sin(a) * ry * k;
    return [cx + x * c - y * s, cy + x * s + y * c];
  }), true, fmt);
}

/** Circular arc path from angle a0 to a1 (radians, clockwise on screen). */
const arc = (cx, cy, rr, a0, a1) =>
  `M${P(cx + rr * Math.cos(a0), cy + rr * Math.sin(a0))}A${r(rr)} ${r(rr)} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${P(cx + rr * Math.cos(a1), cy + rr * Math.sin(a1))}`;

/* ------------------------------------------------------------------ per-item context (defs registry) */

function context(id) {
  const ctx = { id, rand: rng(id), defs: [], keys: new Set(), placed: [] };
  ctx.fid = (k) => `${id}-${k}`;
  ctx.once = (k, make) => {
    if (!ctx.keys.has(k)) { ctx.keys.add(k); ctx.defs.push(make(ctx.fid(k))); }
    return `url(#${ctx.fid(k)})`;
  };
  ctx.blur = (s) => ctx.once(`blur${String(s).replace('.', '_')}`, (fid) => blurF(fid, s));
  ctx.bev = (k, o) => ctx.once(k, (fid) => bevelF(fid, o));
  return ctx;
}

/** Topping positions: dart-throwing in the sauce disc, avoiding earlier layers and `avoid` zones. */
function place(ctx, { count, minDist, radius = RS - 36, rad = 20, overlap = 0.75, avoid = [] }) {
  const cand = scatterInCircle(ctx.rand, { cx: CX, cy: CY, radius, count: count * 5, minDist });
  const out = [];
  for (const p of cand) {
    if (out.length >= count) break;
    if (ctx.placed.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < (q.rad + rad) * overlap)) continue;
    if (avoid.some((a) => Math.hypot(a.x - p.x, a.y - p.y) < a.d)) continue;
    out.push(p);
  }
  for (const p of out) ctx.placed.push({ ...p, rad });
  return out;
}

/* ------------------------------------------------------------------ bases */

// s: gradient (light → dark), d: mottle tint, l: light patches, rim: caramelised edge,
// sh: crust shadow on the base, halo: tint where melted cheese meets this base.
const BASES = {
  tomato: { s: ['#DA472D', '#C8321E', '#AC2816', '#8F1F12'], d: '#7E160A', l: '#E8613F', rim: '#6A180A', sh: '#3A0C04', shOp: 0.5, pulp: '#EE7352', halo: '#EF9446', shine: 0.35 },
  bbq: { s: ['#A0401E', '#842E15', '#68210D', '#4C1607'], d: '#3A0D04', l: '#C0623A', rim: '#2E0B03', sh: '#1A0602', shOp: 0.5, pulp: '#B4552C', halo: '#D07E44', shine: 0.5 },
  cream: { s: ['#F9E6B8', '#F1D29A', '#E6BC7C', '#D6A462'], d: '#C9843A', l: '#FFF6DE', rim: '#B07236', sh: '#7A4A1C', shOp: 0.32, halo: '#E6B46A', shine: 0.4 },
  creme: { s: ['#FFFCF4', '#FBF2E0', '#F3E3C4', '#E6CB9C'], d: '#D9A660', l: '#FFFFFF', rim: '#C79656', sh: '#7A4A1C', shOp: 0.26, halo: '#EED29A', shine: 0.5 },
  choco: { s: ['#5E321A', '#4A230E', '#3A1A09', '#2A1105'], d: '#1A0802', l: '#7E4A2A', rim: '#160701', sh: '#0E0401', shOp: 0.55, halo: '#6A3A1E', shine: 0.45 },
};

/* ------------------------------------------------------------------ crust */

function drawCrust(ctx, spec) {
  const { rand } = ctx;
  const outer = int(blobPath(rand, CX, CY, R, { points: 24, wobble: 0.04 }));
  const rin = Math.round(RS * 0.975 - 10);
  ctx.defs.push(`<path id="${ctx.fid('outer')}" d="${outer}"/>`);
  ctx.defs.push(`<path id="${ctx.fid('ring')}" fill-rule="evenodd" clip-rule="evenodd" d="${outer}M${CX - rin} ${CY}a${rin} ${rin} 0 1 0 ${2 * rin} 0a${rin} ${rin} 0 1 0 ${-2 * rin} 0Z"/>`);
  ctx.outer = `#${ctx.fid('outer')}`;
  const Rg = R * 1.03, fr = (x) => r(x / Rg, 3);
  const g = ctx.once('crust', (gid) => radialG(gid, [
    [fr(rin), '#B4642A'], [fr(RS + 2), '#CF8840'], [fr(RS + 18), '#EBAF59'], [fr(R * 0.915), '#F6C873'],
    [fr(R * 0.955), '#EAAA52'], [fr(R * 0.99), '#C77B32'], [1, '#9A521C'],
  ], { u: 1, cx: CX, cy: CY, r: r(Rg) }));
  const clip = ctx.once('crustclip', (fid) => `<clipPath id="${fid}"><use href="#${ctx.fid('ring')}"/></clipPath>`);
  ctx.defs.push(grainFilter(ctx.id, { freq: 0.85, amount: 0.09 }));
  const mot = ctx.once('crustmot', (fid) => mottleF(fid, '#B0561A', { freq: 0.03, gain: 2.1, cut: 0.98, seed: 7 }));

  // leopard char: clusters of dark specks inside soft brown halos, mostly on the ridge / outer slope
  let halos = '', bubbles = '';
  const cores = [], small = [], specks = [], flour = [];
  const nC = spec.char ?? 16;
  for (let i = 0; i < nC; i++) {
    const a = rand() * TAU, rr = between(rand, RS + 24, R - 9), [x, y] = polar(a, rr);
    const s = between(rand, 6, 12), deg = Math.round((a * 180) / Math.PI + 90);
    halos += `<ellipse cx="${Math.round(x)}" cy="${Math.round(y)}" rx="${Math.round(s * 1.6)}" ry="${Math.round(s)}" transform="rotate(${deg} ${I(x, y)})"/>`;
    cores.push(polar(a + (between(rand, -0.3, 0.3) * s) / rr, rr + between(rand, -2, 2)));
    for (let j = 0; j < 2 + Math.floor(rand() * 3); j++) small.push(polar(a + between(rand, -s, s) / rr, rr + between(rand, -s * 0.5, s * 0.5)));
    if (i < (spec.blisters ?? 6)) {
      const [bx, by] = polar(a + ((rand() < 0.5 ? -1 : 1) * (s * 1.4)) / rr, rr - 2);
      bubbles += `<ellipse cx="${Math.round(bx)}" cy="${Math.round(by)}" rx="${r(s * 1.05)}" ry="${r(s * 0.68)}" transform="rotate(${deg} ${I(bx, by)})"/>`;
    }
  }
  for (let i = 0; i < 22; i++) specks.push(polar(rand() * TAU, between(rand, RS + 14, R - 5)));
  for (let i = 0; i < 16; i++) flour.push(polar(between(rand, 1.6, 4.4), between(rand, RS + 12, R - 4)));
  return `<g filter="${ctx.bev('crustfx', { b: 15, o: 10, hi: 0.55, hiCol: '#FFE6AE', lo: 0.55, loCol: '#4E1E07' })}">` +
    `<g filter="url(#${ctx.id}-grain)"><use href="#${ctx.fid('ring')}" fill="${g}" filter="${mot}"/></g>` +
    `<g clip-path="${clip}">` +
    `<g filter="${ctx.bev('bubfx', { b: 3, o: 2.2, hi: 0.55, hiCol: '#FFEAC0', lo: 0.4, loCol: '#6A2C0A', ds: 0.3, dsB: 2, dsX: 1.5, dsY: 2 })}" fill="#F0BC6C">${bubbles}</g>` +
    `<g filter="${ctx.blur(4)}" fill="#8C3E12" opacity=".42">${halos}</g>` +
    `<g filter="${ctx.blur(0.8)}">${dots(cores, 8, '#2A1005', 0.85)}${dots(small, 3.6, '#3A1608', 0.8)}</g>` +
    dots(specks, 2, '#4A1F0A', 0.6) + dots(flour, 2.2, '#FFF6E4', 0.45) + `</g></g>`;
}

/* ------------------------------------------------------------------ sauce */

function drawSauce(ctx, base) {
  const { rand } = ctx, B = BASES[base];
  const path = int(blobPath(rand, CX, CY, RS, { points: 22, wobble: 0.035 }));
  ctx.defs.push(`<path id="${ctx.fid('sauce-p')}" d="${path}"/>`);
  const clip = ctx.once('sauceclip', (fid) => `<clipPath id="${fid}"><use href="#${ctx.fid('sauce-p')}"/></clipPath>`);
  const g = ctx.once('sauce', (gid) => radialG(gid, [[0, B.s[0]], [0.55, B.s[1]], [0.86, B.s[2]], [1, B.s[3]]], { u: 1, cx: CX - 50, cy: CY - 60, r: r(RS * 1.15) }));
  const mot = ctx.once('saucemot', (fid) => mottleF(fid, B.d, { freq: 0.022, gain: 2.3, cut: 1.0, seed: 3 }));
  let light = '';
  for (let i = 0; i < 8; i++) {
    const [x, y] = polar(rand() * TAU, Math.sqrt(rand()) * (RS - 20));
    light += `<path d="${int(blobPath(rand, x, y, between(rand, 10, 22), { points: 5, wobble: 0.5 }))}"/>`;
  }
  const pulp = [];
  if (B.pulp) for (let i = 0; i < 22; i++) pulp.push(polar(rand() * TAU, Math.sqrt(rand()) * (RS - 8)));
  let shine = '';
  for (let i = 0; i < 9; i++) {
    const [x, y] = polar(between(rand, 2.4, 5.2), between(rand, 0.25, 0.92) * RS).map(Math.round);
    shine += `<ellipse cx="${x}" cy="${y}" rx="${Math.round(between(rand, 5, 14))}" ry="${r(between(rand, 1.8, 3.4))}" transform="rotate(${Math.round(between(rand, -50, -25))} ${x} ${y})"/>`;
  }
  return `<g clip-path="${clip}"><use href="#${ctx.fid('sauce-p')}" fill="${g}" filter="${mot}"/>` +
    `<g fill="${B.l}" opacity=".28" filter="${ctx.blur(5)}">${light}</g>` +
    (pulp.length ? `<g filter="${ctx.blur(1.2)}">${dots(pulp, 4.5, B.pulp, 0.5)}</g>` : '') +
    `<use href="#${ctx.fid('sauce-p')}" fill="none" stroke="${B.rim}" stroke-width="8" opacity=".55" filter="${ctx.blur(2.5)}"/>` +
    `<circle cx="${CX + 12}" cy="${CY + 14}" r="${RS + 16}" fill="none" stroke="${B.sh}" stroke-width="36" opacity="${B.shOp}" filter="${ctx.blur(9)}"/>` +
    `<g fill="#FFF3E6" opacity="${B.shine}" filter="${ctx.blur(1.2)}">${shine}</g></g>`;
}

/* ------------------------------------------------------------------ melted cheese pools */

function drawCheese(ctx, c) {
  const { rand } = ctx, B = BASES[ctx.base];
  const pts = scatterInCircle(rand, { cx: CX, cy: CY, radius: c.radius ?? RS - 58, count: c.count, minDist: c.minDist });
  const g = ctx.once('mozz', (gid) => radialG(gid, [[0, '#FFFBEF'], [0.5, '#FFF1D2'], [0.85, '#F8DCA2'], [1, '#EDC27E']], { cx: 0.4, cy: 0.36, r: 0.72 }));
  let pools = '', browns = '', dark = '', shines = '';
  for (const p of pts) {
    const rr = between(rand, c.r[0], c.r[1]), rot = rand() * Math.PI;
    let d = blobXY(rand, p.x, p.y, rr * between(rand, 0.95, 1.25), rr * between(rand, 0.7, 0.95), { points: 7, wobble: 0.34, rot, fmt: I });
    if (rand() < 0.65) {
      const a = rand() * TAU;
      d += blobPath(rand, p.x + Math.cos(a) * rr * 0.75, p.y + Math.sin(a) * rr * 0.7, rr * between(rand, 0.42, 0.6), { points: 6, wobble: 0.4 });
    }
    pools += `<path d="${int(d)}"/>`;
    const nb = Math.floor(rand() * 3);
    for (let k = 0; k < nb; k++) {
      const [bx, by] = polar(rand() * TAU, rr * between(rand, 0.35, 0.7), p.x, p.y).map(Math.round), br = rr * between(rand, 0.14, 0.26);
      browns += `<ellipse cx="${bx}" cy="${by}" rx="${r(br * 1.3)}" ry="${r(br)}" transform="rotate(${Math.round(rand() * 180)} ${bx} ${by})"/>`;
      if (rand() < 0.45) dark += `<circle cx="${bx}" cy="${by}" r="${r(br * 0.4)}"/>`;
    }
    const sx = Math.round(p.x - rr * 0.3), sy = Math.round(p.y - rr * 0.3);
    shines += `<ellipse cx="${sx}" cy="${sy}" rx="${r(rr * 0.22)}" ry="${r(rr * 0.07)}" transform="rotate(-38 ${sx} ${sy})"/>`;
  }
  return `<g filter="${ctx.bev('cheesefx', { b: 4.5, o: 1.8, hi: 0.6, hiCol: '#FFFFFF', lo: 0.16, loCol: '#8A4A14', ds: 0.12, dsB: 1.5, dsX: 1, dsY: 1.5, dsCol: '#5A1A06', halo: B.halo, haloR: 3, haloB: 4, haloOp: 0.65 })}">` +
    `<g fill="${g}">${pools}</g><g filter="${ctx.blur(3)}"><g fill="#E8A548" opacity=".55">${browns}</g><g fill="#B5682A" opacity=".45">${dark}</g></g></g>` +
    `<g fill="#fff" opacity=".7" filter="${ctx.blur(1.2)}">${shines}</g>`;
}

/* ------------------------------------------------------------------ toppings (drawn at origin, used via <use>) */

const pepperDraw = (pal) => (ctx, v, rand) => {
  const rho = between(rand, 40, 60), span = between(rand, 0.75, 1.15);
  const a0 = -Math.PI / 2 - span / 2, a1 = -Math.PI / 2 + span / 2;
  const d = arc(0, rho, rho, a0, a1);
  const char = [0, 1].map(() => polar(between(rand, a0 + 0.1, a1 - 0.1), rho, 0, rho));
  return `<g fill="none" stroke-linecap="round"><path d="${d}" stroke="${pal[0]}" stroke-width="15"/><path d="${d}" stroke="${pal[1]}" stroke-width="11.5"/>` +
    `<path d="${arc(0, rho, rho - 4.4, a0 + 0.05, a1 - 0.05)}" stroke="${pal[2]}" stroke-width="2.2" opacity=".6"/>` +
    `<path d="${arc(0, rho, rho + 3.2, a0 + 0.06, a1 - 0.12)}" stroke="${pal[3]}" stroke-width="2.4" opacity=".85"/></g>${dots(char, 5, '#2A0A04', 0.3)}`;
};

const KINDS = {
  basil: {
    rad: 28, size: 1.45, variants: 3, rotate: true, scale: [0.9, 1.15],
    fx: { b: 2.4, o: 1.6, hi: 0.3, lo: 0.3, ds: 0.45, dsB: 2.4, dsX: 1.8, dsY: 2.8 },
    draw(ctx, v, rand) {
      const g = ctx.once('basil-g', (gid) => radialG(gid, [[0, '#78B850'], [0.45, '#55973C'], [0.8, '#3A7A3A'], [1, '#2B6032']], { cx: 0.45, cy: 0.5, r: 0.6 }));
      const w = between(rand, 15.5, 19), b = between(rand, -6, 6), L = 33;
      const leaf = `M${-L} 0C${-L + 3} ${r(-w * 1.15)} ${r(L * 0.3)} ${r(-w * 1.1 + b * 0.4)} ${L} ${r(b)}C${r(L * 0.3)} ${r(w * 1.05 + b * 0.4)} ${-L + 3} ${r(w * 1.1)} ${-L} 0Z`;
      const mid = (t) => [-L + 2 * L * t, 2 * (1 - t) * t * (b * 0.3) + t * t * b];
      let veins = '';
      for (const t of [0.2, 0.38, 0.56, 0.72]) {
        const [x, y] = mid(t), reach = w * 0.62 * Math.sin(Math.PI * (t + 0.12)) ** 0.7;
        veins += `M${P(x, y)}q${r(reach * 0.4)} ${r(-reach * 0.6)} ${r(reach * 1.1)} ${r(-reach * 0.85)}M${P(x, y)}q${r(reach * 0.4)} ${r(reach * 0.6)} ${r(reach * 1.1)} ${r(reach * 0.85)}`;
      }
      return `<path d="M${-L + 1} 0.5L${-L - 9} 2" stroke="#3E7B32" stroke-width="2.6" stroke-linecap="round"/>` +
        `<path d="${leaf}" fill="${g}" stroke="#24552B" stroke-width=".8" stroke-opacity=".6"/>` +
        `<path d="${veins}" fill="none" stroke="#9ACF74" stroke-width=".9" stroke-opacity=".55"/>` +
        `<path d="M${-L} 0Q0 ${r(b * 0.3)} ${L - 1} ${r(b)}" fill="none" stroke="#B3DE8E" stroke-width="1.5" stroke-opacity=".85"/>` +
        `<path d="M${-L + 8} -3C${-L + 14} ${r(-w * 0.8)} 4 ${r(-w * 0.85)} ${L - 8} ${r(b * 0.75 - 2)}C2 ${r(-w * 0.45)} ${-L + 16} ${r(-w * 0.45)} ${-L + 8} -3Z" fill="#E4F7C4" opacity=".2"/>`;
    },
  },
  ham: {
    rad: 32, size: 1.35, variants: 3, rotate: true, scale: [0.9, 1.1],
    fx: { b: 3.5, o: 2.4, hi: 0.35, lo: 0.25, ds: 0.4, dsB: 3, dsX: 2, dsY: 3 },
    draw(ctx, v, rand) {
      const g = ctx.once('ham-g', (gid) => radialG(gid, [[0, '#F8C3BA'], [0.55, '#F0A39B'], [0.85, '#E58A85'], [1, '#D7716F']], { cx: 0.45, cy: 0.45, r: 0.6 }));
      const g2 = ctx.once('ham-f', (gid) => linearG(gid, [[0, '#FCD8D0'], [0.4, '#F5B4AC'], [1, '#E99590']], { x2: 1, y2: 0 }));
      const base = blobXY(rand, 0, 0, 34, 25, { points: 9, wobble: 0.24 });
      const fx0 = between(rand, 6, 12);
      const flap = blobXY(rand, fx0, between(rand, -3, 3), 22, 22, { points: 8, wobble: 0.2 });
      const mott = Array.from({ length: 6 }, () => [between(rand, -24, 24), between(rand, -15, 15)]);
      return `<path d="${base}" fill="${g}" stroke="#FCE3DB" stroke-width="2.4" stroke-opacity=".85"/>` +
        dots(mott.slice(0, 3), 6, '#FBD6CF', 0.5) + dots(mott.slice(3), 5, '#D9726F', 0.3) +
        `<path d="${flap}" transform="translate(2.5 3)" fill="#9E3E40" opacity=".35"/>` +
        `<path d="${flap}" fill="${g2}" stroke="#FCE3DB" stroke-width="1.8" stroke-opacity=".8"/>` +
        `<path d="${arc(fx0, 0, 19, 2.3, 4.0)}" fill="none" stroke="#FFF0EA" stroke-width="2" stroke-linecap="round" opacity=".7"/>`;
    },
  },
  mushroom: {
    rad: 24, size: 1.4, variants: 3, rotate: true, scale: [0.85, 1.05],
    fx: { b: 3, o: 2, hi: 0.35, lo: 0.3, ds: 0.4, dsB: 2.5, dsX: 1.8, dsY: 2.6 },
    draw(ctx, v, rand) {
      const g = ctx.once('mush-g', (gid) => radialG(gid, [[0, '#F7E8CA'], [0.6, '#EBD3A8'], [1, '#D3B07E']], { cx: 0.5, cy: 0.42, r: 0.6 }));
      const cw = 26, ch = between(rand, 21, 27), sw = between(rand, 15, 19) / 2, sl = between(rand, 16, 22);
      const cap = `M${-cw} 4C${-cw - 1} ${r(-ch * 0.7)} ${r(-cw * 0.5)} ${r(-ch)} 0 ${r(-ch)}C${r(cw * 0.5)} ${r(-ch)} ${cw + 1} ${r(-ch * 0.7)} ${cw} 4`;
      const body = `${cap}Q${r(cw * 0.6)} 9 ${r(sw)} 8C${r(sw + 0.5)} 14 ${r(sw + 1.5)} ${r(4 + sl)} ${r(sw + 2)} ${r(8 + sl)}Q0 ${r(11 + sl)} ${r(-sw - 2)} ${r(8 + sl)}C${r(-sw - 1.5)} ${r(4 + sl)} ${r(-sw - 0.5)} 14 ${r(-sw)} 8Q${r(-cw * 0.6)} 9 ${-cw} 4Z`;
      let gl = '';
      for (let i = -4; i <= 4; i++) gl += `M${r(i * 4.6)} ${r(1.2 + Math.abs(i) * 0.25)}L${r(i * 3.2)} 7`;
      return `<path d="${body}" fill="${g}"/>` +
        `<path d="M${-cw + 1} 3.5Q0 -3 ${cw - 1} 3.5Q${r(cw * 0.6)} 8.5 ${r(sw)} 7.5L${r(-sw)} 7.5Q${r(-cw * 0.6)} 8.5 ${-cw + 1} 3.5Z" fill="#B98C5E" opacity=".85"/>` +
        `<path d="${gl}" stroke="#7A5232" stroke-width=".8" opacity=".65"/>` +
        `<path d="M${r(-sw * 0.3)} 11L${r(-sw * 0.4)} ${r(4 + sl)}M${r(sw * 0.35)} 12L${r(sw * 0.45)} ${r(3 + sl)}" stroke="#D6BA8E" stroke-width="1.2" opacity=".8"/>` +
        `<path d="${cap}" fill="none" stroke="#8A5530" stroke-width="3.4" stroke-linecap="round"/>` +
        `<path d="${cap}" transform="translate(0 2.6) scale(.9)" fill="none" stroke="#C89C6A" stroke-width="1.1" opacity=".8"/>`;
    },
  },
  pepperoni: {
    rad: 30, size: 1.25, variants: 3, rotate: false, scale: [0.92, 1.08],
    fx: { b: 3, o: 2, hi: 0.3, lo: 0.45, ds: 0.5, dsB: 3, dsX: 2.4, dsY: 3.6 },
    draw(ctx, v, rand) {
      const g = ctx.once('pep-g', (gid) => radialG(gid, [[0, '#C63C22'], [0.5, '#B2301B'], [0.78, '#952313'], [0.9, '#651407'], [1, '#3A0B03']]));
      const cup = ctx.once('pep-c', (gid) => radialG(gid, [[0, '#2A0300', 0], [0.68, '#2A0300', 0], [1, '#2A0300', 0.5]], { cx: 0.6, cy: 0.62, r: 0.62 }));
      const pool = ctx.once('pep-p', (gid) => radialG(gid, [[0, '#F58A3A', 0.9], [0.55, '#E85A22', 0.55], [1, '#E2501F', 0]]));
      const rr = 30, sp = (a, b) => polar(rand() * TAU, between(rand, a, b) * rr, 0, 0);
      const fat = Array.from({ length: 22 }, () => sp(0.15, 0.84));
      const dark = Array.from({ length: 6 }, () => sp(0.35, 0.8));
      let nicks = '';
      for (let i = 0; i < 5; i++) { const a = rand() * TAU; nicks += arc(0, 0, rr - 1.6, a, a + between(rand, 0.25, 0.6)); }
      return `<path d="${blobXY(rand, 0, 0, rr, rr, { points: 10, wobble: 0.07 })}" fill="${g}"/>` +
        dots(fat.slice(0, 11), 3.6, '#F0A286', 0.75) + dots(fat.slice(11), 2.6, '#DE7458', 0.8) + dots(dark, 2, '#5A0E05', 0.6) +
        `<circle r="${r(rr * 0.88)}" fill="${cup}"/>` +
        `<path d="${arc(0, 0, rr * 0.72, 0.15, 1.45)}" fill="none" stroke="#EE7A5A" stroke-width="2.4" stroke-linecap="round" opacity=".45"/>` +
        `<ellipse cx="1" cy="2" rx="${r(rr * 0.46)}" ry="${r(rr * 0.4)}" fill="${pool}"/>` +
        `<path d="${nicks}" fill="none" stroke="#1E0501" stroke-width="3" stroke-linecap="round" opacity=".55"/>` +
        `<ellipse cx="-3" cy="-2.5" rx="4" ry="2" transform="rotate(-35 -3 -2.5)" fill="#FFF4E8" opacity=".75"/>`;
    },
  },
  redpepper: {
    rad: 22, size: 1.35, variants: 3, rotate: true, scale: [0.9, 1.1],
    fx: { b: 2, o: 1.4, hi: 0.35, lo: 0.35, ds: 0.42, dsB: 2, dsX: 1.6, dsY: 2.4 },
    draw: pepperDraw(['#8E120A', '#D3281A', '#F26A4E', '#FFB09A']),
  },
  greenpepper: {
    rad: 22, size: 1.35, variants: 3, rotate: true, scale: [0.9, 1.1],
    fx: { b: 2, o: 1.4, hi: 0.35, lo: 0.35, ds: 0.42, dsB: 2, dsX: 1.6, dsY: 2.4 },
    draw: pepperDraw(['#1E4E16', '#3C8A2B', '#7CC05A', '#C6EFA0']),
  },
  onion: {
    rad: 18, size: 1.4, variants: 4, rotate: true, scale: [0.9, 1.15],
    fx: { b: 1.2, o: 0.9, hi: 0.3, lo: 0.3, ds: 0.38, dsB: 1.6, dsX: 1.2, dsY: 1.8 },
    draw(ctx, v, rand) {
      const ring = (rho, a0, span) => {
        const d = arc(0, 0, rho, a0, a0 + span);
        return `<path d="${d}" stroke="#6A174F" stroke-width="5.8"/><path d="${d}" stroke="#B65D98" stroke-width="3.8"/><path d="${arc(0, 0, rho - 0.6, a0 + 0.05, a0 + span - 0.05)}" stroke="#F0CFE4" stroke-width="1.3" opacity=".9"/>`;
      };
      const rho = between(rand, 14, 22), a0 = rand() * TAU;
      let s = ring(rho, a0, between(rand, 3.4, 5.6));
      if (v % 2) s += ring(rho - 6.5, a0 + between(rand, 0.5, 1.5), between(rand, 2.5, 4.5));
      return `<g fill="none" stroke-linecap="round">${s}</g>`;
    },
  },
  olive: {
    rad: 13, size: 1.45, variants: 2, rotate: false, scale: [0.9, 1.1],
    fx: { b: 1.6, o: 1.2, hi: 0.25, lo: 0.3, ds: 0.45, dsB: 1.8, dsX: 1.4, dsY: 2 },
    draw(ctx, v) {
      const rr = 10.5 + v * 0.8;
      return `<circle r="${rr}" fill="none" stroke="#1C151B" stroke-width="7.4"/>` +
        `<path d="${arc(0, 0, rr + 1.9, 3.4, 4.7)}" fill="none" stroke="#9A8EA0" stroke-width="1.8" stroke-linecap="round" opacity=".75"/>` +
        `<path d="${arc(0, 0, rr - 2.3, 0.2, 1.3)}" fill="none" stroke="#5E5262" stroke-width="1.1" opacity=".6"/>` +
        `<circle cx="-7.5" cy="-7" r="1.5" fill="#fff" opacity=".8"/>`;
    },
  },
  merguez: {
    rad: 20, size: 1.45, variants: 3, rotate: false, scale: [0.9, 1.1],
    fx: { b: 3, o: 2.2, hi: 0.32, lo: 0.4, ds: 0.48, dsB: 2.6, dsX: 2, dsY: 3 },
    draw(ctx, v, rand) {
      const g = ctx.once('merg-g', (gid) => radialG(gid, [[0, '#B8512C'], [0.55, '#963B1E'], [0.82, '#6A220E'], [1, '#3E1006']], { cx: 0.45, cy: 0.42, r: 0.55 }));
      const rr = 19, sp = () => polar(rand() * TAU, Math.sqrt(rand()) * rr * 0.75, 0, 0);
      const s = Array.from({ length: 16 }, sp);
      return `<ellipse rx="${rr}" ry="${r(rr * 0.94)}" fill="${g}"/>` +
        dots(s.slice(0, 6), 2.6, '#DA7A4A', 0.75) + dots(s.slice(6, 11), 2.2, '#2A0803', 0.6) + dots(s.slice(11), 2.8, '#EDA27C', 0.5) +
        `<ellipse rx="${rr - 1}" ry="${r(rr * 0.94 - 1)}" fill="none" stroke="#2A0904" stroke-width="2.2"/>` +
        `<ellipse cx="-6" cy="-6" rx="7" ry="3" transform="rotate(-40 -6 -6)" fill="#fff" opacity=".25"/>`;
    },
  },
  chicken: {
    rad: 22, size: 1.5, variants: 4, rotate: true, scale: [0.9, 1.1],
    fx: { b: 3.5, o: 2.5, hi: 0.4, hiCol: '#FFE9B8', lo: 0.38, ds: 0.5, dsB: 2.6, dsX: 2, dsY: 3, dsCol: '#1A0602' },
    draw(ctx, v, rand) {
      const g = ctx.once('chk-g', (gid) => radialG(gid, [[0, '#F7C978'], [0.5, '#E59F48'], [0.85, '#C3712C'], [1, '#9A4F1C']], { cx: 0.45, cy: 0.42, r: 0.58 }));
      const d = blobXY(rand, 0, 0, 22, 16, { points: 7, wobble: 0.38 });
      const clip = ctx.once(`chk-cl${v}`, (fid) => `<clipPath id="${fid}"><path d="${d}"/></clipPath>`);
      const off = between(rand, -4, 4);
      return `<path d="${d}" fill="${g}"/><g clip-path="${clip}">` +
        `<path d="${blobXY(rand, between(rand, -6, 6), between(rand, -4, 4), 12, 8, { points: 6, wobble: 0.5 })}" fill="#8A2A0E" opacity=".35"/>` +
        `<path d="M-30 ${r(-14 + off)}L30 ${r(4 + off)}M-30 ${r(-1 + off)}L30 ${r(17 + off)}" stroke="#4A1A08" stroke-width="3.6" opacity=".75"/>` +
        `<path d="M-20 ${r(6 + off)}Q0 ${r(2 + off)} 18 ${r(-6 + off)}M-14 ${r(-6 + off)}Q2 ${r(-9 + off)} 16 ${r(-14 + off)}" stroke="#FFE2A8" stroke-width="1.1" fill="none" opacity=".6"/></g>`;
    },
  },
  salmon: {
    rad: 44, size: 1.3, variants: 4, rotate: true, scale: [0.9, 1.1],
    fx: { b: 3.5, o: 2.4, hi: 0.45, lo: 0.3, ds: 0.35, dsB: 3, dsX: 2, dsY: 3 },
    draw(ctx, v, rand) {
      const g = ctx.once('sal-g', (gid) => linearG(gid, [[0, '#FBB08A'], [0.4, '#F38C5E'], [1, '#DC603A']], { x2: 0, y2: 1 }));
      const L = between(rand, 96, 118), W = between(rand, 32, 40), A = between(rand, 4, 8), ph = rand() * TAU, k = between(rand, 1.4, 2.4);
      const N = 16, left = [], right = [], cen = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N, x = -L / 2 + L * t, y = A * Math.sin(ph + t * k * Math.PI);
        const dy = (A * Math.cos(ph + t * k * Math.PI) * k * Math.PI) / L, nl = Math.hypot(dy, 1);
        const nx = -dy / nl, ny = 1 / nl;
        const w = (W / 2) * (0.62 + 0.38 * Math.sin(Math.PI * t) ** 0.5) * (1 + 0.1 * Math.sin(t * 13 + ph));
        left.push([x - nx * w, y - ny * w]); right.push([x + nx * w, y + ny * w]); cen.push([x, y, nx, ny, w]);
      }
      const outline = `${smooth(left, false)}L${smooth(right.reverse(), false).slice(1)}Z`;
      let fat = '';
      for (let i = 1; i < N; i++) {
        const [x, y, nx, ny, w] = cen[i];
        fat += `M${P(x + nx * w * 0.78 + 4, y + ny * w * 0.78)}Q${P(x - 1, y)} ${P(x - nx * w * 0.78 + 4, y - ny * w * 0.78)}`;
      }
      const side = (i, s) => P(cen[i][0] + s * cen[i][2] * cen[i][4], cen[i][1] + s * cen[i][3] * cen[i][4]);
      const band = (i0) => `M${side(i0, -1)}L${side(i0 + 2, -1)}L${side(i0 + 2, 1)}L${side(i0, 1)}Z`;
      const i0 = 2 + Math.floor(rand() * 4), i1 = 9 + Math.floor(rand() * 4);
      const edge = cen.slice(1, -1).map(([x, y, nx, ny, w]) => P(x - nx * (w - 2.6), y - ny * (w - 2.6))).join('L');
      return `<path d="${outline}" fill="${g}"/>` +
        `<path d="${fat}" fill="none" stroke="#FFE3D2" stroke-width="1.4" opacity=".5"/>` +
        `<path d="${band(i0)}${band(i1)}" fill="#B4482C" opacity=".22"/>` +
        `<path d="M${edge}" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity=".45"/>`;
    },
  },
  dill: {
    rad: 16, size: 1.5, variants: 3, rotate: true, scale: [0.9, 1.15],
    fx: { b: 0.8, o: 0.6, hi: 0.2, lo: 0.2, ds: 0.32, dsB: 1.2, dsX: 1, dsY: 1.5 },
    draw(ctx, v, rand) {
      const len = between(rand, 30, 40), bend = between(rand, -6, 6);
      const at = (t) => [-len / 2 + len * t, 2 * (1 - t) * t * bend * 2];
      let d = '';
      for (let i = 0; i < 6; i++) {
        const t = 0.12 + i * 0.15, [bx, by] = at(t), side = i % 2 ? 1 : -1;
        const ang = side * between(rand, 0.6, 1.0) + between(rand, -0.15, 0.15), bl = between(rand, 10, 15) * (1 - t * 0.35);
        d += `M${P(bx, by)}l${P(Math.cos(ang) * bl, Math.sin(ang) * bl)}`;
        for (let j = 1; j <= 3; j++) {
          const px = bx + Math.cos(ang) * bl * (j / 3.2), py = by + Math.sin(ang) * bl * (j / 3.2);
          for (const s of [-1, 1]) { const na = ang + s * 0.75, nl = between(rand, 3.5, 6.5); d += `M${P(px, py)}l${P(Math.cos(na) * nl, Math.sin(na) * nl)}`; }
        }
      }
      const [tx, ty] = at(1);
      for (const s of [-1, 0, 1]) d += `M${P(tx, ty)}l${P(Math.cos(s * 0.6) * 6, Math.sin(s * 0.6) * 6)}`;
      return `<g fill="none" stroke-linecap="round"><path d="M${P(...at(0))}Q0 ${r(bend * 2)} ${P(tx, ty)}" stroke="#4A8A3A" stroke-width="1.8"/><path d="${d}" stroke="#3F8434" stroke-width="1.15"/></g>`;
    },
  },
  banana: {
    rad: 24, size: 1.5, variants: 3, rotate: true, scale: [0.92, 1.08],
    fx: { b: 4, o: 2.6, hi: 0.5, hiCol: '#FFFFF0', lo: 0.3, loCol: '#6A4010', ds: 0.5, dsB: 3, dsX: 2, dsY: 3, dsCol: '#100400' },
    draw(ctx, v, rand) {
      const g = ctx.once('ban-g', (gid) => radialG(gid, [[0, '#FFF9E0'], [0.5, '#FCF0C4'], [0.86, '#F4DD98'], [1, '#E2BE6E']]));
      const car = ctx.once('ban-c', (gid) => radialG(gid, [[0, '#C9802E', 0.75], [1, '#C9802E', 0]]));
      const rr = 23, cx = between(rand, -1.5, 1.5), cy = between(rand, -1.5, 1.5);
      const lobes = [0, 1, 2].map((i) => polar((i / 3) * TAU + v, 3, cx, cy));
      const toast = v === 2 ? `<ellipse cx="${r(between(rand, -8, 8))}" cy="${r(between(rand, -8, 8))}" rx="13" ry="10" fill="${car}"/>` : '';
      return `<circle r="${rr}" fill="${g}"/>${toast}` +
        `<circle r="${rr - 1}" fill="none" stroke="#D9B566" stroke-width="1.6" opacity=".7"/>` +
        `<circle cx="${r(cx)}" cy="${r(cy)}" r="12" fill="none" stroke="#F1DFA8" stroke-width="1.2" opacity=".8"/>` +
        `<circle cx="${r(cx)}" cy="${r(cy)}" r="6.5" fill="#FFFBEC"/>` + dots(lobes, 3, '#B89A62', 0.75) + dots([[cx, cy]], 1.6, '#8A6A3A', 0.8);
    },
  },
  goat: {
    rad: 28, size: 1.3, variants: 2, rotate: false, scale: [0.92, 1.06],
    fx: { b: 5, o: 3.2, hi: 0.55, hiCol: '#FFFFFF', lo: 0.28, loCol: '#6A4A20', ds: 0.4, dsB: 3, dsX: 2, dsY: 3 },
    draw(ctx, v, rand) {
      const g = ctx.once('goat-g', (gid) => radialG(gid, [[0, '#FFFFFF'], [0.7, '#FDFBF6'], [0.9, '#F2ECE0'], [1, '#E2DACB']], { cx: 0.45, cy: 0.42, r: 0.55 }));
      const t = ctx.once('goat-t', (gid) => radialG(gid, [[0, '#E9B56A', 0.55], [1, '#E9B56A', 0]]));
      const rr = 27, tx = between(rand, 4, 10) * (v ? 1 : -1), ty = between(rand, 2, 9);
      return `<circle r="${rr}" fill="${g}"/>` +
        `<circle r="${rr - 2.2}" fill="none" stroke="#E6E0D4" stroke-width="4.4"/>` +
        `<circle r="${rr - 2}" fill="none" stroke="#CFC6B4" stroke-width="2" stroke-dasharray=".1 2.8" stroke-linecap="round"/>` +
        `<circle r="${rr - 0.6}" fill="none" stroke="#BDB29C" stroke-width="1" opacity=".7"/>` +
        `<ellipse cx="${r(tx)}" cy="${r(ty)}" rx="9" ry="7" fill="${t}"/>` +
        `<path d="M-9 -9l5 3 3-2M3 8l5-3M-2 1l3 3" stroke="#E4DCCB" stroke-width="1" fill="none"/>`;
    },
  },
  blue: {
    rad: 13, size: 1.7, variants: 4, rotate: true, scale: [0.85, 1.15],
    fx: { b: 2.4, o: 1.6, hi: 0.45, hiCol: '#FFFFFF', lo: 0.3, ds: 0.4, dsB: 2, dsX: 1.5, dsY: 2.2 },
    draw(ctx, v, rand) {
      const g = ctx.once('blue-g', (gid) => radialG(gid, [[0, '#FCF9F0'], [0.7, '#F4EEDC'], [1, '#E2D7BA']], { cx: 0.45, cy: 0.42, r: 0.6 }));
      const d = blobXY(rand, 0, 0, 14, 11.5, { points: 7, wobble: 0.45 });
      const clip = ctx.once(`blue-cl${v}`, (fid) => `<clipPath id="${fid}"><path d="${d}"/></clipPath>`);
      let veins = '';
      for (let i = 0; i < 3; i++) {
        const x = between(rand, -11, 5), y = between(rand, -8, 8);
        veins += `M${P(x, y)}q${P(between(rand, 2, 6), between(rand, -5, 5))} ${P(between(rand, 7, 13), between(rand, -4, 4))}`;
      }
      const sp = Array.from({ length: 6 }, () => [between(rand, -11, 11), between(rand, -9, 9)]);
      return `<path d="${d}" fill="${g}"/><g clip-path="${clip}"><path d="${veins}" fill="none" stroke="#35687A" stroke-width="3" stroke-linecap="round" opacity=".9"/>` +
        `<path d="${veins}" transform="translate(1.5 2)" fill="none" stroke="#5F9484" stroke-width="1.4" stroke-linecap="round" opacity=".75"/>${dots(sp, 2.8, '#2A5564', 0.9)}</g>`;
    },
  },
  emmental: {
    rad: 34, size: 1.3, variants: 3, rotate: true, scale: [0.9, 1.1],
    fx: { b: 5, o: 3, hi: 0.45, lo: 0.32, loCol: '#6A3208', ds: 0.3, dsB: 3, dsX: 2, dsY: 3 },
    draw(ctx, v, rand) {
      const g = ctx.once('emm-g', (gid) => radialG(gid, [[0, '#FCD27A'], [0.5, '#F2B650'], [0.85, '#DE9634'], [1, '#C27424']], { cx: 0.42, cy: 0.38, r: 0.62 }));
      const d = blobXY(rand, 0, 0, 34, 28, { points: 9, wobble: 0.3 });
      let spots = '', holes = '';
      for (let i = 0; i < 3; i++) spots += `<path d="${blobXY(rand, between(rand, -18, 18), between(rand, -14, 14), between(rand, 5, 9), between(rand, 4, 7), { points: 6, wobble: 0.5 })}"/>`;
      for (let i = 0; i < 2 + (v % 2); i++) {
        const x = between(rand, -18, 18), y = between(rand, -13, 13), hr = between(rand, 3.5, 6);
        holes += `<ellipse cx="${r(x)}" cy="${r(y)}" rx="${r(hr)}" ry="${r(hr * 0.8)}" fill="#B8722A" opacity=".6"/><path d="${arc(x, y, hr, 0.2, 2.2)}" stroke="#FFE7A8" stroke-width="1.2" fill="none" opacity=".85"/>`;
      }
      return `<path d="${d}" fill="${g}"/><g fill="#A85C1C" opacity=".4">${spots}</g>${holes}`;
    },
  },
};

function ensureKind(ctx, kind) {
  const K = KINDS[kind];
  const t = K.size && K.size !== 1 ? ` transform="scale(${K.size})"` : '';
  for (let v = 0; v < K.variants; v++) ctx.once(kind + v, (fid) => `<g id="${fid}"${t}>${K.draw(ctx, v, ctx.rand)}</g>`);
}

function drawLayer(ctx, o) {
  const K = KINDS[o.kind], { rand } = ctx;
  ensureKind(ctx, o.kind);
  const pts = place(ctx, { count: o.count, minDist: o.minDist, radius: o.radius ?? RS - 36, rad: o.rad ?? K.rad * (K.size ?? 1), overlap: o.overlap ?? 0.75, avoid: o.avoid });
  const [s0, s1] = o.scale ?? K.scale;
  const uses = pts.map((p) => {
    const v = Math.floor(rand() * K.variants), a = K.rotate ? rand() * 360 : between(rand, -8, 8), s = between(rand, s0, s1);
    return `<use href="#${ctx.fid(o.kind + v)}" transform="translate(${I(p.x, p.y)}) rotate(${Math.round(a)}) scale(${r(s, 2)})"/>`;
  }).join('');
  return `<g filter="${ctx.bev(`fx-${o.kind}`, { ...K.fx, ...o.fx })}">${uses}</g>`;
}

/* ------------------------------------------------------------------ finishing steps */

const STEPS = {
  cheese: drawCheese,
  layer: drawLayer,

  /** Small rosette of basil leaves in the centre. */
  rosette(ctx, o) {
    ensureKind(ctx, 'basil');
    const n = o.count ?? 4, a0 = ctx.rand() * 360;
    let uses = '';
    for (let i = 0; i < n; i++) {
      const a = a0 + (i * 360) / n + between(ctx.rand, -12, 12), rad = (a * Math.PI) / 180;
      uses += `<use href="#${ctx.fid(`basil${i % 3}`)}" transform="translate(${I(...polar(rad, 46))}) rotate(${Math.round(a)}) scale(${r(between(ctx.rand, 1.0, 1.15), 2)})"/>`;
    }
    ctx.placed.push({ x: CX, y: CY, rad: 60 });
    return `<g filter="${ctx.bev('fx-basil', KINDS.basil.fx)}">${uses}</g>`;
  },

  /** Olive-oil sheens: faint golden films with a glint. */
  oil(ctx, o) {
    const { rand } = ctx;
    let films = '', glints = '';
    for (let i = 0; i < (o.count ?? 5); i++) {
      const [x, y] = polar(rand() * TAU, Math.sqrt(rand()) * (RS - 40)), s = between(rand, 14, 26);
      films += `<path d="${int(blobPath(rand, x, y, s, { points: 6, wobble: 0.5 }))}"/>`;
      glints += `M${I(x - s * 0.45, y - s * 0.05)}q${I(s * 0.3, -s * 0.3)} ${I(s * 0.7, -s * 0.25)}`;
    }
    return `<g fill="#F9CF55" opacity=".16">${films}</g><path d="${glints}" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".55" filter="${ctx.blur(0.8)}"/>`;
  },

  /** Dried oregano flecks. */
  oregano(ctx, o) {
    const { rand } = ctx;
    const pts = scatterInCircle(rand, { cx: CX, cy: CY, radius: RS - 6, count: o.count ?? 20, minDist: 16 });
    const seg = (p) => { const a = rand() * Math.PI, l = between(rand, 0.6, 2.2); return `M${P(p.x, p.y)}l${P(Math.cos(a) * l, Math.sin(a) * l)}`; };
    const h = Math.ceil(pts.length / 2);
    return `<g fill="none" stroke-linecap="round" opacity=".9"><path d="${pts.slice(0, h).map(seg).join('')}" stroke="#3F5A22" stroke-width="2.4"/><path d="${pts.slice(h).map(seg).join('')}" stroke="#2E4419" stroke-width="2"/></g>`;
  },

  /** Sunny-side-up egg in the centre. */
  egg(ctx) {
    const { rand } = ctx;
    const white = ctx.once('egg-w', (gid) => radialG(gid, [[0, '#FFFFFF'], [0.6, '#FFFBF0'], [1, '#F3E5C8']], { cx: 0.42, cy: 0.4, r: 0.62 }));
    const yolk = ctx.once('egg-y', (gid) => radialG(gid, [[0, '#FFD55E'], [0.45, '#FBAE22'], [0.85, '#EE8B0E'], [1, '#D2700A']], { cx: 0.38, cy: 0.34, r: 0.7 }));
    const yx = CX + 6, yy = CY + 4, wp = int(blobPath(rand, CX, CY, 94, { points: 11, wobble: 0.16 }));
    ctx.placed.push({ x: CX, y: CY, rad: 95 });
    return `<path d="${wp}" transform="translate(${I(CX * -0.05, CY * -0.05)}) scale(1.05)" fill="none" stroke="#C98840" stroke-width="7" stroke-dasharray="9 5 4 6" opacity=".7" filter="${ctx.blur(1.8)}"/>` +
      `<g filter="${ctx.bev('fx-egg', { b: 8, o: 5, hi: 0.5, hiCol: '#FFFFFF', lo: 0.22, loCol: '#7A4A1C', ds: 0.38, dsB: 4, dsX: 3, dsY: 4 })}"><path d="${wp}" fill="${white}"/></g>` +
      `<circle cx="${yx + 4}" cy="${yy + 6}" r="35" fill="#B07A2A" opacity=".4" filter="${ctx.blur(5)}"/>` +
      `<g filter="${ctx.bev('fx-yolk', { b: 6, o: 4, hi: 0.45, hiCol: '#FFF4C0', lo: 0.35, loCol: '#8A3A00' })}"><circle cx="${yx}" cy="${yy}" r="35" fill="${yolk}"/></g>` +
      `<ellipse cx="${yx - 12}" cy="${yy - 13}" rx="11" ry="5.5" transform="rotate(-38 ${yx - 12} ${yy - 13})" fill="#fff" opacity=".85" filter="${ctx.blur(1.2)}"/>` +
      `<circle cx="${yx + 17}" cy="${yy + 16}" r="3" fill="#fff" opacity=".4"/>`;
  },

  /** Zig-zag BBQ drizzle: back-and-forth strokes with rounded turns just inside the crust. */
  drizzle(ctx, o) {
    const { rand } = ctx;
    const n = o.count ?? 11, rot = -0.55, c = Math.cos(rot), s = Math.sin(rot), pts = [];
    for (let i = 0; i <= n; i++) {
      const u = -0.9 + (1.8 * i) / n + between(rand, -0.02, 0.02);
      const half = Math.sqrt(1 - u * u) * RS * 0.84, x = u * RS * 0.86, y = (i % 2 ? 1 : -1) * half;
      pts.push([CX + x * c - y * s, CY + x * s + y * c]);
    }
    const d = smooth(pts, false);
    return `<g filter="${ctx.bev('fx-drz', { b: 1.6, o: 1.2, hi: 0.3, lo: 0.3, ds: 0.45, dsB: 2, dsX: 1.5, dsY: 2.5, dsCol: '#1A0602' })}" fill="none" stroke-linecap="round">` +
      `<path d="${d}" stroke="#2C0B03" stroke-width="7"/><path d="${d}" stroke="#5A1C0A" stroke-width="4.6"/></g>` +
      `<path d="${d}" transform="translate(-1.2 -1.4)" fill="none" stroke="#E0946A" stroke-width="1.3" opacity=".6"/>`;
  },

  /** Glossy swirl marks in a spread. */
  swirl(ctx) {
    const { rand } = ctx;
    let d = '';
    for (let i = 0; i < 8; i++) {
      const [x, y] = polar(rand() * TAU, Math.sqrt(rand()) * (RS - 60)), a0 = rand() * TAU;
      d += arc(x, y, between(rand, 30, 80), a0, a0 + between(rand, 0.8, 1.7));
    }
    return `<g clip-path="url(#${ctx.fid('sauceclip')})" fill="none" stroke-linecap="round"><path d="${d}" stroke="#80492A" stroke-width="6" opacity=".55" filter="${ctx.blur(1.5)}"/>` +
      `<path d="${d}" transform="translate(-2.5 -2.5)" stroke="#FFEBD9" stroke-width="1.8" opacity=".35"/></g>`;
  },

  /** Crushed hazelnut pieces. */
  hazel(ctx, o) {
    const { rand } = ctx;
    const pts = scatterInCircle(rand, { cx: CX, cy: CY, radius: RS - 18, count: o.count ?? 36, minDist: 24 });
    let body = '', facet = '', skin = '';
    for (const p of pts) {
      const s = between(rand, 5, 9.5), rot = rand() * TAU, poly = [];
      for (let i = 0; i < 5; i++) poly.push(P(...polar(rot + (i / 5) * TAU, between(rand, 0.6, 1.1) * s, p.x, p.y)));
      body += `M${poly.join('L')}Z`;
      facet += `M${poly[0]}L${poly[1]}L${poly[2]}Z`;
      if (rand() < 0.45) skin += `M${poly[3]}L${poly[4]}L${P(p.x, p.y)}Z`;
    }
    return `<g filter="${ctx.bev('fx-hazel', { b: 1.2, o: 1, hi: 0.35, lo: 0.35, ds: 0.5, dsB: 1.4, dsX: 1.2, dsY: 1.8, dsCol: '#0E0300' })}"><path d="${body}" fill="#C88B4E"/><path d="${facet}" fill="#F0CB96"/><path d="${skin}" fill="#7A3E19"/></g>`;
  },

  /** Powdered-sugar dusting: sparse thresholded noise inside soft discs, plus a faint haze. */
  sugar(ctx, o) {
    const { rand } = ctx;
    const f = ctx.once('sugar', (fid) => `<filter id="${fid}" ${FU}><feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="1" seed="11" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 10 -6.1"/><feComposite in2="SourceGraphic" operator="in"/></filter>`);
    const g = ctx.once('sugar-g', (gid) => radialG(gid, [[0, '#fff', 1], [0.55, '#fff', 0.7], [1, '#fff', 0]]));
    let discs = '';
    for (let i = 0; i < (o.count ?? 3); i++) {
      const [x, y] = polar(rand() * TAU, Math.sqrt(rand()) * RS * 0.5);
      discs += `<circle cx="${Math.round(x)}" cy="${Math.round(y)}" r="${Math.round(between(rand, 100, 150))}" fill="${g}"/>`;
    }
    return `<g opacity=".14" filter="${ctx.blur(6)}">${discs}</g><g filter="${f}">${discs}</g>`;
  },

  /** Lemon zest strips. */
  zest(ctx, o) {
    const { rand } = ctx;
    const pts = scatterInCircle(rand, { cx: CX, cy: CY, radius: RS - 20, count: o.count ?? 30, minDist: 26 });
    let d = '';
    for (const p of pts) { const a = rand() * TAU, l = between(rand, 4, 9); d += `M${P(p.x, p.y)}q${P(Math.cos(a) * l * 0.5 + 1.5, Math.sin(a) * l * 0.5 - 1.5)} ${P(Math.cos(a) * l, Math.sin(a) * l)}`; }
    return `<g filter="${ctx.bev('fx-zest', { b: 0.8, o: 0.6, hi: 0.3, lo: 0.25, ds: 0.4, dsB: 1, dsX: 0.8, dsY: 1.2 })}" fill="none" stroke-linecap="round"><path d="${d}" stroke="#EDBE1C" stroke-width="3.2"/><path d="${d}" stroke="#FFE36A" stroke-width="1.3" opacity=".85"/></g>`;
  },
};

/* ------------------------------------------------------------------ assembly */

function buildPie(ctx, spec) {
  ctx.base = spec.base;
  let out = drawCrust(ctx, spec) + drawSauce(ctx, spec.base);
  for (const [step, opts] of spec.steps) out += STEPS[step](ctx, opts ?? {});
  const light = ctx.once('light', (gid) => linearG(gid, [[0, '#FFF4DA', 0.16], [0.45, '#FFF4DA', 0], [0.6, '#2A0E04', 0], [1, '#2A0E04', 0.2]]));
  out += `<use href="${ctx.outer}" fill="${light}"/>`;
  if (spec.outline) out += `<use href="${ctx.outer}" fill="none" stroke="#2A0D04" stroke-opacity="${spec.outline}" stroke-width="3"/>`;
  return out;
}

// filters render in sRGB (color-interpolation-filters is inherited from this wrapper)
const defsOf = (ctx) => `<g color-interpolation-filters="sRGB">${ctx.defs.join('')}</g>`;

function pizza(id, spec) {
  return () => {
    const ctx = context(id);
    const pie = buildPie(ctx, spec);
    ctx.defs.push(shadowFilter(id, 16));
    const body = contactShadow(id, { cx: CX + 12, cy: CY + 18, rx: R + 4, ry: R - 4, opacity: 0.34 }) +
      `<use href="${ctx.outer}" transform="translate(4 7)" fill="#2A1206" opacity=".4" filter="${ctx.blur(6)}"/>` + pie;
    return svgDoc({ defs: defsOf(ctx), body });
  };
}

/** Showpiece: margherita-pepperoni with one slice pulled out and cheese strings across the gap. */
function heroPizza(id, spec) {
  return () => {
    const ctx = context(id);
    const pie = buildPie(ctx, spec);
    const { rand } = ctx;
    const th = 0.95, half = 0.4, a0 = th - half, a1 = th + half, pull = 30, dx = Math.cos(th) * pull, dy = Math.sin(th) * pull;
    const far = 420;
    const wedge = `M${CX} ${CY}L${I(...polar(a0, far))}L${I(...polar(th, far * 1.2))}L${I(...polar(a1, far))}Z`;
    ctx.defs.push(`<g id="${ctx.fid('pie')}">${pie}</g>`);
    ctx.defs.push(`<clipPath id="${ctx.fid('main')}"><path clip-rule="evenodd" d="M-100 -100H900V900H-100Z${wedge}"/></clipPath><clipPath id="${ctx.fid('slice')}"><path d="${wedge}"/></clipPath>`);
    ctx.defs.push(shadowFilter(id, 18));
    const cut = `M${CX} ${CY}L${I(...polar(a0, R + 20))}M${CX} ${CY}L${I(...polar(a1, R + 20))}`;
    const piece = (clip, t) =>
      `<g transform="translate(${t})"><use href="#${ctx.fid('pie')}" clip-path="url(#${ctx.fid(clip)})"/>` +
      `<g clip-path="url(#${ctx.fid(clip)})"><path d="${cut}" stroke="#2A0D04" stroke-width="5" opacity=".45" fill="none"/></g></g>`;
    const shade = (clip, t, o) => `<g transform="translate(${t})" filter="${ctx.blur(7)}" opacity="${o}"><g clip-path="url(#${ctx.fid(clip)})"><use href="${ctx.outer}" fill="#240A02"/></g></g>`;
    // cheese strings bridging the gap
    const sg = ctx.once('string', (gid) => linearG(gid, [[0, '#FFF8E4'], [0.6, '#FBE7B8'], [1, '#EBC98A']], { x2: 0, y2: 1 }));
    const ux = Math.cos(th), uy = Math.sin(th);
    let strings = '', sshadow = '';
    for (const [ae, side] of [[a0, -1], [a1, 1]]) {
      for (const f of side < 0 ? [0.38, 0.56, 0.72] : [0.3, 0.5, 0.66]) {
        const rho = R * f + between(rand, -10, 10);
        const px = CX + Math.cos(ae) * rho - ux * 8, py = CY + Math.sin(ae) * rho - uy * 8;
        const qx = px + dx + ux * 16, qy = py + dy + uy * 16;
        const nx = -uy, ny = ux, we = between(rand, 3, 5), wm = between(rand, 1, 2), sag = between(rand, -5, 5);
        const mx = (px + qx) / 2 + nx * sag, my = (py + qy) / 2 + ny * sag;
        const d = `M${P(px + nx * we, py + ny * we)}Q${P(mx + nx * wm, my + ny * wm)} ${P(qx + nx * we, qy + ny * we)}L${P(qx - nx * we, qy - ny * we)}Q${P(mx - nx * wm, my - ny * wm)} ${P(px - nx * we, py - ny * we)}Z`;
        strings += `<path d="${d}"/>`;
        sshadow += `<path d="${d}" transform="translate(4 6)"/>`;
      }
    }
    const body = contactShadow(id, { cx: CX + 16, cy: CY + 24, rx: R + 14, ry: R + 4, opacity: 0.45 }) +
      shade('main', '5 9', 0.6) + shade('slice', `${r(dx + 5)} ${r(dy + 9)}`, 0.6) +
      piece('main', '0 0') + piece('slice', `${r(dx)} ${r(dy)}`) +
      `<g fill="#3A1406" opacity=".35" filter="${ctx.blur(2)}">${sshadow}</g>` +
      `<g fill="${sg}" filter="${ctx.bev('fx-string', { b: 1.2, o: 0.8, hi: 0.5, hiCol: '#FFFFFF', lo: 0.25, loCol: '#8A5A1C' })}">${strings}</g>`;
    return svgDoc({ defs: defsOf(ctx), body: `<g transform="translate(-12 -14)">${body}</g>` });
  };
}

/* ------------------------------------------------------------------ menu */

const C = { x: CX, y: CY };

export const art = {
  margherita: pizza('margherita', {
    base: 'tomato',
    steps: [
      ['cheese', { count: 9, r: [42, 64], minDist: 104 }],
      ['oil', { count: 4 }],
      ['rosette', { count: 4 }],
      ['layer', { kind: 'basil', count: 5, minDist: 130, radius: RS - 50, avoid: [{ ...C, d: 125 }] }],
      ['oregano', { count: 18 }],
    ],
  }),
  reine: pizza('reine', {
    base: 'tomato',
    steps: [
      ['cheese', { count: 10, r: [38, 58], minDist: 88 }],
      ['layer', { kind: 'ham', count: 6, minDist: 118 }],
      ['layer', { kind: 'mushroom', count: 8, minDist: 82, overlap: 0.65 }],
      ['oregano', { count: 16 }],
    ],
  }),
  'quatre-fromages': pizza('quatre-fromages', {
    base: 'cream',
    steps: [
      ['layer', { kind: 'emmental', count: 5, minDist: 140 }],
      ['cheese', { count: 6, r: [36, 52], minDist: 105 }],
      ['layer', { kind: 'goat', count: 5, minDist: 120, overlap: 0.6 }],
      ['layer', { kind: 'blue', count: 11, minDist: 66, overlap: 0.55 }],
    ],
  }),
  pepperoni: pizza('pepperoni', {
    base: 'tomato',
    steps: [
      ['cheese', { count: 15, r: [40, 60], minDist: 70 }],
      ['layer', { kind: 'pepperoni', count: 14, minDist: 76, overlap: 0.55 }],
      ['oregano', { count: 16 }],
    ],
  }),
  vegetarienne: pizza('vegetarienne', {
    base: 'tomato',
    steps: [
      ['cheese', { count: 8, r: [36, 54], minDist: 95 }],
      ['layer', { kind: 'mushroom', count: 5, minDist: 110 }],
      ['layer', { kind: 'redpepper', count: 5, minDist: 100, overlap: 0.6 }],
      ['layer', { kind: 'greenpepper', count: 5, minDist: 100, overlap: 0.6 }],
      ['layer', { kind: 'onion', count: 7, minDist: 80, overlap: 0.5 }],
      ['layer', { kind: 'olive', count: 9, minDist: 64, overlap: 0.55 }],
      ['oregano', { count: 12 }],
    ],
  }),
  'chicken-bbq': pizza('chicken-bbq', {
    base: 'bbq',
    steps: [
      ['cheese', { count: 8, r: [32, 48], minDist: 100 }],
      ['layer', { kind: 'chicken', count: 10, minDist: 84 }],
      ['layer', { kind: 'onion', count: 7, minDist: 80, overlap: 0.5 }],
      ['drizzle', { count: 11 }],
    ],
  }),
  orientale: pizza('orientale', {
    base: 'tomato',
    steps: [
      ['cheese', { count: 7, r: [34, 52], minDist: 95 }],
      ['egg'],
      ['layer', { kind: 'merguez', count: 11, minDist: 76, avoid: [{ ...C, d: 140 }] }],
      ['layer', { kind: 'redpepper', count: 4, minDist: 100, overlap: 0.6, avoid: [{ ...C, d: 135 }] }],
      ['layer', { kind: 'greenpepper', count: 4, minDist: 100, overlap: 0.6, avoid: [{ ...C, d: 135 }] }],
      ['oregano', { count: 14 }],
    ],
  }),
  saumon: pizza('saumon', {
    base: 'creme',
    steps: [
      ['layer', { kind: 'salmon', count: 6, minDist: 150, overlap: 0.7 }],
      ['layer', { kind: 'dill', count: 9, minDist: 70, overlap: 0.4 }],
      ['zest', { count: 30 }],
    ],
  }),
  'pizza-choco-banane': pizza('pizza-choco-banane', {
    base: 'choco',
    steps: [
      ['swirl'],
      ['layer', { kind: 'banana', count: 13, minDist: 74 }],
      ['hazel', { count: 34 }],
      ['sugar', { count: 3 }],
    ],
  }),
  'hero-pizza': heroPizza('hero-pizza', {
    base: 'tomato', char: 20, blisters: 8, outline: 0.55,
    steps: [
      ['cheese', { count: 11, r: [44, 68], minDist: 100 }],
      ['oil', { count: 4 }],
      ['layer', { kind: 'pepperoni', count: 10, minDist: 85, overlap: 0.55 }],
      ['layer', { kind: 'basil', count: 6, minDist: 115, overlap: 0.5 }],
      ['oregano', { count: 24 }],
    ],
  }),
};
