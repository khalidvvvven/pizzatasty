// Read-only evidence capture for a live website audit.
//
// Only issues GET requests and renders pages. It never submits forms, never sends
// credentials and never tries to get past authentication: an /admin that asks for a
// login is recorded as "asks for a login", nothing more.
//
// Usage: node capture.mjs <url> [--out dir] [--max-pages 30] [--full-pages 8] [--lighthouse]

import { chromium, devices, request as pwRequest } from 'playwright';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { parseArgs } from 'node:util';

const require = createRequire(import.meta.url);

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: 'string' },
    'max-pages': { type: 'string', default: '30' },
    'full-pages': { type: 'string', default: '8' },
    lighthouse: { type: 'boolean', default: false },
  },
});

if (!positionals[0]) {
  console.error('usage: node capture.mjs <url> [--out dir] [--max-pages N] [--full-pages N] [--lighthouse]');
  process.exit(2);
}
const START = new URL(positionals[0]);
const MAX_PAGES = Number(opts['max-pages']);
const FULL_PAGES = Number(opts['full-pages']);
const STAMP = new Date().toISOString().replace(/[:.]/g, '-');
const OUT = path.resolve(opts.out ?? path.join('captures', START.hostname, STAMP));

const isLoopback = (u) => ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
const PROXY_URL = process.env.HTTPS_PROXY || process.env.https_proxy;
const proxy = PROXY_URL && !isLoopback(START) ? { server: PROXY_URL, bypass: 'localhost,127.0.0.1' } : undefined;

// Viewports cover the brief's matrix: narrow Android, typical iPhone, large phone,
// landscape, tablet, desktop, and 320px reflow (WCAG 1.4.10 ≈ 1280px at 400% zoom).
const VIEWPORTS = [
  { name: 'phone-360', width: 360, height: 740, mobile: true },
  { name: 'phone-390', width: 390, height: 844, mobile: true },
  { name: 'phone-430', width: 430, height: 932, mobile: true },
  { name: 'phone-landscape', width: 844, height: 390, mobile: true },
  { name: 'tablet-768', width: 768, height: 1024, mobile: true },
  { name: 'desktop-1280', width: 1280, height: 800, mobile: false },
  { name: 'desktop-1440', width: 1440, height: 900, mobile: false },
  { name: 'reflow-320', width: 320, height: 640, mobile: false },
];
const CORE_VIEWPORTS = ['phone-390', 'desktop-1280'];
const AXE_VIEWPORTS = new Set(['phone-390', 'desktop-1280']);

const PROBE_PATHS = [
  '/robots.txt', '/sitemap.xml', '/sitemap_index.xml', '/manifest.json', '/site.webmanifest',
  '/manifest.webmanifest', '/favicon.ico', '/apple-touch-icon.png', '/.well-known/security.txt',
  '/admin', '/admin/', '/admin.html', '/login', '/dashboard', '/api', '/fr', '/en', '/es', '/menu',
  '/__audit-nonexistent-page__',
];
const SECURITY_HEADERS = [
  'content-security-policy', 'strict-transport-security', 'x-frame-options', 'x-content-type-options',
  'referrer-policy', 'permissions-policy', 'cross-origin-opener-policy',
];

const savedBodies = new Map(); // url -> relative file path
const log = (...a) => console.log('[capture]', ...a);
const write = async (rel, data) => {
  const file = path.join(OUT, rel);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data, null, 2));
  return rel;
};
const slug = (u) => {
  const url = new URL(u);
  const s = (url.pathname + url.hash).replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '');
  return s || 'home';
};
const sameSite = (u) => {
  const strip = (h) => h.replace(/^www\./, '');
  return strip(u.hostname) === strip(START.hostname);
};

// ---------- HTTP layer: redirects, headers, raw HTML, public probes ----------

async function httpLayer(api) {
  const apex = START.hostname.replace(/^www\./, '');
  const variants = [];
  for (const scheme of ['https', 'http']) for (const host of [`www.${apex}`, apex]) variants.push(`${scheme}://${host}/`);

  const redirects = {};
  for (const v of variants) {
    const chain = [];
    let url = v;
    for (let i = 0; i < 10; i++) {
      try {
        const r = await api.get(url, { maxRedirects: 0, failOnStatusCode: false, timeout: 30_000 });
        const h = r.headers();
        chain.push({ url, status: r.status(), location: h.location ?? null, hsts: h['strict-transport-security'] ?? null });
        if (r.status() >= 300 && r.status() < 400 && h.location) url = new URL(h.location, url).href;
        else break;
      } catch (e) {
        chain.push({ url, error: String(e.message).split('\n')[0] });
        break;
      }
    }
    redirects[v] = chain;
  }

  const main = await api.get(START.href, { failOnStatusCode: false, timeout: 30_000 });
  const rawHtml = await main.text();
  await write('http/raw-index.html', rawHtml);
  const headers = main.headers();

  const probes = [];
  for (const p of PROBE_PATHS) {
    const url = new URL(p, START).href;
    try {
      const r = await api.get(url, { maxRedirects: 0, failOnStatusCode: false, timeout: 30_000 });
      const type = r.headers()['content-type'] ?? '';
      const body = await r.body();
      const text = /text|json|xml|javascript/.test(type) ? body.toString('utf8') : '';
      const sameAsIndex = text && text === rawHtml; // SPA hosts often answer every path with index.html
      let file = null;
      if (text && !sameAsIndex) file = await write(`http/probes/${slug(url)}.txt`, text);
      probes.push({
        path: p, status: r.status(), location: r.headers().location ?? null, contentType: type, bytes: body.length,
        servesIndexHtml: sameAsIndex, title: (text.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1] ?? null, file,
      });
    } catch (e) {
      probes.push({ path: p, error: String(e.message).split('\n')[0] });
    }
  }

  return {
    finalUrl: main.url(), status: main.status(), headers,
    securityHeaders: Object.fromEntries(SECURITY_HEADERS.map((h) => [h, headers[h] ?? null])),
    rawHtmlBytes: Buffer.byteLength(rawHtml),
    rawBodyTextChars: rawHtml.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/gi, '').replace(/\s+/g, ' ').trim().length,
    redirects, probes,
  };
}

// ---------- In-page extraction (runs in the browser) ----------

function extractInPage() {
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0;
  };
  const txt = (s, n = 160) => (s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
  const rect = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y + scrollY), w: Math.round(r.width), h: Math.round(r.height) }; };
  const sel = (el) => {
    const parts = [];
    for (let e = el; e && e.nodeType === 1 && parts.length < 4; e = e.parentElement) {
      let p = e.tagName.toLowerCase();
      if (e.id) { parts.unshift(`${p}#${e.id}`); break; }
      if (e.classList.length) p += '.' + [...e.classList].slice(0, 2).join('.');
      parts.unshift(p);
    }
    return parts.join(' > ');
  };
  const accName = (el) => {
    const by = el.getAttribute('aria-labelledby');
    if (by) return txt(by.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(' '));
    return txt(el.getAttribute('aria-label') || el.innerText || el.getAttribute('title') || el.querySelector('img[alt]')?.alt || el.value || '');
  };

  // Colour maths for a quick text-contrast scan (axe is the authoritative check).
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r, g, b, a }; };
  const lum = ({ r, g, b }) => [r, g, b].map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const effectiveBg = (el) => {
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage !== 'none') return { image: true };
      const c = parse(cs.backgroundColor);
      if (c && c.a > 0.5) return c;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  };

  const head = {
    title: document.title,
    lang: document.documentElement.lang || null,
    dir: document.documentElement.dir || null,
    metas: [...document.querySelectorAll('meta')].map((m) => ({ name: m.name || m.getAttribute('property') || m.httpEquiv || (m.charset ? 'charset' : ''), content: m.content || m.charset })),
    links: [...document.querySelectorAll('link')].map((l) => ({ rel: l.rel, href: l.href, hreflang: l.hreflang || null, as: l.as || null, type: l.type || null, sizes: l.sizes?.value || null })),
    scripts: [...document.scripts].map((s) => ({ src: s.src || null, type: s.type || null, async: s.async, defer: s.defer, inlineChars: s.src ? 0 : s.textContent.length })),
    jsonLd: [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => { try { return JSON.parse(s.textContent); } catch { return { parseError: s.textContent.slice(0, 500) }; } }),
  };

  const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6,[role=heading]')].map((h) => ({ level: h.tagName.match(/H(\d)/)?.[1] ?? h.getAttribute('aria-level'), text: txt(h.innerText, 120), visible: vis(h) }));
  const landmarks = [...document.querySelectorAll('header,nav,main,footer,aside,section[aria-label],[role=banner],[role=navigation],[role=main],[role=contentinfo],[role=dialog],dialog')].map((e) => ({ tag: e.tagName.toLowerCase(), role: e.getAttribute('role'), label: e.getAttribute('aria-label'), visible: vis(e) }));

  const images = [...document.images].map((img) => ({
    src: img.currentSrc || img.src, alt: img.getAttribute('alt'), loading: img.loading, decoding: img.decoding,
    fetchpriority: img.getAttribute('fetchpriority'), srcset: !!img.srcset, sizes: img.sizes || null,
    picture: img.parentElement?.tagName === 'PICTURE' ? [...img.parentElement.querySelectorAll('source')].map((s) => s.type) : null,
    attrW: img.getAttribute('width'), attrH: img.getAttribute('height'),
    natural: [img.naturalWidth, img.naturalHeight], rendered: [Math.round(img.width), Math.round(img.height)],
    visible: vis(img), aboveFold: img.getBoundingClientRect().top + scrollY < innerHeight,
  }));
  const bgImages = [...document.querySelectorAll('body *')].map((e) => [e, getComputedStyle(e).backgroundImage]).filter(([, b]) => b && b !== 'none' && b.includes('url(')).slice(0, 80).map(([e, b]) => ({ el: sel(e), bg: b.slice(0, 200), rect: rect(e) }));

  const linkKind = (href) => /^tel:/i.test(href) ? 'tel' : /^mailto:/i.test(href) ? 'mailto' : /wa\.me|whatsapp/i.test(href) ? 'whatsapp' : /maps\.|goo\.gl\/maps|maps\.app/i.test(href) ? 'maps' : /^https?:/i.test(href) ? (new URL(href).hostname.replace(/^www\./, '') === location.hostname.replace(/^www\./, '') ? 'internal' : 'external') : 'other';
  const links = [...document.querySelectorAll('a')].map((a) => ({ href: a.getAttribute('href'), abs: a.href, kind: linkKind(a.href || ''), name: accName(a), target: a.target || null, rel: a.rel || null, visible: vis(a), size: rect(a) }));

  const NATIVE = 'a[href],button,input,select,textarea,summary,[role=button],[role=link],[role=tab],[role=menuitem],[role=checkbox],[role=radio],[role=switch]';
  const interactive = [...document.querySelectorAll(`${NATIVE},[tabindex],[onclick]`)].filter(vis).map((e) => ({
    tag: e.tagName.toLowerCase(), role: e.getAttribute('role'), type: e.getAttribute('type'), name: accName(e),
    tabindex: e.getAttribute('tabindex'), disabled: e.disabled ?? null, w: Math.round(e.getBoundingClientRect().width), h: Math.round(e.getBoundingClientRect().height), sel: sel(e),
  }));
  // Elements styled as clickable but not exposed as controls (keyboard/screen-reader risk).
  const pseudoButtons = [...document.querySelectorAll('div,span,li,img,p,article,section')].filter((e) => vis(e) && getComputedStyle(e).cursor === 'pointer' && !e.closest(NATIVE) && !e.matches(NATIVE) && !e.hasAttribute('tabindex')).slice(0, 60).map((e) => ({ sel: sel(e), text: txt(e.innerText, 80), rect: rect(e) }));

  const fields = [...document.querySelectorAll('input,select,textarea')].map((f) => {
    const labels = f.labels ? [...f.labels].map((l) => txt(l.innerText, 80)) : [];
    return { tag: f.tagName.toLowerCase(), type: f.type, name: f.name || null, id: f.id || null, required: f.required, autocomplete: f.getAttribute('autocomplete'), inputmode: f.getAttribute('inputmode'), placeholder: f.placeholder || null, labels, ariaLabel: f.getAttribute('aria-label'), labelledby: f.getAttribute('aria-labelledby'), describedby: f.getAttribute('aria-describedby'), visible: vis(f), fontSize: getComputedStyle(f).fontSize };
  });
  const forms = [...document.forms].map((f) => ({ action: f.getAttribute('action'), method: f.method, fields: f.elements.length, novalidate: f.noValidate }));

  // Typography + colour inventory from visible text.
  const typo = new Map(); const colors = new Map(); const lowContrast = [];
  const textEls = [...document.querySelectorAll('body *')].filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && vis(e));
  for (const e of textEls) {
    const cs = getComputedStyle(e);
    const k = `${cs.fontFamily.split(',')[0].replace(/["']/g, '')} | ${cs.fontSize} | ${cs.fontWeight} | lh ${cs.lineHeight}`;
    typo.set(k, (typo.get(k) ?? 0) + 1);
    colors.set(`text ${cs.color}`, (colors.get(`text ${cs.color}`) ?? 0) + 1);
    const bg = effectiveBg(e);
    if (!bg.image) {
      colors.set(`bg rgb(${bg.r}, ${bg.g}, ${bg.b})`, (colors.get(`bg rgb(${bg.r}, ${bg.g}, ${bg.b})`) ?? 0) + 1);
      const fg = parse(cs.color);
      if (fg) {
        const r = ratio(fg, bg);
        const large = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.66 && Number(cs.fontWeight) >= 700);
        if (r < (large ? 3 : 4.5) && lowContrast.length < 40) lowContrast.push({ text: txt(e.innerText, 60), color: cs.color, bg: `rgb(${bg.r}, ${bg.g}, ${bg.b})`, ratio: Math.round(r * 100) / 100, fontSize: cs.fontSize, sel: sel(e) });
      }
    }
  }
  for (const e of document.querySelectorAll('button,a,[role=button]')) {
    if (!vis(e)) continue;
    const cs = getComputedStyle(e);
    const k = `control bg ${cs.backgroundColor} | border-radius ${cs.borderRadius}`;
    colors.set(k, (colors.get(k) ?? 0) + 1);
  }
  const top = (m, n) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ k, n: v }));

  // Author CSS: custom properties, breakpoints, reduced-motion support.
  const rootVars = {}; const media = new Set(); let reducedMotionRules = 0; let cssRuleCount = 0; const sheets = [];
  for (const sh of document.styleSheets) {
    let rules;
    try { rules = sh.cssRules; } catch { sheets.push({ href: sh.href, crossOrigin: true }); continue; }
    sheets.push({ href: sh.href, rules: rules.length });
    const walk = (list) => {
      for (const r of list) {
        cssRuleCount++;
        if (r.media) { media.add(r.media.mediaText); if (/prefers-reduced-motion/.test(r.media.mediaText)) reducedMotionRules++; }
        if (r.selectorText && /(^|,)\s*(:root|html)\s*(,|$)/.test(r.selectorText)) for (const p of r.style) if (p.startsWith('--')) rootVars[p] = r.style.getPropertyValue(p).trim();
        if (r.cssRules) walk(r.cssRules);
      }
    };
    walk(rules);
  }

  const overflowX = document.documentElement.scrollWidth > innerWidth + 1;
  const overflowers = overflowX ? [...document.querySelectorAll('body *')].filter((e) => e.getBoundingClientRect().right > innerWidth + 1 && vis(e)).slice(0, 15).map((e) => ({ sel: sel(e), right: Math.round(e.getBoundingClientRect().right) })) : [];

  const fixed = [...document.querySelectorAll('body *')].filter((e) => ['fixed', 'sticky'].includes(getComputedStyle(e).position) && vis(e)).map((e) => ({ sel: sel(e), position: getComputedStyle(e).position, rect: rect(e), z: getComputedStyle(e).zIndex }));

  const anyEl = document.querySelector('#root > *, #app > *, #__next > *, body > div');
  const clues = {
    nextData: !!document.getElementById('__NEXT_DATA__'), nextGlobal: typeof window.next !== 'undefined',
    nuxt: typeof window.__NUXT__ !== 'undefined', rootIds: ['root', 'app', '__next', '__nuxt', 'svelte'].filter((id) => document.getElementById(id)),
    reactFiber: anyEl ? Object.keys(anyEl).some((k) => k.startsWith('__react')) : false,
    vueAttrs: !!document.querySelector('[data-v-app]') || [...document.querySelectorAll('body *')].some((e) => [...e.attributes].some((a) => a.name.startsWith('data-v-'))),
    angular: !!document.querySelector('[ng-version]'), astro: !!document.querySelector('astro-island'),
    svelteClasses: !!document.querySelector('[class*="svelte-"]'), tailwindLike: !!document.querySelector('[class*="px-"][class*="py-"]'),
    generator: document.querySelector('meta[name=generator]')?.content ?? null,
    globals: Object.keys(window).filter((k) => /^(__|firebase|supabase|gtag|dataLayer|fbq|_paq|Stripe|emailjs|i18n|React|Vue|jQuery|\$)/i.test(k)).slice(0, 40),
  };

  const storage = {};
  for (const [name, s] of [['local', localStorage], ['session', sessionStorage]]) {
    try { storage[name] = Object.fromEntries(Object.keys(s).map((k) => [k, s.getItem(k).slice(0, 2000)])); } catch { storage[name] = 'unavailable'; }
  }

  const resources = performance.getEntriesByType('resource').map((r) => ({ url: r.name, type: r.initiatorType, transfer: r.transferSize, encoded: r.encodedBodySize, decoded: r.decodedBodySize, start: Math.round(r.startTime), dur: Math.round(r.duration), renderBlocking: r.renderBlockingStatus ?? null }));
  const nav = performance.getEntriesByType('navigation')[0];
  const paints = Object.fromEntries(performance.getEntriesByType('paint').map((p) => [p.name, Math.round(p.startTime)]));

  return {
    url: location.href, viewport: [innerWidth, innerHeight], docHeight: document.documentElement.scrollHeight,
    head, headings, landmarks, images, bgImages, links, interactive, pseudoButtons, fields, forms,
    typography: top(typo, 30), colors: top(colors, 40), lowContrast, rootVars, mediaQueries: [...media], reducedMotionRules, cssRuleCount, sheets,
    overflowX, overflowers, fixed, clues, storage, fonts: [...document.fonts].map((f) => `${f.family} ${f.weight} ${f.style} ${f.status}`),
    animations: document.getAnimations().length,
    perf: { nav: nav && { ttfb: Math.round(nav.responseStart), dcl: Math.round(nav.domContentLoadedEventEnd), load: Math.round(nav.loadEventEnd), transfer: nav.transferSize }, paints, resources },
    text: txt(document.body.innerText, 20000),
  };
}

// LCP and layout shifts must be observed from the start of the page's life.
const VITALS_INIT = () => {
  window.__audit = { lcp: null, shifts: [] };
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) {
      const el = e.element;
      window.__audit.lcp = { time: Math.round(e.startTime), size: e.size, url: e.url || null, el: el ? `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''}` : null };
    }
  }).observe({ type: 'largest-contentful-paint', buffered: true });
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) if (!e.hadRecentInput) window.__audit.shifts.push({ value: e.value, time: Math.round(e.startTime), sources: (e.sources || []).map((s) => s.node?.nodeName ?? null) });
  }).observe({ type: 'layout-shift', buffered: true });
};

// ---------- Browser layer ----------

async function newContext(browser, vp, extra = {}) {
  const base = vp.mobile ? devices['Pixel 7'] : devices['Desktop Chrome'];
  const ctx = await browser.newContext({
    ...base, viewport: { width: vp.width, height: vp.height }, isMobile: vp.mobile, hasTouch: vp.mobile,
    deviceScaleFactor: vp.mobile ? 2 : 1, locale: 'fr-FR', ...extra,
  });
  await ctx.addInitScript(VITALS_INIT);
  return ctx;
}

async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  // Scroll through the page so lazy images and scroll-triggered content load, then return.
  await page.evaluate(async () => {
    for (let y = 0, i = 0; y < document.documentElement.scrollHeight && i < 40; y += innerHeight * 0.8, i++) {
      scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 200));
    }
    scrollTo(0, 0);
  });
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(500);
}

async function saveBody(response) {
  const url = response.url();
  if (savedBodies.has(url) || url.startsWith('data:')) return;
  savedBodies.set(url, null);
  try {
    const body = await response.body();
    const ext = (path.extname(new URL(url).pathname) || '.' + (response.headers()['content-type'] ?? 'bin').split(/[/;+]/)[1]).slice(0, 8);
    const rel = await write(`assets/${createHash('sha1').update(url).digest('hex').slice(0, 16)}${ext}`, body);
    savedBodies.set(url, rel);
  } catch { /* redirects and aborted requests have no body */ }
}

async function capturePage(browser, url, vp, { axe, screenshots }) {
  const ctx = await newContext(browser, vp);
  const page = await ctx.newPage();
  const network = []; const consoleMsgs = []; const errors = []; const failed = []; const bodySaves = [];
  page.on('response', (r) => {
    network.push({ url: r.url(), status: r.status(), type: r.request().resourceType(), mime: r.headers()['content-type'] ?? null, cache: r.headers()['cache-control'] ?? null, length: r.headers()['content-length'] ?? null, fromSW: r.fromServiceWorker() });
    bodySaves.push(saveBody(r));
  });
  page.on('requestfailed', (r) => failed.push({ url: r.url(), error: r.failure()?.errorText }));
  page.on('console', (m) => consoleMsgs.push({ type: m.type(), text: m.text().slice(0, 500), at: m.location()?.url ?? null }));
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 800)));

  const dir = `pages/${slug(url)}/${vp.name}`;
  let status = null;
  try {
    const resp = await page.goto(url, { waitUntil: 'load', timeout: 45_000 });
    status = resp?.status() ?? null;
  } catch (e) {
    errors.push(`navigation: ${String(e.message).split('\n')[0]}`);
  }
  await settle(page);
  const data = await page.evaluate(extractInPage).catch((e) => ({ extractError: String(e) }));
  data.vitals = await page.evaluate(() => window.__audit).catch(() => null);
  data.status = status;
  if (screenshots) {
    await page.screenshot({ path: path.join(OUT, dir, 'fold.png') }).catch(() => {});
    await page.screenshot({ path: path.join(OUT, dir, 'full.png'), fullPage: true }).catch(() => {});
  }
  await write(`${dir}/dom.html`, await page.content());
  await write(`${dir}/extract.json`, data);
  await write(`${dir}/network.json`, { network, failed });
  await write(`${dir}/console.json`, { console: consoleMsgs, errors });
  if (axe) {
    await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
    const res = await page.evaluate(() => window.axe.run(document, { resultTypes: ['violations', 'incomplete'] })).catch((e) => ({ error: String(e) }));
    await write(`${dir}/axe.json`, res);
    data.axeViolations = res.violations?.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })) ?? res;
  }
  const internalLinks = (data.links ?? []).filter((l) => l.kind === 'internal').map((l) => l.abs);
  await Promise.allSettled(bodySaves);
  await ctx.close();
  return { url, viewport: vp.name, status, data, internalLinks, consoleErrors: consoleMsgs.filter((m) => m.type === 'error').length + errors.length, failedRequests: failed.length, requests: network.length };
}

async function focusWalk(browser, url, vpName) {
  const vp = VIEWPORTS.find((v) => v.name === vpName);
  const ctx = await newContext(browser, vp);
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'load', timeout: 45_000 }).catch(() => {});
  await settle(page);
  const stops = [];
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName.toLowerCase(), role: el.getAttribute('role'),
        name: (el.getAttribute('aria-label') || el.innerText || el.getAttribute('title') || el.value || '').replace(/\s+/g, ' ').trim().slice(0, 80),
        focusVisible: el.matches(':focus-visible'), outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`, boxShadow: cs.boxShadow,
        inViewport: r.bottom > 0 && r.top < innerHeight, rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
      };
    });
    if (!info) { stops.push({ i, body: true }); continue; }
    if (i < 20) {
      const [x, y, w, h] = info.rect;
      if (info.inViewport && w > 0 && h > 0) await page.screenshot({ path: path.join(OUT, `focus/${vpName}-${String(i).padStart(2, '0')}.png`), clip: { x: Math.max(0, x - 12), y: Math.max(0, y - 12), width: w + 24, height: h + 24 } }).catch(() => {});
    }
    stops.push({ i, ...info });
  }
  await write(`focus/${vpName}.json`, stops);
  await ctx.close();
  return stops;
}

async function reducedMotion(browser, url) {
  const out = {};
  for (const mode of ['no-preference', 'reduce']) {
    const ctx = await newContext(browser, VIEWPORTS.find((v) => v.name === 'phone-390'), { reducedMotion: mode });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'load', timeout: 45_000 }).catch(() => {});
    await page.waitForTimeout(1500);
    out[mode] = await page.evaluate(() => document.getAnimations().map((a) => ({ name: a.animationName ?? a.constructor.name, target: a.effect?.target?.tagName ?? null })).slice(0, 50));
    await page.screenshot({ path: path.join(OUT, `motion/${mode}.png`) }).catch(() => {});
    await ctx.close();
  }
  await write('motion/animations.json', out);
  return { noPreference: out['no-preference'].length, reduce: out.reduce.length };
}

function lighthouse(url, formFactor, chromePath) {
  const bin = path.join(path.dirname(require.resolve('lighthouse/package.json')), 'cli', 'index.js');
  const flags = ['--headless=new', '--no-sandbox'];
  if (proxy) flags.push(`--proxy-server=${proxy.server}`);
  const args = [bin, url, '--quiet', '--output=json', `--output-path=${path.join(OUT, `lighthouse/${formFactor}.json`)}`, `--chrome-flags=${flags.join(' ')}`];
  if (formFactor === 'desktop') args.push('--preset=desktop');
  return new Promise((resolve) => {
    mkdir(path.join(OUT, 'lighthouse'), { recursive: true }).then(() => {
      const p = spawn(process.execPath, args, { env: { ...process.env, CHROME_PATH: chromePath }, stdio: 'inherit' });
      p.on('exit', (code) => resolve(code));
    });
  });
}

// ---------- Main ----------

await mkdir(OUT, { recursive: true });
log('output', OUT);
const api = await pwRequest.newContext({ proxy, extraHTTPHeaders: { 'accept-language': 'fr-FR,fr;q=0.9,en;q=0.8,es;q=0.7' } });
const http = await httpLayer(api);
await api.dispose();
log('http', http.status, http.finalUrl);

const browser = await chromium.launch({ proxy });

// Discover pages breadth-first from the start URL (desktop, no screenshots).
const queue = [new URL(http.finalUrl || START.href).href];
const seen = new Set(queue);
const pages = [];
while (queue.length && pages.length < MAX_PAGES) {
  const url = queue.shift();
  const idx = pages.length;
  const full = idx < FULL_PAGES;
  const vps = full ? VIEWPORTS : VIEWPORTS.filter((v) => CORE_VIEWPORTS.includes(v.name));
  log(`page ${idx + 1}: ${url} (${vps.length} viewports)`);
  const results = [];
  for (const vp of vps) results.push(await capturePage(browser, url, vp, { axe: AXE_VIEWPORTS.has(vp.name), screenshots: true }));
  pages.push({ url, results: results.map(({ data, internalLinks, ...r }) => ({ ...r, title: data.head?.title, h1: data.headings?.filter((h) => h.level === '1').map((h) => h.text), overflowX: data.overflowX, axe: data.axeViolations ?? null, lcp: data.vitals?.lcp ?? null, cls: data.vitals?.shifts?.reduce((s, x) => s + x.value, 0) ?? null })) });
  for (const link of results.flatMap((r) => r.internalLinks)) {
    const u = new URL(link);
    if (!sameSite(u) || !/^https?:$/.test(u.protocol)) continue;
    if (!u.hash.startsWith('#/')) u.hash = ''; // in-page anchors are not separate pages; "#/" hash routes are
    if (/\.(pdf|jpe?g|png|webp|avif|svg|gif|zip)$/i.test(u.pathname)) continue;
    if (!seen.has(u.href)) { seen.add(u.href); queue.push(u.href); }
  }
}
if (queue.length) log(`page cap reached; not captured: ${queue.length} more URL(s)`, queue.slice(0, 20));

const home = pages[0]?.url ?? START.href;
const focus = { desktop: await focusWalk(browser, home, 'desktop-1280') };
const motion = await reducedMotion(browser, home);
const chromePath = chromium.executablePath();
await browser.close();

let lh = null;
if (opts.lighthouse) {
  lh = {};
  for (const ff of ['mobile', 'desktop']) lh[ff] = await lighthouse(home, ff, chromePath);
}

await write('assets/index.json', Object.fromEntries(savedBodies));
const summary = {
  capturedAt: new Date().toISOString(), start: START.href, proxied: !!proxy, environmentNote: 'Lab capture from a cloud container through an egress proxy: timings are NOT representative of real users.',
  http, pages, notCaptured: queue, focus: { stops: focus.desktop.length, withoutVisibleIndicator: focus.desktop.filter((s) => s.tag && s.outline.startsWith('none') && s.boxShadow === 'none').length, skipLinkFirst: /skip|contenu|contenido|aller/i.test(focus.desktop[0]?.name ?? '') },
  motion, lighthouseExitCodes: lh, assetsSaved: [...savedBodies.values()].filter(Boolean).length,
};
await write('summary.json', summary);
log('done', OUT);
