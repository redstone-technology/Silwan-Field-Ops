import { format, startOfWeek, addDays, isSameDay } from "date-fns";

export const mins = (n: number) => n * 60_000;
export const toISO = (d: Date | number) => new Date(d).toISOString();
export const ms = (iso?: string) => (iso ? new Date(iso).getTime() : NaN);

export const hm = (iso?: string) => (iso ? format(new Date(iso), "H:mm") : "—");
export const dayLabel = (iso: string) => format(new Date(iso), "EEE d MMM");
export const slot = (start: string, end: string) => `${hm(start)}–${hm(end)}`;

/** Week starts Sunday (Qatar work week). */
export const weekStart = (d: Date) => startOfWeek(d, { weekStartsOn: 0 });
export const weekDays = (d: Date) =>
  Array.from({ length: 7 }, (_, i) => addDays(weekStart(d), i));
export { isSameDay, format, addDays };

export function ago(iso: string, now: number): string {
  const diff = Math.round((now - ms(iso)) / 60000);
  if (diff < 1) return "just now";
  if (diff < 60) return `${diff} min ago`;
  const h = Math.floor(diff / 60);
  if (h < 24) return `${h} h ${diff % 60} min ago`;
  return format(new Date(iso), "EEE H:mm");
}

export function minsText(m: number): string {
  m = Math.round(m);
  if (Math.abs(m) < 60) return `${m} min`;
  const h = Math.floor(Math.abs(m) / 60);
  const r = Math.abs(m) % 60;
  return `${m < 0 ? "-" : ""}${h} h${r ? ` ${r} min` : ""}`;
}

export function hoursText(h: number): string {
  if (!h) return "0h";
  return `${Math.round(h * 10) / 10}h`;
}

export function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Random id for new records (the database will make these in the real build). */
export const newId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;

/** Milliseconds since a timestamp. */
export const ageMs = (t: number) => Date.now() - t;
