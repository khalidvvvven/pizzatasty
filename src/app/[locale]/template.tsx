import type { ReactNode } from 'react';
import styles from './template.module.css';

/** Re-mounts on every navigation, giving each page a short entrance. */
export default function Template({ children }: { children: ReactNode }) {
  return <div className={styles.enter}>{children}</div>;
}
