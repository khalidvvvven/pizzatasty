import { describe, expect, it } from 'vitest';
import { demoMenu } from '@/content/demo/menu';
import { cartReducer, computeTotals, deserializeCart, emptyDetails, initialCart, serializeCart, type CartState } from './cart';
import { openStatus, reservationSlots, type WeeklyHours } from './hours';
import { buildOrderMessage, whatsappUrl } from './order-message';
import { canQuickAdd, clampSelection, defaultSelection, indexMenu, startingPrice, unitPrice, validateSelection } from './pricing';
import { searchProducts } from './search';
import { isValidPhone, validateCheckout } from './validation';

const idx = indexMenu(demoMenu);
const p = (id: string) => idx.product(id)!;
const delivery = { fee: 250, freeFrom: 2500, minimumOrder: 1500 };
const sel = (variantId: string, optionIds: string[] = [], quantity = 1, note?: string) => ({ variantId, optionIds, quantity, note });

describe('pricing', () => {
  it('adds size and paid options in integer cents', () => {
    expect(unitPrice(idx, p('margherita'), sel('mega', ['crust-stuffed', 'x-chevre', 'x-olives']))).toBe(1450 + 250 + 150 + 100);
  });

  it('starting price includes the cheapest required options', () => {
    expect(startingPrice(idx, p('tacos-classique'))).toBe(750);
    expect(startingPrice(idx, p('cheeseburger'))).toBe(890);
  });

  it('enforces size-dependent limits (tacos L = exactly 2 meats)', () => {
    const tacos = p('tacos-classique');
    expect(validateSelection(idx, tacos, sel('l', ['m-poulet', 's-algerienne']))).toEqual([{ groupId: 'tacos-meats', kind: 'min', limit: 2 }]);
    expect(validateSelection(idx, tacos, sel('l', ['m-poulet', 'm-merguez', 's-algerienne']))).toEqual([]);
  });

  it('drops extra meats when the size shrinks', () => {
    expect(clampSelection(idx, p('tacos-classique'), sel('m', ['m-poulet', 'm-merguez', 'm-hachee', 's-bbq']))).toEqual(['m-poulet', 's-bbq']);
  });

  it('only asks for a meal drink when the burger is ordered as a meal', () => {
    const burger = p('cheeseburger');
    expect(validateSelection(idx, burger, sel('solo'))).toEqual([]);
    expect(validateSelection(idx, burger, sel('menu'))).toEqual([{ groupId: 'menu-drink', kind: 'min', limit: 1 }]);
    expect(unitPrice(idx, burger, sel('menu', ['d-limonade']))).toBe(890 + 350 + 100);
  });

  it('pre-selects single-choice required options', () => {
    expect(defaultSelection(idx, p('margherita'))).toEqual({ variantId: 'senior', optionIds: ['crust-classic'] });
  });

  it('offers quick add only when no decision is needed', () => {
    expect(canQuickAdd(idx, p('panini-poulet'))).toBe(true);
    expect(canQuickAdd(idx, p('americain'))).toBe(true);
    expect(canQuickAdd(idx, p('margherita'))).toBe(false); // sizes
    expect(canQuickAdd(idx, p('saumon'))).toBe(false); // sold out
  });
});

describe('cart', () => {
  const add = (s: CartState, productId: string, selection: ReturnType<typeof sel>) => cartReducer(s, { type: 'add', productId, selection });

  it('merges identical configurations and keeps different ones apart', () => {
    let s = add(initialCart, 'margherita', sel('senior', ['crust-classic', 'x-olives']));
    s = add(s, 'margherita', sel('senior', ['x-olives', 'crust-classic'], 2));
    expect(s.lines).toHaveLength(1);
    expect(s.lines[0]!.quantity).toBe(3);
    s = add(s, 'margherita', sel('senior', ['crust-classic'], 1, 'bien cuite'));
    expect(s.lines).toHaveLength(2);
  });

  it('clamps quantities to 1–20', () => {
    let s = add(initialCart, 'cola', sel('33'));
    const id = s.lines[0]!.lineId;
    s = cartReducer(s, { type: 'quantity', lineId: id, quantity: 0 });
    expect(s.lines[0]!.quantity).toBe(1);
    s = cartReducer(s, { type: 'quantity', lineId: id, quantity: 99 });
    expect(s.lines[0]!.quantity).toBe(20);
  });

  it('undo restores a removed line at its original position', () => {
    let s = add(initialCart, 'cola', sel('33'));
    s = add(s, 'eau', sel('std'));
    s = add(s, 'brownie', sel('std'));
    const removed = s.lines[1]!;
    s = cartReducer(s, { type: 'remove', lineId: removed.lineId });
    s = cartReducer(s, { type: 'restore-line', line: removed, index: 1 });
    expect(s.lines.map((l) => l.productId)).toEqual(['cola', 'eau', 'brownie']);
  });

  it('computes delivery fee, free-delivery threshold and minimum order', () => {
    let s: CartState = { ...add(initialCart, 'cola', sel('33')), mode: 'delivery' };
    let t = computeTotals(idx, s, delivery);
    expect([t.subtotal, t.deliveryFee, t.total, t.belowDeliveryMinimum]).toEqual([250, 250, 500, true]);
    s = add(s, 'margherita', sel('mega', ['crust-classic'], 2));
    t = computeTotals(idx, s, delivery);
    expect([t.subtotal, t.deliveryFee, t.total, t.belowDeliveryMinimum]).toEqual([3150, 0, 3150, false]);
    expect(computeTotals(idx, { ...s, mode: 'takeaway' }, delivery).deliveryFee).toBe(0);
  });

  it('excludes and flags sold-out items', () => {
    const s = add(initialCart, 'saumon', sel('senior', ['crust-classic']));
    const t = computeTotals(idx, s, delivery);
    expect(t.subtotal).toBe(0);
    expect(t.unavailableLineIds).toEqual([s.lines[0]!.lineId]);
  });

  it('never persists personal details, and rejects foreign data', () => {
    const s: CartState = { ...add(initialCart, 'cola', sel('33')), details: { ...emptyDetails, name: 'Ana', phone: '0612345678' } };
    const raw = serializeCart(s);
    expect(raw).not.toContain('Ana');
    expect(raw).not.toContain('0612345678');
    expect(deserializeCart(raw, idx)?.lines).toHaveLength(1);
    expect(deserializeCart('{"v":99,"state":{}}', idx)).toBeNull();
    expect(deserializeCart('not json', idx)).toBeNull();
    const ghost = JSON.stringify({ v: 1, state: { lines: [{ lineId: 'x', productId: 'deleted-dish', variantId: 'a', optionIds: [], quantity: 1 }], mode: 'takeaway' } });
    expect(deserializeCart(ghost, idx)?.lines).toEqual([]);
  });

  it('keeps details typed in this tab when another tab syncs the cart', () => {
    const typed = cartReducer(initialCart, { type: 'details', patch: { name: 'Ana' } });
    const synced = cartReducer(typed, { type: 'hydrate', state: { ...initialCart, mode: 'delivery' } });
    expect(synced.details.name).toBe('Ana');
    expect(synced.mode).toBe('delivery');
  });
});

describe('WhatsApp order message', () => {
  const base = cartReducer(initialCart, { type: 'add', productId: 'tacos-classique', selection: sel('l', ['m-poulet', 'm-merguez', 's-algerienne'], 2, 'sans oignons') });

  it('is written in the staff language with the customer language flagged', () => {
    const cart: CartState = { ...base, mode: 'delivery', details: { ...emptyDetails, name: 'Ana', phone: '06 12 34 56 78', address: '1 rue X, Ville' } };
    const msg = buildOrderMessage({ idx, cart, totals: computeTotals(idx, cart, delivery), ref: 'PT-TEST', restaurantName: 'Pizza Tasty', staffLocale: 'fr', customerLocale: 'en', currency: 'EUR' });
    expect(msg).toContain('NOUVELLE COMMANDE — Pizza Tasty');
    expect(msg).toContain('Langue client : EN');
    expect(msg).toContain('2 × Tacos Classique (L) — 19,00');
    expect(msg).toContain('• Viandes : Poulet mariné, Merguez');
    expect(msg).toContain('• Note cuisine : sans oignons');
    expect(msg).toContain('Livraison : 2,50');
    expect(msg).toContain('Adresse : 1 rue X, Ville');
  });

  it('asks only for the table on dine-in', () => {
    const cart: CartState = { ...base, mode: 'dine-in', details: { ...emptyDetails, table: '12' } };
    const msg = buildOrderMessage({ idx, cart, totals: computeTotals(idx, cart, delivery), ref: 'PT-TEST', restaurantName: 'Pizza Tasty', staffLocale: 'fr', customerLocale: 'fr', currency: 'EUR' });
    expect(msg).toContain('Table : 12');
    expect(msg).not.toContain('Adresse');
    expect(msg).not.toContain('Langue client');
  });

  it('builds a wa.me link with digits only and an encoded message', () => {
    expect(whatsappUrl('+33 6 12 34 56 78', 'A & B\nC')).toBe('https://wa.me/33612345678?text=A%20%26%20B%0AC');
  });
});

describe('opening hours', () => {
  const hours = {
    0: [['18:00', '23:00']],
    1: [], 2: [], 3: [['11:30', '14:30'], ['18:00', '23:00']], 4: [], 5: [], 6: [['11:30', '00:00']],
  } as unknown as WeeklyHours;
  const tz = 'Europe/Paris'; // UTC+2 in early October 2026

  it('is open during service and reports closing time', () => {
    expect(openStatus(hours, new Date('2026-10-07T10:00:00Z'), tz)).toEqual({ open: true, closesAt: '14:30' }); // Wed 12:00
  });

  it('finds the next opening between services', () => {
    expect(openStatus(hours, new Date('2026-10-07T13:00:00Z'), tz)).toEqual({ open: false, opensAt: { day: 3, time: '18:00' } }); // Wed 15:00
  });

  it('handles a service ending at midnight', () => {
    expect(openStatus(hours, new Date('2026-10-10T21:30:00Z'), tz)).toEqual({ open: true, closesAt: '00:00' }); // Sat 23:30
    expect(openStatus(hours, new Date('2026-10-11T00:30:00Z'), tz)).toEqual({ open: false, opensAt: { day: 0, time: '18:00' } }); // Sun 02:30
  });

  it('uses the restaurant time zone, not the visitor’s', () => {
    // 09:45 UTC is 11:45 in Paris (open) even though it is 05:45 in New York.
    expect(openStatus(hours, new Date('2026-10-07T09:45:00Z'), tz).open).toBe(true);
  });

  it('builds reservation slots up to an hour before closing', () => {
    expect(reservationSlots(hours, 0)).toEqual(['18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00']);
    expect(reservationSlots(hours, 1)).toEqual([]);
    expect(reservationSlots(hours, 6).at(-1)).toBe('23:00');
  });
});

describe('validation & search', () => {
  it('accepts real phone formats and rejects typos', () => {
    for (const ok of ['06 12 34 56 78', '+33 6 12 34 56 78', '(212) 555-0199', '+212.6.12.34.56.78']) expect(isValidPhone(ok)).toBe(true);
    for (const bad of ['123', 'abc 12345678', '+33 6 12 34 56 78 90 12 34', '']) expect(isValidPhone(bad)).toBe(false);
  });

  it('asks each order mode only for what it needs', () => {
    expect(Object.keys(validateCheckout('dine-in', emptyDetails))).toEqual(['table']);
    expect(Object.keys(validateCheckout('takeaway', emptyDetails))).toEqual(['name', 'phone']);
    expect(Object.keys(validateCheckout('delivery', emptyDetails))).toEqual(['name', 'phone', 'address']);
    expect(validateCheckout('dine-in', { ...emptyDetails, table: '0' })).toEqual({ table: 'table' });
  });

  it('search ignores accents and case, per language', () => {
    expect(searchProducts(demoMenu.products, demoMenu.categories, 'CREME', 'fr').map((x) => x.id)).toContain('saumon');
    expect(searchProducts(demoMenu.products, demoMenu.categories, 'jamon', 'es').map((x) => x.id)).toContain('reine');
    expect(searchProducts(demoMenu.products, demoMenu.categories, 'zzzz', 'en')).toEqual([]);
  });
});
