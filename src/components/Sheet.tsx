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
  const openedAt = useRef(0);
  const pressStartedOnBackdrop = useRef(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && dialog.open && dialog.hasAttribute('data-closing')) {
      // Reopened during the exit animation: cancel the close (its timer was cleared with the effect).
      dialog.removeAttribute('data-closing');
      dialog.inert = false;
      openedAt.current = performance.now();
    } else if (open && !dialog.open) {
      dialog.removeAttribute('data-closing');
      dialog.inert = false;
      openedAt.current = performance.now();
      dialog.showModal();
    } else if (!open && dialog.open) {
      // Play the exit animation, then close (immediately when motion is reduced). While it plays the
      // sheet is inert, so a double-click can't add an item twice or act on a closing sheet.
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduce) return dialog.close();
      dialog.setAttribute('data-closing', '');
      dialog.inert = true;
      const done = () => {
        dialog.removeAttribute('data-closing');
        dialog.inert = false;
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
      onPointerDown={(e) => {
        pressStartedOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        // A click on the backdrop lands on the <dialog> element itself. Only close when the press also
        // started there (a text selection dragged outside must not close it), and ignore the click that
        // may land on the fresh backdrop right after a double-click opened the sheet.
        const onBackdrop = e.target === e.currentTarget && pressStartedOnBackdrop.current;
        if (onBackdrop && performance.now() - openedAt.current > 300) onClose();
      }}
    >
      <div className={styles.inner}>{children}</div>
    </dialog>
  );
}
