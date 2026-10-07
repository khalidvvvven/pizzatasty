'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LOCALES, LOCALE_NAMES } from '@/i18n';
import { useI18n } from './providers/AppProviders';
import styles from './LanguageSwitcher.module.css';

/** Real links to the same page in each language (crawlable, and each name is announced in its own language). */
export function LanguageSwitcher({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const { locale, dict } = useI18n();
  const pathname = usePathname() ?? `/${locale}`;
  const rest = pathname.replace(/^\/(fr|en|es)(?=\/|$)/, '');
  return (
    <nav aria-label={dict.common.language} className={`${styles.switcher} ${tone === 'dark' ? styles.dark : ''}`}>
      {LOCALES.map((l) => (
        <Link
          key={l}
          href={`/${l}${rest}`}
          hrefLang={l}
          lang={l}
          aria-current={l === locale ? 'true' : undefined}
          aria-label={LOCALE_NAMES[l]}
          className={styles.item}
          scroll={false}
        >
          {l.toUpperCase()}
        </Link>
      ))}
    </nav>
  );
}
