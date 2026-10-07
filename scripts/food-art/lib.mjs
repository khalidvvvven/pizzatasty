// Shared helpers for the demo food-art generators.
// The art is a placeholder system: every file in public/food/ is meant to be replaced by a
// real Pizza Tasty photograph later, with no component changes.

/** Deterministic PRNG seeded from a string, so every build produces identical files. */
export function rng(seed) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Round to keep files small. */
export const r = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

/** Random float in [min, max) from a PRNG. */
export const between = (rand, min, max) => min + rand() * (max - min);

const hex = (c) => c.replace('#', '').match(/../g).map((x) => parseInt(x, 16));
const toHex = (rgb) => '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

/** Linear mix of two hex colours, t in [0,1]. */
export const mix = (a, b, t) => toHex(hex(a).map((v, i) => v + (hex(b)[i] - v) * t));

/** Darken (amt < 0) or lighten (amt > 0) a hex colour, amt in [-1, 1]. */
export const shade = (c, amt) => (amt < 0 ? mix(c, '#000000', -amt) : mix(c, '#ffffff', amt));

/**
 * Scatter points inside a circle with a minimum spacing (simple dart throwing).
 * Returns [{x, y}]. Used for toppings so they never clump unnaturally.
 */
export function scatterInCircle(rand, { cx, cy, radius, count, minDist, tries = 4000 }) {
  const pts = [];
  for (let i = 0; i < tries && pts.length < count; i++) {
    const ang = rand() * Math.PI * 2;
    const rad = Math.sqrt(rand()) * radius;
    const p = { x: cx + Math.cos(ang) * rad, y: cy + Math.sin(ang) * rad };
    if (pts.every((q) => (q.x - p.x) ** 2 + (q.y - p.y) ** 2 >= minDist ** 2)) pts.push(p);
  }
  return pts;
}

/** Organic closed blob path around (cx, cy). `wobble` is relative radius variation. */
export function blobPath(rand, cx, cy, radius, { points = 9, wobble = 0.22 } = {}) {
  const pts = Array.from({ length: points }, (_, i) => {
    const a = (i / points) * Math.PI * 2;
    const rr = radius * (1 - wobble / 2 + rand() * wobble);
    return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
  });
  // Catmull-Rom → cubic Bézier for a smooth closed shape.
  let d = `M${r(pts[0][0])} ${r(pts[0][1])}`;
  for (let i = 0; i < points; i++) {
    const p0 = pts[(i - 1 + points) % points], p1 = pts[i], p2 = pts[(i + 1) % points], p3 = pts[(i + 2) % points];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${r(c1[0])} ${r(c1[1])} ${r(c2[0])} ${r(c2[1])} ${r(p2[0])} ${r(p2[1])}`;
  }
  return d + 'Z';
}

/** Soft warm contact shadow under the subject (needs `shadowFilter(id)` in defs). */
export const contactShadow = (id, { cx = 400, cy = 700, rx = 290, ry = 38, opacity = 0.3 } = {}) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#3a1f10" opacity="${opacity}" filter="url(#${id}-shadow)"/>`;

export const shadowFilter = (id, blur = 18) =>
  `<filter id="${id}-shadow" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="${blur}"/></filter>`;

/**
 * Subtle grain texture filter for bread, crust and cheese. Apply with filter="url(#id-grain)".
 * Keep `amount` low: texture should be felt, not seen.
 */
export const grainFilter = (id, { freq = 0.9, amount = 0.08 } = {}) =>
  `<filter id="${id}-grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="2" seed="3" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ${amount} 0" result="g"/><feComposite in="g" in2="SourceGraphic" operator="in" result="gi"/><feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="gi"/></feMerge></filter>`;

/** Wrap content into a standalone 800×800 SVG document with a transparent background. */
export const svgDoc = ({ defs = '', body }) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">${defs ? `<defs>${defs}</defs>` : ''}${body}</svg>`;
