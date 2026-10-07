# site-audit

Read-only evidence capture for auditing a live website. Use it now on the current
Pizza Tasty site, and later on the rebuild, so before/after comparisons use the same
method.

**Read-only.** It only issues GET requests and renders pages. It never submits forms,
never sends credentials, and never tries to get past a login. A protected `/admin` is
recorded as "asks for a login", nothing more.

```bash
cd tools/site-audit
npm install
npm run selftest                                   # proves every detector against a local fixture
node capture.mjs https://www.pizzatasty.online/ --lighthouse
```

## What it captures

| Area | Evidence |
|---|---|
| HTTP | Redirect chains for http/https × www/apex, response headers, security headers, raw (pre-JavaScript) HTML |
| Public routes | Status codes for robots.txt, sitemaps, manifests, favicon, security.txt, `/admin`, `/login`, `/fr`, `/en`, `/es`, `/menu`, a 404 probe. Detects hosts that answer every path with the same `index.html` |
| Pages | Breadth-first crawl of same-site links (default cap 30). `#/` hash routes count as pages |
| Viewports | 360, 390 and 430 px phones, phone landscape, 768 tablet, 1280 and 1440 desktop, 320 px reflow. The first 8 pages get all viewports; the rest get 390 + 1280 |
| Per page and viewport | Rendered DOM; above-the-fold and full-page screenshots; head (title, metas, links, hreflang, JSON-LD); headings; landmarks; images (alt, sizes, formats, lazy loading); links (classified tel / WhatsApp / maps / internal / external); controls with sizes; fake buttons (`cursor:pointer` without a role); form fields and their labels; typography and colour inventory; quick contrast scan; CSS custom properties and breakpoints; fixed/sticky elements; horizontal overflow; framework clues; local/session storage; console errors; failed requests; resource timing; LCP element and layout shifts |
| Accessibility | axe-core at 390 and 1280 px; keyboard focus walk (60 Tab stops, focus-indicator styles, cropped screenshots); animations with and without `prefers-reduced-motion` |
| Assets | Every response body (JS, CSS, images, JSON) saved once, with a URL index, for static analysis |
| Lighthouse | Optional (`--lighthouse`): mobile and desktop JSON |

## Reading the numbers honestly

Timings come from a cloud container behind an egress proxy. They are **lab** values
and are **not** representative of customers' phones. Use them to compare runs made
under the same conditions, and to identify *which* element is the LCP or *what*
shifts. Real-user Core Web Vitals come from field data, after launch.

## Never commit captures

Output goes to `captures/`, which is git-ignored. Raw bundles can contain keys or
cookies shipped by the audited site, and this repository is public. Commit curated
findings, not raw captures.
