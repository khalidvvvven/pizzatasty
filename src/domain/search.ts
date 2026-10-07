import type { Category, Locale, Product } from './types';

/**
 * Lowercase, strip accents and fold ligatures/punctuation so "creme" finds "Crème", "oeuf" finds
 * "Œuf" and "jus d'orange" (straight apostrophe) finds "Jus d’orange".
 */
export const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

export function searchProducts(products: Product[], categories: Category[], query: string, locale: Locale): Product[] {
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  if (!tokens.length) return products;
  const catName = new Map(categories.map((c) => [c.id, c.name[locale]]));
  return products.filter((p) => {
    const haystack = normalize(`${p.name[locale]} ${p.description[locale]} ${catName.get(p.categoryId) ?? ''}`);
    return tokens.every((t) => haystack.includes(t));
  });
}
