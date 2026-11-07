import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { GraduationCap, LogIn, ShieldCheck } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { useAuth } from '../auth/AuthProvider';
import { Field, Notice, Spinner, errorProps } from '../components/ui';
import { hasErrors, validateLogin, type Errors } from '../lib/validation';
import { AuthLayout, authErrorMessage } from './AuthLayout';

type Tab = 'student' | 'admin';

export default function Login() {
  const { t } = useI18n();
  const { configured, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('as') === 'admin' ? 'admin' : 'student';
  const from = (location.state as { from?: string; reason?: string } | null)?.from;
  const reason = (location.state as { reason?: string } | null)?.reason;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors<'email' | 'password'>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const setTab = (next: Tab) => setParams(next === 'admin' ? { as: 'admin' } : {}, { replace: true, state: location.state });

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const errs = validateLogin({ email, password }, t.validation);
    setErrors(errs);
    if (hasErrors(errs) || !configured) return;
    setBusy(true);
    try {
      const { roles } = await signIn(email, password);
      const admin = roles.includes('admin');
      if (tab === 'admin') {
        if (admin) navigate(from?.startsWith('/admin') ? from : '/admin', { replace: true });
        else navigate('/user', { replace: true, state: { notice: 'notAdmin' } });
      } else {
        navigate(from && !from.startsWith('/admin') ? from : '/user', { replace: true });
      }
    } catch (err) {
      setFormError(authErrorMessage(err, t));
    } finally {
      setBusy(false);
    }
  };

  const tabs: { id: Tab; label: string; icon: typeof GraduationCap }[] = [
    { id: 'student', label: t.auth.studentTab, icon: GraduationCap },
    { id: 'admin', label: t.auth.adminTab, icon: ShieldCheck },
  ];

  return (
    <AuthLayout
      title={t.auth.loginTitle}
      subtitle={t.auth.loginSubtitle}
      footer={
        <>
          {t.auth.noAccount}{' '}
          <Link to="/register" className="font-bold text-academic hover:underline">
            {t.nav.register}
          </Link>
        </>
      }
    >
      <div role="tablist" aria-label={t.auth.loginTitle} className="mb-5 grid grid-cols-2 rounded-xl bg-mist p-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-bold transition ${
              tab === id ? 'bg-white text-navy shadow-sm' : 'text-muted hover:text-navy'
            }`}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      {reason === 'login' && <Notice className="mb-4">{t.auth.loginRequired}</Notice>}
      {tab === 'admin' && (
        <Notice tone="info" className="mb-4">
          {t.auth.adminNote}
        </Notice>
      )}

      <form noValidate onSubmit={onSubmit} className="space-y-4">
        <Field label={t.auth.email} htmlFor="l-email" error={errors.email}>
          <input {...errorProps('l-email', errors.email)} type="email" dir="ltr" autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label={t.auth.password} htmlFor="l-password" error={errors.password}>
          <input {...errorProps('l-password', errors.password)} type="password" autoComplete="current-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm font-semibold text-academic hover:underline">
            {t.auth.forgot}
          </Link>
        </div>
        {formError && <Notice tone="error">{formError}</Notice>}
        <button type="submit" className="btn-primary w-full py-3" disabled={busy || !configured}>
          {busy ? <Spinner className="size-4 text-white" /> : <LogIn className="size-4 rtl:-scale-x-100" aria-hidden />}
          {busy ? t.auth.signingIn : t.auth.submitLogin}
        </button>
        {!configured && <p className="text-center text-xs text-muted">{t.auth.disabledNoBackend}</p>}
      </form>
    </AuthLayout>
  );
}
