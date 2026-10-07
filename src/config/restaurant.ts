import type { WeeklyHours } from '@/domain/hours';
import type { Cents, Locale } from '@/domain/types';

/**
 * Restaurant facts.
 *
 * ⚠️ EVERYTHING HERE IS DEMO DATA. None of it is verified Pizza Tasty information.
 * Real values come from the owner (docs/discovery/intake.md). While `isDemo` is true the
 * UI labels these facts as demo and never sends anyone to a fake phone number.
 */
export const restaurant = {
  isDemo: true,
  name: 'Pizza Tasty',
  /** Language staff read orders in (labels and item names in the WhatsApp message). UNKNOWN: demo value. */
  staffLocale: 'fr' as Locale,
  defaultLocale: 'fr' as Locale,
  currency: 'EUR',
  timeZone: 'Europe/Paris',
  /** null = not configured. The WhatsApp step then shows the message in a clearly marked demo state. */
  whatsappNumber: null as string | null,
  /** null = not configured. Call buttons then show a demo notice instead of dialling. */
  phone: null as string | null,
  address: null as null | { street: string; city: string; mapsUrl: string },
  hours: {
    0: [['18:00', '23:00']],
    1: [['11:30', '14:30'], ['18:00', '23:00']],
    2: [['11:30', '14:30'], ['18:00', '23:00']],
    3: [['11:30', '14:30'], ['18:00', '23:00']],
    4: [['11:30', '14:30'], ['18:00', '23:00']],
    5: [['11:30', '14:30'], ['18:00', '00:00']],
    6: [['11:30', '00:00']],
  } satisfies WeeklyHours as WeeklyHours,
  delivery: {
    fee: 250 as Cents,
    freeFrom: 2500 as Cents,
    minimumOrder: 1500 as Cents,
    etaMinutes: [30, 45] as [number, number],
  },
  takeawayEtaMinutes: [15, 25] as [number, number],
  reservation: { maxGuests: 12, daysAhead: 30 },
  social: [] as Array<{ label: string; url: string }>,
} as const;

export type Restaurant = typeof restaurant;
