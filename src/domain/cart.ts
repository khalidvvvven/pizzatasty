import { indexMenu, unitPrice, type MenuIndex } from './pricing';
import type { Cents, CartLine, CheckoutDetails, OrderMode, Selection } from './types';

export interface CartState {
  lines: CartLine[];
  mode: OrderMode;
  details: CheckoutDetails;
}

export const emptyDetails: CheckoutDetails = { table: '', name: '', phone: '', address: '', addressExtra: '', note: '' };
export const initialCart: CartState = { lines: [], mode: 'takeaway', details: emptyDetails };

export type CartAction =
  | { type: 'add'; productId: string; selection: Selection }
  | { type: 'replace'; lineId: string; selection: Selection }
  | { type: 'quantity'; lineId: string; quantity: number }
  | { type: 'remove'; lineId: string }
  | { type: 'restore-line'; line: CartLine; index: number }
  | { type: 'mode'; mode: OrderMode }
  | { type: 'details'; patch: Partial<CheckoutDetails> }
  | { type: 'clear' }
  | { type: 'hydrate'; state: CartState };

const MAX_QTY = 20;
const clampQty = (q: number) => Math.max(1, Math.min(MAX_QTY, Math.round(q)));
const sameConfig = (a: Omit<Selection, 'quantity'> & { productId: string }, b: Omit<Selection, 'quantity'> & { productId: string }) =>
  a.productId === b.productId &&
  a.variantId === b.variantId &&
  (a.note ?? '') === (b.note ?? '') &&
  [...a.optionIds].sort().join() === [...b.optionIds].sort().join();

let counter = 0;
const newLineId = () => `l${Date.now().toString(36)}${(counter++).toString(36)}`;

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'add': {
      const incoming = { productId: action.productId, ...action.selection };
      const existing = state.lines.find((l) => sameConfig(l, incoming));
      if (existing) {
        return { ...state, lines: state.lines.map((l) => (l === existing ? { ...l, quantity: clampQty(l.quantity + incoming.quantity) } : l)) };
      }
      return { ...state, lines: [...state.lines, { lineId: newLineId(), ...incoming, quantity: clampQty(incoming.quantity) }] };
    }
    case 'replace':
      return { ...state, lines: state.lines.map((l) => (l.lineId === action.lineId ? { ...l, ...action.selection, quantity: clampQty(action.selection.quantity) } : l)) };
    case 'quantity':
      return { ...state, lines: state.lines.map((l) => (l.lineId === action.lineId ? { ...l, quantity: clampQty(action.quantity) } : l)) };
    case 'remove':
      return { ...state, lines: state.lines.filter((l) => l.lineId !== action.lineId) };
    case 'restore-line': {
      const lines = [...state.lines];
      lines.splice(Math.min(action.index, lines.length), 0, action.line);
      return { ...state, lines };
    }
    case 'mode':
      return { ...state, mode: action.mode };
    case 'details':
      return { ...state, details: { ...state.details, ...action.patch } };
    case 'clear':
      return { ...state, lines: [], details: { ...state.details, note: '' } };
    case 'hydrate':
      // Saved carts carry no personal details, so keep whatever this tab already has.
      return { ...action.state, details: state.details };
  }
}

export interface DeliveryRules {
  fee: Cents;
  freeFrom: Cents;
  minimumOrder: Cents;
}

export interface Totals {
  itemCount: number;
  subtotal: Cents;
  deliveryFee: Cents;
  total: Cents;
  /** Lines whose product no longer exists or is sold out. Checkout is blocked while any exist. */
  unavailableLineIds: string[];
  belowDeliveryMinimum: boolean;
}

export function computeTotals(idx: MenuIndex, state: CartState, delivery: DeliveryRules): Totals {
  let subtotal = 0;
  let itemCount = 0;
  const unavailableLineIds: string[] = [];
  for (const line of state.lines) {
    const product = idx.product(line.productId);
    if (!product || !product.available) {
      unavailableLineIds.push(line.lineId);
      continue;
    }
    subtotal += unitPrice(idx, product, line) * line.quantity;
    itemCount += line.quantity;
  }
  const isDelivery = state.mode === 'delivery';
  const deliveryFee = isDelivery && itemCount > 0 && subtotal < delivery.freeFrom ? delivery.fee : 0;
  return {
    itemCount,
    subtotal,
    deliveryFee,
    total: subtotal + deliveryFee,
    unavailableLineIds,
    belowDeliveryMinimum: isDelivery && itemCount > 0 && subtotal < delivery.minimumOrder,
  };
}

/**
 * Persisted shape is versioned so a future change can't crash an old visitor's saved cart.
 * Only lines and mode are saved: name, phone and address never touch localStorage.
 */
const STORAGE_VERSION = 1;
export const STORAGE_KEY = 'pizzatasty.cart';

export function serializeCart(state: CartState): string {
  return JSON.stringify({ v: STORAGE_VERSION, state: { lines: state.lines, mode: state.mode } });
}

export function deserializeCart(raw: string | null, menuIdx: MenuIndex): CartState | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as { v?: number; state?: CartState };
    if (data.v !== STORAGE_VERSION || !data.state || !Array.isArray(data.state.lines)) return null;
    const lines = data.state.lines.filter(
      (l) => typeof l.lineId === 'string' && menuIdx.product(l.productId) && Number.isFinite(l.quantity) && Array.isArray(l.optionIds),
    );
    const mode: OrderMode = ['dine-in', 'takeaway', 'delivery'].includes(data.state.mode) ? data.state.mode : 'takeaway';
    return { lines, mode, details: emptyDetails };
  } catch {
    return null;
  }
}

export { indexMenu };
