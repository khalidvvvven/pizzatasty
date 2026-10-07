import type { CartState, Totals } from './cart';
import { formatMoney } from './money';
import { groupsFor, unitPrice, type MenuIndex } from './pricing';
import type { CheckoutDetails, Locale, OrderMode } from './types';

/** Labels are in the STAFF's language: the kitchen reads this message, not the customer. */
const LABELS: Record<Locale, { heading: string; ref: string; mode: string; lang: string; table: string; name: string; phone: string; address: string; extra: string; note: string; kitchenNote: string; subtotal: string; delivery: string; free: string; total: string; modes: Record<OrderMode, string> }> = {
  fr: { heading: 'NOUVELLE COMMANDE', ref: 'Réf.', mode: 'Mode', lang: 'Langue client', table: 'Table', name: 'Nom', phone: 'Tél.', address: 'Adresse', extra: 'Complément', note: 'Note', kitchenNote: 'Note cuisine', subtotal: 'Sous-total', delivery: 'Livraison', free: 'offerte', total: 'TOTAL', modes: { 'dine-in': 'Sur place', takeaway: 'À emporter', delivery: 'Livraison' } },
  en: { heading: 'NEW ORDER', ref: 'Ref.', mode: 'Mode', lang: 'Customer language', table: 'Table', name: 'Name', phone: 'Phone', address: 'Address', extra: 'Details', note: 'Note', kitchenNote: 'Kitchen note', subtotal: 'Subtotal', delivery: 'Delivery', free: 'free', total: 'TOTAL', modes: { 'dine-in': 'Dine in', takeaway: 'Takeaway', delivery: 'Delivery' } },
  es: { heading: 'NUEVO PEDIDO', ref: 'Ref.', mode: 'Modo', lang: 'Idioma del cliente', table: 'Mesa', name: 'Nombre', phone: 'Tel.', address: 'Dirección', extra: 'Detalles', note: 'Nota', kitchenNote: 'Nota cocina', subtotal: 'Subtotal', delivery: 'Envío', free: 'gratis', total: 'TOTAL', modes: { 'dine-in': 'En el local', takeaway: 'Para llevar', delivery: 'A domicilio' } },
};

const RULE = '--------------------';

export interface OrderMessageInput {
  idx: MenuIndex;
  cart: CartState;
  totals: Totals;
  ref: string;
  restaurantName: string;
  staffLocale: Locale;
  customerLocale: Locale;
  currency: string;
}

/** Plain-text order for WhatsApp. No emoji or markdown: it must read cleanly on any phone. */
export function buildOrderMessage({ idx, cart, totals, ref, restaurantName, staffLocale, customerLocale, currency }: OrderMessageInput): string {
  const t = LABELS[staffLocale];
  const money = (c: number) => formatMoney(c, staffLocale, currency);
  const d: CheckoutDetails = cart.details;
  const out: string[] = [`${t.heading} — ${restaurantName}`, `${t.ref} ${ref}`, `${t.mode} : ${t.modes[cart.mode]}`];
  if (customerLocale !== staffLocale) out.push(`${t.lang} : ${customerLocale.toUpperCase()}`);
  out.push(RULE);

  for (const line of cart.lines) {
    const product = idx.product(line.productId);
    if (!product || !product.available) continue;
    const variant = product.variants.find((v) => v.id === line.variantId);
    const size = product.variants.length > 1 && variant ? ` (${variant.label[staffLocale]})` : '';
    out.push(`${line.quantity} × ${product.name[staffLocale]}${size} — ${money(unitPrice(idx, product, line) * line.quantity)}`);
    for (const g of groupsFor(idx, product)) {
      const chosen = g.options.filter((o) => line.optionIds.includes(o.id)).map((o) => o.label[staffLocale]);
      if (chosen.length) out.push(`   • ${g.label[staffLocale]} : ${chosen.join(', ')}`);
    }
    if (line.note?.trim()) out.push(`   • ${t.kitchenNote} : ${line.note.trim()}`);
  }

  out.push(RULE, `${t.subtotal} : ${money(totals.subtotal)}`);
  if (cart.mode === 'delivery') out.push(`${t.delivery} : ${totals.deliveryFee ? money(totals.deliveryFee) : t.free}`);
  out.push(`${t.total} : ${money(totals.total)}`, RULE);

  if (cart.mode === 'dine-in') out.push(`${t.table} : ${d.table.trim()}`);
  if (d.name.trim()) out.push(`${t.name} : ${d.name.trim()}`);
  if (d.phone.trim()) out.push(`${t.phone} : ${d.phone.trim()}`);
  if (cart.mode === 'delivery') {
    out.push(`${t.address} : ${d.address.trim()}`);
    if (d.addressExtra.trim()) out.push(`${t.extra} : ${d.addressExtra.trim()}`);
  }
  if (d.note.trim()) out.push(`${t.note} : ${d.note.trim()}`);
  return out.join('\n');
}

/** wa.me expects the international number as digits only, with no "+" or leading zeros. */
export function whatsappUrl(number: string, message: string): string {
  return `https://wa.me/${number.replace(/\D/g, '').replace(/^0+/, '')}?text=${encodeURIComponent(message)}`;
}

const REF_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/L: easy to read aloud
export function newOrderRef(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return 'PT-' + Array.from(bytes, (b) => REF_ALPHABET[b % REF_ALPHABET.length]).join('');
}
