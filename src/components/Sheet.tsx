'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import styles from './Sheet.module.css';

/**
 * Native <dialog> as a bottom sheet on phones and a centred dialog / side drawer on larger
 * screens. showModal() gives us focus containment, Esc handling, an inert background and
 * focus return to the opener for free, so no focus-trap library is needed.
 */
export function Sheet({
  open,
  onClose,
  labelledBy,
  desktop = 'center',
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  desktop?: 'center' | 'side';
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.removeAttribute('data-closing');
      dialog.showModal();
    } else if (!open && dialog.open) {
      // Play the exit animation, then close (immediately when motion is reduced).
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduce) return dialog.close();
      dialog.setAttribute('data-closing', '');
      const done = () => {
        dialog.removeAttribute('data-closing');
        dialog.close();
      };
      const t = window.setTimeout(done, 220);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`${styles.sheet} ${desktop === 'side' ? styles.side : styles.center} ${className ?? ''}`}
      aria-labelledby={labelledBy}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // A click on the backdrop lands on the <dialog> element itself.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.inner}>{children}</div>
    </dialog>
  );
}
