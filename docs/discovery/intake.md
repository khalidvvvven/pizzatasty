# Pizza Tasty — Discovery Intake

Everything here is something I won't invent. Answer in any form: chat, voice note
transcript, photos, spreadsheet. "Don't know" and "doesn't apply" are useful answers too.

> ⚠️ **This repository is public.** Don't commit passwords, API keys, admin
> credentials, or customer data (orders, phone numbers). Send secrets through your
> hosting provider's environment-variable settings, never through git. Public
> business facts like address, hours and menu are fine to commit.

---

## A. The existing project (unblocks the whole audit)

- [x] **A1. Live URL:** https://www.pizzatasty.online/ (confirmed 2026-10-07).
- [ ] **A1b. Network access.** Add `www.pizzatasty.online` and `pizzatasty.online` to this cloud environment's allowed domains: session title bar → cloud environment menu → Edit → Network access → Allowed domains, keeping **Allow package managers** ticked ([docs](https://code.claude.com/docs/en/cloud-environments#network-access)). This is the single step that unblocks the audit. A new session may be needed for it to apply.
- [ ] **A2. Source code.** Which GitHub repository deploys pizzatasty.online? If it's one of yours, I can add it to the session read-only. Otherwise push it to a branch here *after* a secret scan, or send a zip.
- [ ] **A3. Hosting.** VERIFIED via DNS: **Vercel**, in an account *other than* the one connected to this session, with DNS managed at **Spaceship**. Still needed: which Vercel account or team owns the project, which plan it's on, and who owns the domain registration.
- [ ] **A4. Admin.** How do staff log in today, and where are menu edits saved?
- [ ] **A5. Data export** of the current menu from the admin, if possible.
- [ ] **A6b. PageSpeed Insights API key** (optional, free from Google Cloud). Lets me pull Google's own lab measurements and any real-user (CrUX) data for the site.
- [ ] **A6. Analytics.** Any Google Analytics, Search Console, or Google Business Profile access? Even rough numbers (orders per week via WhatsApp) help set a baseline.

## B. Business facts

**Identity**
- [ ] **B1. Exact name** as on signage and legal registration: `Pizza Tasty`, `PizzaTasty`, `Pizza Tasty's`…?
  - The English word order is unusual (English usually puts the adjective first, as in "Tasty Pizza"). I'm **not** suggesting a change, only confirming it's intentional so the wordmark and structured data match exactly.
  - Do customers also call it "Tasty Pizza"?
- [ ] B2. Logo files (SVG preferred), brand colours, fonts, and any brand guidelines.
- [ ] B3. One or two sentences on what makes Pizza Tasty different, in your words.

**Location and contact**
- [ ] B4. Country, city, full street address, postcode.
- [ ] B5. Phone number(s). **WhatsApp number** for orders, if different.
- [ ] B6. Time zone, if not obvious from the address.
- [ ] B7. Opening hours per day, including split shifts and holiday closures.
- [ ] B8. Social media links. Google Business Profile link.

**Ordering**
- [ ] B9. Which modes are actually offered today: dine-in / takeaway / delivery?
- [ ] B10. Delivery: area (neighbourhoods, radius or postcodes), fee, minimum order, typical time. Only what you're comfortable promising.
- [ ] B11. Takeaway: can customers choose a pickup time, or is it always "as soon as possible"?
- [ ] B12. Dine-in: are there table numbers? QR codes on tables?
- [ ] B13. Payment methods accepted (cash, card on delivery, card in store, online?).
- [ ] B14. **Currency**, and whether menu prices include tax.
- [ ] B15. Which language do staff read orders in? Should the WhatsApp message use that language for item names?

**Menu**
- [ ] B16. Full menu: categories, items, descriptions, prices.
- [ ] B17. Sizes and their prices; extras/toppings and their prices; limits (e.g. max 3 extras).
- [ ] B18. **Allergens** per item, if you have them. If you don't, the site will say "ask our staff", never "none".
- [ ] B19. Dietary tags you can stand behind (vegetarian, halal, spicy…).
- [ ] B20. Which items you want featured. Do you have sales data for genuine "best-sellers"?
- [ ] B21. Food photos you own, and whether a photo shoot is possible. Photography is the biggest single lever for appetite.
- [ ] B22. Current offers or promotions, with their conditions and end dates.

**Reservations**
- [ ] B23. Do you take reservations? Maximum party size? How far ahead?
- [ ] B24. Who confirms them, and through which channel (WhatsApp, phone, email)?

**Legal**
- [ ] B25. Legal entity name, registration number and address. Most EU countries require these in a legal notice.
- [ ] B26. Any existing privacy policy or cookie banner.

**Reviews**
- [ ] B27. Where your real reviews live (Google, TripAdvisor…). They'll be linked to the source, never copied out of context or invented.

## C. Decisions that are yours

- [ ] **C1. Default language** and the order of the language switcher.
- [ ] **C2. Hosting.** Your Vercel team is on the Hobby plan, which Vercel restricts to non-commercial personal use. For a restaurant, choose between a paid Vercel plan, another host whose terms allow commercial use, or the restaurant owning its own hosting account. See [ADR-0001](../adr/0001-stack-and-content-platform.md).
- [ ] **C3. Who owns the accounts:** domain, hosting, CMS. Ideally the restaurant owns them and you're invited as a developer.
- [ ] **C4. Analytics appetite:** none, privacy-friendly cookieless, or Google Analytics (which needs a consent banner in the EU).
- [ ] C5. Dark mode: defer (recommended) or include in MVP?
