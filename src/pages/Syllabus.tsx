import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { ChevronDown, Clock, FileCheck2, Gauge, Library, MapPin, Search, User } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { BackendNotice } from '../components/BackendNotice';
import { Badge, EmptyState, NA, Notice, PageHeader, PageLoader } from '../components/ui';
import { formatDate, formatTime } from '../lib/format';
import { useCatalog, usePlanCourses, useSemesterSections, type CatalogData, type SectionWithMeetings } from '../lib/syllabusData';
import type { Course, CreditLimitPolicy, PlanCourse } from '../lib/types';

const PAGE = 40;

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[إأآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');

export default function Syllabus() {
  const { t } = useI18n();
  const state = useCatalog();
  return (
    <div className="container-page py-10 sm:py-14">
      <PageHeader eyebrow={t.syllabus.eyebrow} title={t.syllabus.title} subtitle={t.syllabus.subtitle} />
      <BackendNotice className="mt-6" />
      <div className="mt-8">
        {state.status === 'loading' && <PageLoader />}
        {state.status === 'error' && <Notice tone="error">{t.syllabus.loadError}</Notice>}
        {(state.status === 'unconfigured' || (state.status === 'ready' && state.data.courses.length === 0)) && (
          <>
            <FilterSkeleton />
            <EmptyState icon={<Library className="size-6" />} title={t.syllabus.emptyTitle} body={t.syllabus.emptyBody} />
          </>
        )}
        {state.status === 'ready' && state.data.courses.length > 0 && <Explorer data={state.data} />}
      </div>
    </div>
  );
}

function FilterSkeleton() {
  const { t } = useI18n();
  const labels = [t.syllabus.faculty, t.syllabus.department, t.syllabus.major, t.syllabus.plan, t.syllabus.semester];
  return (
    <div className="card mb-6 grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-5" aria-hidden>
      {labels.map((l) => (
        <div key={l}>
          <p className="label">{l}</p>
          <select className="input" disabled>
            <option>{t.common.notAvailable}</option>
          </select>
        </div>
      ))}
    </div>
  );
}

function Explorer({ data }: { data: CatalogData }) {
  const { t, lang, pick } = useI18n();
  const [params, setParams] = useSearchParams();
  const searchRef = useRef<HTMLInputElement>(null);

  const faculty = params.get('faculty') ?? '';
  const department = params.get('department') ?? '';
  const major = params.get('major') ?? '';
  const plan = params.get('plan') ?? '';
  const semester = params.get('semester') ?? data.semesters.find((s) => s.is_current)?.id ?? '';
  const q = params.get('q') ?? '';
  const focusCourse = params.get('course');
  const [limit, setLimit] = useState(PAGE);

  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete('focus');
    setParams(next, { replace: true });
    setLimit(PAGE);
  };

  useEffect(() => {
    if (params.get('focus') === 'search') searchRef.current?.focus();
  }, [params]);

  const departments = data.departments.filter((d) => !faculty || d.faculty_id === faculty);
  const deptIds = new Set(departments.map((d) => d.id));
  const majors = data.majors.filter((m) => (department ? m.department_id === department : !faculty || deptIds.has(m.department_id)));
  const majorIds = new Set(majors.map((m) => m.id));
  const plans = data.plans.filter((p) => (major ? p.major_id === major : majorIds.has(p.major_id)));
  const selectedPlan = data.plans.find((p) => p.id === plan) ?? null;
  const planCourses = usePlanCourses(selectedPlan?.id ?? null);
  const sections = useSemesterSections(semester || null);

  const courseByNumber = useMemo(() => new Map(data.courses.map((c) => [c.course_number, c])), [data.courses]);
  const requisitesByCourse = useMemo(() => {
    const m = new Map<string, typeof data.requisites>();
    for (const r of data.requisites) {
      const list = m.get(r.course_number) ?? [];
      list.push(r);
      m.set(r.course_number, list);
    }
    return m;
  }, [data.requisites]);

  const planMap = useMemo(() => new Map((planCourses ?? []).map((pc) => [pc.course_number, pc])), [planCourses]);

  const filtered = useMemo(() => {
    let list: Course[];
    if (selectedPlan) {
      list = (planCourses ?? []).map((pc) => courseByNumber.get(pc.course_number)).filter((c): c is Course => !!c);
      list.sort((a, b) => {
        const pa = planMap.get(a.course_number)!, pb = planMap.get(b.course_number)!;
        return (pa.suggested_year ?? 99) - (pb.suggested_year ?? 99) || a.course_number.localeCompare(b.course_number);
      });
    } else {
      const majorDept = major ? data.majors.find((m) => m.id === major)?.department_id : null;
      const dept = department || majorDept;
      list = data.courses.filter((c) => (dept ? c.department_id === dept : faculty ? c.faculty_id === faculty || (c.department_id ? deptIds.has(c.department_id) : false) : true));
    }
    const nq = normalize(q.trim());
    if (nq) {
      list = list.filter(
        (c) => c.course_number.toLowerCase().includes(nq) || normalize(c.name_ar).includes(nq) || normalize(c.name_en ?? '').includes(nq),
      );
    }
    return list;
  }, [data, selectedPlan, planCourses, planMap, courseByNumber, faculty, department, major, q]);

  const policies = data.policies.filter(
    (p) => (selectedPlan ? p.plan_id === selectedPlan.id : false) || (!p.plan_id && (!p.faculty_id || p.faculty_id === faculty)),
  );

  const jumpTo = (num: string) => {
    setParams(new URLSearchParams({ q: num, course: num, ...(semester ? { semester } : {}) }), { replace: false });
    setLimit(PAGE);
  };

  return (
    <div className="space-y-6">
      <div className="card grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-5">
        <Select label={t.syllabus.faculty} id="f-fac" value={faculty} onChange={(v) => update({ faculty: v, department: '', major: '', plan: '' })}>
          <option value="">{t.common.all}</option>
          {data.faculties.map((f) => (
            <option key={f.id} value={f.id}>{pick(f.name_ar, f.name_en)}</option>
          ))}
        </Select>
        <Select label={t.syllabus.department} id="f-dep" value={department} onChange={(v) => update({ department: v, major: '', plan: '' })}>
          <option value="">{t.common.all}</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{pick(d.name_ar, d.name_en)}</option>
          ))}
        </Select>
        <Select label={t.syllabus.major} id="f-maj" value={major} onChange={(v) => update({ major: v, plan: '' })}>
          <option value="">{t.common.all}</option>
          {majors.map((m) => (
            <option key={m.id} value={m.id}>{pick(m.name_ar, m.name_en)}</option>
          ))}
        </Select>
        <Select label={t.syllabus.plan} id="f-plan" value={plan} onChange={(v) => update({ plan: v })}>
          <option value="">{t.syllabus.noPlan}</option>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {pick(p.name_ar, p.name_en)}
              {p.catalog_year ? ` — ${p.catalog_year}` : ''}
            </option>
          ))}
        </Select>
        <Select label={t.syllabus.semester} id="f-sem" value={semester} onChange={(v) => update({ semester: v })}>
          <option value="">—</option>
          {data.semesters.map((s) => (
            <option key={s.id} value={s.id}>{pick(s.name_ar, s.name_en)}</option>
          ))}
        </Select>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden />
        <input
          ref={searchRef}
          type="search"
          aria-label={t.common.search}
          placeholder={t.syllabus.searchPlaceholder}
          className="input py-3.5 ps-12 text-base shadow-card"
          value={q}
          onChange={(e) => update({ q: e.target.value, course: '' })}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <section aria-label={t.syllabus.courseName}>
          <p className="mb-3 text-sm font-semibold text-muted" aria-live="polite">
            {t.syllabus.resultsCount(filtered.length)}
          </p>
          {filtered.length === 0 ? (
            <EmptyState icon={<Search className="size-6" />} title={t.syllabus.noResults} />
          ) : (
            <ul className="space-y-3">
              {filtered.slice(0, limit).map((c) => (
                <CourseCard
                  key={c.course_number}
                  course={c}
                  planCourse={planMap.get(c.course_number)}
                  requisites={requisitesByCourse.get(c.course_number) ?? []}
                  courseByNumber={courseByNumber}
                  data={data}
                  sections={sections ? sections[c.course_number] ?? [] : null}
                  initiallyOpen={focusCourse === c.course_number}
                  onJump={jumpTo}
                />
              ))}
            </ul>
          )}
          {filtered.length > limit && (
            <div className="mt-5 text-center">
              <button type="button" className="btn-outline" onClick={() => setLimit((l) => l + PAGE)}>
                {t.common.show} +{Math.min(PAGE, filtered.length - limit)}
              </button>
            </div>
          )}
        </section>

        <aside className="space-y-4">
          {selectedPlan && (
            <div className="card p-5">
              <h2 className="font-bold text-navy">{pick(selectedPlan.name_ar, selectedPlan.name_en)}</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <Row label={t.syllabus.planTotal} value={selectedPlan.total_credits} />
                <Row label={t.common.source} value={selectedPlan.source_note ?? (selectedPlan.source_document_id ? data.documents[selectedPlan.source_document_id] : null)} />
                <Row label={t.common.lastVerified} value={formatDate(selectedPlan.last_verified_at, lang)} />
              </dl>
            </div>
          )}
          <CreditLimits policies={policies} documents={data.documents} />
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-end font-semibold text-navy">{value ?? <NA />}</dd>
    </div>
  );
}

function Select({ label, id, value, onChange, children }: { label: string; id: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        {children}
      </select>
    </div>
  );
}

function CreditLimits({ policies, documents }: { policies: CreditLimitPolicy[]; documents: Record<string, string> }) {
  const { t, lang, pick } = useI18n();
  const termLabel = { regular: t.syllabus.termRegular, summer: t.syllabus.termSummer, any: t.syllabus.termAny };
  return (
    <div className="card p-5">
      <h2 className="flex items-center gap-2 font-bold text-navy">
        <Gauge className="size-4.5 text-gold-dark" aria-hidden />
        {t.syllabus.creditLimits}
      </h2>
      {policies.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{t.syllabus.noCreditLimits}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {policies.map((p) => (
            <li key={p.id} className="rounded-xl bg-mist p-3 text-sm">
              <p className="font-semibold text-navy">{pick(p.name_ar, p.name_en)}</p>
              <p className="mt-1 text-muted">
                {termLabel[p.term_type]} · {t.syllabus.minCredits}: {p.min_credits ?? <NA />} · {t.syllabus.maxCredits}: {p.max_credits ?? <NA />}
              </p>
              {pick(p.condition_ar, p.condition_en) && <p className="mt-1 text-muted">{pick(p.condition_ar, p.condition_en)}</p>}
              <p className="mt-1.5 text-xs text-muted">
                {t.common.source}: {p.source_document_id ? documents[p.source_document_id] ?? <NA /> : <NA />}
                {p.source_page ? ` · ${t.advisor.page(p.source_page)}` : ''} · {t.common.lastVerified}: {formatDate(p.last_verified_at, lang) ?? t.common.notAvailable}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const CourseCard = memo(function CourseCard({
  course,
  planCourse,
  requisites,
  courseByNumber,
  data,
  sections,
  initiallyOpen,
  onJump,
}: {
  course: Course;
  planCourse?: PlanCourse;
  requisites: CatalogData['requisites'];
  courseByNumber: Map<string, Course>;
  data: CatalogData;
  sections: SectionWithMeetings[] | null;
  initiallyOpen: boolean;
  onJump: (n: string) => void;
}) {
  const { t, lang, pick } = useI18n();
  const [open, setOpen] = useState(initiallyOpen);
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (initiallyOpen) {
      setOpen(true);
      ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [initiallyOpen]);

  const name = pick(course.name_ar, course.name_en);
  const altName = lang === 'ar' ? course.name_en : course.name_ar;
  const desc = pick(course.description_ar, course.description_en);
  const prereqs = requisites.filter((r) => r.relation_type === 'prerequisite');
  const coreqs = requisites.filter((r) => r.relation_type === 'corequisite');
  const fac = data.faculties.find((f) => f.id === course.faculty_id);
  const dep = data.departments.find((d) => d.id === course.department_id);
  const panelId = `course-${course.course_number}`;

  const reqLinks = (list: typeof requisites) =>
    list.length === 0 ? (
      <span className="text-muted">{t.common.none}</span>
    ) : (
      <span className="flex flex-wrap gap-1.5">
        {list.map((r) => {
          const target = courseByNumber.get(r.required_course_number);
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => onJump(r.required_course_number)}
              title={t.syllabus.jumpToCourse}
              className="rounded-lg border border-line bg-white px-2 py-1 text-xs font-semibold text-academic hover:border-gold"
            >
              <span dir="ltr" className="font-mono">{r.required_course_number}</span>
              {target && <span className="ms-1.5 text-muted">{pick(target.name_ar, target.name_en)}</span>}
            </button>
          );
        })}
      </span>
    );

  return (
    <li ref={ref} className={`card overflow-hidden transition ${open ? 'border-gold/50 shadow-lift' : 'hover:border-gold/40'}`}>
      <button type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-4 p-4 text-start sm:p-5">
        <span className="grid min-w-20 shrink-0 place-items-center rounded-xl bg-navy px-2.5 py-2 font-mono text-sm font-bold text-gold-light" dir="ltr">
          {course.course_number}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold text-navy">{name}</span>
          {altName && altName !== name && <span className="block truncate text-sm text-muted" dir="auto">{altName}</span>}
          {planCourse && (
            <span className="mt-1.5 flex flex-wrap gap-1.5">
              <Badge tone="gold">{t.syllabus.reqTypes[planCourse.requirement_type]}</Badge>
              {planCourse.suggested_year && (
                <Badge tone="blue">
                  {t.syllabus.year(planCourse.suggested_year)}
                  {planCourse.suggested_term ? ` · ${t.syllabus.terms[planCourse.suggested_term]}` : ''}
                </Badge>
              )}
            </span>
          )}
        </span>
        <span className="shrink-0 text-center">
          <span className="block text-lg font-extrabold text-navy tabular-nums">{course.credit_hours ?? '—'}</span>
          <span className="block text-[11px] text-muted">{t.syllabus.creditsShort}</span>
        </span>
        <ChevronDown className={`size-5 shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
        <span className="sr-only">{open ? t.syllabus.collapse : t.syllabus.expand}</span>
      </button>

      {open && (
        <div id={panelId} className="animate-fade-up space-y-5 border-t border-line bg-mist/40 p-4 text-sm sm:p-5">
          <div>
            <h3 className="mb-1 font-bold text-navy">{t.syllabus.description}</h3>
            <p className="leading-relaxed text-muted">{desc ?? <NA />}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="mb-1.5 font-bold text-navy">{t.syllabus.prerequisites}</h3>
              {reqLinks(prereqs)}
            </div>
            <div>
              <h3 className="mb-1.5 font-bold text-navy">{t.syllabus.corequisites}</h3>
              {reqLinks(coreqs)}
            </div>
            <div>
              <h3 className="mb-1 font-bold text-navy">{t.syllabus.facultyDept}</h3>
              <p className="text-muted">
                {fac ? pick(fac.name_ar, fac.name_en) : <NA />} / {dep ? pick(dep.name_ar, dep.name_en) : <NA />}
              </p>
            </div>
            <div>
              <h3 className="mb-1 flex items-center gap-1.5 font-bold text-navy">
                <FileCheck2 className="size-4 text-gold-dark" aria-hidden />
                {t.syllabus.verification}
              </h3>
              <p className="text-muted">
                {t.common.source}:{' '}
                {course.source_note ?? (course.source_document_id ? data.documents[course.source_document_id] : null) ?? <NA />}
                {course.source_page ? ` · ${t.advisor.page(course.source_page)}` : ''}
              </p>
              <p className="text-muted">
                {t.common.lastVerified}: {formatDate(course.last_verified_at, lang) ?? <NA />}
              </p>
            </div>
          </div>
          <div>
            <h3 className="mb-2 font-bold text-navy">{t.syllabus.sections}</h3>
            {sections === null ? (
              <p className="text-muted">{t.syllabus.selectSemesterForSections}</p>
            ) : sections.length === 0 ? (
              <p className="text-muted">{t.syllabus.noSections}</p>
            ) : (
              <SectionsTable sections={sections} />
            )}
          </div>
        </div>
      )}
    </li>
  );
});

function SectionsTable({ sections }: { sections: SectionWithMeetings[] }) {
  const { t } = useI18n();
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-white">
      <table className="w-full min-w-[34rem] text-start text-sm">
        <thead className="bg-mist text-xs text-muted">
          <tr>
            <th className="px-3 py-2 text-start font-semibold">{t.syllabus.sectionNo}</th>
            <th className="px-3 py-2 text-start font-semibold">{t.syllabus.instructor}</th>
            <th className="px-3 py-2 text-start font-semibold">{t.syllabus.meetings}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {sections.map((s) => (
            <tr key={s.id}>
              <td className="px-3 py-2.5 font-mono font-bold text-navy" dir="ltr">{s.section_number}</td>
              <td className="px-3 py-2.5">
                <span className="inline-flex items-center gap-1.5">
                  <User className="size-3.5 text-muted" aria-hidden />
                  {s.instructor_name ?? <NA />}
                </span>
              </td>
              <td className="px-3 py-2.5">
                {s.section_meetings.length === 0 ? (
                  <NA />
                ) : (
                  <ul className="space-y-1">
                    {[...s.section_meetings]
                      .sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time))
                      .map((m) => (
                        <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                          <span className="font-semibold">{t.syllabus.days[m.day_of_week]}</span>
                          <span className="inline-flex items-center gap-1 text-muted" dir="ltr">
                            <Clock className="size-3.5" aria-hidden />
                            {formatTime(m.start_time)}–{formatTime(m.end_time)}
                          </span>
                          <span className="inline-flex items-center gap-1 text-muted">
                            <MapPin className="size-3.5" aria-hidden />
                            {t.syllabus.hall}: {m.classrooms ? [m.classrooms.building, m.classrooms.code].filter(Boolean).join(' ') : t.common.notAvailable}
                          </span>
                        </li>
                      ))}
                  </ul>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
