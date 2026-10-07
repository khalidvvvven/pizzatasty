'use client';

import { ShoppingBag } from 'lucide-react';
import { plural } from '@/i18n';
import { useCart, useI18n, useUi } from '../providers/AppProviders';
import styles from './MiniCartBar.module.css';

/** Phone/tablet: always one thumb-tap from the cart once something is in it. */
export function MiniCartBar() {
  const { locale, dict, money } = useI18n();
  const { totals, hydrated, addTick } = useCart();
  const { openCart, cartOpen } = useUi();
  const visible = hydrated && totals.itemCount > 0;

  return (
    <>
      {/* Reserves room at the end of the page so the bar never hides the footer. */}
      {visible && <div className={styles.spacer} aria-hidden="true" />}
      <div className={`${styles.wrap} ${visible && !cartOpen ? styles.show : ''}`} aria-hidden={!visible}>
        <button type="button" className={styles.bar} onClick={() => openCart()} tabIndex={visible ? 0 : -1}>
          <span key={addTick} className={`${styles.count} ${addTick ? styles.bump : ''} tabular`}>
            {totals.itemCount}
          </span>
          <span className={styles.label}>
            <ShoppingBag size={18} aria-hidden />
            {dict.product.viewCart}
            <span className="visually-hidden"> · {plural(locale, totals.itemCount, { one: dict.common.items_one, other: dict.common.items_other })}</span>
          </span>
          <span className={`${styles.total} tabular`}>{money(totals.total)}</span>
        </button>
      </div>
    </>
  );
}
