'use client';

import { Minus, Plus, Trash2 } from 'lucide-react';
import styles from './QuantityStepper.module.css';

/** When `onRemove` is given, "−" at the minimum becomes a remove button instead of being disabled. */
export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 20,
  label,
  decreaseLabel,
  increaseLabel,
  onRemove,
  removeLabel,
  size = 'md',
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  label: string;
  decreaseLabel: string;
  increaseLabel: string;
  onRemove?: () => void;
  removeLabel?: string;
  size?: 'sm' | 'md';
}) {
  const atMin = value <= min;
  const removeMode = atMin && !!onRemove;
  return (
    <div className={`${styles.stepper} ${size === 'sm' ? styles.sm : ''}`} role="group" aria-label={label}>
      <button
        type="button"
        className={styles.btn}
        onClick={() => (removeMode ? onRemove!() : onChange(value - 1))}
        disabled={atMin && !onRemove}
        aria-label={removeMode ? removeLabel : decreaseLabel}
      >
        {removeMode ? <Trash2 size={size === 'sm' ? 16 : 18} aria-hidden /> : <Minus size={size === 'sm' ? 16 : 18} strokeWidth={2.5} aria-hidden />}
      </button>
      <output className={`${styles.value} tabular`} aria-live="polite">
        {value}
      </output>
      <button type="button" className={styles.btn} onClick={() => onChange(value + 1)} disabled={value >= max} aria-label={increaseLabel}>
        <Plus size={size === 'sm' ? 16 : 18} strokeWidth={2.5} aria-hidden />
      </button>
    </div>
  );
}
