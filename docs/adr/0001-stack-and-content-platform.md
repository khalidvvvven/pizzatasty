# ADR-0001 — Stack and content platform

| | |
|---|---|
| **Status** | **Proposed.** To be re-evaluated once the existing site's code has been inspected (see [discovery §0](../discovery/README.md#0-what-was-inspected-and-what-was-found)). |
| **Date** | 2026-10-07 |
| **Deciders** | Owner (you), with this recommendation |

## Context

- **The current code hasn't been seen.** The existing product is https://www.pizzatasty.online/.
  - DNS shows it's **hosted on Vercel**, in an account this session isn't connected to.
  - This environment's network allowlist blocks the site itself (discovery §0.1).
  - So this ADR can't yet judge whether the existing stack deserves to stay. Option A below exists for exactly that judgement.
- **The product needs:**
  - A fast, crawlable, multilingual (fr/en/es) menu.
  - A client-side cart with variants and modifiers.
  - WhatsApp checkout for the MVP.
  - A reservation request form.
  - A staff admin for menu, prices, availability, images and hours.
  - A clean path to native orders and payments later.
- **Team:** one developer who is learning, so operational load and security surface must stay small.
- **Evidence from the connected Vercel account:**
  - The developer already deploys **Next.js and Vite** projects there, which matters for familiarity and migration cost.
  - The team is on the **Hobby** plan, which Vercel restricts to non-commercial personal use. That makes hosting a decision in its own right.

## Requirements this decision must satisfy

1. Menu pages ship as static HTML: fast LCP, fully crawlable, with localized URLs and `hreflang`.
2. Interactive JavaScript only where state lives: cart, product sheet, search, forms.
3. Staff can edit content without code, behind **server-side authentication and authorization**.
4. Image pipeline: responsive sizes and modern formats from a single upload.
5. Content changes go live within about a minute, without a manual redeploy.
6. Domain logic (pricing, cart, WhatsApp message) is independent of the vendor and unit-testable.
7. Adding Postgres-backed orders later doesn't require rewriting the front end.

## Options

**A. Keep and evolve the existing stack.**
Can't be assessed yet. It wins if the audit finds the current code well structured
and the main gap is design and UX. It loses if the admin relies on browser-side
protection, or if languages aren't separate URLs and retrofitting them costs more
than rebuilding.

**B. Next.js (App Router) + TypeScript + Sanity (hosted headless CMS).**

**C. Next.js + Payload CMS (open source, runs inside the Next.js app) + PostgreSQL.**

**D. Astro + headless CMS (Sanity or similar), with React or Preact islands for the cart.**

| Criterion | B · Next + Sanity | C · Next + Payload + Postgres | D · Astro + CMS |
|---|---|---|---|
| Dev complexity | Medium | Medium–high (schema, migrations, storage adapter) | Medium (islands need cross-island cart state) |
| Ops complexity | **Low.** No database to run; CMS is hosted | **Higher.** You own the DB, backups, upload storage and patching | Low (with a hosted CMS) |
| Admin security | **Hosted login and roles.** No auth code of ours on the public internet | Built-in auth and access-control functions; we configure and maintain them | Same as the chosen CMS |
| Performance | Good: Server Components ship no JS for static parts; client islands for cart | Same front end as B; admin adds server weight but not public JS | **Best default JS weight**: zero JS unless opted in |
| SEO / i18n | Strong: static generation, `generateMetadata`, `next-intl` localized pathnames | Same as B; Payload has built-in field localization | Strong: built-in i18n routing |
| Vendor lock-in | Medium: content in Sanity, exportable with `sanity dataset export` | **Low**: open source, your own Postgres | Medium (CMS-dependent) |
| Cost model | Hosted CMS free/paid tiers plus hosting. **Check current quotas and terms; no prices assumed here** | Hosting + managed Postgres + object storage | Hosting + CMS |
| Path to native orders | Add Postgres later: two systems (content in Sanity, transactions in Postgres) | **One database** for content and orders | Add a backend later |
| Learning value | Headless CMS, GROQ, webhooks, caching. Postgres arrives later, when needed | Postgres, SQL, migrations, access control from day one | Islands architecture; less transferable to the React job market |
| Migration from an unknown old site | Import script into the CMS | Import script into Postgres | Import script into the CMS |

## Decision (proposed)

**Option B: Next.js App Router + TypeScript strict + Sanity.** For the MVP:

- **No transactional database**, because WhatsApp is the order channel.
- **Postgres is introduced in the post-MVP "native orders" milestone**, behind the existing `submitOrder` channel interface.

Why B over C: for a one-developer restaurant site, the riskiest part is the admin.
B removes our own authentication code and database operations from the critical
path while keeping every domain concept typed and portable.

Why B over D: Astro would likely ship less JavaScript. But the cart, product sheet,
search and checkout form are a large, shared-state interactive surface, and the
developer already works in React and Next.js. If the performance budgets in
discovery §10 are missed and the overrun is traced to the framework, this
trade-off gets revisited.

**What would change the decision:**

| If… | Then… |
|---|---|
| The audit shows the existing stack is sound | **A** |
| The owner requires that all data live on infrastructure they control, or native ordering is expected soon after launch, or the old admin already uses Postgres | **C** |
| Measured JS cost blows the performance budgets | **D** |

**Hosting (sub-decision, owner input required):** Vercel Hobby isn't suitable for
a commercial restaurant site under Vercel's terms. The options are:
- a Vercel paid plan,
- Cloudflare via the OpenNext adapter (verify current feature support), or
- Netlify.

Ideally the account is owned by the restaurant. **Verify current terms and pricing
before choosing. This ADR doesn't assume any prices.**

## Consequences

**Good**
- Static menu pages from a CDN.
- Staff editing with version history.
- No hand-rolled authentication.
- Typed domain logic testable without the CMS.

**Costs**
- A SaaS dependency for content.
- Two data systems once native orders arrive.
- Plan limits (users, roles, API usage) must be checked against the restaurant's needs.

**Obligations**
- CMS write tokens exist only server-side.
- The revalidation webhook verifies its signature.
- Content read in the browser is limited to published, public data.

## Reversal strategy

- **One door to the CMS.** All CMS access goes through one module, `src/lib/content/`, which returns **our own domain types** (`MenuItem`, `Category`, …). Components never import the CMS client directly.
- **Domain logic doesn't know the CMS exists.** Pricing, cart, the WhatsApp message builder and validation have no CMS imports.
- **Switching B → C:** write a new `src/lib/content/` implementation backed by Payload/Postgres and migrate the data from `sanity dataset export` output. The components don't change.
- **Switching hosts:** keep the app free of host-specific APIs except behind small adapters (image loader, revalidation), so a hosting move is configuration, not a rewrite.
