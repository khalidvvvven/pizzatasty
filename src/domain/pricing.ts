import type { Cents, Menu, ModifierGroup, Product, Selection } from './types';

export interface MenuIndex {
  menu: Menu;
  product: (id: string) => Product | undefined;
  group: (id: string) => ModifierGroup | undefined;
}

export function indexMenu(menu: Menu): MenuIndex {
  const products = new Map(menu.products.map((p) => [p.id, p]));
  const groups = new Map(menu.modifierGroups.map((g) => [g.id, g]));
  return { menu, product: (id) => products.get(id), group: (id) => groups.get(id) };
}

export const groupsFor = (idx: MenuIndex, product: Product): ModifierGroup[] =>
  (product.modifierGroupIds ?? []).map((id) => idx.group(id)).filter((g): g is ModifierGroup => !!g);

export function limitsFor(group: ModifierGroup, variantId: string) {
  return group.limitsByVariant?.[variantId] ?? { min: group.min, max: group.max };
}

/** Lowest price a customer can pay for this product ("from 9,50 €"). */
export function startingPrice(idx: MenuIndex, product: Product): Cents {
  return Math.min(
    ...product.variants.map((v) => {
      // Required modifiers add their cheapest options to the floor price.
      const required = groupsFor(idx, product).reduce((sum, g) => {
        const { min } = limitsFor(g, v.id);
        if (!min) return sum;
        const cheapest = g.options.map((o) => o.price).sort((a, b) => a - b).slice(0, min);
        return sum + cheapest.reduce((s, p) => s + p, 0);
      }, 0);
      return v.price + required;
    }),
  );
}

/** "from" is only shown when the price can actually change (two same-price variants don't count). */
export const hasPriceRange = (idx: MenuIndex, product: Product) =>
  new Set(product.variants.map((v) => v.price)).size > 1 || groupsFor(idx, product).some((g) => g.options.some((o) => o.price > 0));

/** Unit price for a configured product. Unknown variants/options contribute nothing (they're rejected by validate). */
export function unitPrice(idx: MenuIndex, product: Product, sel: Pick<Selection, 'variantId' | 'optionIds'>): Cents {
  const variant = product.variants.find((v) => v.id === sel.variantId);
  const options = groupsFor(idx, product).flatMap((g) => g.options);
  const extras = sel.optionIds.reduce((sum, id) => sum + (options.find((o) => o.id === id)?.price ?? 0), 0);
  return (variant?.price ?? 0) + extras;
}

export type SelectionError = { groupId: string; kind: 'min' | 'max'; limit: number };

/** Checks a selection against the product's rules. Empty array = valid. */
export function validateSelection(idx: MenuIndex, product: Product, sel: Pick<Selection, 'variantId' | 'optionIds'>): SelectionError[] {
  const errors: SelectionError[] = [];
  for (const g of groupsFor(idx, product)) {
    const { min, max } = limitsFor(g, sel.variantId);
    const count = sel.optionIds.filter((id) => g.options.some((o) => o.id === id)).length;
    if (count < min) errors.push({ groupId: g.id, kind: 'min', limit: min });
    if (count > max) errors.push({ groupId: g.id, kind: 'max', limit: max });
  }
  return errors;
}

/** Drops options that exceed a group's limit after a size change (e.g. XL → M tacos keeps the first meat). */
export function clampSelection(idx: MenuIndex, product: Product, sel: Pick<Selection, 'variantId' | 'optionIds'>): string[] {
  const kept: string[] = [];
  for (const g of groupsFor(idx, product)) {
    const { max } = limitsFor(g, sel.variantId);
    kept.push(...sel.optionIds.filter((id) => g.options.some((o) => o.id === id)).slice(0, max));
  }
  return kept;
}

/** Default selection: first available variant, plus single-choice required groups pre-filled. */
export function defaultSelection(idx: MenuIndex, product: Product): Pick<Selection, 'variantId' | 'optionIds'> {
  const variantId = product.variants[0]!.id;
  const optionIds = groupsFor(idx, product)
    .filter((g) => {
      const l = limitsFor(g, variantId);
      return l.min === 1 && l.max === 1;
    })
    .map((g) => g.options.find((o) => o.available !== false)?.id)
    .filter((id): id is string => !!id);
  return { variantId, optionIds };
}

/** Quick add is only offered when the default selection is already valid and needs no decision. */
export const canQuickAdd = (idx: MenuIndex, product: Product) =>
  product.available &&
  product.variants.length === 1 &&
  groupsFor(idx, product).every((g) => limitsFor(g, product.variants[0]!.id).min === 0);
