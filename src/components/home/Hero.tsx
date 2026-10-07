import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import type { Locale } from '@/domain/types';
import type { Dictionary } from '@/i18n';
import { OpenStatus } from '../OpenStatus';
import styles from './Hero.module.css';

export function Hero({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  return (
    <section className={`${styles.hero} on-red`} aria-labelledby="hero-title">
      <div className={`container ${styles.inner}`}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>{dict.hero.eyebrow}</p>
          <h1 id="hero-title" className={styles.title}>
            {dict.hero.title}
          </h1>
          <p className={styles.subtitle}>{dict.hero.subtitle}</p>
          <div className={styles.status}>
            <OpenStatus tone="red" />
          </div>
          <div className={styles.ctas}>
            <Link href={`/${locale}/menu`} className={`btn btn-lg ${styles.primary}`}>
              {dict.hero.order}
              <ArrowRight size={20} aria-hidden />
            </Link>
            <a href="#categories" className="btn btn-lg btn-outline-cream">
              {dict.hero.viewMenu}
            </a>
          </div>
        </div>
        <div className={styles.visual}>
          <div className={styles.glow} aria-hidden="true" />
          <img src="/food/hero-pizza.svg" alt={dict.hero.pizzaAlt} width={800} height={800} fetchPriority="high" decoding="async" className={styles.pizza} />
        </div>
      </div>
    </section>
  );
}
