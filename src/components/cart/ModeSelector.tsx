'use client';

import { Bike, ShoppingBag, UtensilsCrossed } from 'lucide-react';
import { useId } from 'react';
import { restaurant } from '@/config/restaurant';
import type { OrderMode } from '@/domain/types';
import { fill } from '@/i18n';
import { useCart, useI18n } from '../providers/AppProviders';
import styles from './ModeSelector.module.css';

const MODES: Array<{ id: OrderMode; Icon: typeof Bike }> = [
  { id: 'dine-in', Icon: UtensilsCrossed },
  { id: 'takeaway', Icon: ShoppingBag },
  { id: 'delivery', Icon: Bike },
];

export function ModeSelector({ compact = false }: { compact?: boolean }) {
  const { dict } = useI18n();
  const { state, dispatch } = useCart();
  const name = useId();
  const hint = (m: OrderMode) => {
    const [min, max] = m === 'delivery' ? restaurant.delivery.etaMinutes : restaurant.takeawayEtaMinutes;
    return fill(dict.cart.modeHint[m], { min, max });
  };
  return (
    <fieldset className={`${styles.modes} ${compact ? styles.compact : ''}`}>
      <legend className={compact ? 'visually-hidden' : styles.legend}>{dict.cart.modeLabel}</legend>
      <div className={styles.grid}>
        {MODES.map(({ id, Icon }) => (
          <label key={id} className={styles.mode}>
            <input type="radio" name={name} value={id} checked={state.mode === id} onChange={() => dispatch({ type: 'mode', mode: id })} />
            <Icon size={compact ? 18 : 22} aria-hidden className={styles.icon} />
            <span className={styles.label}>{dict.cart.modes[id]}</span>
            {!compact && <span className={styles.hint}>{hint(id)}</span>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
