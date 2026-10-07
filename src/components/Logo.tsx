import styles from './Logo.module.css';

/**
 * DEMO brand mark (a slice in a tomato roundel) and wordmark. The real Pizza Tasty logo
 * is UNKNOWN: swap this component when the owner provides it.
 */
export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className={styles.mark}>
      <circle cx="24" cy="24" r="24" fill="#C8321E" />
      <path d="M11.5 15.5c7.6-4.3 17.4-4.3 25 0L24 39.5z" fill="#FFF1CF" />
      <path d="M11.5 15.5c7.6-4.3 17.4-4.3 25 0l-1.6 3.1c-6.6-3.6-15.2-3.6-21.8 0z" fill="#F2B33D" />
      <circle cx="20" cy="22.5" r="2.6" fill="#C8321E" />
      <circle cx="27.6" cy="21.6" r="2.2" fill="#C8321E" />
      <circle cx="24.2" cy="29.4" r="2.1" fill="#C8321E" />
    </svg>
  );
}

export function Logo({ tone = 'ink' }: { tone?: 'ink' | 'cream' }) {
  return (
    <span className={`${styles.logo} ${tone === 'cream' ? styles.cream : ''}`}>
      <LogoMark />
      <span className={styles.word}>
        Pizza<span className={styles.accent}>Tasty</span>
      </span>
    </span>
  );
}
