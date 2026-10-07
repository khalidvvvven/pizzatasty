/** Opening hours as "HH:MM" ranges per weekday (0 = Sunday). Ranges may cross midnight ("18:00"–"01:00"). */
export type WeeklyHours = Record<0 | 1 | 2 | 3 | 4 | 5 | 6, Array<[string, string]>>;

export type OpenStatus =
  | { open: true; closesAt: string }
  | { open: false; opensAt: { day: number; time: string } | null };

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/** Weekday and minutes-since-midnight at the restaurant, whatever the visitor's own time zone is. */
export function localClock(now: Date, timeZone: string): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  return { day, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

export function openStatus(hours: WeeklyHours, now: Date, timeZone: string): OpenStatus {
  const { day, minutes } = localClock(now, timeZone);
  const dayRanges = (d: number) => hours[((d + 7) % 7) as keyof WeeklyHours] ?? [];

  // Today's ranges, plus yesterday's ranges that run past midnight.
  for (const [start, end] of dayRanges(day)) {
    const s = toMin(start), e = toMin(end);
    if (e > s ? minutes >= s && minutes < e : minutes >= s) return { open: true, closesAt: end };
  }
  for (const [start, end] of dayRanges(day - 1)) {
    const s = toMin(start), e = toMin(end);
    if (e < s && minutes < e) return { open: true, closesAt: end };
  }
  // Next opening within a week.
  for (let offset = 0; offset < 8; offset++) {
    const d = (day + offset) % 7;
    const next = dayRanges(d)
      .map(([start]) => start)
      .filter((start) => offset > 0 || toMin(start) > minutes)
      .sort((a, b) => toMin(a) - toMin(b))[0];
    if (next) return { open: false, opensAt: { day: d, time: next } };
  }
  return { open: false, opensAt: null };
}

/** Bookable time slots for a date: every `step` minutes, ending `lastBefore` minutes before closing. */
export function reservationSlots(hours: WeeklyHours, weekday: number, step = 30, lastBefore = 60): string[] {
  const out: string[] = [];
  for (const [start, end] of hours[weekday as keyof WeeklyHours] ?? []) {
    const s = toMin(start);
    let e = toMin(end);
    if (e <= s) e += 24 * 60;
    for (let t = s; t <= e - lastBefore; t += step) {
      const m = t % (24 * 60);
      out.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
    }
  }
  return out;
}
