// Generates public/food/<id>.svg from the art modules.
//   node scripts/food-art/build.mjs                       → write all files
//   node scripts/food-art/build.mjs --only pizza          → one module
//   node scripts/food-art/build.mjs --only pizza --preview scripts/food-art/preview
//       → also renders a contact sheet PNG (cream and dark backgrounds) to inspect quality
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, '../../public/food');

// The menu data references exactly these ids (src/content/demo/menu.ts).
export const EXPECTED = {
  pizza: ['margherita', 'reine', 'quatre-fromages', 'pepperoni', 'vegetarienne', 'chicken-bbq', 'orientale', 'saumon', 'pizza-choco-banane', 'hero-pizza'],
  'burger-sandwich': ['cheeseburger', 'double-smash', 'chicken-crispy', 'veggie-burger', 'kebab', 'americain', 'poulet-curry'],
  'tacos-panini': ['tacos-classique', 'tacos-gratine', 'tacos-xl', 'panini-trois-fromages', 'panini-poulet', 'panini-choco'],
  'salad-drink-dessert': ['cesar', 'chevre-chaud', 'salade-thon', 'cola', 'the-glace', 'eau', 'limonade', 'jus-orange', 'tiramisu', 'brownie'],
};

const { values } = parseArgs({ options: { only: { type: 'string' }, preview: { type: 'string' } } });
const modules = values.only ? [values.only] : Object.keys(EXPECTED);
await mkdir(OUT, { recursive: true });

const written = [];
let problems = 0;
for (const m of modules) {
  const { art } = await import(pathToFileURL(path.join(here, `${m}.mjs`)).href + `?t=${process.hrtime.bigint()}`);
  for (const id of EXPECTED[m]) if (!art[id]) { console.warn(`MISSING ${m}/${id}`); problems++; }
  for (const [id, render] of Object.entries(art)) {
    const svg = render();
    const issues = [];
    if (!svg.startsWith('<svg')) issues.push('not an <svg> document');
    if (/(?:href|src)="(?:https?:|\/\/|data:image\/(?:png|jpe?g))/.test(svg)) issues.push('external or raster reference');
    if (/<text/.test(svg)) issues.push('contains text');
    const kb = Buffer.byteLength(svg) / 1024;
    if (kb > 40) issues.push(`large (${kb.toFixed(1)} KB)`);
    if (issues.length) { console.warn(`ISSUE ${id}: ${issues.join(', ')}`); problems++; }
    await writeFile(path.join(OUT, `${id}.svg`), svg);
    written.push({ id, kb: kb.toFixed(1) });
  }
}
console.log(written.map((w) => `${w.id} ${w.kb}KB`).join('\n'));

if (values.preview) {
  const dir = path.resolve(values.preview);
  await mkdir(dir, { recursive: true });
  const { chromium } = await import('@playwright/test');
  const tile = (id, bg) => `<figure style="margin:0;background:${bg};border-radius:16px;padding:8px"><img src="${pathToFileURL(path.join(OUT, id + '.svg'))}" width="300" height="300" style="display:block"><figcaption style="font:12px sans-serif;color:${bg === '#1F1A17' ? '#eee' : '#333'}">${id}</figcaption></figure>`;
  const html = `<body style="margin:0;padding:16px;background:#ddd;display:grid;grid-template-columns:repeat(4,316px);gap:12px">${written.flatMap((w) => [tile(w.id, '#FBF6EE'), tile(w.id, '#1F1A17')]).join('')}</body>`;
  // Load the sheet from a file:// URL: a page created with setContent() runs on about:blank,
  // which is not allowed to load file:// images (every tile would render as a broken image).
  const sheetHtml = path.join(dir, `${modules.join('+')}-sheet.html`);
  await writeFile(sheetHtml, html);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1340, height: 900 } });
  await page.goto(pathToFileURL(sheetHtml).href);
  await page.waitForLoadState('load');
  const broken = await page.evaluate(() => [...document.images].filter((i) => !i.complete || i.naturalWidth === 0).length);
  if (broken) console.warn(`PREVIEW: ${broken} image(s) failed to load`);
  const file = path.join(dir, `${modules.join('+')}-sheet.png`);
  await page.screenshot({ path: file, fullPage: true });
  await browser.close();
  console.log('preview:', file);
}
process.exit(problems ? 1 : 0);
