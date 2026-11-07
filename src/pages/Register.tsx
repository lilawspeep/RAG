import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { UserPlus } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { useAuth } from '../auth/AuthProvider';
import { Field, Notice, Spinner, errorProps } from '../components/ui';
import { hasErrors, validateRegister, type Errors, type RegisterValues } from '../lib/validation';
import { getSupabase } from '../lib/supabase';
import type { Department, Faculty, Major } from '../lib/types';
import { AuthLayout, authErrorMessage } from './AuthLayout';

const empty: RegisterValues = { fullName: '', email: '', password: '', confirmPassword: '', universityId: '', faculty: '', major: '' };

export default function Register() {
  const { t, lang, pick } = useI18n();
  const { configured, signUp } = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState(empty);
  const [errors, setErrors] = useState<Errors<keyof RegisterValues>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [catalog, setCatalog] = useState<{ faculties: Faculty[]; departments: Department[]; majors: Major[] }>({
    faculties: [],
    departments: [],
    majors: [],
  });

  useEffect(() => {
    let active = true;
    getSupabase().then(async (sb) => {
      if (!sb) return;
      const [f, d, m] = await Promise.all([
        sb.from('faculties').select('id,code,name_ar,name_en').order('name_ar'),
        sb.from('departments').select('id,faculty_id,code,name_ar,name_en'),
        sb.from('majors').select('id,department_id,code,name_ar,name_en,degree').order('name_ar'),
      ]);
      if (active) setCatalog({ faculties: f.data ?? [], departments: d.data ?? [], majors: m.data ?? [] });
    });
    return () => {
      active = false;
    };
  }, []);

  const useSelects = catalog.faculties.length > 0;
  const majorsForFaculty = useMemo(() => {
    const deptIds = new Set(catalog.departments.filter((d) => d.faculty_id === values.faculty).map((d) => d.id));
    return catalog.majors.filter((m) => deptIds.has(m.department_id));
  }, [catalog, values.faculty]);

  const set = (k: keyof RegisterValues) => (e: { target: { value: string } }) => {
    setValues((v) => ({ ...v, [k]: e.target.value, ...(k === 'faculty' ? { major: '' } : {}) }));
    if (errors[k]) setErrors((er) => ({ ...er, [k]: undefined }));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const errs = validateRegister(values, t.validation);
    setErrors(errs);
    if (hasErrors(errs)) {
      setFormError(t.validation.fixErrors);
      return;
    }
    if (!configured) return;
    setBusy(true);
    try {
      const { needsConfirmation } = await signUp({
        fullName: values.fullName,
        email: values.email,
        password: values.password,
        universityId: values.universityId,
        preferredLanguage: lang,
        ...(useSelects
          ? { facultyId: values.faculty, majorId: values.major }
          : { facultyText: values.faculty, majorText: values.major }),
      });
      if (needsConfirmation) {
        setSuccess(t.auth.registeredCheckEmail);
        setValues(empty);
      } else {
        navigate('/user', { replace: true });
      }
    } catch (err) {
      setFormError(authErrorMessage(err, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title={t.auth.registerTitle}
      subtitle={t.auth.registerSubtitle}
      footer={
        <>
          {t.auth.haveAccount}{' '}
          <Link to="/login" className="font-bold text-academic hover:underline">
            {t.nav.login}
          </Link>
        </>
      }
    >
      {success ? (
        <Notice tone="success">{success}</Notice>
      ) : (
        <form noValidate onSubmit={onSubmit} className="space-y-4">
          <Field label={t.auth.fullName} htmlFor="r-name" error={errors.fullName}>
            <input {...errorProps('r-name', errors.fullName)} className="input" autoComplete="name" value={values.fullName} onChange={set('fullName')} />
          </Field>
          <Field label={t.auth.email} htmlFor="r-email" error={errors.email}>
            <input {...errorProps('r-email', errors.email)} className="input" type="email" dir="ltr" autoComplete="email" value={values.email} onChange={set('email')} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.auth.password} htmlFor="r-pw" error={errors.password}>
              <input {...errorProps('r-pw', errors.password)} className="input" type="password" autoComplete="new-password" value={values.password} onChange={set('password')} />
            </Field>
            <Field label={t.auth.confirmPassword} htmlFor="r-pw2" error={errors.confirmPassword}>
              <input {...errorProps('r-pw2', errors.confirmPassword)} className="input" type="password" autoComplete="new-password" value={values.confirmPassword} onChange={set('confirmPassword')} />
            </Field>
          </div>
          <Field label={t.auth.universityId} htmlFor="r-uid" error={errors.universityId} optional>
            <input {...errorProps('r-uid', errors.universityId)} className="input" inputMode="numeric" dir="ltr" value={values.universityId} onChange={set('universityId')} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.auth.faculty} htmlFor="r-fac" error={errors.faculty}>
              {useSelects ? (
                <select {...errorProps('r-fac', errors.faculty)} className="input" value={values.faculty} onChange={set('faculty')}>
                  <option value="">{t.auth.selectFaculty}</option>
                  {catalog.faculties.map((f) => (
                    <option key={f.id} value={f.id}>
                      {pick(f.name_ar, f.name_en)}
                    </option>
                  ))}
                </select>
              ) : (
                <input {...errorProps('r-fac', errors.faculty)} className="input" placeholder={t.auth.facultyFree} value={values.faculty} onChange={set('faculty')} />
              )}
            </Field>
            <Field label={t.auth.major} htmlFor="r-major" error={errors.major}>
              {useSelects ? (
                <select {...errorProps('r-major', errors.major)} className="input" value={values.major} onChange={set('major')} disabled={!values.faculty}>
                  <option value="">{t.auth.selectMajor}</option>
                  {majorsForFaculty.map((m) => (
                    <option key={m.id} value={m.id}>
                      {pick(m.name_ar, m.name_en)}
                    </option>
                  ))}
                </select>
              ) : (
                <input {...errorProps('r-major', errors.major)} className="input" placeholder={t.auth.majorFree} value={values.major} onChange={set('major')} />
              )}
            </Field>
          </div>
          {formError && <Notice tone="error">{formError}</Notice>}
          <button type="submit" className="btn-gold w-full py-3" disabled={busy || !configured}>
            {busy ? <Spinner className="size-4" /> : <UserPlus className="size-4" aria-hidden />}
            {busy ? t.auth.registering : t.auth.submitRegister}
          </button>
          {!configured && <p className="text-center text-xs text-muted">{t.auth.disabledNoBackend}</p>}
        </form>
      )}
    </AuthLayout>
  );
}
