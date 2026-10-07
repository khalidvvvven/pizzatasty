'use client';

import { Check, Flame, Leaf, Plus, Sparkles, Star } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { canQuickAdd, defaultSelection, hasPriceRange, startingPrice } from '@/domain/pricing';
import type { Badge, Product } from '@/domain/types';
import { fill } from '@/i18n';
import { useCart, useI18n, useUi } from './providers/AppProviders';
import styles from './ProductCard.module.css';

const BADGE_ICON: Record<Badge, typeof Star> = { popular: Star, new: Sparkles, spicy: Flame, veggie: Leaf };

export function BadgeChip({ badge }: { badge: Badge }) {
  const { dict } = useI18n();
  const Icon = BADGE_ICON[badge];
  return (
    <span className={`${styles.badge} ${styles[`badge_${badge}`]}`}>
      <Icon size={12} strokeWidth={2.5} aria-hidden />
      {dict.menu.badges[badge]}
    </span>
  );
}

/**
 * Menu item. The name is the real button (its hit area is stretched over the whole card),
 * so the separate "+" quick-add button is never nested inside another interactive element.
 */
export function ProductCard({ product, layout = 'row', headingLevel = 3 }: { product: Product; layout?: 'row' | 'tile'; headingLevel?: 2 | 3 }) {
  const { locale, dict, money } = useI18n();
  const { idx, dispatch } = useCart();
  const { openProduct, toast, openCart } = useUi();
  const [justAdded, setJustAdded] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const name = product.name[locale];
  const tint = idx.menu.categories.find((c) => c.id === product.categoryId)?.tint ?? 'var(--c-dough-2)';
  const quick = canQuickAdd(idx, product);
  const price = startingPrice(idx, product);
  const ranged = hasPriceRange(idx, product);
  const Heading = headingLevel === 2 ? 'h2' : 'h3';

  const quickAdd = () => {
    const sel = defaultSelection(idx, product);
    dispatch({ type: 'add', productId: product.id, selection: { ...sel, quantity: 1 } });
    setJustAdded(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setJustAdded(false), 1400);
    toast({ message: fill(dict.product.addedToast, { name }), action: { label: dict.product.viewCart, onClick: () => openCart() } });
  };

  return (
    <article className={`${styles.card} ${styles[layout]} ${product.available ? '' : styles.soldOut}`}>
      <div className={styles.media} style={{ background: tint }}>
        <img src={product.image} alt="" width={400} height={400} loading="lazy" decoding="async" className={styles.img} />
      </div>
      <div className={styles.body}>
        {!!product.badges?.length && (
          <div className={styles.badges}>
            {product.badges.map((b) => (
              <BadgeChip key={b} badge={b} />
            ))}
          </div>
        )}
        <Heading className={styles.name}>
          <button type="button" className={styles.open} onClick={() => openProduct(product.id)}>
            {name}
          </button>
        </Heading>
        <p className={styles.desc}>{product.description[locale]}</p>
        <div className={styles.foot}>
          {product.available ? (
            <span className={`${styles.price} tabular`}>
              {ranged && <span className={styles.from}>{dict.common.from} </span>}
              {money(price)}
            </span>
          ) : (
            <span className={styles.soldOutLabel}>{dict.menu.soldOut}</span>
          )}
        </div>
      </div>
      {product.available && (
        <button
          type="button"
          className={`${styles.add} ${justAdded ? styles.added : ''}`}
          onClick={quick ? quickAdd : () => openProduct(product.id)}
          aria-label={quick ? fill(dict.menu.addNamed, { name }) : fill(dict.menu.chooseNamed, { name })}
        >
          {justAdded ? <Check size={22} strokeWidth={3} aria-hidden /> : <Plus size={22} strokeWidth={3} aria-hidden />}
        </button>
      )}
    </article>
  );
}
