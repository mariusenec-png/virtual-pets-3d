import { en, type MessageKey } from './en';
import { ro } from './ro';

/**
 * Minimal i18n. Dictionaries are flat key → string maps; `{param}` markers
 * are replaced by values. TypeScript guarantees every language has every key.
 */

export type Language = 'en' | 'ro';
export type LanguageSetting = 'auto' | Language;
export type { MessageKey };

const DICTS: Record<Language, Record<MessageKey, string>> = { en, ro };

let current: Language = 'en';

export function resolveLanguage(setting: LanguageSetting): Language {
  if (setting !== 'auto') return setting;
  const nav = typeof navigator !== 'undefined' ? (navigator.languages?.[0] ?? navigator.language ?? '') : '';
  return nav.toLowerCase().startsWith('ro') ? 'ro' : 'en';
}

export function setLanguage(lang: Language): void {
  current = lang;
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
}

export function getLanguage(): Language {
  return current;
}

export type Params = Record<string, string | number>;

export function t(key: MessageKey, params?: Params): string {
  const template = DICTS[current][key] ?? en[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m));
}

/**
 * Count phrase with correct plural form, e.g. count(3, 'unit.hour') →
 * "3 hours" / "3 ore", count(24, 'unit.hour') → "24 hours" / "24 de ore".
 * Uses the keys `${base}.one`, `${base}.few` and `${base}.many`.
 */
export function count(n: number, base: 'unit.hour' | 'unit.day' | 'unit.pet'): string {
  const abs = Math.abs(n);
  let form: 'one' | 'few' | 'many' = 'many';
  if (abs === 1) form = 'one';
  else if (current === 'ro') {
    // Romanian: 2-19 (and 0, x01-x19) → "ore"; 20+ → "de ore".
    const rest = abs % 100;
    form = abs === 0 || (rest >= 1 && rest <= 19) ? 'few' : 'many';
  } else form = 'few';
  return t(`${base}.${form}` as MessageKey, { n });
}

/** Joins a list for display ("a, b and c" / "a, b și c"). */
export function list(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} ${t('common.and')} ${items[items.length - 1]}`;
}
