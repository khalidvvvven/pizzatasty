'use client';

import { ShoppingBag } from 'lucide-react';
import { plural } from '@/i18n';
import { useCart, useI18n, useUi } from '../providers/AppProviders';
import { CartLines, CartTotals } from './CartLines';
import { ModeSelector } from './ModeSelector';
import styles from './CartPanel.module.css';

/** Desktop menu: the cart stays visible beside the menu, removing the "open cart" step. */
export function CartPanel() {
  const { locale, dict } = useI18n();
  const { state, totals, hydrated } = useCart();
  const { openCart } = useUi();
  const empty = !hydrated || state.lines.length === 0;
  const blocked = totals.unavailableLineIds.length > 0 || totals.belowDeliveryMinimum;

  return (
    <aside className={styles.panel} aria-labelledby="cart-panel-title">
      <h2 id="cart-panel-title" className={styles.title}>
        {dict.cart.title}
      </h2>
      <ModeSelector compact />
      {empty ? (
        <div className={styles.empty}>
          <ShoppingBag size={28} aria-hidden />
          <p className={styles.emptyTitle}>{dict.cart.empty}</p>
          <p>{dict.cart.emptyHint}</p>
        </div>
      ) : (
        <>
          <div className={styles.lines}>
            <CartLines />
          </div>
          <CartTotals />
          <button type="button" className="btn btn-primary btn-lg btn-block" disabled={blocked} onClick={() => openCart('details')}>
            {dict.common.order} · {plural(locale, totals.itemCount, { one: dict.common.items_one, other: dict.common.items_other })}
          </button>
        </>
      )}
    </aside>
  );
}
