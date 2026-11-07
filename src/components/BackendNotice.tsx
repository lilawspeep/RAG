import { isSupabaseConfigured } from '../lib/supabase';
import { useI18n } from '../i18n/I18nProvider';
import { Notice } from './ui';

/** Honest notice rendered on data-driven pages when no backend is connected. */
export function BackendNotice({ className = '' }: { className?: string }) {
  const { t } = useI18n();
  if (isSupabaseConfigured) return null;
  return (
    <Notice tone="warning" title={t.config.backendMissingTitle} className={className}>
      {t.config.backendMissing}
    </Notice>
  );
}
