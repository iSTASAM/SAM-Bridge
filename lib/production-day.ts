export const DAY_MS = 24 * 60 * 60 * 1000;

export function isDayKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function productionDayKey(ms = Date.now()) {
  return new Date(ms).toISOString().slice(0, 10);
}

export function productionDayRange(dayKey: string) {
  const start = Date.parse(`${dayKey}T00:00:00.000Z`);
  return { start, end: start + DAY_MS };
}

export function addDayKey(dayKey: string, days: number) {
  return new Date(Date.parse(`${dayKey}T00:00:00.000Z`) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

export function resolveDayKey(raw: string | null | undefined, now = Date.now()) {
  const current = productionDayKey(now);
  if (raw && isDayKey(raw) && raw <= current) return raw;
  return current;
}
