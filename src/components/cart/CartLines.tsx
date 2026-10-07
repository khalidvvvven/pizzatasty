'use client';

import { AlertTriangle } from 'lucide-react';
import { restaurant } from '@/config/restaurant';
import { groupsFor, unitPrice } from '@/domain/pricing';
import { fill } from '@/i18n';
import { QuantityStepper } from '../QuantityStepper';
import { useCart, useI18n, useUi } from '../providers/AppProviders';
import styles from './Cart.module.css';

export function CartLines() {
  const { locale, dict, money } = useI18n();
  const { state, dispatch, idx, totals } = useCart();
  const { openProduct, toast } = useUi();

  return (
    <ul className={styles.lines}>
      {state.lines.map((line, index) => {
        const product = idx.product(line.productId);
        if (!product) return null;
        const name = product.name[locale];
        const unavailable = totals.unavailableLineIds.includes(line.lineId);
        const variant = product.variants.length > 1 ? product.variants.find((v) => v.id === line.variantId)?.label[locale] : undefined;
        const options = groupsFor(idx, product)
          .flatMap((g) => g.options.filter((o) => line.optionIds.includes(o.id)))
          .map((o) => o.label[locale]);
        const details = [variant, ...options].filter(Boolean).join(' · ');
        const tint = idx.menu.categories.find((c) => c.id === product.categoryId)?.tint;
        const remove = () => {
          dispatch({ type: 'remove', lineId: line.lineId });
          toast({ message: fill(dict.cart.removedToast, { name }), action: { label: dict.cart.undo, onClick: () => dispatch({ type: 'restore-line', line, index }) } });
        };
        return (
          <li key={line.lineId} className={`${styles.line} ${unavailable ? styles.lineUnavailable : ''}`}>
            <div className={styles.thumb} style={{ background: tint }}>
              <img src={product.image} alt="" width={64} height={64} loading="lazy" />
            </div>
            <div className={styles.lineBody}>
              <div className={styles.lineTop}>
                <p className={styles.lineName}>{name}</p>
                <p className={`${styles.lineTotal} tabular`}>{money(unitPrice(idx, product, line) * line.quantity)}</p>
              </div>
              {details && <p className={styles.lineDetails}>{details}</p>}
              {line.note && <p className={styles.lineNote}>“{line.note}”</p>}
              {unavailable ? (
                <p className={styles.lineWarning}>
                  <AlertTriangle size={14} aria-hidden /> {dict.cart.unavailableLine}
                </p>
              ) : null}
              <div className={styles.lineActions}>
                {!unavailable && (
                  <QuantityStepper
                    size="sm"
                    value={line.quantity}
                    onChange={(q) => dispatch({ type: 'quantity', lineId: line.lineId, quantity: q })}
                    label={`${dict.product.quantity} · ${name}`}
                    decreaseLabel={`${dict.product.decrease} · ${name}`}
                    increaseLabel={`${dict.product.increase} · ${name}`}
                    onRemove={remove}
                    removeLabel={`${dict.cart.remove} · ${name}`}
                  />
                )}
                {!unavailable && (
                  <button type="button" className={styles.textBtn} onClick={() => openProduct(product.id, line.lineId)}>
                    {dict.cart.edit}
                    <span className="visually-hidden"> · {name}</span>
                  </button>
                )}
                {unavailable && (
                  <button type="button" className={styles.textBtn} onClick={remove}>
                    {dict.cart.remove}
                    <span className="visually-hidden"> · {name}</span>
                  </button>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function CartTotals() {
  const { dict, money } = useI18n();
  const { state, totals } = useCart();
  const { freeFrom, minimumOrder } = restaurant.delivery;
  const isDelivery = state.mode === 'delivery';
  const progress = Math.min(1, totals.subtotal / freeFrom);
  return (
    <div className={styles.totals}>
      {isDelivery && totals.belowDeliveryMinimum && (
        <p className={styles.notice}>{fill(dict.cart.belowMinimum, { min: money(minimumOrder), missing: money(minimumOrder - totals.subtotal) })}</p>
      )}
      {isDelivery && !totals.belowDeliveryMinimum && (
        <div className={styles.freeDelivery}>
          <p>{totals.deliveryFee ? fill(dict.cart.freeDeliveryHint, { missing: money(freeFrom - totals.subtotal) }) : dict.cart.freeDeliveryReached}</p>
          <div className={styles.progress} aria-hidden="true">
            <span style={{ transform: `scaleX(${progress})` }} />
          </div>
        </div>
      )}
      <dl className={styles.sums}>
        <div>
          <dt>{dict.cart.subtotal}</dt>
          <dd className="tabular">{money(totals.subtotal)}</dd>
        </div>
        {isDelivery && (
          <div>
            <dt>{dict.cart.delivery}</dt>
            <dd className="tabular">{totals.deliveryFee ? money(totals.deliveryFee) : dict.cart.free}</dd>
          </div>
        )}
        <div className={styles.grand}>
          <dt>{dict.cart.total}</dt>
          <dd className="tabular">{money(totals.total)}</dd>
        </div>
      </dl>
      <p className={styles.demoPrices}>
        <span className="demo-pill">{dict.common.demo}</span> {dict.cart.demoPrices}
      </p>
    </div>
  );
}
