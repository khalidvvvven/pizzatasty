'use client';

import { CalendarCheck, Loader2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { restaurant } from '@/config/restaurant';
import { localClock, reservationSlots } from '@/domain/hours';
import { intlLocale } from '@/domain/money';
import { isValidPhone } from '@/domain/validation';
import { plural } from '@/i18n';
import { QuantityStepper } from '../QuantityStepper';
import { useI18n } from '../providers/AppProviders';
import styles from './ReservationForm.module.css';

type Field = 'name' | 'phone' | 'date' | 'time';

/** "YYYY-MM-DD" for today in the restaurant's time zone (not the visitor's). */
function todayAtRestaurant(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: restaurant.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const weekdayOf = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();

export function ReservationForm() {
  const { locale, dict } = useI18n();
  const t = dict.reservation;
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [guests, setGuests] = useState(2);
  const [note, setNote] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle');
  const [today, setToday] = useState('');
  const successRef = useRef<HTMLHeadingElement>(null);

  // Client-only values: today's date and the ?guests= shortcut from the homepage.
  useEffect(() => {
    const d = todayAtRestaurant();
    setToday(d);
    setDate(d);
    const g = Number(new URLSearchParams(window.location.search).get('guests'));
    if (Number.isInteger(g) && g >= 1) setGuests(Math.min(g, restaurant.reservation.maxGuests));
  }, []);

  const slots = useMemo(() => {
    if (!date) return [];
    const all = reservationSlots(restaurant.hours, weekdayOf(date));
    if (date !== today) return all;
    const { minutes } = localClock(new Date(), restaurant.timeZone);
    return all.filter((s) => {
      const [h, m] = s.split(':').map(Number);
      const slotMin = (h ?? 0) * 60 + (m ?? 0);
      return slotMin >= minutes + 30 || slotMin < 6 * 60; // after-midnight slots belong to tonight
    });
  }, [date, today]);

  useEffect(() => {
    if (time && !slots.includes(time)) setTime('');
  }, [slots, time]);

  const errors: Partial<Record<Field, string>> = {};
  if (!name.trim()) errors.name = t.errors.required;
  if (!phone.trim()) errors.phone = t.errors.required;
  else if (!isValidPhone(phone)) errors.phone = t.errors.phone;
  if (!date || (today && date < today)) errors.date = t.errors.date;
  if (!time) errors.time = t.errors.time;
  const errorCount = Object.keys(errors).length;
  const shown = (f: Field) => (submitted ? errors[f] : undefined);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (errorCount) {
      const first = (['name', 'phone', 'date', 'time'] as Field[]).find((f) => errors[f]);
      document.getElementById(first === 'time' ? 'res-time-0' : `res-${first}`)?.focus();
      return;
    }
    setStatus('sending');
    // Demo: simulate a network round trip. Nothing is sent or stored.
    await new Promise((r) => setTimeout(r, 900));
    setStatus('done');
    requestAnimationFrame(() => successRef.current?.focus());
  };

  const reset = () => {
    setStatus('idle');
    setSubmitted(false);
    setTime('');
    setNote('');
  };

  const longDate = date ? new Intl.DateTimeFormat(intlLocale(locale), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`)) : '';
  const guestsLabel = plural(locale, guests, { one: t.guestsValue_one, other: t.guestsValue_other });

  if (status === 'done') {
    return (
      <div className={styles.success}>
        <div className={styles.successIcon} aria-hidden="true">
          <CalendarCheck size={40} />
        </div>
        <h2 ref={successRef} tabIndex={-1} className={styles.successTitle}>
          {t.successTitle}
        </h2>
        <dl className={styles.summary}>
          <div>
            <dt>{t.name}</dt>
            <dd>{name}</dd>
          </div>
          <div>
            <dt>{t.date}</dt>
            <dd className={styles.cap}>{longDate}</dd>
          </div>
          <div>
            <dt>{t.time}</dt>
            <dd className="tabular">{time}</dd>
          </div>
          <div>
            <dt>{t.guests}</dt>
            <dd>{guestsLabel}</dd>
          </div>
        </dl>
        <p className={styles.notConfirmed}>
          <span className="demo-pill">{dict.common.demo}</span> {t.notConfirmed}
        </p>
        <p className={styles.successText}>{t.successText}</p>
        <button type="button" className="btn btn-ghost" onClick={reset}>
          {t.another}
        </button>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      {submitted && errorCount > 0 && (
        <p className={styles.errorSummary} role="alert">
          {plural(locale, errorCount, { one: t.fixErrors_one, other: t.fixErrors_other })}
        </p>
      )}

      <div className={styles.row}>
        <Input id="res-name" label={t.name} value={name} onChange={setName} error={shown('name')} autoComplete="name" />
        <Input id="res-phone" label={t.phone} value={phone} onChange={setPhone} error={shown('phone')} autoComplete="tel" type="tel" inputMode="tel" />
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label htmlFor="res-date" className={styles.label}>
            {t.date}
          </label>
          <input
            id="res-date"
            type="date"
            className={styles.input}
            value={date}
            min={today || undefined}
            max={today ? addDays(today, restaurant.reservation.daysAhead) : undefined}
            onChange={(e) => setDate(e.target.value)}
            aria-invalid={!!shown('date')}
            aria-describedby={shown('date') ? 'res-date-err' : undefined}
            required
          />
          {shown('date') && (
            <p id="res-date-err" className={styles.error}>
              {shown('date')}
            </p>
          )}
        </div>
        <div className={styles.field}>
          <span className={styles.label} id="res-guests-label">
            {t.guests}
          </span>
          <div className={styles.guests}>
            <QuantityStepper value={guests} onChange={setGuests} min={1} max={restaurant.reservation.maxGuests} label={t.guests} decreaseLabel="−1" increaseLabel="+1" />
            <span className={styles.guestsValue}>{guestsLabel}</span>
          </div>
        </div>
      </div>

      <fieldset className={styles.slots} aria-describedby={shown('time') ? 'res-time-err' : undefined}>
        <legend className={styles.label}>{t.time}</legend>
        {!date ? (
          <p className={styles.muted}>{t.pickDateFirst}</p>
        ) : slots.length === 0 ? (
          <p className={styles.muted}>{t.closedThatDay}</p>
        ) : (
          <div className={styles.slotGrid}>
            {slots.map((s, i) => (
              <label key={s} className={styles.slot}>
                <input id={`res-time-${i}`} type="radio" name="res-time" value={s} checked={time === s} onChange={() => setTime(s)} />
                <span className="tabular">{s}</span>
              </label>
            ))}
          </div>
        )}
        {shown('time') && (
          <p id="res-time-err" className={styles.error}>
            {shown('time')}
          </p>
        )}
      </fieldset>

      <div className={styles.field}>
        <label htmlFor="res-note" className={styles.label}>
          {t.note} <span className={styles.optional}>({t.optional})</span>
        </label>
        <textarea id="res-note" className={styles.input} rows={3} maxLength={300} placeholder={t.notePlaceholder} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

      <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={status === 'sending'} aria-busy={status === 'sending'}>
        {status === 'sending' ? (
          <>
            <Loader2 size={20} className={styles.spin} aria-hidden /> {t.sending}
          </>
        ) : (
          t.submit
        )}
      </button>
      <p className={styles.demoNote}>
        <span className="demo-pill">{dict.common.demo}</span> {t.demoNote}
      </p>
      {date && slots.length > 0 && time && (
        <p className={styles.recap} aria-live="polite">
          <span className={styles.cap}>{longDate}</span> · {time} · {guestsLabel}
        </p>
      )}
    </form>
  );
}

function Input({
  id,
  label,
  value,
  onChange,
  error,
  type = 'text',
  autoComplete,
  inputMode,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  type?: string;
  autoComplete?: string;
  inputMode?: 'tel' | 'text';
}) {
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        className={styles.input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        inputMode={inputMode}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-err` : undefined}
        required
        maxLength={80}
      />
      {error && (
        <p id={`${id}-err`} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
