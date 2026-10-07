// Runs capture.mjs against a local fixture with known defects and checks that each one
// is detected. Proves the harness works before it is pointed at a real site.
import { spawn } from 'node:child_process';
import { readFile, mkdtemp } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

const PAGES = {
  '/': `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Fixture Home</title>
    <meta name="description" content="fixture">
    <link rel="alternate" hreflang="en" href="/en">
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"Restaurant","name":"Fixture"}</script>
    <style>:root{--brand:#c00}@media (min-width:48em){body{padding:2rem}} .pale{color:#bbb;background:#fff} .clickable{cursor:pointer}</style></head>
    <body><header><nav><a href="/menu">Menu</a> <a href="https://wa.me/0000000000?text=test">WhatsApp</a></nav></header>
    <main><h1>Fixture</h1><h3>Skipped level</h3><img src="/img.svg" width="10" height="10">
    <p class="pale">Low contrast text</p><div class="clickable">Fake button</div>
    <form><input type="text" name="nolabel"><label for="ok">Name</label><input id="ok" name="ok"></form>
    <div style="width:2000px">wide</div></main></body></html>`,
  '/menu': '<!doctype html><html lang="fr"><head><title>Fixture Menu</title></head><body><main><h1>Menu</h1><a href="/">Home</a></main></body></html>',
  '/robots.txt': 'User-agent: *\nAllow: /\n',
  '/img.svg': '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>',
};

const server = http.createServer((req, res) => {
  const body = PAGES[req.url];
  if (!body) { res.writeHead(404, { 'content-type': 'text/html' }); return res.end('<title>404</title>'); }
  const type = req.url.endsWith('.txt') ? 'text/plain' : req.url.endsWith('.svg') ? 'image/svg+xml' : 'text/html';
  res.writeHead(200, { 'content-type': type, 'x-content-type-options': 'nosniff' });
  res.end(body);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;
const out = await mkdtemp(path.join(os.tmpdir(), 'site-audit-selftest-'));

// Async spawn: the fixture server lives in this process, so blocking here would starve it.
const code = await new Promise((resolve) => {
  spawn(process.execPath, ['capture.mjs', base, '--out', out, '--max-pages', '3', '--full-pages', '1'], { stdio: 'inherit', cwd: path.dirname(new URL(import.meta.url).pathname) }).on('exit', resolve);
});
server.close();
if (code !== 0) { console.error('capture exited with', code); process.exit(1); }

const summary = JSON.parse(await readFile(path.join(out, 'summary.json'), 'utf8'));
const home = JSON.parse(await readFile(path.join(out, 'pages/home/phone-390/extract.json'), 'utf8'));
const axe = JSON.parse(await readFile(path.join(out, 'pages/home/phone-390/axe.json'), 'utf8'));
const axeIds = new Set(axe.violations.map((v) => v.id));

const checks = [
  ['crawled both pages', summary.pages.length === 2],
  ['robots.txt probed', summary.http.probes.find((p) => p.path === '/robots.txt')?.status === 200],
  ['404 path detected', summary.http.probes.find((p) => p.path === '/__audit-nonexistent-page__')?.status === 404],
  ['lang captured', home.head.lang === 'fr'],
  ['JSON-LD parsed', home.head.jsonLd[0]?.['@type'] === 'Restaurant'],
  ['hreflang link captured', home.head.links.some((l) => l.hreflang === 'en')],
  ['whatsapp link classified', home.links.some((l) => l.kind === 'whatsapp')],
  ['image without alt found', home.images.some((i) => i.alt === null)],
  ['pseudo-button found', home.pseudoButtons.some((p) => p.text === 'Fake button')],
  ['unlabelled field found', home.fields.some((f) => f.name === 'nolabel' && f.labels.length === 0 && !f.ariaLabel)],
  ['low contrast found', home.lowContrast.some((c) => c.text === 'Low contrast text')],
  ['horizontal overflow found', home.overflowX === true],
  ['css custom property read', home.rootVars['--brand'] === '#c00'],
  ['breakpoint read', home.mediaQueries.includes('(min-width: 48em)')],
  ['axe: image-alt', axeIds.has('image-alt')],
  ['axe: label', axeIds.has('label')],
  ['axe: heading-order', axe.violations.some((v) => v.id === 'heading-order') || axe.incomplete.some((v) => v.id === 'heading-order')],
  ['focus walk ran', summary.focus.stops > 0],
  ['all viewports for first page', (await import('node:fs')).readdirSync(path.join(out, 'pages/home')).length === 8],
];
let failed = 0;
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) failed++; }
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed', '·', out);
process.exit(failed ? 1 : 0);
