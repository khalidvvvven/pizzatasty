// Global tokens and base styles must load before any component CSS module so modules can override them.
import '../globals.css';
import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Figtree } from 'next/font/google';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { CartSheet } from '@/components/cart/CartSheet';
import { MiniCartBar } from '@/components/cart/MiniCartBar';
import { DemoBar } from '@/components/DemoBar';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { ProductSheet } from '@/components/ProductSheet';
import { AppProviders } from '@/components/providers/AppProviders';
import { demoMenu } from '@/content/demo/menu';
import { getDictionary, isLocale, LOCALES } from '@/i18n';

// Self-hosted at build time by next/font: no request to Google from visitors' browsers.
const display = Bricolage_Grotesque({ subsets: ['latin', 'latin-ext'], axes: ['wdth'], variable: '--font-bricolage', display: 'swap' });
const body = Figtree({ subsets: ['latin', 'latin-ext'], variable: '--font-figtree', display: 'swap' });

export const dynamicParams = false;
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#C8321E',
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  return {
    title: { default: dict.meta.title, template: `%s · Pizza Tasty` },
    description: dict.meta.description,
    // Prototype with fictional content: keep it out of search results.
    robots: { index: false, follow: false },
    alternates: { languages: Object.fromEntries(LOCALES.map((l) => [l, `/${l}`])) },
    icons: { icon: '/icon.svg' },
  };
}

export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);

  return (
    <html lang={locale} className={`${display.variable} ${body.variable}`}>
      <body>
        <AppProviders locale={locale} dict={dict} menu={demoMenu}>
          <a href="#main" className="skip-link">
            {dict.common.skip}
          </a>
          <DemoBar text={dict.demoBar} label={dict.common.demo} />
          <Header />
          <main id="main" tabIndex={-1} style={{ outline: 'none' }}>
            {children}
          </main>
          <Footer locale={locale} dict={dict} />
          <MiniCartBar />
          <ProductSheet />
          <CartSheet />
        </AppProviders>
      </body>
    </html>
  );
}
