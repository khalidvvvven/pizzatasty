import type { Cents, Locale } from './types';

const INTL_LOCALE: Record<Locale, string> = { fr: 'fr-FR', en: 'en-GB', es: 'es-ES' };
const cache = new Map<string, Intl.NumberFormat>();

export function formatMoney(cents: Cents, locale: Locale, currency: string): string {
  const key = `${locale}:${currency}`;
  let fmt = cache.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat(INTL_LOCALE[locale], { style: 'currency', currency });
    cache.set(key, fmt);
  }
  return fmt.format(cents / 100);
}

export const intlLocale = (locale: Locale) => INTL_LOCALE[locale];
