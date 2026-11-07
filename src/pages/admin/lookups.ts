import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from '../../lib/supabase';
import type { AcademicPlan, Classroom, Department, DocumentRow, Faculty, Major, Semester } from '../../lib/types';

export interface Lookups {
  faculties: Faculty[];
  departments: Department[];
  majors: Major[];
  plans: AcademicPlan[];
  semesters: Semester[];
  classrooms: Classroom[];
  documents: Pick<DocumentRow, 'id' | 'title' | 'version_label'>[];
}

const EMPTY: Lookups = { faculties: [], departments: [], majors: [], plans: [], semesters: [], classrooms: [], documents: [] };

export function useLookups() {
  const [data, setData] = useState<Lookups>(EMPTY);
  const reload = useCallback(async () => {
    const sb = await getSupabase();
    if (!sb) return;
    const [f, d, m, p, s, c, docs] = await Promise.all([
      sb.from('faculties').select('*').order('name_ar'),
      sb.from('departments').select('*').order('name_ar'),
      sb.from('majors').select('*').order('name_ar'),
      sb.from('academic_plans').select('*').order('name_ar'),
      sb.from('semesters').select('*').order('starts_on', { ascending: false, nullsFirst: false }),
      sb.from('classrooms').select('*').order('code'),
      sb.from('documents').select('id,title,version_label').order('title'),
    ]);
    setData({
      faculties: f.data ?? [],
      departments: d.data ?? [],
      majors: m.data ?? [],
      plans: p.data ?? [],
      semesters: s.data ?? [],
      classrooms: c.data ?? [],
      documents: docs.data ?? [],
    });
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);
  return { ...data, reload };
}

export const opts = <T extends { id: string }>(rows: T[], label: (r: T) => string) => rows.map((r) => ({ value: r.id, label: label(r) }));
