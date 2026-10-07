'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LOCALES, LOCALE_NAMES } from '@/i18n';
import { useI18n } from './providers/AppProviders';
import styles from './LanguageSwitcher.module.css';

/** Real links to the same page in each language (crawlable, and each name is announced in its own language). */
export function LanguageSwitcher({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const { locale, dict } = useI18n();
  const router = useRouter();
  const pathname = usePathname() ?? `/${locale}`;
  const rest = pathname.replace(/^\/(fr|en|es)(?=\/|$)/, '');

  // The href stays a plain, crawlable link; on click we also carry the query and section anchor
  // over (e.g. ?guests=5 or #tacos) so the visitor stays exactly where they were.
  const go = (href: string) => (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    router.push(`${href}${window.location.search}${window.location.hash}`); // scrolls to the #section, or to the top
  };
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
          onClick={go(`/${l}${rest}`)}
        >
          {l.toUpperCase()}
        </Link>
      ))}
    </nav>
  );
}
