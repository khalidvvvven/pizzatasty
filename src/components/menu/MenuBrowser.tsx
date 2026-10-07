'use client';

import { Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { searchProducts } from '@/domain/search';
import { fill, plural } from '@/i18n';
import { CartPanel } from '../cart/CartPanel';
import { ModeSelector } from '../cart/ModeSelector';
import { ProductCard } from '../ProductCard';
import { useCart, useI18n } from '../providers/AppProviders';
import styles from './MenuBrowser.module.css';

export function MenuBrowser() {
  const { locale, dict } = useI18n();
  const { idx } = useCart();
  const { categories, products } = idx.menu;
  const [query, setQuery] = useState('');
  // Filtering ~30 items is instant, so no deferred value: results always match what was typed.
  const searching = query.trim().length > 0;
  const results = useMemo(() => (searching ? searchProducts(products, categories, query, locale) : products), [searching, products, categories, query, locale]);
  const [active, setActive] = useState(categories[0]?.id ?? '');
  const chipsRef = useRef<HTMLDivElement>(null);
  const clickScrolling = useRef(false);

  // Scroll-spy: highlight the category whose section is under the sticky bars.
  useEffect(() => {
    if (searching) return;
    const sections = categories.map((c) => document.getElementById(c.id)).filter((el): el is HTMLElement => !!el);
    const observer = new IntersectionObserver(
      (entries) => {
        if (clickScrolling.current) return;
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: '-140px 0px -55% 0px', threshold: 0 },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [categories, searching]);

  // Keep the active chip visible inside the horizontal chip rail (without moving the page).
  useEffect(() => {
    const rail = chipsRef.current;
    const chip = rail?.querySelector<HTMLElement>(`[data-cat="${active}"]`);
    if (!rail || !chip) return;
    const left = chip.offsetLeft - rail.clientWidth / 2 + chip.clientWidth / 2;
    rail.scrollTo({ left, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [active]);

  const goTo = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    // Clear the search synchronously so the target section exists before we scroll to it.
    if (query) flushSync(() => setQuery(''));
    setActive(id);
    clickScrolling.current = true;
    const target = document.getElementById(id);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    history.replaceState(null, '', `#${id}`);
    // Move focus to the section heading so keyboard and screen-reader users land there too.
    target?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
    window.setTimeout(() => (clickScrolling.current = false), reduce ? 50 : 700);
  };

  const byCategory = categories.map((c) => ({ category: c, items: results.filter((p) => p.categoryId === c.id) })).filter((g) => g.items.length);

  return (
    <div className={styles.layout}>
      <div className={styles.main}>
        <div className={styles.top}>
          <div className={styles.searchWrap}>
            <label htmlFor="menu-search" className="visually-hidden">
              {dict.menu.searchLabel}
            </label>
            <Search size={20} className={styles.searchIcon} aria-hidden />
            <input
              id="menu-search"
              type="search"
              className={styles.search}
              placeholder={dict.menu.searchPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
              enterKeyHint="search"
            />
            {query && (
              <button type="button" className={styles.clear} onClick={() => setQuery('')} aria-label={dict.menu.clearSearch}>
                <X size={18} aria-hidden />
              </button>
            )}
          </div>
          <div className={styles.modeMobile}>
            <ModeSelector compact />
          </div>
        </div>

        <nav className={`${styles.catbar} ${searching ? styles.catbarDim : ''}`} aria-label={dict.menu.categories}>
          <div className={styles.chips} ref={chipsRef}>
            {categories.map((c) => (
              <a key={c.id} href={`#${c.id}`} data-cat={c.id} className={styles.chip} aria-current={!searching && active === c.id ? 'true' : undefined} onClick={goTo(c.id)}>
                <span className={styles.chipArt} style={{ background: c.tint }} aria-hidden="true">
                  <img src={c.image} alt="" width={28} height={28} />
                </span>
                {c.name[locale]}
              </a>
            ))}
          </div>
        </nav>

        <p className={styles.resultCount} role="status" aria-live="polite">
          {searching ? plural(locale, results.length, { one: dict.menu.results_one, other: dict.menu.results_other }) : ''}
        </p>

        {searching && results.length === 0 && (
          <div className={styles.noResults}>
            <img src="/food/pizza-choco-banane.svg" alt="" width={120} height={120} />
            <p className={styles.noResultsTitle}>{fill(dict.menu.noResults, { q: query.trim() })}</p>
            <p>{dict.menu.noResultsHint}</p>
            <button type="button" className="btn btn-dark" onClick={() => setQuery('')}>
              {dict.menu.clearSearch}
            </button>
          </div>
        )}

        {byCategory.map(({ category, items }) => (
          <section key={category.id} id={category.id} className={styles.section} aria-labelledby={`h-${category.id}`}>
            <div className={styles.sectionHead}>
              <h2 id={`h-${category.id}`} className={styles.sectionTitle} tabIndex={-1}>
                {category.name[locale]}
              </h2>
              <p className={styles.sectionTagline}>{category.tagline[locale]}</p>
            </div>
            <div className={styles.grid}>
              {items.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        ))}
      </div>
      <div className={styles.side}>
        <CartPanel />
      </div>
    </div>
  );
}
