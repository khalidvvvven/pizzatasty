import styles from './DemoBar.module.css';

/** Always visible: this prototype must never be mistaken for real restaurant information. */
export function DemoBar({ text, label }: { text: string; label: string }) {
  return (
    <div className={styles.bar} role="note">
      <span className={styles.pill}>{label}</span>
      <span>{text}</span>
    </div>
  );
}
