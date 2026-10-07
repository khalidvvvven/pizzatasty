'use client';

import { Info, X } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { clampSelection, defaultSelection, groupsFor, limitsFor, unitPrice, validateSelection } from '@/domain/pricing';
import type { Product } from '@/domain/types';
import { fill, plural } from '@/i18n';
import { BadgeChip } from './ProductCard';
import { QuantityStepper } from './QuantityStepper';
import { useCart, useI18n, useUi } from './providers/AppProviders';
import { Sheet } from './Sheet';
import styles from './ProductSheet.module.css';

export function ProductSheet() {
  const { product: target, closeProduct } = useUi();
  const { idx } = useCart();
  const product = target ? idx.product(target.productId) : undefined;

  // Keep the last product rendered while the sheet plays its exit animation.
  const [shown, setShown] = useState<{ product: Product; lineId?: string; n: number } | null>(null);
  const opens = useRef(0);
  useEffect(() => {
    if (product) {
      opens.current += 1;
      setShown({ product, lineId: target?.lineId, n: opens.current });
    }
  }, [product, target?.lineId]);

  return (
    <Sheet open={!!product} onClose={closeProduct} labelledBy="product-sheet-title">
      {shown && <ProductForm key={shown.n} product={shown.product} lineId={shown.lineId} />}
    </Sheet>
  );
}

function ProductForm({ product, lineId }: { product: Product; lineId?: string }) {
  const { locale, dict, money } = useI18n();
  const { idx, state, dispatch } = useCart();
  const { closeProduct, toast, openCart } = useUi();
  const editing = lineId ? state.lines.find((l) => l.lineId === lineId) : undefined;
  const initial = editing ?? { ...defaultSelection(idx, product), quantity: 1, note: '' };

  const [variantId, setVariantId] = useState(initial.variantId);
  const [optionIds, setOptionIds] = useState<string[]>(initial.optionIds);
  const [quantity, setQuantity] = useState(initial.quantity);
  const [note, setNote] = useState(initial.note ?? '');
  const [showErrors, setShowErrors] = useState(false);
  const uid = useId();

  const groups = useMemo(() => groupsFor(idx, product), [idx, product]);
  const errors = validateSelection(idx, product, { variantId, optionIds });
  const unit = unitPrice(idx, product, { variantId, optionIds });
  const tint = idx.menu.categories.find((c) => c.id === product.categoryId)?.tint;
  const name = product.name[locale];

  const changeVariant = (id: string) => {
    setVariantId(id);
    setOptionIds((ids) => clampSelection(idx, product, { variantId: id, optionIds: ids }));
  };

  const toggle = (groupId: string, optionId: string, single: boolean) => {
    const group = groups.find((g) => g.id === groupId)!;
    const inGroup = (id: string) => group.options.some((o) => o.id === id);
    setOptionIds((ids) => {
      if (single) return [...ids.filter((id) => !inGroup(id)), optionId];
      if (ids.includes(optionId)) return ids.filter((id) => id !== optionId);
      const { max } = limitsFor(group, variantId);
      return ids.filter(inGroup).length >= max ? ids : [...ids, optionId];
    });
  };

  const submit = () => {
    if (errors.length) {
      setShowErrors(true);
      document.getElementById(`${uid}-grp-${errors[0]!.groupId}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    const selection = { variantId, optionIds, quantity, note: note.trim() || undefined };
    if (editing) {
      dispatch({ type: 'replace', lineId: editing.lineId, selection });
      toast({ message: fill(dict.product.updatedToast, { name }) });
    } else {
      dispatch({ type: 'add', productId: product.id, selection });
      toast({ message: fill(dict.product.addedToast, { name }), action: { label: dict.product.viewCart, onClick: () => openCart() } });
    }
    closeProduct();
  };

  return (
    <>
      <div className={styles.scroll}>
        <div className={styles.hero} style={{ background: tint }}>
          <img src={product.image} alt={name} width={400} height={400} className={styles.heroImg} />
          <button type="button" className={styles.close} onClick={closeProduct} aria-label={dict.common.close}>
            <X size={22} aria-hidden />
          </button>
        </div>

        <div className={styles.content}>
          {!!product.badges?.length && (
            <div className={styles.badges}>
              {product.badges.map((b) => (
                <BadgeChip key={b} badge={b} />
              ))}
            </div>
          )}
          <h2 id="product-sheet-title" className={styles.title}>
            {name}
          </h2>
          <p className={styles.desc}>{product.description[locale]}</p>
          <p className={styles.allergens}>
            <Info size={16} aria-hidden />
            <span>
              <strong>{dict.product.allergens} · </strong>
              {product.allergens?.[locale] ?? dict.product.allergensUnknown}
            </span>
          </p>

          {!product.available && <p className={styles.unavailable}>{dict.product.unavailable}</p>}

          {product.variants.length > 1 && (
            <fieldset className={styles.group}>
              <legend className={styles.legend}>
                <span>{dict.product.size}</span>
                <span className={styles.rule}>{dict.product.required}</span>
              </legend>
              <div className={styles.variants}>
                {product.variants.map((v) => (
                  <label key={v.id} className={styles.variant}>
                    <input type="radio" name={`${uid}-variant`} value={v.id} checked={variantId === v.id} onChange={() => changeVariant(v.id)} />
                    <span className={styles.variantLabel}>{v.label[locale]}</span>
                    {v.detail && <span className={styles.variantDetail}>{v.detail[locale]}</span>}
                    <span className={`${styles.variantPrice} tabular`}>{money(v.price)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {groups.map((g) => {
            const { min, max } = limitsFor(g, variantId);
            if (max === 0) return null;
            const single = min === 1 && max === 1;
            const chosen = optionIds.filter((id) => g.options.some((o) => o.id === id)).length;
            const err = showErrors ? errors.find((e) => e.groupId === g.id) : undefined;
            const errId = `${uid}-err-${g.id}`;
            const rule = min === max ? fill(dict.product.chooseExactly, { n: min }) : fill(dict.product.upTo, { n: max });
            return (
              <fieldset key={g.id} id={`${uid}-grp-${g.id}`} className={`${styles.group} ${err ? styles.groupError : ''}`} aria-describedby={err ? errId : undefined}>
                <legend className={styles.legend}>
                  <span>{g.label[locale]}</span>
                  <span className={styles.rule}>
                    {min > 0 ? dict.product.required : dict.product.optional} · {rule}
                    {!single && max > 1 && <span className="tabular"> · {chosen}/{max}</span>}
                  </span>
                </legend>
                <div className={styles.options}>
                  {g.options.map((o) => {
                    const checked = optionIds.includes(o.id);
                    const blocked = !single && !checked && chosen >= max;
                    return (
                      <label key={o.id} className={`${styles.option} ${blocked ? styles.optionBlocked : ''}`}>
                        <input
                          type={single ? 'radio' : 'checkbox'}
                          name={`${uid}-${g.id}`}
                          checked={checked}
                          disabled={blocked || o.available === false}
                          onChange={() => toggle(g.id, o.id, single)}
                        />
                        <span className={styles.optionLabel}>{o.label[locale]}</span>
                        {o.price > 0 && <span className={`${styles.optionPrice} tabular`}>+ {money(o.price)}</span>}
                      </label>
                    );
                  })}
                </div>
                {!single && chosen >= max && max > 1 && <p className={styles.hint}>{fill(dict.product.maxReached, { n: max })}</p>}
                {err && (
                  <p id={errId} className={styles.error}>
                    {err.kind === 'min' ? plural(locale, err.limit, { one: dict.product.minError_one, other: dict.product.minError_other }) : fill(dict.product.maxReached, { n: err.limit })}
                  </p>
                )}
              </fieldset>
            );
          })}

          {product.allowNote && (
            <div className={styles.group}>
              <label htmlFor={`${uid}-note`} className={styles.legend}>
                <span>{dict.product.note}</span>
                <span className={styles.rule}>{dict.product.optional}</span>
              </label>
              <textarea id={`${uid}-note`} className={styles.note} rows={2} maxLength={140} placeholder={dict.product.notePlaceholder} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          )}
        </div>
      </div>

      <div className={styles.footer}>
        <QuantityStepper value={quantity} onChange={setQuantity} min={1} max={20} label={dict.product.quantity} decreaseLabel={dict.product.decrease} increaseLabel={dict.product.increase} />
        <button type="button" className="btn btn-primary btn-lg" style={{ flex: 1 }} onClick={submit} disabled={!product.available}>
          <span>{fill(editing ? dict.product.update : dict.product.add, { price: money(unit * quantity) })}</span>
        </button>
      </div>
      {showErrors && errors.length > 0 && (
        <p className="visually-hidden" role="alert">
          {dict.product.fixErrors}
        </p>
      )}
    </>
  );
}
