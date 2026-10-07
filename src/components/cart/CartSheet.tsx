'use client';

import { ArrowLeft, Check, Copy, MessageCircle, PartyPopper, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { restaurant } from '@/config/restaurant';
import { buildOrderMessage, newOrderRef, whatsappUrl } from '@/domain/order-message';
import { FIELDS_BY_MODE, validateCheckout, type CheckoutField } from '@/domain/validation';
import { fill, plural } from '@/i18n';
import { useCart, useI18n, useUi, type CartStep } from '../providers/AppProviders';
import { Sheet } from '../Sheet';
import { CartLines, CartTotals } from './CartLines';
import { ModeSelector } from './ModeSelector';
import styles from './Cart.module.css';

const STEPS: CartStep[] = ['cart', 'details', 'review'];

export function CartSheet() {
  const { dict } = useI18n();
  const { cartOpen, closeCart, cartStep, setCartStep } = useUi();
  const [ref, setRef] = useState<string | null>(null);

  // One reference per checkout, created when the customer first reaches the summary.
  useEffect(() => {
    if (cartStep === 'review' && !ref) setRef(newOrderRef());
  }, [cartStep, ref]);

  const stepIndex = STEPS.indexOf(cartStep);
  const back = cartStep === 'details' ? 'cart' : cartStep === 'review' ? 'details' : null;

  return (
    <Sheet open={cartOpen} onClose={closeCart} labelledBy="cart-title" desktop="side">
      <div className={styles.head}>
        {back ? (
          <button type="button" className="icon-btn" onClick={() => setCartStep(back)} aria-label={dict.common.back}>
            <ArrowLeft size={22} aria-hidden />
          </button>
        ) : (
          <span className={styles.headSpacer} />
        )}
        <h2 id="cart-title" className={styles.title}>
          {cartStep === 'details' ? dict.checkout.detailsTitle : cartStep === 'review' ? dict.checkout.reviewTitle : dict.cart.title}
        </h2>
        <button type="button" className="icon-btn" onClick={closeCart} aria-label={dict.common.close}>
          <X size={22} aria-hidden />
        </button>
      </div>
      {cartStep !== 'sent' && (
        <ol className={styles.steps} aria-label={dict.cart.title}>
          {STEPS.map((s, i) => (
            <li key={s} className={i <= stepIndex ? styles.stepDone : ''} aria-current={i === stepIndex ? 'step' : undefined}>
              <span className={styles.stepDot}>{i < stepIndex ? <Check size={12} strokeWidth={3} aria-hidden /> : i + 1}</span>
              {dict.cart.steps[s as 'cart' | 'details' | 'review']}
            </li>
          ))}
        </ol>
      )}
      {cartStep === 'cart' && <CartStepView />}
      {cartStep === 'details' && <DetailsStep />}
      {cartStep === 'review' && ref && <ReviewStep orderRef={ref} />}
      {cartStep === 'sent' && ref && <SentStep orderRef={ref} onDone={() => setRef(null)} />}
    </Sheet>
  );
}

function CartStepView() {
  const { locale, dict } = useI18n();
  const { state, totals } = useCart();
  const { setCartStep, closeCart } = useUi();

  if (!state.lines.length) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyArt} aria-hidden="true">
          <img src="/food/margherita.svg" alt="" width={160} height={160} />
        </div>
        <p className={styles.emptyTitle}>{dict.cart.empty}</p>
        <p className={styles.emptyHint}>{dict.cart.emptyHint}</p>
        <Link href={`/${locale}/menu`} className="btn btn-primary btn-lg" onClick={closeCart}>
          {dict.cart.browse}
        </Link>
      </div>
    );
  }

  const blocked = totals.unavailableLineIds.length > 0 || totals.belowDeliveryMinimum || totals.itemCount === 0;
  return (
    <>
      <div className={styles.body}>
        <ModeSelector />
        <CartLines />
      </div>
      <div className={styles.foot}>
        <CartTotals />
        <button type="button" className="btn btn-primary btn-lg btn-block" disabled={blocked} onClick={() => setCartStep('details')}>
          {dict.cart.continue} · {plural(locale, totals.itemCount, { one: dict.common.items_one, other: dict.common.items_other })}
        </button>
      </div>
    </>
  );
}

const AUTOCOMPLETE: Record<CheckoutField | 'addressExtra', string> = { table: 'off', name: 'name', phone: 'tel', address: 'street-address', addressExtra: 'address-line2' };

function DetailsStep() {
  const { locale, dict } = useI18n();
  const { state, dispatch } = useCart();
  const { setCartStep } = useUi();
  const [submitted, setSubmitted] = useState(false);
  const summaryRef = useRef<HTMLParagraphElement>(null);
  const errors = validateCheckout(state.mode, state.details);
  const fields = FIELDS_BY_MODE[state.mode];
  const errorCount = Object.keys(errors).length;

  const labelFor: Record<CheckoutField, string> = { table: dict.checkout.table, name: dict.checkout.name, phone: dict.checkout.phone, address: dict.checkout.address };
  const hintFor: Partial<Record<CheckoutField, string>> = { table: dict.checkout.tableHint, phone: dict.checkout.phoneHint, address: dict.checkout.addressHint };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (errorCount) {
      const first = fields.find((f) => errors[f]);
      requestAnimationFrame(() => document.getElementById(`co-${first}`)?.focus());
      return;
    }
    setCartStep('review');
  };

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <div className={styles.body}>
        <div className={styles.modeSummary}>
          <ModeSelector compact />
        </div>
        {submitted && errorCount > 0 && (
          <p ref={summaryRef} className={styles.errorSummary} role="alert">
            {plural(locale, errorCount, { one: dict.checkout.fixErrors_one, other: dict.checkout.fixErrors_other })}
          </p>
        )}
        {fields.map((f) => {
          const err = submitted ? errors[f] : undefined;
          const hint = hintFor[f];
          const describedBy = [hint ? `co-${f}-hint` : '', err ? `co-${f}-err` : ''].filter(Boolean).join(' ') || undefined;
          return (
            <div key={f} className={styles.field}>
              <label htmlFor={`co-${f}`} className={styles.label}>
                {labelFor[f]}
              </label>
              {f === 'address' ? (
                <textarea
                  id={`co-${f}`}
                  className={styles.input}
                  rows={2}
                  autoComplete={AUTOCOMPLETE[f]}
                  value={state.details[f]}
                  aria-invalid={!!err}
                  aria-describedby={describedBy}
                  aria-required="true"
                  onChange={(e) => dispatch({ type: 'details', patch: { [f]: e.target.value } })}
                />
              ) : (
                <input
                  id={`co-${f}`}
                  className={styles.input}
                  type={f === 'phone' ? 'tel' : 'text'}
                  inputMode={f === 'table' ? 'numeric' : f === 'phone' ? 'tel' : undefined}
                  autoComplete={AUTOCOMPLETE[f]}
                  value={state.details[f]}
                  aria-invalid={!!err}
                  aria-describedby={describedBy}
                  aria-required="true"
                  maxLength={f === 'table' ? 2 : 80}
                  onChange={(e) => dispatch({ type: 'details', patch: { [f]: e.target.value } })}
                />
              )}
              {hint && (
                <p id={`co-${f}-hint`} className={styles.hint}>
                  {hint}
                </p>
              )}
              {err && (
                <p id={`co-${f}-err`} className={styles.fieldError}>
                  {dict.checkout.errors[err]}
                </p>
              )}
            </div>
          );
        })}
        {state.mode === 'delivery' && (
          <div className={styles.field}>
            <label htmlFor="co-addressExtra" className={styles.label}>
              {dict.checkout.addressExtra} <span className={styles.optional}>({dict.checkout.optional})</span>
            </label>
            <input id="co-addressExtra" className={styles.input} autoComplete={AUTOCOMPLETE.addressExtra} value={state.details.addressExtra} maxLength={80} onChange={(e) => dispatch({ type: 'details', patch: { addressExtra: e.target.value } })} />
          </div>
        )}
        <div className={styles.field}>
          <label htmlFor="co-note" className={styles.label}>
            {dict.checkout.note} <span className={styles.optional}>({dict.checkout.optional})</span>
          </label>
          <textarea id="co-note" className={styles.input} rows={2} maxLength={200} value={state.details.note} onChange={(e) => dispatch({ type: 'details', patch: { note: e.target.value } })} />
        </div>
      </div>
      <div className={styles.foot}>
        <CartTotals />
        <button type="submit" className="btn btn-primary btn-lg btn-block">
          {dict.checkout.review}
        </button>
      </div>
    </form>
  );
}

function ReviewStep({ orderRef }: { orderRef: string }) {
  const { locale, dict } = useI18n();
  const { state, totals, idx } = useCart();
  const { setCartStep, toast } = useUi();
  const message = buildOrderMessage({ idx, cart: state, totals, ref: orderRef, restaurantName: restaurant.name, staffLocale: restaurant.staffLocale, customerLocale: locale, currency: restaurant.currency });
  const configured = !!restaurant.whatsappNumber;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      toast({ message: dict.checkout.copied });
    } catch {
      toast({ message: dict.checkout.copyFailed });
    }
  };

  const send = () => {
    // Only a real, configured number ever opens WhatsApp. Otherwise: clearly labelled demo state.
    if (configured) window.open(whatsappUrl(restaurant.whatsappNumber!, message), '_blank', 'noopener');
    setCartStep('sent');
  };

  return (
    <>
      <div className={styles.body}>
        <p className={styles.lead}>{dict.checkout.reviewLead}</p>
        <figure className={styles.ticket}>
          <figcaption className={styles.ticketHead}>
            <span>{dict.checkout.ticket}</span>
            <span className="tabular">{orderRef}</span>
          </figcaption>
          <pre className={styles.ticketText}>{message}</pre>
        </figure>
        {!configured && (
          <div className={styles.demoBox} role="note">
            <p className={styles.demoTitle}>
              <span className="demo-pill">{dict.common.demo}</span> {dict.checkout.demoTitle}
            </p>
            <p>{dict.checkout.demoText}</p>
          </div>
        )}
        <p className={styles.confirmNote}>{dict.checkout.confirmNote}</p>
      </div>
      <div className={styles.foot}>
        <button type="button" className={`btn btn-lg btn-block ${styles.whatsapp}`} onClick={send}>
          <MessageCircle size={20} aria-hidden />
          {dict.checkout.send}
        </button>
        <div className={styles.footRow}>
          <button type="button" className="btn btn-ghost" onClick={copy}>
            <Copy size={18} aria-hidden />
            {dict.checkout.copy}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setCartStep('cart')}>
            {dict.checkout.edit}
          </button>
        </div>
      </div>
    </>
  );
}

function SentStep({ orderRef, onDone }: { orderRef: string; onDone: () => void }) {
  const { locale, dict } = useI18n();
  const { dispatch } = useCart();
  const { closeCart, setCartStep } = useUi();
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);

  const finish = (clear: boolean) => {
    if (clear) dispatch({ type: 'clear' });
    closeCart();
    window.setTimeout(() => {
      setCartStep('cart');
      onDone();
    }, 260);
  };

  return (
    <div className={styles.sent}>
      <div className={styles.sentIcon} aria-hidden="true">
        <PartyPopper size={40} />
      </div>
      <h3 ref={headingRef} tabIndex={-1} className={styles.sentTitle}>
        {dict.checkout.sentTitle}
      </h3>
      <p className={styles.sentText}>{dict.checkout.sentText}</p>
      <p className={`${styles.sentRef} tabular`}>{fill(dict.checkout.sentRef, { ref: orderRef })}</p>
      <div className={styles.sentActions}>
        <Link href={`/${locale}/menu`} className="btn btn-primary btn-lg btn-block" onClick={() => finish(true)}>
          {dict.checkout.newOrder}
        </Link>
        <button type="button" className="btn btn-ghost btn-block" onClick={() => finish(false)}>
          {dict.checkout.keepCart}
        </button>
      </div>
    </div>
  );
}
