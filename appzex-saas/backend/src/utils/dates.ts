const DAY_MS = 24 * 60 * 60 * 1000;

/** Today's date at 00:00 UTC. Date-only columns are stored at UTC midnight. */
export function startOfTodayUtc(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** Whole days from `from` to `to` (negative when `to` is in the past). */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}

/** Parses `YYYY-MM-DD` into a UTC-midnight Date. */
export function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function toDateOnlyString(date: Date | null | undefined): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}
