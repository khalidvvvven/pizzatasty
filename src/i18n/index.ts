import { LOCALES, type Locale } from '@/domain/types';
import { en } from './dictionaries/en';
import { es } from './dictionaries/es';
import { fr, type Dictionary } from './dictionaries/fr';

export type { Dictionary };
export { LOCALES };

const DICTIONARIES: Record<Locale, Dictionary> = { fr, en, es };

export const isLocale = (v: string): v is Locale => (LOCALES as readonly string[]).includes(v);
export const getDictionary = (locale: Locale): Dictionary => DICTIONARIES[locale];

export const LOCALE_NAMES: Record<Locale, string> = { fr: 'Français', en: 'English', es: 'Español' };

/** Replace {name} placeholders. */
export function fill(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
}

/**
 * Pick `key_one` / `key_other` with the language's real plural rules (French treats 0 as singular, English doesn't).
 */
export function plural(locale: Locale, count: number, forms: { one: string; other: string }): string {
  const rule = new Intl.PluralRules(locale).select(count);
  return fill(rule === 'one' ? forms.one : forms.other, { count });
}
