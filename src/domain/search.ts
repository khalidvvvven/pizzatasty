import type { Category, Locale, Product } from './types';

/** Lowercase and strip accents so "creme" finds "Crème" and "jamon" finds "jamón". */
export const normalize = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export function searchProducts(products: Product[], categories: Category[], query: string, locale: Locale): Product[] {
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  if (!tokens.length) return products;
  const catName = new Map(categories.map((c) => [c.id, c.name[locale]]));
  return products.filter((p) => {
    const haystack = normalize(`${p.name[locale]} ${p.description[locale]} ${catName.get(p.categoryId) ?? ''}`);
    return tokens.every((t) => haystack.includes(t));
  });
}
