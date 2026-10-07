export const LOCALES = ['fr', 'en', 'es'] as const;
export type Locale = (typeof LOCALES)[number];

/** Every customer-facing string in content exists in all three languages. */
export type Localized = Record<Locale, string>;

/** Money is always integer cents. Never floats: 0.1 + 0.2 !== 0.3. */
export type Cents = number;

export interface Category {
  id: string;
  name: Localized;
  tagline: Localized;
  image: string;
  /** Backdrop tint behind food art for this category. */
  tint: string;
}

export interface Variant {
  id: string;
  label: Localized;
  detail?: Localized;
  price: Cents;
}

export interface ModifierOption {
  id: string;
  label: Localized;
  price: Cents;
  available?: boolean;
}

export interface ModifierGroup {
  id: string;
  label: Localized;
  min: number;
  max: number;
  /** Some limits depend on the size, e.g. French tacos M/L/XL = 1/2/3 meats. */
  limitsByVariant?: Record<string, { min: number; max: number }>;
  options: ModifierOption[];
}

export type Badge = 'popular' | 'new' | 'spicy' | 'veggie';

export interface Product {
  id: string;
  categoryId: string;
  name: Localized;
  description: Localized;
  image: string;
  /** At least one. A single-price item has exactly one variant. */
  variants: Variant[];
  modifierGroupIds?: string[];
  badges?: Badge[];
  available: boolean;
  featured?: boolean;
  allowNote?: boolean;
  /** undefined = unknown. Never display "no allergens" for unknown data. */
  allergens?: Localized;
}

export interface Menu {
  categories: Category[];
  products: Product[];
  modifierGroups: ModifierGroup[];
}

export type OrderMode = 'dine-in' | 'takeaway' | 'delivery';

/** What the customer chose for one product. Prices are never stored: they're derived from the menu. */
export interface Selection {
  variantId: string;
  optionIds: string[];
  quantity: number;
  note?: string;
}

export interface CartLine extends Selection {
  lineId: string;
  productId: string;
}

export interface CheckoutDetails {
  table: string;
  name: string;
  phone: string;
  address: string;
  addressExtra: string;
  note: string;
}
