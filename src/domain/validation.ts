import type { CheckoutDetails, OrderMode } from './types';

/** Lenient on purpose: accepts local and international formats, rejects obvious typos. */
export const isValidPhone = (v: string) => {
  if (!/^\+?[\d\s().-]+$/.test(v.trim())) return false;
  const digits = v.replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15;
};

export type CheckoutField = 'table' | 'name' | 'phone' | 'address';
export type FieldError = 'required' | 'phone' | 'table' | 'address';

/** Which fields each order mode asks for: only what that mode needs (progressive disclosure). */
export const FIELDS_BY_MODE: Record<OrderMode, CheckoutField[]> = {
  'dine-in': ['table'],
  takeaway: ['name', 'phone'],
  delivery: ['name', 'phone', 'address'],
};

export function validateCheckout(mode: OrderMode, d: CheckoutDetails): Partial<Record<CheckoutField, FieldError>> {
  const errors: Partial<Record<CheckoutField, FieldError>> = {};
  for (const field of FIELDS_BY_MODE[mode]) {
    const value = d[field].trim();
    if (!value) errors[field] = 'required';
    else if (field === 'phone' && !isValidPhone(value)) errors.phone = 'phone';
    else if (field === 'table' && !/^([1-9]\d?)$/.test(value)) errors.table = 'table';
    else if (field === 'address' && value.length < 8) errors.address = 'address';
  }
  return errors;
}
