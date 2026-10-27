import { count, t } from '../i18n';

/** Formats in-game hours as a friendly age, e.g. "2 days 5 h". */
export function formatAge(hours: number): string {
  const total = Math.floor(hours);
  const days = Math.floor(total / 24);
  const h = total % 24;
  if (days === 0) return h === 0 ? t('time.newborn') : t('time.hoursShort', { n: h });
  return t('time.dayHours', { days: count(days, 'unit.day'), h });
}

export function formatHours(hours: number): string {
  if (hours < 1) return t('time.minutesShort', { n: Math.round(hours * 60) });
  return count(hours < 10 ? Math.round(hours * 10) / 10 : Math.round(hours), 'unit.hour');
}

export function formatClock(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
