import { Clock, Phone, Users } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ReservationForm } from '@/components/reservation/ReservationForm';
import { restaurant } from '@/config/restaurant';
import { fill, getDictionary, isLocale } from '@/i18n';
import styles from './page.module.css';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getDictionary(locale).reservation.title };
}

const INFO_ICONS = [Users, Phone, Clock];

export default async function ReservationPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale).reservation;

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.layout}>
        <aside className={`${styles.aside} on-dark`}>
          <div className={styles.art} aria-hidden="true">
            <img src="/food/margherita.svg" alt="" width={260} height={260} className={styles.artA} />
            <img src="/food/limonade.svg" alt="" width={150} height={150} className={styles.artB} />
          </div>
          <h1 className={styles.title}>{t.title}</h1>
          <p className={styles.lead}>{t.lead}</p>
          <h2 className={styles.infoTitle}>{t.infoTitle}</h2>
          <ul className={styles.info}>
            {t.info.map((line, i) => {
              const Icon = INFO_ICONS[i] ?? Clock;
              return (
                <li key={line}>
                  <Icon size={18} aria-hidden />
                  {fill(line, { max: restaurant.reservation.maxGuests })}
                </li>
              );
            })}
          </ul>
        </aside>
        <section className={styles.card} aria-label={t.title}>
          <ReservationForm />
        </section>
      </div>
    </div>
  );
}
