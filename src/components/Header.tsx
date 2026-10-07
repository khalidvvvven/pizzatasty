'use client';

import { Menu as MenuIcon, ShoppingBag, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { plural } from '@/i18n';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Logo } from './Logo';
import { OpenStatus } from './OpenStatus';
import { useCart, useI18n, useUi } from './providers/AppProviders';
import { Sheet } from './Sheet';
import styles from './Header.module.css';

export function Header() {
  const { locale, dict } = useI18n();
  const { totals, hydrated, addTick } = useCart();
  const { openCart } = useUi();
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close the mobile nav whenever the route changes.
  useEffect(() => setNavOpen(false), [pathname]);

  const links = [
    { href: `/${locale}/menu`, label: dict.common.menu },
    { href: `/${locale}/reservation`, label: dict.common.reserve },
    { href: `/${locale}#contact`, label: dict.common.contact },
  ];
  const count = hydrated ? totals.itemCount : 0;
  const cartLabel = plural(locale, count, { one: dict.common.cartWithCount_one, other: dict.common.cartWithCount_other });

  return (
    <header className={`${styles.header} ${scrolled ? styles.scrolled : ''}`}>
      <div className={`container ${styles.bar}`}>
        <button type="button" className={`icon-btn ${styles.navToggle}`} aria-label={dict.common.openNav} onClick={() => setNavOpen(true)}>
          <MenuIcon size={24} aria-hidden />
        </button>

        <Link href={`/${locale}`} className={styles.brand} aria-label={`Pizza Tasty — ${dict.common.home}`}>
          <Logo />
        </Link>

        <nav className={styles.nav} aria-label="Navigation">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={styles.navLink} aria-current={pathname === l.href ? 'page' : undefined}>
              {l.label}
            </Link>
          ))}
        </nav>

        <div className={styles.actions}>
          <span className={styles.status}>
            <OpenStatus />
          </span>
          <span className={styles.lang}>
            <LanguageSwitcher />
          </span>
          <button type="button" className={styles.cartBtn} onClick={() => openCart()} aria-label={cartLabel}>
            <span key={addTick} className={addTick ? styles.bump : undefined}>
              <ShoppingBag size={22} aria-hidden />
            </span>
            {count > 0 && (
              <span className={styles.count} aria-hidden="true">
                {count}
              </span>
            )}
          </button>
          <Link href={`/${locale}/menu`} className={`btn btn-primary ${styles.orderBtn}`}>
            {dict.common.order}
          </Link>
        </div>
      </div>

      <Sheet open={navOpen} onClose={() => setNavOpen(false)} labelledBy="mobile-nav-title" className={styles.navSheet}>
        <div className={styles.navSheetHead}>
          <h2 id="mobile-nav-title" className="visually-hidden">
            Navigation
          </h2>
          <Logo />
          <button type="button" className="icon-btn" aria-label={dict.common.close} onClick={() => setNavOpen(false)}>
            <X size={24} aria-hidden />
          </button>
        </div>
        <nav className={styles.navSheetLinks} aria-label="Navigation">
          <Link href={`/${locale}`} className={styles.navSheetLink} onClick={() => setNavOpen(false)}>
            {dict.common.home}
          </Link>
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={styles.navSheetLink} onClick={() => setNavOpen(false)}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className={styles.navSheetFoot}>
          <OpenStatus />
          <LanguageSwitcher />
          <Link href={`/${locale}/menu`} className="btn btn-primary btn-block btn-lg" onClick={() => setNavOpen(false)}>
            {dict.common.order}
          </Link>
        </div>
      </Sheet>
    </header>
  );
}
