import type { Lang } from '../i18n/I18nProvider';

export function formatDate(value: string | null | undefined, lang: Lang): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(lang === 'ar' ? 'ar-PS' : 'en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(value: string | null | undefined, lang: Lang): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(lang === 'ar' ? 'ar-PS' : 'en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** "13:30:00" → "13:30" */
export const formatTime = (t: string | null | undefined) => (t ? t.slice(0, 5) : null);

export function formatBytes(n: number | null | undefined): string | null {
  if (n == null) return null;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
