import { type ClassValue, clsx } from 'clsx';
import { formatDistanceToNowStrict } from 'date-fns';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const shortDateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

/** Date-only values are stored at UTC midnight, so format them in UTC. */
export function formatDate(value: string | null | undefined, fallback = '—') {
  if (!value) return fallback;
  return dateFormatter.format(new Date(value));
}

export function formatShortDate(value: string | null | undefined, fallback = '—') {
  if (!value) return fallback;
  return shortDateFormatter.format(new Date(value));
}

export function formatDateTime(value: string | null | undefined, fallback = '—') {
  if (!value) return fallback;
  return dateTimeFormatter.format(new Date(value));
}

export function timeAgo(value: string | null | undefined, fallback = 'never') {
  if (!value) return fallback;
  return `${formatDistanceToNowStrict(new Date(value))} ago`;
}

/** YYYY-MM-DD for today in the user's local time zone. */
export function todayIso() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" portion of an ISO string, for date inputs. */
export function toDateInput(value: string | null | undefined) {
  return value ? value.slice(0, 10) : '';
}

/** Days from today until a date-only value (negative = overdue). */
export function daysUntil(value: string | null | undefined): number | null {
  if (!value) return null;
  const target = Date.parse(value.slice(0, 10));
  const today = Date.parse(todayIso());
  return Math.round((target - today) / 86_400_000);
}

export function isOverdue(dueDate: string | null | undefined, done: boolean) {
  const days = daysUntil(dueDate);
  return !done && days !== null && days < 0;
}

export function dueLabel(dueDate: string | null | undefined, done = false) {
  const days = daysUntil(dueDate);
  if (days === null) return 'No due date';
  if (done) return `Due ${formatShortDate(dueDate)}`;
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days <= 7) return `Due in ${days}d`;
  return `Due ${formatShortDate(dueDate)}`;
}

/** "12 days to go" / "3 days overdue" / "Completed". */
export function daysLeftLabel(dueDate: string | null | undefined, done = false) {
  if (done) return 'Completed';
  const days = daysUntil(dueDate);
  if (days === null) return 'No date set yet';
  if (days < 0) return `${Math.abs(days)} day${days === -1 ? '' : 's'} overdue`;
  if (days === 0) return 'Due today';
  return `${days} day${days === 1 ? '' : 's'} to go`;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}
