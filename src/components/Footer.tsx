import Link from 'next/link';
import type { Locale } from '@/domain/types';
import type { Dictionary } from '@/i18n';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Logo } from './Logo';
import styles from './Footer.module.css';

export function Footer({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  return (
    <footer className={`${styles.footer} on-dark`}>
      <div className={`container ${styles.grid}`}>
        <div className={styles.brand}>
          <Logo tone="cream" />
          <p className={styles.tagline}>{dict.footer.tagline}</p>
          <LanguageSwitcher tone="dark" />
        </div>
        <nav aria-labelledby="footer-explore">
          <h2 id="footer-explore" className={styles.heading}>
            {dict.footer.explore}
          </h2>
          <ul className={styles.list}>
            <li>
              <Link href={`/${locale}/menu`}>{dict.common.menu}</Link>
            </li>
            <li>
              <Link href={`/${locale}/reservation`}>{dict.common.reserve}</Link>
            </li>
            <li>
              <Link href={`/${locale}#contact`}>{dict.common.contact}</Link>
            </li>
          </ul>
        </nav>
        <div>
          <h2 className={styles.heading}>{dict.footer.info}</h2>
          {/* Placeholders: these pages depend on the restaurant's country and legal entity (UNKNOWN). */}
          <ul className={styles.list}>
            <li>
              <span className={styles.pending}>{dict.footer.allergens}</span>
            </li>
            <li>
              <span className={styles.pending}>{dict.footer.legal}</span>
            </li>
            <li>
              <span className={styles.pending}>{dict.footer.privacy}</span>
            </li>
          </ul>
        </div>
      </div>
      <div className={`container ${styles.bottom}`}>
        <p className={styles.disclaimer}>
          <span className="demo-pill">{dict.common.demo}</span> {dict.footer.disclaimer}
        </p>
        <p className={styles.copy}>© {new Date().getFullYear()} Pizza Tasty</p>
      </div>
    </footer>
  );
}
