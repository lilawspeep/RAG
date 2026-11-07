import { useI18n } from '../../i18n/I18nProvider';
import type { Department, Faculty, Major } from '../../lib/types';
import { EntityManager } from './EntityManager';
import { opts, useLookups } from './lookups';

export default function Catalog() {
  const { t, pick } = useI18n();
  const c = t.admin.catalogPage;
  const lk = useLookups();
  const name = (r: { name_ar: string; name_en: string | null }) => pick(r.name_ar, r.name_en) ?? '';
  const facultyName = (id: string) => lk.faculties.find((f) => f.id === id);
  const deptName = (id: string) => lk.departments.find((d) => d.id === id);
  const base = [
    { name: 'code', label: c.code, ltr: true },
    { name: 'name_ar', label: c.nameAr, required: true },
    { name: 'name_en', label: c.nameEn, ltr: true },
  ];
  const cols = [
    { key: 'code', label: c.code, ltr: true },
    { key: 'name', label: c.nameAr, render: (r: { name_ar: string; name_en: string | null }) => name(r) },
  ];

  return (
    <>
      <EntityManager<Faculty & Record<string, unknown>>
        title={c.faculties}
        table="faculties"
        order={{ column: 'name_ar' }}
        fields={base}
        columns={cols}
        searchKeys={['code', 'name_ar', 'name_en']}
        onChanged={lk.reload}
      />
      <EntityManager<Department & Record<string, unknown>>
        title={c.departments}
        table="departments"
        order={{ column: 'name_ar' }}
        fields={[{ name: 'faculty_id', label: c.parentFaculty, type: 'select', required: true, options: opts(lk.faculties, name) }, ...base]}
        columns={[...cols, { key: 'faculty_id', label: c.parentFaculty, render: (r) => { const f = facultyName(r.faculty_id); return f ? name(f) : '—'; } }]}
        searchKeys={['code', 'name_ar', 'name_en']}
        onChanged={lk.reload}
      />
      <EntityManager<Major & Record<string, unknown>>
        title={c.majors}
        table="majors"
        order={{ column: 'name_ar' }}
        fields={[
          { name: 'department_id', label: c.parentDepartment, type: 'select', required: true, options: opts(lk.departments, name) },
          ...base,
          { name: 'degree', label: c.degree },
        ]}
        columns={[...cols, { key: 'department_id', label: c.parentDepartment, render: (r) => { const d = deptName(r.department_id); return d ? name(d) : '—'; } }, { key: 'degree', label: c.degree }]}
        searchKeys={['code', 'name_ar', 'name_en']}
        onChanged={lk.reload}
      />
    </>
  );
}
