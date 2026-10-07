# Pizza Tasty — Rebuild Discovery

| | |
|---|---|
| **Status** | Phase 0 complete · **Phase 1 (audit of the existing site) blocked — source not yet provided** |
| **Date** | 2026-10-07 |
| **Inputs needed** | See [intake.md](./intake.md) |
| **Related** | [ADR-0001 — Stack and content platform](../adr/0001-stack-and-content-platform.md) (Proposed) |

This document follows the "first assignment" of the rebuild brief. Every section is
labelled with how much of it rests on evidence:

- **VERIFIED**: I inspected it directly in this session.
- **STATED**: you told me in the brief, but I haven't seen it in code yet.
- **PROPOSED**: design or architecture direction. Doesn't depend on the old code and is open to revision.
- **BLOCKED**: needs the existing site or code. The section lists exactly what I will check once I have it.

---

## 0. What was inspected, and what was found

| Source | Result | Evidence |
|---|---|---|
| GitHub `khalidvvvven/pizzatasty` (this repo) | **Empty.** 1 commit (`776d3a5 Initial commit`), one file: `README.md` with 2 lines. Visibility: **public**. | `git log --all`, `git ls-tree -r origin/main`, GitHub repo listing |
| Your other GitHub repos visible to this session | None named for pizza, a restaurant, or food. Not opened: they're outside this session's scope. | GitHub repo listing |
| Connected Vercel account | **196 projects, none whose name or alias contains `pizz`/`tasty`**, and no custom domains. The team is on the **Hobby** plan. | Vercel API: `/v9/projects` (all pages), `/v5/domains`, `/v2/teams/{id}` |
| Public web search for "Pizza Tasty" | Only **unrelated** businesses named "Tasty Pizza": Mexborough and Redcar (UK, Just Eat), Schaarbeek (Belgium, Uber Eats), Omaha (US app). None matches a FR/EN/ES site with admin features. **I did not audit any of them.** | Web search, 2026-10-07 |

**Conclusion:** the existing Pizza Tasty website and code aren't anywhere this
session can reach. Per rule 1 of the brief ("inspect before rebuilding"), I haven't
invented a system map or audit findings. The sections that need the old project are
marked **BLOCKED**, and each one says exactly what I'll check and how.

Three findings come straight from the evidence above and matter now:

1. **The repo is public** (security, §7). Scan the old code for secrets *before* pushing it here.
2. **The name collides with "Tasty Pizza" in search** (SEO, §9). Local SEO will have to carry the brand.
3. **The Vercel team is on Hobby**, which Vercel limits to non-commercial personal use (architecture, ADR-0001). A restaurant site is commercial, so hosting needs a decision.

---

## 1. Known / assumed / unknown

**KNOWN — STATED in the brief (not yet seen in code)**
- Brand name: "Pizza Tasty". Exact casing and spacing still need confirming ([intake](./intake.md) Q1).
- Languages: French, English, Spanish.
- Order modes: dine-in (with table number), takeaway, delivery (with address).
- Checkout via WhatsApp; reservation form; phone/contact actions.
- Cart with quantities; product pricing; featured/best-seller items.
- Admin: category CRUD, dish CRUD, prices, availability, image management.
- *Possibly* size-dependent pricing (the brief says "potentially").

**KNOWN — VERIFIED**
- Everything in §0.

**ASSUMED (to be confirmed, never shipped as fact)**
- One restaurant location. If there are several, the URLs, schema and hours model change.
- Customers mostly arrive on phones, from Google Maps, Instagram/WhatsApp shares or a QR code on the table. This assumption drives the mobile-first priority, so it's worth validating with real analytics if you have any.

**UNKNOWN — must come from you (nothing below will be invented)**
- URL, hosting, tech stack and source of the current site.
- Country, city and address; currency; time zone; phone; WhatsApp number.
- Opening hours; delivery area and fees; minimum order; payment methods accepted.
- Real menu: categories, items, descriptions, sizes, extras, prices, allergens, dietary tags.
- Logo files, brand colours, fonts, photography and image rights.
- How reservations are handled today, and who confirms them.
- Legal entity details (needed for legal pages in most EU jurisdictions).
- Default language, and the language staff read orders in.

---

## 2. Current system map — BLOCKED

The capabilities below are **STATED**. The *how* column fills in once I can read the code.

| Area | Stated capability | To verify in code |
|---|---|---|
| Pages | Landing page, menu, reservation, contact | Page inventory, URL structure, which are separate documents vs. JS-rendered views |
| Components | Product cards, category controls, cart | Reuse vs. copy-paste, naming, structure |
| Menu data | Categories, dishes, prices, featured flags, (sizes?) | Where it lives (inline HTML, JS array, JSON, DB, Firebase…), shape, how admin edits reach customers |
| Cart | Add/remove, quantities, price totals | State container, persistence, float vs. integer money, rounding |
| Order modes | Dine-in / takeaway / delivery | Conditional fields, validation, how mode reaches the WhatsApp message |
| WhatsApp | Order message | Message format, encoding, number source, desktop fallback |
| Reservations | Form | Where submissions go, validation, success/failure states |
| Languages | FR / EN / ES switcher | Separate URLs or client-side text swapping (critical for SEO), translation storage, `lang` attribute |
| Admin | CRUD, availability, images | **Authentication and authorization model**, storage, upload handling |
| Styling | — | CSS architecture, tokens, breakpoints, fonts |
| Assets | Food imagery | Formats, dimensions, byte sizes, ownership/rights |
| SEO / analytics / deploy | — | Metadata, structured data, sitemap, tracking scripts, hosting |

---

## 3. Skills already represented — STATED, inferred from the feature list

I've inferred these from what you say the project does. Confirming them in code
tells us where to build on your existing habits and where to correct them.

| Feature you built | Skill it demonstrates |
|---|---|
| Landing page, product cards, food imagery | HTML structure, CSS layout (flex/grid), visual hierarchy |
| Cart and quantities | Client-side state, event handling, DOM updates |
| Price totals, size pricing | Business logic, arithmetic on user selections |
| Order modes with different fields | Conditional UI, form handling |
| WhatsApp ordering | Building strings from state, URL encoding, deep links |
| Reservation form | Forms, input validation |
| FR/EN/ES switcher | Content localization |
| Admin CRUD, availability, images | CRUD interfaces, data persistence, file handling |

That's the full set of skills a small commerce product needs. The rebuild doesn't
replace these skills. It makes each one typed, tested, secure and scalable (§19).

---

## 4. Reuse matrix — PROVISIONAL (capability level)

Code-level classification is **BLOCKED**. What follows is the product-level call:
which ideas survive and why.

| Capability | Call | Why |
|---|---|---|
| Restaurant landing page | **REFACTOR** | The concept stays. The layout gets rebuilt around customer intent: food, open/closed, order, reserve, find us. |
| Menu categories | **KEEP** concept → typed content model | Categories are the backbone of the menu. They move into structured, translatable CMS data. |
| Product cards | **REFACTOR** | One `MenuItemRow` component with explicit states (available, sold out, has options, no image). |
| Food imagery | **KEEP** if real and owned · **REPLACE** stock · optimize all | Real photos sell food. Stock photos that don't show the actual product create a trust (and consumer-protection) risk. |
| Pricing | **REFACTOR** | Integer minor units (cents) and a pure, unit-tested pricing function, formatted with `Intl.NumberFormat`. |
| Size-dependent pricing | **KEEP** (confirm it exists) | Modelled as *variants*, so a single-price item is simply one variant. |
| Featured / "best-seller" | **KEEP** flag · **REFACTOR** label | "Best-seller" is a factual claim. Use "Our picks" unless sales data backs it. |
| FR / EN / ES | **KEEP** languages · implementation TBD | If the current switcher swaps text client-side, search engines index only one language → **REPLACE** with localized URLs. |
| Cart state and quantity | **KEEP** behaviour · **REFACTOR** into a reducer | Same customer behaviour, but testable, persistent and safe against stale prices. |
| Order modes | **KEEP** · **REFACTOR** | Progressive disclosure: only ask for what the chosen mode needs. |
| Table number | **KEEP** | Optionally prefilled from a table QR code (`?table=12`), if you use table QR codes. |
| Customer info, address, notes | **KEEP** · **REFACTOR** validation | Shared validation schema, accessible error messages. |
| WhatsApp checkout | **KEEP** as MVP channel · **REFACTOR** | Becomes a tested message builder behind a "notification channel" interface, so native orders can replace it later without rewriting checkout. |
| Reservation form | **KEEP** · **REFACTOR** states | It must say "request sent", never "confirmed", unless a real system confirms. |
| Phone / contact actions | **KEEP** | `tel:`, `wa.me`, map directions links. |
| Admin: categories, dishes, prices, availability, images | **KEEP** the staff workflow · mechanism likely **REPLACE** | The jobs are right. Implementing them safely (server-side auth, upload validation, audit trail) is easier with a CMS than with hand-built admin code. To confirm against the old code. |
| Search, modifiers/extras, allergens, structured data, hreflang, legal pages, tests, CI | **MISSING?** | Not mentioned in the brief. Verify whether any exist. |

---

## 5–9. Audits

None of these can produce findings until I have the site. Each one lists what I'll
check first, in priority order, and how, so the audit is reproducible.

### 5. UX audit — BLOCKED
1. **Time-to-order test:** count taps and screens from landing to WhatsApp opening, for a one-pizza takeaway order, on a 390 px viewport. This becomes the number we have to beat (§16 target: ≤ 8 on-site taps).
2. Can a first-time visitor answer "is it open, what do they serve, how much, how do I order" within the first screen?
3. Can a customer find a specific item in a long menu? Is there search or category jumping?
4. Order-mode forms: fields asked that the mode doesn't need; error recovery; what happens to the cart if WhatsApp doesn't open.
5. Reservation: does the UI ever claim a confirmation it can't guarantee?

### 6. Visual audit — BLOCKED
Things to check: type scale and number of fonts, colour consistency and contrast,
spacing rhythm, image treatment (crop, angle, lighting consistency), button
hierarchy (is "Order" visually dominant?), how recognizable the brand is beyond the
name, and template-like patterns. Each finding will come with the design reason,
not just a taste judgement.

### 7. Security audit — partially VERIFIED

**Evidence-based now:**

- **S-1 · This repository is public (VERIFIED).** Everything committed, including
  deleted files in git history, is readable by anyone.
  - Run a secret scan (e.g. `gitleaks detect`) on the old project **before** pushing it here. Look for API keys, service-account files, admin passwords and `.env` files.
  - Add a `.gitignore` covering `.env*` from the first code commit.
  - Turn on GitHub secret scanning with push protection.
  - Never commit customer data: orders, reservations, phone numbers.
  - Public business facts like address and hours are fine to commit.

**Priority checks once the code is available**, in order of how badly each one could hurt:
1. How the admin is protected. A password checked in browser JavaScript, a "hidden" URL or a client-side flag would be **critical**: anyone can bypass them.
2. Any credentials or privileged API keys shipped in front-end bundles.
3. Where admin writes go, and whether that write path is authorized server-side.
4. Image upload: type sniffing vs. trusting the file extension, size limits, storage location.
5. Untrusted text, such as dish names or customer notes, inserted into the DOM with `innerHTML` (XSS).
6. Dependency vulnerabilities (`npm audit`), and whether the site sends security headers.

### 8. Accessibility audit — BLOCKED
- **Automated:** axe-core on Home, Menu, cart open, product dialog open, checkout and reservation. Automated tools catch only part of the WCAG issues.
- **Manual (required):**
  - Keyboard-only order from landing to WhatsApp.
  - Focus visibility, and focus moving into and out of dialogs and drawers.
  - VoiceOver (iOS Safari) and TalkBack (Android Chrome) pass on the menu and checkout.
  - 200% zoom and 320 px reflow.
  - `lang` attribute changes with the language.
  - Error announcements; touch target sizes.
  - Colour-only signals, e.g. sold-out shown only as grey.

### 9. SEO audit — partially VERIFIED

**Evidence-based now:**

- **SEO-1 · Name collision (VERIFIED).** Searching "Pizza Tasty" returns several unrelated "Tasty Pizza" businesses across the UK, Belgium and the US. The brand name alone won't rank. What will:
  - Brand + city in titles and the H1 area.
  - A claimed and complete **Google Business Profile**.
  - Consistent name, address and phone everywhere (site, Google, social, delivery platforms).
  - Truthful `Restaurant` structured data.

**Priority checks once the site is available:**
1. Are FR/EN/ES separate crawlable URLs, or one URL with text swapped by JavaScript?
2. Indexability (robots, noindex, canonical), titles and descriptions, H1 per page.
3. Is the menu real HTML text, or images/PDF?
4. Existing URLs and backlinks. Every old URL that has traffic needs a 301 redirect at launch (§18).
5. Existing structured data and its accuracy.

---

## 10. Performance plan — how we establish a baseline

No numbers will be claimed until they're measured. The procedure:

1. **Field data first.** Query the PageSpeed Insights API (it includes Chrome UX Report data) for the origin and the home and menu URLs. Small restaurant sites often have **too little traffic for CrUX data**. If so, we record "no field data" rather than substituting lab numbers.
2. **Lab, repeatable.**
   - Lighthouse mobile preset, 5 runs per page, median recorded, for Home, Menu, and Menu with the cart open (a scripted user flow).
   - WebPageTest on a mid-range Android profile over 4G, from a test location near the restaurant's country.
3. **Record for each page:**
   - LCP time *and which element it is*, TBT, CLS and the shifting elements.
   - Total bytes, JS bytes, image bytes, font files, third-party requests, request count.
   - The largest image: its natural size vs. its rendered size.
4. **Interaction cost.** INP needs real interactions. Record Chrome DevTools Performance traces at 4× CPU throttling for: tapping a category, opening an item, add-to-cart, and changing a quantity.
5. **Store the raw output** (JSON and traces) in `docs/perf/baseline-YYYY-MM-DD/` so before/after comparisons are honest.
6. **After launch:** collect real-user Core Web Vitals with the `web-vitals` library (attribution build) and report p75 per page type. That's the number that matters: LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1.

**Proposed budgets for the new build.** These are targets to enforce in CI, not measurements:
- Hero/LCP image ≤ ~120 KB on mobile.
- ≤ 2 font families, variable, self-hosted and subset.
- No render-blocking third-party scripts.
- CLS 0 on menu render: every image box reserved by aspect ratio.
- Per-route JS budget set once the first route is built and measured.

---

## 11. Target experience — PROPOSED

**For the hungry customer on a phone, on mobile data:**
- The first screen answers four questions: *what food is this, is it open now, how do I order, how do I reserve or call?*
- One tap reaches the menu. One more jumps to a category, or search finds "4 fromages" by typing `4 fro`, accents optional.
- Every item shows its price up front. Items without options add in one tap with immediate, calm feedback. Items with sizes open a focused sheet with the price updating live.
- The cart is always one tap away. Checkout asks only what the chosen mode needs: a table number for dine-in, name and phone for takeaway, an address only for delivery.
- WhatsApp opens with a complete, unambiguous order the staff can act on without follow-up questions. The site is honest that the order is confirmed when Pizza Tasty replies.
- It feels **warm, fast and local**, like a confident neighbourhood pizzeria with excellent execution. Not a chain template, not fine dining.

**For staff:**
- Mark an item "sold out today" from a phone in seconds.
- Change a price once, and every language updates.
- Add a dish with photo and translations without touching code.
- Mistakes can be reverted through version history.

---

## 12. Proposed architecture — summary

The full reasoning is in [ADR-0001](../adr/0001-stack-and-content-platform.md),
status **Proposed**. It will be re-checked against the old code: if the existing
stack is strong, migration has to justify itself.

```
                ┌─────────────────────────── Next.js (App Router, TypeScript strict) ───────────────────────────┐
 Customer ──►   │ Server Components render menu/pages as static HTML  ──►  CDN cache                            │
 (browser)      │ Client islands only where state lives: cart, product sheet, search, checkout form              │
                │ Route handlers / server actions: reservation submit, CMS webhook (signature-verified)          │
                └───────────────▲───────────────────────────────────────────────────────────────┬───────────────┘
                                │ read (build + on-demand revalidation)                          │ wa.me deep link
                  ┌─────────────┴─────────────┐                                       ┌──────────▼──────────┐
 Staff ──────────►│ Headless CMS (Sanity)     │                                       │ WhatsApp (MVP       │
 (hosted login,   │ menu, prices, availability,│                                       │ checkout channel)   │
  roles)          │ images, hours, translations│                                       └─────────────────────┘
                  └───────────────────────────┘
        Later, only when native ordering is justified:  PostgreSQL ── orders, order events, reservations, payments
```

**Key decisions and why:**
- **Content and transactions are separate.** The menu is content: edited by staff, read by everyone, heavily cached. Orders are transactions: written once, must be correct and auditable. The MVP has no transactional database because WhatsApp is the order channel. Postgres comes in only when native orders do.
- **The cart stores selections, not prices.** Prices are always derived from current menu data, so a price change or a sold-out item is caught at render, not discovered by staff.
- **A pure pricing engine.** `priceLine(item, selection) → minor units` is unit-tested, and the server reuses the same function once native orders exist.
- **WhatsApp is behind a channel interface.** Checkout calls `submitOrder(order, channel)`. Today the channel builds a `wa.me` link. Later it can be "save to DB and notify via WhatsApp", without rewriting checkout.
- **The admin is the CMS Studio.** Staff authentication, roles, version history and image handling come from a maintained product instead of hand-written auth code. This is the single largest security risk reduction available.
- **Minimal dependencies.**
  - Native `<dialog>` for sheets and dialogs: browser-level focus containment and top-layer rendering.
  - CSS Modules + custom-property tokens: no UI kit, no CSS-in-JS runtime.
  - Libraries only where they earn it: `next-intl` for routing and ICU plurals, `zod` for validating untrusted input. Each dependency gets a one-line justification in the PR that adds it.

**Draft domain model**, a teaching sketch, finalized in milestone M3:

```ts
type Locale = 'fr' | 'en' | 'es';
type Localized = Partial<Record<Locale, string>>; // validation: default locale required

interface MenuItem {
  id: string;
  slug: string;
  categoryId: string;
  name: Localized;
  description?: Localized;
  image?: ImageRef;
  variants: Variant[];             // ≥ 1. A single-price item has exactly one variant.
  modifierGroupIds: string[];      // reusable groups, e.g. "Pizza extras"
  availability: 'available' | 'sold_out_today' | 'hidden';
  allergens?: AllergenCode[];      // undefined = UNKNOWN; [] = none declared. Never conflate these.
  dietary?: DietaryTag[];
  featured: boolean;
}
interface Variant       { id: string; label?: Localized; priceMinor: number }
interface ModifierGroup { id: string; name: Localized; min: number; max: number; options: ModifierOption[] }
interface ModifierOption{ id: string; name: Localized; priceDeltaMinor: number; available: boolean }
interface CartLine      { lineId: string; itemId: string; variantId: string; optionIds: string[]; quantity: number; note?: string }
```

---

## 13. Design system direction — PROPOSED, to reconcile with the existing identity

I haven't seen the current logo or colours. So the **roles** below are the real
proposal. The hex values are a candidate that I'll map onto the existing brand
colours once I see them, rather than replacing them arbitrarily.

### Concept: "Oven warmth, counter speed"
Appetite and warmth come from photography and a warm base. Speed and clarity
come from confident type, generous tap targets and a disciplined layout. One
signature move instead of decoration: **a warm, dough-coloured base with tomato
red reserved for action.** When everything that's red is something you can tap,
the colour carries meaning, not just mood.

### Colour roles (candidate values, contrast computed for WCAG 2.2)

| Token | Light | Use | Contrast check |
|---|---|---|---|
| `--surface` | `#FBF6EE` "dough" | Page background: warm, less glare than pure white | — |
| `--surface-raised` | `#FFFFFF` | Cards, sheets | — |
| `--surface-sunken` | `#F3EADB` | Section bands, input wells | — |
| `--ink` | `#1F1A17` "oven" | Body text, headings | 16.0 : 1 on surface ✅ |
| `--ink-muted` | `#5C534C` | Descriptions, meta | 7.0 : 1 on surface ✅ |
| `--brand` | `#C8321E` "tomato" | Primary buttons, active category, price emphasis | white on it 5.3 : 1 ✅ · as text on surface 5.0 : 1 ✅ |
| `--brand-strong` | `#A3271A` | Hover/pressed, small brand text | white on it 7.3 : 1 ✅ |
| `--accent` | `#F2B33D` "saffron" | Badge **fills only**, with ink text | ink on it 9.3 : 1 ✅ · **1.7 : 1 on surface ❌, never use as text or as a lone boundary** |
| `--fresh` | `#2F6B3A` "basil" | Dietary tags (vegetarian) | 5.9 : 1 on surface ✅ |
| `--border-subtle` | `#E2D6C3` | Decorative dividers only | 1.3 : 1, decorative only |
| `--border-input` | `#857868` | Input and checkbox outlines | 4.0 : 1 ✅ (≥ 3 : 1 required for UI components) |
| `--focus-ring` | `--ink` 2 px + 2 px offset | Every focusable element | 16 : 1 against surface, visible even around red buttons |
| Semantic | success / warning / danger / info | Always icon + text, never colour alone | checked at build |

Dark mode is **optional and deferred**. A candidate `--surface #171311`,
`--ink #F6EFE6`, `--brand #FF6B4F` passes contrast (6.6 : 1). But dark mode doubles
the visual QA surface, and food photography reads best on warm light backgrounds.
Decide after MVP.

### Typography (candidates, to test against real menu names and the logo)
- **Display: *Bricolage Grotesque*** (variable: weight, width, optical size). Chunky and warm with a hint of local character, and it avoids the default-SaaS look. Use it in a condensed width for category headings so long FR/ES names fit.
- **Body/UI: *Figtree*** (variable weight). Friendly and highly legible at small sizes. Both fonts cover the Latin Extended characters FR/ES need: é, è, ç, ñ, ¿, ¡.
- **Prices:** body font with `font-variant-numeric: tabular-nums` so prices align in columns. Formatted per locale with `Intl.NumberFormat`, e.g. `12,50 €` in fr/es and `€12.50` in en if the currency is EUR. **Currency unknown.**
- **Loading:** self-hosted with `next/font` (no runtime request to Google), subset, with a metric-adjusted fallback so swapping fonts doesn't shift layout.
- **Scale:** fluid with `clamp()`, ratio ~1.2 on mobile and ~1.25 on desktop. Body never below 16 px; form inputs ≥ 16 px, which also stops iOS zooming on focus.

### Spacing, radius, elevation, layering
- **Spacing:** 4 px base: `1=4 2=8 3=12 4=16 5=20 6=24 8=32 10=40 12=48 16=64 20=80`. Mobile page gutter 16 px; section rhythm 48–64 px.
- **Radius:** `sm 6` (badges, inputs) · `md 14` (cards, images) · `lg 24` (sheet top corners) · `pill` (chips, primary buttons). One personality: soft, not bubbly.
- **Shadows:** two levels, tinted warm (oven-brown at low alpha), not grey. Raised cards barely lift; sheets and dialogs lift clearly.
- **Z-index scale:**

  | Layer | z-index |
  |---|---|
  | content | 0 |
  | sticky category bar | 10 |
  | header | 20 |
  | mini-cart bar | 30 |
  | toast | 60 |

  Dialogs and sheets use the native top layer, so they need no z-index.

### Layout and breakpoints (content-driven, in `em` so they respond to zoom)
- **< 30em:** single column. Menu items are rows: text left, 96 px square image right. That's the fastest layout to scan on a phone.
- **≥ 48em:** menu rows flow into 2 columns. The cart becomes a side drawer, and the product sheet becomes a centered dialog.
- **≥ 64em:** three zones on the menu. Sticky vertical category list, item list, and a **persistent cart column**, which removes the "open cart" step on desktop.
- **≥ 80em:** content width capped (~75ch for text blocks) so lines stay readable.
- **Component-level:** `MenuItemRow` uses **container queries**. It adapts to the space it's given, not the viewport, so it works in the homepage carousel and the menu grid alike.

### Photography rules
- **Real Pizza Tasty food only.** Consistent angle per category (pizzas overhead to show toppings; burgers and sides at 30–45°), consistent warm light, and a consistent surface or background.
- **Aspect ratios:** item thumbnail 1:1 · item detail 4:3 · home hero 4:3 on mobile and 16:9 on desktop · category tile 1:1.
- **Source files** ≥ 1600 px on the long edge. The site serves AVIF/WebP at the rendered size via `srcset`/`sizes`.
- **Missing image:** a designed placeholder (brand-coloured monogram), never a broken image. The layout doesn't depend on every item having a photo.

### Motion (communicates state; never makes anyone wait)
- **Tokens:** `--dur-press 80ms` · `--dur-fast 140ms` · `--dur-base 220ms` · `--dur-sheet-in 280ms` / `--dur-sheet-out 200ms` · `--ease-out cubic-bezier(.2,0,0,1)`.
- **Add-to-cart:**
  - The button briefly shows "✓ Added".
  - The cart count does a small bump.
  - A polite live region announces "Margherita added. 2 items in cart".
  - No flying-image gimmick.
- **`prefers-reduced-motion`:** transforms off, opacity fades ≤ 100 ms, scroll-to-category jumps instead of smooth-scrolling.

### Core components (each spec covers default / hover / focus-visible / active / disabled / loading / error / keyboard / screen reader / reduced motion)

| Group | Components |
|---|---|
| Actions | `Button` (primary/secondary/ghost/icon; loading keeps its width), `Link` |
| Data entry | `QuantityStepper` (at 1, "−" becomes "Remove"), `TextField`, `Textarea`, `Select`, `RadioGroup`/`OptionCard` (sizes), `CheckboxGroup` (extras, with max limit), `SearchField` |
| Menu | `MenuItemRow`, `CategoryNav` (in-page links + scroll-spy, *not* tabs: every section stays in the document), `Badge`, `Price` |
| Overlays | `Sheet`/`Dialog` (native `<dialog>`), `CartDrawer`, `MiniCartBar` |
| Feedback | `Toast` (with undo for removals), `Alert`, `Skeleton`, `EmptyState`, `ErrorState` |
| Navigation & business info | `LanguageSwitcher` (links to the same page in each language, each with its own `lang`), `OpenStatus` |

---

## 14. New sitemap — PROPOSED

Localized slugs for the handful of public pages. Nothing is built just to look
bigger: conditional pages exist only when their content does.

| Page | FR | EN | ES | Index | Condition / purpose |
|---|---|---|---|---|---|
| Home | `/fr` | `/en` | `/es` | ✅ | Local landing page: food, status, order, reserve, find us |
| Menu | `/fr/carte` | `/en/menu` | `/es/carta` | ✅ | **The** core page: all categories in one crawlable document with anchored sections |
| Menu category | `/fr/carte/pizzas` | `/en/menu/pizzas` | `/es/carta/pizzas` | ✅ | **Only if** the menu is large (≈ 40+ items) or a category has real search demand. Otherwise anchors only, to avoid thin pages |
| Item detail | `?item=slug` on menu | | | ❌ | MVP: shareable sheet state, not separate pages. Revisit dedicated pages only for signature items with substantial content |
| Cart / checkout | `/fr/commande` | `/en/order` | `/es/pedido` | ❌ noindex | Transactional |
| Reservation | `/fr/reservation` | `/en/book-a-table` | `/es/reservas` | ✅ | If you take reservations |
| Contact & location | `/fr/contact` | `/en/contact` | `/es/contacto` | ✅ | Address, map link, hours, phone, WhatsApp, delivery area |
| Allergens | `/fr/allergenes` | `/en/allergens` | `/es/alergenos` | ✅ | Legally required in the EU for non-prepacked food (Reg. 1169/2011). Content from you only |
| Offers | `/fr/offres` | `/en/offers` | `/es/ofertas` | ✅ | **Only while real offers exist** |
| About | `/fr/a-propos` | `/en/about` | `/es/sobre-nosotros` | ✅ | Only with a real story and photos |
| FAQ | `/fr/faq` | `/en/faq` | `/es/preguntas-frecuentes` | ✅ | Only with real recurring questions (delivery area, payment, gluten-free…) |
| Legal notice | `/fr/mentions-legales` | `/en/legal-notice` | `/es/aviso-legal` | ✅ | Requirement depends on country (e.g. FR LCEN, ES LSSI) |
| Privacy | `/fr/confidentialite` | `/en/privacy` | `/es/privacidad` | ✅ | Required: forms collect personal data |
| Accessibility | `/fr/accessibilite` | `/en/accessibility` | `/es/accesibilidad` | ✅ | Statement of conformance target and contact for issues |
| Terms of sale | — | — | — | — | Only once native ordering or payment exists |
| `/` | → default locale | | | | Negotiates from `Accept-Language` plus a remembered choice. `hreflang="x-default"` points here |
| `/studio` | CMS admin | | | ❌ | Protected by CMS authentication, **not** by obscurity. Noindex, not linked |

Every indexable page carries `hreflang` alternates for fr/en/es plus `x-default`,
a self-referencing canonical, a localized title and description, one H1, and
breadcrumbs where depth > 1.

---

## 15. Mobile homepage wireframe (390 × 844 reference) — PROPOSED

Copy in `[brackets]` needs your input. Nothing factual will be invented.

```
┌────────────────────────────────────────┐
│ [logo] Pizza Tasty        FR▾  [cart 2]│  Header 56px. NOT sticky on home (saves screen).
├────────────────────────────────────────┤  Language = real links to /en, /es equivalents.
│ ┌────────────────────────────────────┐ │
│ │                                    │ │  HERO IMAGE 4:3 (~290px tall)
│ │   Real signature pizza, overhead   │ │  LCP element: priority-loaded, AVIF, ≤120KB,
│ │                                    │ │  width/height set → zero layout shift.
│ └────────────────────────────────────┘ │
│ ● Open now · until [23:00]             │  Only with real hours. Computed IN THE BROWSER
│                                        │  in the restaurant's time zone (static pages
│ H1 [Promise — your words]              │  must not cache "open/closed").
│    e.g. "Pizza Tasty — [city]"         │  Brand + city helps against the name collision.
│ Dine-in · Takeaway · Delivery          │  Confirmed modes only.
│                                        │
│ ┌────────────────────────────────────┐ │
│ │        Order now          →        │ │  PRIMARY. 52px tall, full width, brand red.
│ └────────────────────────────────────┘ │  → /menu
│ ┌───────────────────────┐ ┌──────────┐ │
│ │   Book a table        │ │  Call    │ │  Secondary (outline) + call (tel: link).
│ └───────────────────────┘ └──────────┘ │
├──────────────── fold ≈ 700px visible ──┤  Everything above answers: food? open? order? reserve?
│ H2 What are you craving?               │
│ ┌─────┐┌─────┐┌─────┐┌──             │  CATEGORY TILES: horizontal scroll-snap, 1:1
│ │ img ││ img ││ img ││ im             │  images, next tile peeks to signal scroll.
│ │Pizza││Sides││Drink││De              │  Each is a link → /menu#category.
│ └─────┘└─────┘└─────┘└──             │
│ See the full menu →                    │
├────────────────────────────────────────┤
│ H2 [Our picks]                         │  Items flagged "featured" in the CMS.
│ ┌────────────────────────────────────┐ │  "Best-sellers" only if sales data backs it.
│ │ Name                     ┌──────┐ │ │
│ │ 2-line description…      │ img  │ │ │  Same MenuItemRow component as the menu page.
│ │ from [8,50 €]            │   (+)│ │ │  (+) = Quick add, or opens sheet if options.
│ └──────────────────────────└──────┘─┘ │
│ … 3–6 items                            │
├────────────────────────────────────────┤
│ [OFFERS — only rendered if real]       │
├────────────────────────────────────────┤
│ H2 How do you want to eat?             │  Three compact cards: Dine-in / Takeaway /
│ [Dine-in] [Takeaway] [Delivery]        │  Delivery, each with REAL facts only
│  table QR?  ready in?  area · fee · min│  (delivery area, fee, minimum — or omitted).
├────────────────────────────────────────┤
│ H2 Book a table                        │  Party-size quick pick → /reservation?party=4
│ (2) (3) (4) (5) (6+)   [Continue]      │
├────────────────────────────────────────┤
│ H2 Find us                             │
│ [address]                [Directions]  │  Directions = link to maps app (no heavy
│ Hours  Mon [..]  ← today highlighted   │  embedded map iframe: bytes + third-party
│        Tue [..]                        │  cookies). Optional static map image.
│ [Call]  [WhatsApp]                     │
├────────────────────────────────────────┤
│ [Reviews — only real, linked to source]│  e.g. link to Google reviews; never copied/faked.
├────────────────────────────────────────┤
│ FOOTER: name · address · phone (NAP)   │
│ hours · socials · FR | EN | ES         │
│ allergens · legal · privacy · a11y     │
└────────────────────────────────────────┘
┌────────────────────────────────────────┐
│ 2 items · 24,50 €        View cart  →  │  MINI-CART BAR: appears only when the cart has
└────────────────────────────────────────┘  items. Fixed bottom, safe-area aware, 56px.
```

**Desktop adaptation:**
- The hero splits into text and CTA on the left, image on the right (16:9).
- Category tiles become a full row.
- "Our picks" becomes a 3-column grid of the same component.
- Find us shows the hours table beside the address.

---

## 16. Mobile menu wireframe — PROPOSED

```
┌────────────────────────────────────────┐
│ [logo]   Menu        [search] [cart 2] │  Header 56px; scrolls away.
├────────────────────────────────────────┤
│ Takeaway ▾   · [Open until 23:00]      │  Order mode (changeable). Delivery shows area/fee
├────────────────────────────────────────┤  only if known.
│ (Pizzas)(Calzones)(Sides)(Drinks)(De…  │  STICKY CATEGORY BAR (z 10): <nav> of in-page
├────────────────────────────────────────┤  links. Active chip = brand fill + underline
│ H2 Pizzas                              │  (not colour alone), auto-scrolled into view.
│ [optional one-line category note]      │  Tap → jump to section; focus moves to its H2.
│ ┌────────────────────────────────────┐ │
│ │ H3 Margherita            ┌──────┐ │ │  MENU ITEM ROW (whole row opens sheet):
│ │ [description, 2 lines]   │ 1:1  │ │ │  - name, 2-line clamp description
│ │ from 8,50 €  [Veg]       │  (+) │ │ │  - price ("from" when variants differ)
│ └──────────────────────────└──────┘─┘ │  - factual badges only (Veg from CMS data)
│ ┌────────────────────────────────────┐ │  - (+) 44×44: adds directly if no required
│ │ H3 [Item]                ┌──────┐ │ │    options; otherwise opens the sheet.
│ │ …                        │ img  │ │ │
│ │ 10,00 €  Sold out today  │      │ │ │  SOLD OUT: stays in place (spatial memory),
│ └──────────────────────────└──────┘─┘ │  text label + muted image, no (+). Not grey-only.
│ …                                      │
│ H2 Drinks                              │
│ …                                      │
├────────────────────────────────────────┤
│ Allergen info → · Prices incl. [tax]   │
└────────────────────────────────────────┘
┌────────────────────────────────────────┐
│ 2 items · 24,50 €        View cart  →  │  MINI-CART BAR
└────────────────────────────────────────┘
```

**Search (tap the search icon):**
- The field expands under the header. Filtering is client-side over the already-loaded menu: instant, no network.
- Matching is accent-insensitive (`creme` finds "crème") and uses the current language.
- Results are grouped by category. A polite live region announces "4 results".
- **Empty state:** "No match for 'xyz'", plus links to the categories.

**Product sheet** (native `<dialog>` as a bottom sheet; centered dialog ≥ 48em):

```
┌────────────────────────────────────────┐
│ [image 4:3]                     [ × ]  │  Close button first in focus order after title.
│ H2 Margherita                          │  Esc closes; focus returns to the row's button.
│ [full description]                     │
│ Allergens: [from CMS] · or "Ask staff" │  If allergens unknown → say so, NEVER "none".
│                                        │
│ Size (required)                        │  <fieldset><legend>; radio cards; price per
│ ( ) Medium            8,50 €           │  option; error tied via aria-describedby; on
│ ( ) Large            12,00 €           │  submit without a choice, focus moves here.
│                                        │
│ Extras (up to 3)                       │  Checkboxes; at max, the rest are disabled WITH
│ [ ] [Extra]          + 1,50 €          │  the reason announced ("Maximum 3 reached").
│                                        │
│ Note for the kitchen (optional)        │  Only if enabled for this item.
│ [______________________]               │
├────────────────────────────────────────┤
│  [ − ] 1 [ + ]    [ Add · 12,00 € ]    │  STICKY FOOTER; total updates live.
└────────────────────────────────────────┘
```

---

## 17. Order flow — PROPOSED

```
Landing ─► Menu ─► (category / search) ─► Item
                                           │
                    no required options ───┼─── required options
                          │                │          │
                     Quick add             │     Product sheet ─► Add
                          └──────────► CART ◄─────────┘
                                         │  lines · options · qty · line totals · subtotal
                                         ▼
                                  Choose order mode
          ┌──────────────────────────────┼───────────────────────────────┐
     Dine-in                         Takeaway                         Delivery
     table no. (prefill from QR)     name · phone                     name · phone · address
                                     [pickup time, if offered]        [zone check, fee — if known]
          └──────────────────────────────┼───────────────────────────────┘
                                         ▼
                            Review (order note optional)
                     "Your order is confirmed when Pizza Tasty replies."
                                         ▼
                           [ Send order on WhatsApp ]  ─── fallbacks: Copy order text · Call
                                         ▼
                 Return screen: "Did your message send?"
                    [Yes — clear my cart]   [No — back to my order]
```

**Why the cart isn't cleared on tap:** the site can't know whether the message was
actually sent. WhatsApp might not be installed, or the customer might back out.
Clearing on tap would lose their order.

**WhatsApp message spec.** Plain text, no emoji. Built by a pure, unit-tested function:

```
NEW ORDER — Pizza Tasty            ← labels in staff language (Q: which?)
Ref: PT-7K3Q                       ← short client-generated ref, helps spot duplicate sends
Mode: Delivery
Customer language: EN              ← so staff reply in the right language
--------------------
2 × {item} ({variant})   {line total}
    + {option}
1 × {item}               {line total}
--------------------
Subtotal: {subtotal}
Delivery: {fee | "to be confirmed"}
Total: {total}
--------------------
Name: {name}
Phone: {phone}
Address: {street, no., building/floor, landmark}
Note: {note}
```

- **URL:** `https://wa.me/<international number, digits only>?text=<encodeURIComponent(message)>`.
- **Trust:** the customer can edit the text before sending, so a WhatsApp total is **never authoritative**. That's fine for an MVP where staff confirm. It's also exactly why native ordering will need server-side price validation.
- **Privacy:** the message carries personal data to WhatsApp. Analytics receive only `{mode, item_count, value}`, never names, phones or addresses.

**Edge states designed up front:**

| Situation | What happens |
|---|---|
| Item became sold out after adding | Cart line flagged, checkout blocked until removed |
| Price changed since adding | Cart shows the current price (prices are derived, not stored) |
| Menu failed to load | Retry button, plus Call/WhatsApp as fallbacks |
| Empty cart | Link back to the menu |
| Invalid phone or address | Inline error with a fix-it hint |
| Double tap on "Send" | Same ref reused; idempotent link |
| Slow network | Skeleton rows with reserved size |

**Reservation flow (MVP):**
1. Form fields: name, phone, date, time, party size, optional note.
2. Validation is shared between client and server.
3. Hours are checked only once real hours exist.
4. Hand-off goes to WhatsApp or email.
5. The success screen says **"Request sent — not yet confirmed. Pizza Tasty will confirm by [channel]."**
6. The server route is rate-limited and has a honeypot field against spam.

---

## 18. Migration plan — PROPOSED

1. **Intake.** Get the old source, URL, hosting access and an admin data export ([intake.md](./intake.md)). Scan it for secrets before it goes into this public repo.
2. **Capture the old site.**
   - Crawl every URL → `docs/migration/url-inventory.csv`, which becomes the redirect map.
   - Screenshot each page at 390 / 768 / 1280 px.
   - Export the menu data.
   - Record the exact current WhatsApp message.
   - Run the performance baseline (§10) and record the time-to-order tap count (§5).
3. **Complete the Phase 1 audits** (§2, §4–§9) and update ADR-0001. If the old stack is strong, the plan changes here.
4. **Content migration.**
   - A one-time import script maps old data into the CMS schema.
   - An automated diff report compares item counts, every price and every availability flag; you sign it off.
   - Translations are reviewed by a human, not just copied.
5. **Build in parallel** on a preview URL. **The old site stays live and untouched.**
6. **Parity checklist.** Every capability in brief §2 maps to a passing test or a signed-off manual check before cutover.
7. **Cutover.**
   - Point the domain at the new site.
   - 301 redirects from the old URLs, e.g. `/menu.html` → `/fr/carte`.
   - Submit the sitemap in Search Console.
   - Update the Google Business Profile website and menu links.
   - **Rollback = repoint DNS** to the old hosting, which stays archived for at least 30 days.
8. **After launch.** Real-user CWV, error monitoring, WhatsApp-checkout rate compared with the baseline, 404 log reviewed weekly for missed redirects.

---

## 19. Learning roadmap — existing skill → professional pattern

| You already did | You'll learn | Milestone |
|---|---|---|
| Landing page HTML/CSS | Landmarks and heading outline, design tokens with CSS custom properties, fluid type with `clamp()`, container queries, logical properties | M2 |
| Product cards from data | TypeScript interfaces and discriminated unions, React components and props, Server vs. Client Components | M3–M4 |
| Menu stored somewhere | Content modelling, headless CMS, static generation and cache revalidation, signed webhooks | M3, M10 |
| Cart + quantities | Reducer pattern, pure functions, **money as integer cents** (why `0.1 + 0.2 !== 0.3`), unit testing, versioned `localStorage` | M5–M6 |
| Size pricing | Variants and modifier rules (min/max), deriving totals instead of storing them | M5 |
| Order-mode forms | Discriminated-union form state, progressive disclosure, schema validation shared by client and server, accessible error messages | M6 |
| WhatsApp link | URL encoding, deep links, the **adapter pattern** (swap channel without touching checkout) | M7 |
| Reservation form | Server actions and HTTP, time zones, rate limiting, honest async UI states | M9 |
| Admin CRUD | **Authentication vs. authorization**, RBAC, why client-side checks are not security, audit trails | M10 |
| Image upload | Responsive images (`srcset`/`sizes`), AVIF/WebP, CDNs, upload validation | M4, M10 |
| Language switch | i18n routing, ICU plurals, `Intl` formatting, `hreflang`, the `lang` attribute | M3, M11 |
| Deploying a site | Git branching, CI (typecheck/lint/test/build), preview deployments, secrets management | M1 |
| (new) | SEO structured data, analytics event design, Core Web Vitals, WCAG testing | M11–M13 |
| (later) | PostgreSQL, SQL, transactions, idempotency, payment webhooks | Post-MVP |

---

## 20. Implementation roadmap — small, reviewable milestones

The brief's order puts the homepage before the menu. **I recommend the menu first.**
The homepage is assembled from menu components (category tiles, item rows) and
needs real content and photos. Building the menu first turns the homepage into
composition, not a separate design exercise.

| # | Milestone | Done when | Blocked by |
|---|---|---|---|
| **M0** | Intake + baseline + Phase 1 audit | Audits in this doc filled with evidence; ADR-0001 accepted or revised | **Your inputs** |
| M1 | Foundation | Next.js + TS strict, lint/format, Vitest, Playwright + axe, GitHub Actions CI, preview deploy, `.gitignore`/secret scanning | Hosting decision (ADR) |
| M2 | Tokens, type, layout primitives, Button/Link/Icon | Dev-only style-guide route renders every state; contrast checks pass | Brand assets (or proceed with candidate palette) |
| M3 | Content model + i18n routing | CMS schema for Restaurant, Hours, Category, MenuItem, ModifierGroup; fr/en/es routes with hreflang; fixture data **clearly marked as non-real** | — |
| M4 | Menu: one production-quality category | Rows, sticky nav, search, sold-out/empty/error/loading states, keyboard + screen-reader pass | Real data for one category |
| M5 | Product sheet + pricing engine | Variants and modifiers with min/max rules; pricing unit tests | — |
| M6 | Cart + order modes + checkout forms | Reducer tests; persistence; stale/sold-out handling; progressive disclosure | — |
| M7 | WhatsApp checkout | Message-builder tests per locale; fallbacks; return-screen flow; E2E test asserts the generated URL | WhatsApp number, staff language |
| M8 | Homepage | Composed from M4–M6 components; real hours and status | Photos, copy, hours |
| M9 | Reservations | Honest states; rate limiting; hand-off channel | Reservation policy |
| M10 | CMS Studio for staff | Roles; "sold out today" toggle usable on a phone; webhook revalidation with signature check | — |
| M11 | SEO | Metadata, sitemap, robots, Restaurant + Menu JSON-LD **from CMS facts only** | Business facts |
| M12 | Analytics | Event spec (trigger, params, purpose, data class, consent) **before** any tracking code | Jurisdiction → consent model |
| M13 | Audits | Manual a11y (keyboard, VoiceOver, TalkBack, zoom), performance vs. budgets, security headers/CSP, cross-browser/device matrix | — |
| M14 | Migration cutover | §18 steps 6–8 | — |
| Later | Native orders (Postgres), payments, order status, promotions, accounts, loyalty | Each only when MVP data shows the need | — |

---

## 21. What I need from you to continue

Everything is listed in **[intake.md](./intake.md)**. The three that unblock the most:

1. **The existing site:** its URL, plus the source code (zip, repo, or hosting access).
2. **Country, city, currency, and the WhatsApp number** orders go to.
3. **The real menu** in any form (photo of the printed menu, spreadsheet, admin export).
