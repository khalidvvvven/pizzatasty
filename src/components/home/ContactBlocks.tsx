'use client';

import { MessageCircle, Navigation, Phone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { restaurant } from '@/config/restaurant';
import { localClock } from '@/domain/hours';
import { useI18n, useUi } from '../providers/AppProviders';
import styles from './Sections.module.css';

/** Never dials or opens a fake number: without real data the buttons explain the demo state. */
export function ContactActions() {
  const { dict } = useI18n();
  const { toast } = useUi();
  const demo = () => toast({ message: dict.home.contactDemo });
  const phone = restaurant.phone;
  const wa = restaurant.whatsappNumber;
  const maps = restaurant.address?.mapsUrl;

  return (
    <div className={styles.contactActions}>
      {phone ? (
        <a className="btn btn-primary" href={`tel:${phone}`}>
          <Phone size={18} aria-hidden /> {dict.home.call}
        </a>
      ) : (
        <button type="button" className="btn btn-primary" onClick={demo}>
          <Phone size={18} aria-hidden /> {dict.home.call}
        </button>
      )}
      {wa ? (
        <a className="btn btn-ghost" href={`https://wa.me/${wa.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
          <MessageCircle size={18} aria-hidden /> {dict.home.whatsapp}
        </a>
      ) : (
        <button type="button" className="btn btn-ghost" onClick={demo}>
          <MessageCircle size={18} aria-hidden /> {dict.home.whatsapp}
        </button>
      )}
      {maps ? (
        <a className="btn btn-ghost" href={maps} target="_blank" rel="noopener noreferrer">
          <Navigation size={18} aria-hidden /> {dict.home.directions}
        </a>
      ) : (
        <button type="button" className="btn btn-ghost" onClick={demo}>
          <Navigation size={18} aria-hidden /> {dict.home.directions}
        </button>
      )}
    </div>
  );
}

const ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday first

export function HoursTable() {
  const { locale, dict } = useI18n();
  const [today, setToday] = useState<number | null>(null);
  useEffect(() => setToday(localClock(new Date(), restaurant.timeZone).day), []);
  const dayName = (d: number) => new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2023, 0, 1 + d)));

  return (
    <table className={styles.hoursTable}>
      <caption className="visually-hidden">{dict.home.hoursTitle}</caption>
      <tbody>
        {ORDER.map((d) => {
          const ranges = restaurant.hours[d as keyof typeof restaurant.hours];
          return (
            <tr key={d} className={d === today ? styles.today : undefined} aria-current={d === today ? 'date' : undefined}>
              <th scope="row">{dayName(d)}</th>
              <td className="tabular">{ranges.length ? ranges.map(([a, b]) => `${a}–${b}`).join(' · ') : dict.common.closedDay}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
