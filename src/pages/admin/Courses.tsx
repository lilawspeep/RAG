import { useRef, useState, type FormEvent } from 'react';
import { Download, Link2, Trash2, Upload } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase';
import { downloadText, parseCsv, toCsv } from '../../lib/csv';
import { COURSE_NUMBER_RE } from '../../lib/validation';
import { formatDate } from '../../lib/format';
import type { Course, CoursePrerequisite, RelationType } from '../../lib/types';
import { Badge, Field, Modal, Notice, Spinner } from '../../components/ui';
import { EntityManager, dbErrorMessage, useRows, type FieldDef } from './EntityManager';
import { opts, useLookups } from './lookups';

const COURSE_COLUMNS = ['course_number', 'name_ar', 'name_en', 'credit_hours', 'description_ar', 'description_en', 'source_note', 'source_page', 'last_verified_at'];
const REQ_COLUMNS = ['course_number', 'required_course_number', 'relation_type', 'note'];

export default function Courses() {
  const { t, lang, pick } = useI18n();
  const c = t.admin.coursesPage;
  const lk = useLookups();
  const [reloadKey, setReloadKey] = useState(0);
  const [reqFor, setReqFor] = useState<Course | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const courseCsv = useRef<HTMLInputElement>(null);
  const reqCsv = useRef<HTMLInputElement>(null);

  const fields: FieldDef[] = [
    { name: 'course_number', label: t.syllabus.courseNumber, required: true, ltr: true, pattern: COURSE_NUMBER_RE, patternMessage: t.validation.courseNumber, hint: c.numberLocked },
    { name: 'credit_hours', label: t.syllabus.credits, type: 'number', step: '0.5' },
    { name: 'name_ar', label: c.nameAr, required: true },
    { name: 'name_en', label: c.nameEn, ltr: true },
    { name: 'faculty_id', label: t.syllabus.faculty, type: 'select', options: opts(lk.faculties, (f) => pick(f.name_ar, f.name_en) ?? '') },
    { name: 'department_id', label: t.syllabus.department, type: 'select', options: opts(lk.departments, (d) => pick(d.name_ar, d.name_en) ?? '') },
    { name: 'description_ar', label: c.descAr, type: 'textarea' },
    { name: 'description_en', label: c.descEn, type: 'textarea', ltr: true },
    { name: 'source_document_id', label: c.sourceDoc, type: 'select', options: opts(lk.documents, (d) => d.title + (d.version_label ? ` (${d.version_label})` : '')) },
    { name: 'source_page', label: c.sourcePage, type: 'number' },
    { name: 'source_note', label: c.sourceNote },
    { name: 'last_verified_at', label: t.common.lastVerified, type: 'date' },
    { name: 'is_active', label: c.active, type: 'checkbox' },
  ];

  const exportCourses = async () => {
    const sb = await getSupabase();
    if (!sb) return;
    const { data } = await sb.from('courses').select(COURSE_COLUMNS.join(',')).order('course_number').range(0, 9999);
    downloadText('courses.csv', toCsv((data as unknown as Record<string, unknown>[]) ?? [], COURSE_COLUMNS));
  };

  const exportReqs = async () => {
    const sb = await getSupabase();
    if (!sb) return;
    const { data } = await sb.from('course_prerequisites').select(REQ_COLUMNS.join(',')).order('course_number').range(0, 19999);
    downloadText('course_requisites.csv', toCsv((data as unknown as Record<string, unknown>[]) ?? [], REQ_COLUMNS));
  };

  const importCsv = async (file: File, kind: 'courses' | 'requisites') => {
    const sb = await getSupabase();
    if (!sb) return;
    const rows = parseCsv(await file.text());
    const bad: number[] = [];
    let payload: Record<string, unknown>[];
    if (kind === 'courses') {
      payload = rows.flatMap((r, i) => {
        if (!COURSE_NUMBER_RE.test(r.course_number ?? '') || !r.name_ar) {
          bad.push(i + 2);
          return [];
        }
        const row: Record<string, unknown> = { course_number: r.course_number, name_ar: r.name_ar };
        for (const k of COURSE_COLUMNS.slice(2)) if (k in r) row[k] = r[k] === '' ? null : k === 'credit_hours' || k === 'source_page' ? Number(r[k]) : r[k];
        return [row];
      });
    } else {
      payload = rows.flatMap((r, i) => {
        const rel = (r.relation_type || 'prerequisite') as RelationType;
        if (!COURSE_NUMBER_RE.test(r.course_number ?? '') || !COURSE_NUMBER_RE.test(r.required_course_number ?? '') || !['prerequisite', 'corequisite'].includes(rel)) {
          bad.push(i + 2);
          return [];
        }
        return [{ course_number: r.course_number, required_course_number: r.required_course_number, relation_type: rel, note: r.note || null }];
      });
    }
    const conflict = kind === 'courses' ? 'course_number' : 'course_number,required_course_number,relation_type';
    const table = kind === 'courses' ? 'courses' : 'course_prerequisites';
    for (let i = 0; i < payload.length; i += 500) {
      const { error } = await sb.from(table).upsert(payload.slice(i, i + 500), { onConflict: conflict });
      if (error) {
        setNotice({ tone: 'error', text: dbErrorMessage(error, t.common.errorGeneric) });
        return;
      }
    }
    setNotice({
      tone: bad.length ? 'error' : 'success',
      text: c.imported(payload.length) + (bad.length ? ` — ${t.validation.fixErrors} (CSV rows: ${bad.slice(0, 20).join(', ')})` : ''),
    });
    setReloadKey((k) => k + 1);
  };

  const fileInput = (ref: React.RefObject<HTMLInputElement | null>, kind: 'courses' | 'requisites') => (
    <input
      ref={ref}
      type="file"
      accept=".csv,text/csv"
      className="hidden"
      onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) importCsv(f, kind);
        e.target.value = '';
      }}
    />
  );

  return (
    <>
      <div className="card flex flex-wrap items-center gap-2 p-4">
        <p className="me-auto max-w-xl text-xs leading-relaxed text-muted" dir="ltr">{c.csvHint}</p>
        {fileInput(courseCsv, 'courses')}
        {fileInput(reqCsv, 'requisites')}
        <button type="button" className="btn-outline py-2" onClick={() => courseCsv.current?.click()} disabled={!isSupabaseConfigured}>
          <Upload className="size-4" aria-hidden /> {t.common.import} CSV
        </button>
        <button type="button" className="btn-outline py-2" onClick={exportCourses} disabled={!isSupabaseConfigured}>
          <Download className="size-4" aria-hidden /> {t.common.export} CSV
        </button>
        <button type="button" className="btn-outline py-2" onClick={() => reqCsv.current?.click()} disabled={!isSupabaseConfigured}>
          <Upload className="size-4" aria-hidden /> {t.syllabus.prerequisites} CSV
        </button>
        <button type="button" className="btn-outline py-2" onClick={exportReqs} disabled={!isSupabaseConfigured}>
          <Download className="size-4" aria-hidden /> {t.syllabus.prerequisites} CSV
        </button>
      </div>
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}

      <EntityManager<Course & Record<string, unknown>>
        key={reloadKey}
        title={t.admin.courses}
        table="courses"
        pk="course_number"
        order={{ column: 'course_number' }}
        locked={['course_number']}
        searchKeys={['course_number', 'name_ar', 'name_en']}
        emptyText={c.empty}
        fields={fields}
        columns={[
          { key: 'course_number', label: t.syllabus.courseNumber, ltr: true, render: (r) => <span className="font-mono font-bold text-navy">{r.course_number}</span> },
          { key: 'name', label: t.syllabus.courseName, render: (r) => pick(r.name_ar, r.name_en) },
          { key: 'credit_hours', label: t.syllabus.credits },
          { key: 'last_verified_at', label: t.common.lastVerified, render: (r) => formatDate(r.last_verified_at, lang) ?? '—' },
          { key: 'is_active', label: c.active, render: (r) => (r.is_active ? <Badge tone="green">{t.common.yes}</Badge> : <Badge>{t.common.no}</Badge>) },
        ]}
        extraActions={(r) => (
          <button type="button" className="btn-ghost px-2.5 py-1.5" onClick={() => setReqFor(r)}>
            <Link2 className="size-4" aria-hidden />
            <span className="hidden xl:inline">{c.prereqs}</span>
          </button>
        )}
      />
      {reqFor && <RequisitesModal course={reqFor} onClose={() => setReqFor(null)} />}
    </>
  );
}

function RequisitesModal({ course, onClose }: { course: Course; onClose: () => void }) {
  const { t } = useI18n();
  const c = t.admin.coursesPage;
  const { rows, reload } = useRows<CoursePrerequisite>('course_prerequisites', '*', { column: 'relation_type' }, { course_number: course.course_number });
  const [num, setNum] = useState('');
  const [rel, setRel] = useState<RelationType>('prerequisite');
  const [error, setError] = useState<string | null>(null);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const n = num.trim();
    if (!COURSE_NUMBER_RE.test(n)) return setError(t.validation.courseNumber);
    const sb = await getSupabase();
    const res = await sb?.from('course_prerequisites').insert({ course_number: course.course_number, required_course_number: n, relation_type: rel });
    if (res?.error) return setError(dbErrorMessage(res.error, t.common.errorGeneric));
    setError(null);
    setNum('');
    reload();
  };

  const remove = async (id: string) => {
    const sb = await getSupabase();
    await sb?.from('course_prerequisites').delete().eq('id', id);
    reload();
  };

  return (
    <Modal open onClose={onClose} title={`${c.prereqs} — ${course.course_number}`}>
      {rows === null ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted">{t.common.none}</p>
      ) : (
        <ul className="mb-4 divide-y divide-line rounded-xl border border-line">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <span className="flex items-center gap-2">
                <Badge tone={r.relation_type === 'prerequisite' ? 'blue' : 'gold'}>{r.relation_type === 'prerequisite' ? c.prerequisite : c.corequisite}</Badge>
                <span className="font-mono font-bold" dir="ltr">{r.required_course_number}</span>
              </span>
              <button type="button" className="btn-ghost p-1.5 text-red-700" aria-label={t.common.delete} onClick={() => remove(r.id)}>
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="mt-4 grid gap-3 sm:grid-cols-[1fr_9rem_auto] sm:items-end">
        <Field label={c.requiredCourse} htmlFor="rq-num">
          <input id="rq-num" className="input" dir="ltr" value={num} onChange={(e) => setNum(e.target.value)} />
        </Field>
        <Field label={c.relation} htmlFor="rq-rel">
          <select id="rq-rel" className="input" value={rel} onChange={(e) => setRel(e.target.value as RelationType)}>
            <option value="prerequisite">{c.prerequisite}</option>
            <option value="corequisite">{c.corequisite}</option>
          </select>
        </Field>
        <button type="submit" className="btn-primary">{c.addPrereq}</button>
      </form>
      {error && <Notice tone="error" className="mt-3">{error}</Notice>}
    </Modal>
  );
}
