import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { KeyRound } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { useAuth } from '../auth/AuthProvider';
import { Field, Notice, Spinner, errorProps } from '../components/ui';
import { EMAIL_RE } from '../lib/validation';
import { AuthLayout, authErrorMessage } from './AuthLayout';

export default function ForgotPassword() {
  const { t } = useI18n();
  const { configured, requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string>();
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const err = !email.trim() ? t.validation.required : !EMAIL_RE.test(email.trim()) ? t.validation.email : undefined;
    setError(err);
    if (err || !configured) return;
    setBusy(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (ex) {
      setFormError(authErrorMessage(ex, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title={t.auth.forgotTitle}
      subtitle={t.auth.forgotSubtitle}
      footer={
        <Link to="/login" className="font-bold text-academic hover:underline">
          {t.nav.login}
        </Link>
      }
    >
      {sent ? (
        <Notice tone="success">{t.auth.resetSent}</Notice>
      ) : (
        <form noValidate onSubmit={onSubmit} className="space-y-4">
          <Field label={t.auth.email} htmlFor="f-email" error={error}>
            <input {...errorProps('f-email', error)} type="email" dir="ltr" autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          {formError && <Notice tone="error">{formError}</Notice>}
          <button type="submit" className="btn-primary w-full py-3" disabled={busy || !configured}>
            {busy ? <Spinner className="size-4 text-white" /> : <KeyRound className="size-4" aria-hidden />}
            {t.auth.sendReset}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
