import { ArrowRight, Bike, Flame, Leaf, ShoppingBag, Timer, UtensilsCrossed } from 'lucide-react';
import Link from 'next/link';
import { restaurant } from '@/config/restaurant';
import { formatMoney } from '@/domain/money';
import type { Category, Locale, Product } from '@/domain/types';
import { fill, type Dictionary } from '@/i18n';
import { ProductCard } from '../ProductCard';
import { ContactActions, HoursTable } from './ContactBlocks';
import { OpenStatus } from '../OpenStatus';
import styles from './Sections.module.css';

type Props = { locale: Locale; dict: Dictionary };

export function CategoryStrip({ locale, dict, categories }: Props & { categories: Category[] }) {
  return (
    <section id="categories" className="section" aria-labelledby="cat-title" style={{ scrollMarginTop: 'calc(var(--header-h) + 8px)' }}>
      <div className="container">
        <div className="section-head">
          <div>
            <h2 id="cat-title" className="section-title">
              {dict.home.categoriesTitle}
            </h2>
            <p className="section-lead">{dict.home.categoriesLead}</p>
          </div>
          <Link href={`/${locale}/menu`} className={`link-arrow ${styles.hideSm}`}>
            {dict.home.seeAll} <ArrowRight size={18} aria-hidden />
          </Link>
        </div>
        <ul className={`scroller ${styles.cats}`}>
          {categories.map((c, i) => (
            <li key={c.id}>
              <Link href={`/${locale}/menu#${c.id}`} className={styles.cat}>
                <span className={styles.catArt} style={{ background: c.tint, ['--tilt' as string]: `${i % 2 ? 4 : -4}deg` }}>
                  <img src={c.image} alt="" width={120} height={120} loading="lazy" />
                </span>
                <span className={styles.catName}>{c.name[locale]}</span>
              </Link>
            </li>
          ))}
        </ul>
        <Link href={`/${locale}/menu`} className={`btn btn-ghost btn-block ${styles.showSm}`}>
          {dict.home.seeAll}
        </Link>
      </div>
    </section>
  );
}

export function BestSellers({ dict, products }: Props & { products: Product[] }) {
  return (
    <section className={`section ${styles.best}`} aria-labelledby="best-title">
      <div className="container">
        <div className="section-head">
          <div>
            <p className="eyebrow">
              <Flame size={14} aria-hidden /> {dict.home.bestLead}
            </p>
            <h2 id="best-title" className="section-title">
              {dict.home.bestTitle}
            </h2>
          </div>
        </div>
        <ul className={`scroller ${styles.bestList}`}>
          {products.map((p) => (
            <li key={p.id} className={styles.bestItem}>
              <ProductCard product={p} layout="tile" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function Promo({ locale, dict }: Props) {
  return (
    <section className="section" aria-labelledby="promo-title">
      <div className="container">
        <div className={`${styles.promo} on-dark`}>
          <div className={styles.promoCopy}>
            <p className={styles.promoEyebrow}>
              {dict.home.promoEyebrow} <span className="demo-pill">{dict.home.promoNote}</span>
            </p>
            <h2 id="promo-title" className={styles.promoTitle}>
              {dict.home.promoTitle}
            </h2>
            <p className={styles.promoText}>{dict.home.promoText}</p>
            <Link href={`/${locale}/menu#pizza`} className="btn btn-lg btn-cream">
              {dict.home.promoCta} <ArrowRight size={20} aria-hidden />
            </Link>
          </div>
          <div className={styles.promoArt} aria-hidden="true">
            <img src="/food/pepperoni.svg" alt="" width={320} height={320} loading="lazy" className={styles.promoPizzaA} />
            <img src="/food/margherita.svg" alt="" width={260} height={260} loading="lazy" className={styles.promoPizzaB} />
            <span className={styles.promoBadge}>
              –50<small>%</small>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

const WHY_ICONS = [Flame, Leaf, Timer];

export function Why({ dict }: Props) {
  return (
    <section className="section" aria-labelledby="why-title">
      <div className="container">
        <div className="section-head">
          <h2 id="why-title" className="section-title">
            {dict.home.whyTitle}
          </h2>
          <span className="demo-pill">{dict.home.whyNote}</span>
        </div>
        <ul className={styles.why}>
          {dict.home.why.map((w, i) => {
            const Icon = WHY_ICONS[i] ?? Flame;
            return (
              <li key={w.title} className={styles.whyItem}>
                <span className={styles.whyIcon} aria-hidden="true">
                  <Icon size={26} />
                </span>
                <h3 className={styles.whyTitle}>{w.title}</h3>
                <p className={styles.whyText}>{w.text}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export function Modes({ locale, dict }: Props) {
  const money = (c: number) => formatMoney(c, locale, restaurant.currency);
  const items = [
    { id: 'dine-in' as const, Icon: UtensilsCrossed, text: dict.home.modes['dine-in'].text },
    { id: 'takeaway' as const, Icon: ShoppingBag, text: dict.home.modes.takeaway.text },
    { id: 'delivery' as const, Icon: Bike, text: fill(dict.home.modes.delivery.text, { fee: money(restaurant.delivery.fee), free: money(restaurant.delivery.freeFrom) }) },
  ];
  return (
    <section className={`section ${styles.modesSection}`} aria-labelledby="modes-title">
      <div className="container">
        <div className="section-head">
          <h2 id="modes-title" className="section-title">
            {dict.home.modesTitle}
          </h2>
        </div>
        <ul className={styles.modes}>
          {items.map(({ id, Icon, text }) => (
            <li key={id} className={styles.mode}>
              <span className={styles.modeIcon} aria-hidden="true">
                <Icon size={28} />
              </span>
              <div>
                <h3 className={styles.modeTitle}>{dict.home.modes[id].title}</h3>
                <p className={styles.modeText}>{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function ReserveCta({ locale, dict }: Props) {
  return (
    <section className="section" aria-labelledby="reserve-title">
      <div className="container">
        <div className={styles.reserve}>
          <div className={styles.reserveCopy}>
            <h2 id="reserve-title" className={styles.reserveTitle}>
              {dict.home.reserveTitle}
            </h2>
            <p>{dict.home.reserveText}</p>
          </div>
          <div className={styles.reserveActions}>
            <p className={styles.guestsLabel} id="guests-quick">
              {dict.home.guests}
            </p>
            <ul className={styles.guests} aria-labelledby="guests-quick">
              {[2, 3, 4, 5, 6].map((n) => (
                <li key={n}>
                  <Link href={`/${locale}/reservation?guests=${n}`} className={styles.guest}>
                    {n === 6 ? '6+' : n}
                  </Link>
                </li>
              ))}
            </ul>
            <Link href={`/${locale}/reservation`} className="btn btn-lg btn-dark">
              {dict.home.reserveCta} <ArrowRight size={20} aria-hidden />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export function FindUs({ dict }: Props) {
  return (
    <section id="contact" className="section" aria-labelledby="find-title" style={{ scrollMarginTop: 'calc(var(--header-h) + 8px)' }}>
      <div className="container">
        <div className={styles.find}>
          <div className={styles.findInfo}>
            <h2 id="find-title" className="section-title">
              {dict.home.findTitle}
            </h2>
            <p className={styles.address}>
              {restaurant.address ? `${restaurant.address.street}, ${restaurant.address.city}` : dict.home.addressPending}
              {restaurant.isDemo && <span className="demo-pill">{dict.common.demo}</span>}
            </p>
            <p className={styles.addressNote}>{dict.home.addressDemo}</p>
            <OpenStatus />
            <ContactActions />
          </div>
          <div className={styles.hours}>
            <h3 className={styles.hoursTitle}>{dict.home.hoursTitle}</h3>
            <HoursTable />
          </div>
        </div>
      </div>
    </section>
  );
}
