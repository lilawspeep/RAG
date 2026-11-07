import { useState, type FormEvent } from 'react';
import { Send } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { useAuth } from '../auth/AuthProvider';
import { getSupabase } from '../lib/supabase';
import { hasErrors, validateContact, type Errors } from '../lib/validation';
import { Field, Notice, Spinner, errorProps } from './ui';

type Values = { name: string; email: string; subject: string; message: string };
type Status = { kind: 'idle' } | { kind: 'sending' } | { kind: 'success' } | { kind: 'unavailable' } | { kind: 'failed' };

export function ContactForm() {
  const { t } = useI18n();
  const { user, profile } = useAuth();
  const [values, setValues] = useState<Values>({
    name: profile?.full_name ?? '',
    email: user?.email ?? '',
    subject: '',
    message: '',
  });
  const [errors, setErrors] = useState<Errors<keyof Values>>({});
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const set = (k: keyof Values) => (e: { target: { value: string } }) => {
    setValues((v) => ({ ...v, [k]: e.target.value }));
    if (errors[k]) setErrors((er) => ({ ...er, [k]: undefined }));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = validateContact(values, t.validation);
    setErrors(errs);
    if (hasErrors(errs)) return;
    setStatus({ kind: 'sending' });
    const sb = await getSupabase();
    if (!sb) {
      setStatus({ kind: 'unavailable' });
      return;
    }
    const { error } = await sb.from('contact_messages').insert({
      name: values.name.trim(),
      email: values.email.trim(),
      subject: values.subject.trim(),
      message: values.message.trim(),
      user_id: user?.id ?? null,
    });
    if (error) {
      setStatus({ kind: 'failed' });
      return;
    }
    setStatus({ kind: 'success' });
    setValues((v) => ({ ...v, subject: '', message: '' }));
  };

  const sending = status.kind === 'sending';

  return (
    <form noValidate onSubmit={onSubmit} className="card space-y-4 p-6 sm:p-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.contact.name} htmlFor="c-name" error={errors.name}>
          <input {...errorProps('c-name', errors.name)} className="input" autoComplete="name" value={values.name} onChange={set('name')} />
        </Field>
        <Field label={t.contact.email} htmlFor="c-email" error={errors.email}>
          <input {...errorProps('c-email', errors.email)} className="input" type="email" dir="ltr" autoComplete="email" value={values.email} onChange={set('email')} />
        </Field>
      </div>
      <Field label={t.contact.subject} htmlFor="c-subject" error={errors.subject}>
        <input {...errorProps('c-subject', errors.subject)} className="input" value={values.subject} onChange={set('subject')} />
      </Field>
      <Field label={t.contact.message} htmlFor="c-message" error={errors.message}>
        <textarea {...errorProps('c-message', errors.message)} className="input min-h-32 resize-y" rows={5} value={values.message} onChange={set('message')} />
      </Field>

      {status.kind === 'success' && <Notice tone="success">{t.contact.success}</Notice>}
      {status.kind === 'unavailable' && <Notice tone="warning">{t.contact.unavailable}</Notice>}
      {status.kind === 'failed' && <Notice tone="error">{t.contact.failed}</Notice>}

      <button type="submit" className="btn-primary w-full sm:w-auto" disabled={sending}>
        {sending ? <Spinner className="size-4 text-white" /> : <Send className="size-4 rtl:-scale-x-100" aria-hidden />}
        {sending ? t.contact.sending : t.contact.send}
      </button>
    </form>
  );
}
