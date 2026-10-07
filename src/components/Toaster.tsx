'use client';

import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './Toaster.module.css';

export interface ToastInput {
  message: string;
  action?: { label: string; onClick: () => void };
  /** ms; actions get longer so people can reach them. */
  duration?: number;
}

/**
 * While a modal <dialog> is open, everything outside it is inert, so a toast rendered in
 * <body> could be seen but not clicked or announced. Toasts are therefore portalled into the
 * open sheet (ignoring one that is closing), or into <body> when no sheet is open.
 */
function currentHost(): HTMLElement {
  const open = [...document.querySelectorAll<HTMLDialogElement>('dialog[open]:not([data-closing])')];
  const focused = document.activeElement?.closest<HTMLDialogElement>('dialog[open]:not([data-closing])');
  return focused ?? open.at(-1) ?? document.body;
}

/** One toast at a time: a new one replaces the old. */
export function Toaster({ register, closeLabel }: { register: (fn: (t: ToastInput) => void) => void; closeLabel: string }) {
  const [toast, setToast] = useState<(ToastInput & { id: number }) | null>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const counter = useRef(0);

  // Mount the (empty) live region at load: regions created together with their first message are often not announced.
  useEffect(() => setHost(document.body), []);

  useEffect(() => {
    register((t) => {
      counter.current += 1;
      setToast({ ...t, id: counter.current });
    });
  }, [register]);

  // Pick the host after the sheets have reacted to the same update (e.g. a sheet starting to close).
  useEffect(() => {
    if (!toast) return;
    const raf = requestAnimationFrame(() => setHost(currentHost()));
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), toast.duration ?? (toast.action ? 6000 : 3200));
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer.current);
    };
  }, [toast]);

  // If the hosting sheet closes while the toast is visible, move the toast back to the page.
  useEffect(() => {
    if (!(host instanceof HTMLDialogElement)) return;
    const back = () => setHost(currentHost());
    host.addEventListener('close', back);
    return () => host.removeEventListener('close', back);
  }, [host]);

  if (!host) return null;
  return createPortal(
    <div className={styles.region} role="status" aria-live="polite" aria-atomic="true">
      {toast && (
        <div key={toast.id} className={styles.toast}>
          <span className={styles.message}>{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              className={styles.action}
              onClick={() => {
                toast.action?.onClick();
                setToast(null);
              }}
            >
              {toast.action.label}
            </button>
          )}
          <button type="button" className={styles.close} onClick={() => setToast(null)} aria-label={closeLabel}>
            <X size={16} aria-hidden />
          </button>
        </div>
      )}
    </div>,
    host,
  );
}
