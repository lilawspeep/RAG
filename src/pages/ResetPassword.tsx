import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { KeyRound } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { useAuth } from '../auth/AuthProvider';
import { Field, Notice, PageLoader, Spinner, errorProps } from '../components/ui';
import { isStrongPassword } from '../lib/validation';
import { AuthLayout, authErrorMessage } from './AuthLayout';

export default function ResetPassword() {
  const { t } = useI18n();
  const { configured, loading, session, recoveryMode, updatePassword } = useAuth();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [errors, setErrors] = useState<{ pw?: string; pw2?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  if (configured && loading) return <PageLoader />;
  const canReset = configured && (recoveryMode || !!session);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const errs = {
      pw: !pw ? t.validation.required : !isStrongPassword(pw) ? t.validation.passwordWeak : undefined,
      pw2: pw2 !== pw ? t.validation.passwordMismatch : undefined,
    };
    setErrors(errs);
    if (errs.pw || errs.pw2) return;
    setBusy(true);
    try {
      await updatePassword(pw);
      setDone(true);
    } catch (ex) {
      setFormError(authErrorMessage(ex, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title={t.auth.resetTitle}>
      {done ? (
        <div className="space-y-4">
          <Notice tone="success">{t.auth.passwordUpdated}</Notice>
          <Link to="/user" className="btn-primary w-full">
            {t.nav.dashboard}
          </Link>
        </div>
      ) : !canReset ? (
        <div className="space-y-4">
          <Notice tone="error">{t.auth.resetLinkInvalid}</Notice>
          <Link to="/forgot-password" className="btn-outline w-full">
            {t.auth.forgotTitle}
          </Link>
        </div>
      ) : (
        <form noValidate onSubmit={onSubmit} className="space-y-4">
          <Field label={t.auth.newPassword} htmlFor="rp-1" error={errors.pw}>
            <input {...errorProps('rp-1', errors.pw)} type="password" autoComplete="new-password" className="input" value={pw} onChange={(e) => setPw(e.target.value)} />
          </Field>
          <Field label={t.auth.confirmPassword} htmlFor="rp-2" error={errors.pw2}>
            <input {...errorProps('rp-2', errors.pw2)} type="password" autoComplete="new-password" className="input" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          </Field>
          {formError && <Notice tone="error">{formError}</Notice>}
          <button type="submit" className="btn-primary w-full py-3" disabled={busy}>
            {busy ? <Spinner className="size-4 text-white" /> : <KeyRound className="size-4" aria-hidden />}
            {t.auth.updatePassword}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
