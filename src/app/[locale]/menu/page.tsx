import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MenuBrowser } from '@/components/menu/MenuBrowser';
import { getDictionary, isLocale } from '@/i18n';
import styles from './page.module.css';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getDictionary(locale).menu.title };
}

export default async function MenuPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  return (
    <div className={`container ${styles.page}`}>
      <header className={styles.head}>
        <h1 className={styles.title}>{dict.menu.title}</h1>
        <p className={styles.lead}>{dict.menu.lead}</p>
      </header>
      <MenuBrowser />
    </div>
  );
}
