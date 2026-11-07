import { useState } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { COURSE_NUMBER_RE } from '../../lib/validation';
import { REQUIREMENT_TYPES, TERMS, type AcademicPlan, type CreditLimitPolicy, type PlanCourse } from '../../lib/types';
import { Badge } from '../../components/ui';
import { EntityManager } from './EntityManager';
import { opts, useLookups } from './lookups';

export default function Plans() {
  const { t, pick } = useI18n();
  const p = t.admin.plansPage;
  const lk = useLookups();
  const [selected, setSelected] = useState<AcademicPlan | null>(null);
  const name = (r: { name_ar: string; name_en: string | null }) => pick(r.name_ar, r.name_en) ?? '';
  const docOptions = opts(lk.documents, (d) => d.title + (d.version_label ? ` (${d.version_label})` : ''));

  return (
    <>
      <EntityManager<AcademicPlan & Record<string, unknown>>
        title={t.admin.plans}
        table="academic_plans"
        order={{ column: 'name_ar' }}
        searchKeys={['code', 'name_ar', 'name_en']}
        emptyText={p.empty}
        selectedId={selected?.id}
        onSelect={setSelected}
        onChanged={lk.reload}
        fields={[
          { name: 'major_id', label: t.syllabus.major, type: 'select', required: true, options: opts(lk.majors, name) },
          { name: 'code', label: p.code, required: true, ltr: true },
          { name: 'name_ar', label: t.admin.catalogPage.nameAr, required: true },
          { name: 'name_en', label: t.admin.catalogPage.nameEn, ltr: true },
          { name: 'catalog_year', label: p.catalogYear, ltr: true },
          { name: 'total_credits', label: p.totalCredits, type: 'number' },
          { name: 'source_document_id', label: t.admin.coursesPage.sourceDoc, type: 'select', options: docOptions },
          { name: 'source_note', label: t.admin.coursesPage.sourceNote },
          { name: 'last_verified_at', label: t.common.lastVerified, type: 'date' },
          { name: 'is_current', label: p.current, type: 'checkbox' },
        ]}
        columns={[
          { key: 'code', label: p.code, ltr: true },
          { key: 'name', label: t.syllabus.plan, render: (r) => name(r) },
          { key: 'catalog_year', label: p.catalogYear },
          { key: 'total_credits', label: p.totalCredits },
          { key: 'is_current', label: p.current, render: (r) => (r.is_current ? <Badge tone="gold">{t.common.yes}</Badge> : <Badge>{t.common.no}</Badge>) },
        ]}
      />

      {selected ? (
        <EntityManager<PlanCourse & Record<string, unknown>>
          key={selected.id}
          title={`${p.planCourses} — ${name(selected)}`}
          table="plan_courses"
          order={{ column: 'suggested_year' }}
          filter={{ plan_id: selected.id }}
          searchKeys={['course_number']}
          fields={[
            { name: 'course_number', label: t.syllabus.courseNumber, required: true, ltr: true, pattern: COURSE_NUMBER_RE, patternMessage: t.validation.courseNumber },
            { name: 'requirement_type', label: t.syllabus.requirementType, type: 'select', required: true, options: REQUIREMENT_TYPES.map((k) => ({ value: k, label: t.syllabus.reqTypes[k] })) },
            { name: 'suggested_year', label: p.suggestedYear, type: 'number' },
            { name: 'suggested_term', label: p.suggestedTerm, type: 'select', options: TERMS.map((k) => ({ value: k, label: t.syllabus.terms[k] })) },
          ]}
          columns={[
            { key: 'course_number', label: t.syllabus.courseNumber, ltr: true, render: (r) => <span className="font-mono font-bold">{r.course_number}</span> },
            { key: 'requirement_type', label: t.syllabus.requirementType, render: (r) => t.syllabus.reqTypes[r.requirement_type] },
            { key: 'suggested_year', label: p.suggestedYear },
            { key: 'suggested_term', label: p.suggestedTerm, render: (r) => (r.suggested_term ? t.syllabus.terms[r.suggested_term] : '—') },
          ]}
        />
      ) : (
        <p className="card px-5 py-6 text-center text-sm text-muted">{p.selectPlan}</p>
      )}

      <EntityManager<CreditLimitPolicy & Record<string, unknown>>
        title={p.creditPolicies}
        table="credit_limit_policies"
        order={{ column: 'name_ar' }}
        fields={[
          { name: 'name_ar', label: t.admin.catalogPage.nameAr, required: true },
          { name: 'name_en', label: t.admin.catalogPage.nameEn, ltr: true },
          { name: 'faculty_id', label: t.syllabus.faculty, type: 'select', options: opts(lk.faculties, name) },
          { name: 'plan_id', label: t.syllabus.plan, type: 'select', options: opts(lk.plans, name) },
          {
            name: 'term_type',
            label: p.termType,
            type: 'select',
            required: true,
            options: [
              { value: 'regular', label: t.syllabus.termRegular },
              { value: 'summer', label: t.syllabus.termSummer },
              { value: 'any', label: t.syllabus.termAny },
            ],
          },
          { name: 'min_credits', label: t.syllabus.minCredits, type: 'number' },
          { name: 'max_credits', label: t.syllabus.maxCredits, type: 'number' },
          { name: 'condition_ar', label: `${p.condition} (AR)`, type: 'textarea' },
          { name: 'condition_en', label: `${p.condition} (EN)`, type: 'textarea', ltr: true },
          { name: 'source_document_id', label: t.admin.coursesPage.sourceDoc, type: 'select', options: docOptions },
          { name: 'source_page', label: t.admin.coursesPage.sourcePage, type: 'number' },
          { name: 'last_verified_at', label: t.common.lastVerified, type: 'date' },
        ]}
        columns={[
          { key: 'name', label: t.admin.catalogPage.nameAr, render: (r) => name(r) },
          { key: 'term_type', label: p.termType, render: (r) => ({ regular: t.syllabus.termRegular, summer: t.syllabus.termSummer, any: t.syllabus.termAny })[r.term_type] },
          { key: 'min_credits', label: t.syllabus.minCredits },
          { key: 'max_credits', label: t.syllabus.maxCredits },
        ]}
      />
    </>
  );
}
