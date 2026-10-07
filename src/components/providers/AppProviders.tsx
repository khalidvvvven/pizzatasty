'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { restaurant } from '@/config/restaurant';
import { cartReducer, computeTotals, deserializeCart, initialCart, serializeCart, STORAGE_KEY, type CartAction, type CartState, type Totals } from '@/domain/cart';
import { formatMoney } from '@/domain/money';
import { indexMenu, type MenuIndex } from '@/domain/pricing';
import type { Cents, Locale, Menu } from '@/domain/types';
import type { Dictionary } from '@/i18n';
import { Toaster, type ToastInput } from '@/components/Toaster';

/* ---------- i18n ---------- */

interface I18nValue {
  locale: Locale;
  dict: Dictionary;
  money: (cents: Cents) => string;
}
const I18nContext = createContext<I18nValue | null>(null);
export function useI18n(): I18nValue {
  const v = useContext(I18nContext);
  if (!v) throw new Error('useI18n outside AppProviders');
  return v;
}

/* ---------- cart ---------- */

interface CartValue {
  state: CartState;
  dispatch: (a: CartAction) => void;
  totals: Totals;
  idx: MenuIndex;
  hydrated: boolean;
  /** Increments on every add: drives the cart-icon bump animation. */
  addTick: number;
}
const CartContext = createContext<CartValue | null>(null);
export function useCart(): CartValue {
  const v = useContext(CartContext);
  if (!v) throw new Error('useCart outside AppProviders');
  return v;
}

/* ---------- UI: which sheet is open ---------- */

export type CartStep = 'cart' | 'details' | 'review' | 'sent';
interface UiValue {
  cartOpen: boolean;
  cartStep: CartStep;
  openCart: (step?: CartStep) => void;
  closeCart: () => void;
  setCartStep: (s: CartStep) => void;
  /** `n` increments on every open so each opening gets fresh form state. */
  product: { productId: string; lineId?: string; n: number } | null;
  openProduct: (productId: string, lineId?: string) => void;
  closeProduct: () => void;
  toast: (t: ToastInput) => void;
}
const UiContext = createContext<UiValue | null>(null);
export function useUi(): UiValue {
  const v = useContext(UiContext);
  if (!v) throw new Error('useUi outside AppProviders');
  return v;
}

export function AppProviders({ locale, dict, menu, children }: { locale: Locale; dict: Dictionary; menu: Menu; children: ReactNode }) {
  const i18n = useMemo<I18nValue>(() => ({ locale, dict, money: (c) => formatMoney(c, locale, restaurant.currency) }), [locale, dict]);
  const idx = useMemo(() => indexMenu(menu), [menu]);

  const [state, rawDispatch] = useReducer(cartReducer, initialCart);
  const [hydrated, setHydrated] = useState(false);
  const [addTick, setAddTick] = useState(0);
  const dispatch = useCallback((a: CartAction) => {
    rawDispatch(a);
    if (a.type === 'add') setAddTick((n) => n + 1);
  }, []);

  // Restore the saved cart after mount (never during SSR, so server and client HTML match).
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch {
      /* private mode or blocked storage: cart simply isn't persisted */
    }
    const restored = deserializeCart(saved, idx);
    if (restored) rawDispatch({ type: 'hydrate', state: restored });
    setHydrated(true);

    // Keep several open tabs in sync.
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      const next = deserializeCart(e.newValue, idx);
      if (next) rawDispatch({ type: 'hydrate', state: next });
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [idx]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, serializeCart(state));
    } catch {
      /* ignore */
    }
  }, [state, hydrated]);

  const totals = useMemo(() => computeTotals(idx, state, restaurant.delivery), [idx, state]);
  const cart = useMemo<CartValue>(() => ({ state, dispatch, totals, idx, hydrated, addTick }), [state, dispatch, totals, idx, hydrated, addTick]);

  const [cartOpen, setCartOpen] = useState(false);
  const [cartStep, setCartStep] = useState<CartStep>('cart');
  const [product, setProduct] = useState<UiValue['product']>(null);
  const toastRef = useRef<(t: ToastInput) => void>(() => {});
  const productOpens = useRef(0);
  const ui = useMemo<UiValue>(
    () => ({
      cartOpen,
      cartStep,
      openCart: (step = 'cart') => {
        setCartStep(step);
        setProduct(null);
        setCartOpen(true);
      },
      closeCart: () => setCartOpen(false),
      setCartStep,
      product,
      openProduct: (productId, lineId) => setProduct({ productId, lineId, n: ++productOpens.current }),
      closeProduct: () => setProduct(null),
      toast: (t) => toastRef.current(t),
    }),
    [cartOpen, cartStep, product],
  );

  return (
    <I18nContext.Provider value={i18n}>
      <CartContext.Provider value={cart}>
        <UiContext.Provider value={ui}>
          {children}
          <Toaster register={(fn) => (toastRef.current = fn)} closeLabel={dict.common.close} />
        </UiContext.Provider>
      </CartContext.Provider>
    </I18nContext.Provider>
  );
}
