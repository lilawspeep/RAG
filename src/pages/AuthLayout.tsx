import type { ReactNode } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { Notice } from '../components/ui';
import { isSupabaseConfigured } from '../lib/supabase';
import logoSm from '../assets/alquds-logo-sm.png';

export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="relative overflow-hidden py-12 sm:py-16">
      <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-72 bg-gradient-to-b from-navy to-navy/0" />
      <div className="container-page flex justify-center">
        <div className="w-full max-w-md animate-fade-up">
          <div className="card p-7 sm:p-9">
            <div className="mb-6 flex flex-col items-center text-center">
              <span className="mb-4 grid size-16 place-items-center rounded-2xl bg-warm p-1.5 ring-1 ring-gold/40">
                <img src={logoSm} alt={t.hero.logoAlt} width={52} height={50} className="h-auto w-13" />
              </span>
              <h1 className="text-2xl font-extrabold text-navy">{title}</h1>
              {subtitle && <p className="mt-2 text-sm text-muted">{subtitle}</p>}
            </div>
            {!isSupabaseConfigured && (
              <Notice tone="warning" title={t.config.backendMissingTitle} className="mb-5">
                {t.config.authPending}
              </Notice>
            )}
            {children}
          </div>
          {footer && <div className="mt-5 text-center text-sm text-muted">{footer}</div>}
        </div>
      </div>
    </div>
  );
}

export function authErrorMessage(err: unknown, t: ReturnType<typeof useI18n>['t']): string {
  const e = err as { code?: string; message?: string };
  const code = e?.code ?? '';
  const msg = e?.message ?? '';
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(msg)) return t.auth.invalidCredentials;
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(msg)) return t.auth.emailNotConfirmed;
  if (code === 'user_already_exists' || /already registered|already_registered/i.test(msg)) return t.auth.alreadyRegistered;
  if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit') return t.advisor.rateLimited;
  if (code === 'weak_password') return t.validation.passwordWeak;
  return t.common.errorGeneric;
}
