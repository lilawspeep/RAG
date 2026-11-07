import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase';
import { Field, Modal, NA, Notice, Spinner, errorProps } from '../../components/ui';

export type FieldDef = {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'time' | 'textarea' | 'select' | 'checkbox';
  options?: { value: string; label: string }[];
  required?: boolean;
  ltr?: boolean;
  hint?: string;
  step?: string;
  pattern?: RegExp;
  patternMessage?: string;
  /** Store a select value as a number (e.g. day_of_week). */
  numeric?: boolean;
};

export type Column<T> = { key: string; label: string; render?: (row: T) => ReactNode; ltr?: boolean };

type Row = Record<string, unknown>;

export function dbErrorMessage(err: { code?: string; message?: string } | null, fallback: string): string {
  if (!err) return fallback;
  if (err.code === '23505') return `${fallback} (duplicate / مكرر)`;
  if (err.code === '23503') return `${fallback} (reference / مرجع غير موجود أو مستخدم)`;
  if (err.code === '42501') return `${fallback} (permission / صلاحيات)`;
  if (err.code === '23514') return `${fallback} (invalid value / قيمة غير صالحة)`;
  return err.message ? `${fallback} — ${err.message}` : fallback;
}

export function useRows<T>(table: string, select: string, order: { column: string; ascending?: boolean }, filter?: Record<string, string | null>) {
  const [rows, setRows] = useState<T[] | null>(isSupabaseConfigured ? null : []);
  const [error, setError] = useState<string | null>(null);
  const filterKey = JSON.stringify(filter ?? {});
  const reload = useCallback(async () => {
    const sb = await getSupabase();
    if (!sb) return setRows([]);
    let q = sb.from(table).select(select).order(order.column, { ascending: order.ascending ?? true }).range(0, 4999);
    for (const [k, v] of Object.entries(JSON.parse(filterKey) as Record<string, string | null>)) q = v === null ? q.is(k, null) : q.eq(k, v);
    const { data, error: e } = await q;
    if (e) setError(e.message);
    else setError(null);
    setRows((data as T[]) ?? []);
  }, [table, select, order.column, order.ascending, filterKey]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { rows, error, reload };
}

function toForm(fields: FieldDef[], row?: Row): Record<string, string | boolean> {
  return Object.fromEntries(
    fields.map((f) => {
      const v = row?.[f.name];
      if (f.type === 'checkbox') return [f.name, Boolean(v ?? false)];
      if (f.type === 'time' && typeof v === 'string') return [f.name, v.slice(0, 5)];
      return [f.name, v == null ? '' : String(v)];
    }),
  );
}

function fromForm(fields: FieldDef[], values: Record<string, string | boolean>): Row {
  return Object.fromEntries(
    fields.map((f) => {
      const v = values[f.name];
      if (f.type === 'checkbox') return [f.name, Boolean(v)];
      const s = String(v ?? '').trim();
      if (!s) return [f.name, null];
      if (f.type === 'number' || f.numeric) return [f.name, Number(s)];
      return [f.name, s];
    }),
  );
}

export function EntityForm({
  fields,
  initial,
  locked = [],
  onSubmit,
  onCancel,
  submitLabel,
}: {
  fields: FieldDef[];
  initial?: Row;
  locked?: string[];
  onSubmit: (values: Row) => Promise<string | null>;
  onCancel: () => void;
  submitLabel?: string;
}) {
  const { t } = useI18n();
  const [values, setValues] = useState(() => toForm(fields, initial));
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string | undefined> = {};
    for (const f of fields) {
      const v = values[f.name];
      const s = typeof v === 'string' ? v.trim() : '';
      if (f.required && f.type !== 'checkbox' && !s) errs[f.name] = t.validation.required;
      else if (s && f.type === 'number' && !Number.isFinite(Number(s))) errs[f.name] = t.validation.number;
      else if (s && f.pattern && !f.pattern.test(s)) errs[f.name] = f.patternMessage ?? t.validation.required;
    }
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
    setBusy(true);
    const err = await onSubmit(fromForm(fields, values));
    setBusy(false);
    setFormError(err);
  };

  return (
    <form noValidate onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((f) => {
          const id = `ef-${f.name}`;
          const disabled = locked.includes(f.name);
          const common = { ...errorProps(id, errors[f.name]), disabled, dir: f.ltr ? 'ltr' : undefined } as const;
          const set = (v: string | boolean) => setValues((s) => ({ ...s, [f.name]: v }));
          const wide = f.type === 'textarea';
          return (
            <div key={f.name} className={wide ? 'sm:col-span-2' : ''}>
              {f.type === 'checkbox' ? (
                <label className="mt-7 flex items-center gap-2 text-sm font-semibold text-navy">
                  <input id={id} type="checkbox" className="size-4 accent-academic" checked={Boolean(values[f.name])} onChange={(e) => set(e.target.checked)} disabled={disabled} />
                  {f.label}
                </label>
              ) : (
                <Field label={f.label} htmlFor={id} error={errors[f.name]} optional={!f.required} hint={f.hint}>
                  {f.type === 'select' ? (
                    <select {...common} className="input" value={String(values[f.name])} onChange={(e) => set(e.target.value)}>
                      <option value="">—</option>
                      {f.options?.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : f.type === 'textarea' ? (
                    <textarea {...common} className="input min-h-24" value={String(values[f.name])} onChange={(e) => set(e.target.value)} />
                  ) : (
                    <input
                      {...common}
                      className="input"
                      type={f.type === 'number' ? 'number' : f.type ?? 'text'}
                      step={f.step}
                      value={String(values[f.name])}
                      onChange={(e) => set(e.target.value)}
                    />
                  )}
                </Field>
              )}
            </div>
          );
        })}
      </div>
      {formError && <Notice tone="error">{formError}</Notice>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-outline" onClick={onCancel}>
          {t.common.cancel}
        </button>
        <button type="submit" className="btn-primary" disabled={busy || !isSupabaseConfigured}>
          {busy && <Spinner className="size-4 text-white" />}
          {busy ? t.common.saving : submitLabel ?? t.common.save}
        </button>
      </div>
    </form>
  );
}

export function EntityManager<T extends Row>({
  title,
  table,
  pk = 'id',
  select = '*',
  order,
  filter,
  columns,
  fields,
  locked = [],
  searchKeys,
  emptyText,
  selectedId,
  onSelect,
  extraActions,
  toolbar,
  onChanged,
}: {
  title: string;
  table: string;
  pk?: string;
  select?: string;
  order: { column: string; ascending?: boolean };
  filter?: Record<string, string>;
  columns: Column<T>[];
  fields: FieldDef[];
  locked?: string[];
  searchKeys?: string[];
  emptyText?: string;
  selectedId?: string | null;
  onSelect?: (row: T) => void;
  extraActions?: (row: T) => ReactNode;
  toolbar?: ReactNode;
  onChanged?: () => void;
}) {
  const { t } = useI18n();
  const { rows, error, reload } = useRows<T>(table, select, order, filter);
  const [editing, setEditing] = useState<T | 'new' | null>(null);
  const [q, setQ] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const visible = useMemo(() => {
    if (!rows || !q.trim() || !searchKeys) return rows;
    const nq = q.trim().toLowerCase();
    return rows.filter((r) => searchKeys.some((k) => String(r[k] ?? '').toLowerCase().includes(nq)));
  }, [rows, q, searchKeys]);

  const save = async (values: Row): Promise<string | null> => {
    const sb = await getSupabase();
    if (!sb) return t.config.backendMissingTitle;
    const payload = { ...values, ...(filter ?? {}) };
    const res =
      editing === 'new'
        ? await sb.from(table).insert(payload)
        : await sb.from(table).update(Object.fromEntries(Object.entries(payload).filter(([k]) => !locked.includes(k)))).eq(pk, (editing as T)[pk] as string);
    if (res.error) return dbErrorMessage(res.error, t.common.errorGeneric);
    setEditing(null);
    await reload();
    onChanged?.();
    return null;
  };

  const remove = async (row: T) => {
    if (!window.confirm(t.common.confirmDelete)) return;
    const sb = await getSupabase();
    const res = await sb?.from(table).delete().eq(pk, row[pk] as string);
    if (res?.error) setActionError(dbErrorMessage(res.error, t.common.errorGeneric));
    else {
      setActionError(null);
      await reload();
      onChanged?.();
    }
  };

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <h2 className="text-lg font-bold text-navy">{title}</h2>
        <div className="flex flex-wrap items-center gap-2">
          {searchKeys && (
            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
              <input type="search" aria-label={t.common.search} placeholder={t.common.search} className="input w-48 py-2 ps-9" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          )}
          {toolbar}
          <button type="button" className="btn-primary py-2" onClick={() => setEditing('new')} disabled={!isSupabaseConfigured}>
            <Plus className="size-4" aria-hidden />
            {t.common.add}
          </button>
        </div>
      </div>
      {(error || actionError) && <Notice tone="error" className="m-4">{actionError ?? error}</Notice>}
      {visible === null ? (
        <div className="p-6">
          <Spinner />
        </div>
      ) : visible.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted">{emptyText ?? t.common.none}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-mist text-xs text-muted">
              <tr>
                {columns.map((c) => (
                  <th key={c.key} className="px-4 py-2.5 text-start font-semibold whitespace-nowrap">
                    {c.label}
                  </th>
                ))}
                <th className="px-4 py-2.5 text-end font-semibold">{t.common.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {visible.map((r) => {
                const id = String(r[pk]);
                const selected = selectedId === id;
                return (
                  <tr
                    key={id}
                    className={`${onSelect ? 'cursor-pointer' : ''} ${selected ? 'bg-academic/5' : 'hover:bg-mist/50'}`}
                    onClick={onSelect ? () => onSelect(r) : undefined}
                    aria-selected={onSelect ? selected : undefined}
                  >
                    {columns.map((c) => (
                      <td key={c.key} className="px-4 py-2.5 align-top" dir={c.ltr ? 'ltr' : undefined}>
                        {c.render ? c.render(r) : r[c.key] == null || r[c.key] === '' ? <NA /> : String(r[c.key])}
                      </td>
                    ))}
                    <td className="px-4 py-2 text-end whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      {extraActions?.(r)}
                      <button type="button" className="btn-ghost p-2" aria-label={t.common.edit} onClick={() => setEditing(r)}>
                        <Pencil className="size-4" />
                      </button>
                      <button type="button" className="btn-ghost p-2 text-red-700 hover:bg-red-50" aria-label={t.common.delete} onClick={() => remove(r)}>
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <Modal open wide onClose={() => setEditing(null)} title={editing === 'new' ? `${t.common.add} — ${title}` : `${t.common.edit} — ${title}`}>
          <EntityForm
            fields={fields}
            initial={editing === 'new' ? undefined : editing}
            locked={editing === 'new' ? [] : locked}
            onSubmit={save}
            onCancel={() => setEditing(null)}
          />
        </Modal>
      )}
    </section>
  );
}
