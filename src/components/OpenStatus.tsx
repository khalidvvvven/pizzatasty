'use client';

import { useEffect, useState } from 'react';
import { restaurant } from '@/config/restaurant';
import { localClock, openStatus, type OpenStatus as Status } from '@/domain/hours';
import { fill } from '@/i18n';
import { useI18n } from './providers/AppProviders';
import styles from './OpenStatus.module.css';

/**
 * Computed in the browser, in the restaurant's time zone. Static pages are cached, so
 * "open/closed" must never be baked into the HTML. Renders an empty placeholder until mounted.
 */
export function OpenStatus({ tone = 'light' }: { tone?: 'light' | 'red' | 'dark' }) {
  const { locale, dict } = useI18n();
  const [status, setStatus] = useState<Status | null>(null);
  const [today, setToday] = useState(0);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setStatus(openStatus(restaurant.hours, now, restaurant.timeZone));
      setToday(localClock(now, restaurant.timeZone).day);
    };
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const toneClass = tone === 'red' ? styles.red : tone === 'dark' ? styles.dark : '';
  if (!status) return <span className={`${styles.pill} ${toneClass} ${styles.placeholder}`} aria-hidden="true" />;

  let label: string;
  if (status.open) label = fill(dict.common.closesAt, { time: status.closesAt });
  else if (status.opensAt) {
    const { day, time } = status.opensAt;
    const dayLabel =
      day === today
        ? dict.common.today
        : day === (today + 1) % 7
          ? dict.common.tomorrow
          : new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2023, 0, 1 + day)));
    label = fill(dict.common.opensAt, { day: dayLabel, time });
  } else label = dict.common.closed;

  return (
    <span className={`${styles.pill} ${toneClass} ${status.open ? styles.open : styles.closed}`}>
      <span className={styles.dot} aria-hidden="true" />
      {label}
    </span>
  );
}
