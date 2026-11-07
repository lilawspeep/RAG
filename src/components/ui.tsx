import { useEffect, useId, useRef, type ReactNode } from 'react';
import { CircleAlert, CircleCheck, Info, LoaderCircle, TriangleAlert, X } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';

export function Spinner({ className = 'size-5' }: { className?: string }) {
  return <LoaderCircle aria-hidden className={`animate-spin text-academic ${className}`} />;
}

export function PageLoader() {
  const { t } = useI18n();
  return (
    <div className="flex min-h-[50vh] items-center justify-center gap-3 text-muted" role="status">
      <Spinner />
      <span>{t.common.loading}</span>
    </div>
  );
}

type Tone = 'info' | 'warning' | 'error' | 'success';
const toneStyles: Record<Tone, string> = {
  info: 'border-academic/20 bg-academic/5 text-academic',
  warning: 'border-gold/40 bg-gold/10 text-[#6b5524]',
  error: 'border-red-200 bg-red-50 text-red-800',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
};
const toneIcons = { info: Info, warning: TriangleAlert, error: CircleAlert, success: CircleCheck };

export function Notice({
  tone = 'info',
  title,
  children,
  className = '',
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const Icon = toneIcons[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex gap-3 rounded-xl border px-4 py-3 text-sm leading-relaxed ${toneStyles[tone]} ${className}`}
    >
      <Icon aria-hidden className="mt-0.5 size-4.5 shrink-0" />
      <div className="min-w-0">
        {title && <p className="font-bold">{title}</p>}
        {children && <div className={title ? 'mt-0.5 opacity-90' : ''}>{children}</div>}
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-line bg-white/60 px-6 py-12 text-center">
      <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-mist text-academic">{icon}</div>
      <h3 className="text-lg font-bold text-navy">{title}</h3>
      {body && <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Field({
  label,
  error,
  hint,
  optional,
  children,
  htmlFor,
}: {
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
  children: ReactNode;
  htmlFor: string;
}) {
  const { t } = useI18n();
  return (
    <div>
      <label htmlFor={htmlFor} className="label">
        {label}
        {optional && <span className="ms-1.5 text-xs font-medium text-muted">({t.common.optional})</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
      {error && (
        <p id={`${htmlFor}-error`} className="mt-1.5 text-xs font-semibold text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

/** Props that wire an input to its Field error message for screen readers. */
export const errorProps = (id: string, error?: string) => ({
  id,
  'aria-invalid': error ? true : undefined,
  'aria-describedby': error ? `${id}-error` : undefined,
});

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'gold' | 'blue' | 'green' | 'red' }) {
  const tones = {
    neutral: 'bg-mist text-muted',
    gold: 'bg-gold/15 text-[#7a6128]',
    blue: 'bg-academic/10 text-academic',
    green: 'bg-emerald-50 text-emerald-700',
    red: 'bg-red-50 text-red-700',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function NA() {
  const { t } = useI18n();
  return <span className="text-muted/80 italic">{t.common.notAvailable}</span>;
}

export function PageHeader({ eyebrow, title, subtitle, actions }: { eyebrow?: ReactNode; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="text-3xl font-extrabold text-navy sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-3 max-w-2xl leading-relaxed text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal?.();
    if (!open && d.open) d.close?.();
  }, [open]);
  if (!open) return null;
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={onClose}
      className={`m-auto w-[calc(100%-2rem)] ${wide ? 'max-w-3xl' : 'max-w-lg'} rounded-2xl border border-line bg-white p-0 text-ink shadow-lift backdrop:bg-navy/40 backdrop:backdrop-blur-sm`}
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 id={titleId} className="text-lg font-bold text-navy">
          {title}
        </h2>
        <button type="button" onClick={onClose} className="btn-ghost -me-2 p-2" aria-label={t.common.close}>
          <X className="size-5" />
        </button>
      </div>
      <div className="max-h-[75vh] overflow-y-auto px-5 py-5">{children}</div>
    </dialog>
  );
}

export function StatCard({ label, value, icon }: { label: ReactNode; value: ReactNode; icon: ReactNode }) {
  return (
    <div className="card flex items-center gap-4 p-5">
      <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-academic/8 text-academic">{icon}</div>
      <div className="min-w-0">
        <p className="text-2xl font-extrabold text-navy tabular-nums">{value}</p>
        <p className="truncate text-sm text-muted">{label}</p>
      </div>
    </div>
  );
}
