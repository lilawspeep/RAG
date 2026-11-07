import { useEffect, useState } from 'react';
import { getSupabase } from './supabase';
import type {
  AcademicPlan,
  Classroom,
  Course,
  CoursePrerequisite,
  CourseSection,
  CreditLimitPolicy,
  Department,
  Faculty,
  Major,
  PlanCourse,
  Semester,
  SectionMeeting,
} from './types';

export interface CatalogData {
  faculties: Faculty[];
  departments: Department[];
  majors: Major[];
  plans: AcademicPlan[];
  semesters: Semester[];
  policies: CreditLimitPolicy[];
  courses: Course[];
  requisites: CoursePrerequisite[];
  documents: Record<string, string>;
}

export type LoadState<T> = { status: 'loading' } | { status: 'unconfigured' } | { status: 'error' } | { status: 'ready'; data: T };

const EMPTY: CatalogData = {
  faculties: [],
  departments: [],
  majors: [],
  plans: [],
  semesters: [],
  policies: [],
  courses: [],
  requisites: [],
  documents: {},
};

export function useCatalog(): LoadState<CatalogData> {
  const [state, setState] = useState<LoadState<CatalogData>>({ status: 'loading' });
  useEffect(() => {
    let active = true;
    (async () => {
      const sb = await getSupabase();
      if (!sb) return active && setState({ status: 'unconfigured' });
      const results = await Promise.all([
        sb.from('faculties').select('*').order('name_ar'),
        sb.from('departments').select('*').order('name_ar'),
        sb.from('majors').select('*').order('name_ar'),
        sb.from('academic_plans').select('*').order('catalog_year', { ascending: false }),
        sb.from('semesters').select('*').order('starts_on', { ascending: false, nullsFirst: false }),
        sb.from('credit_limit_policies').select('*'),
        sb.from('courses').select('*').eq('is_active', true).order('course_number').range(0, 4999),
        sb.from('course_prerequisites').select('*').range(0, 9999),
        sb.from('document_catalog').select('id,title,version_label'),
      ]);
      if (!active) return;
      if (results.some((r) => r.error)) return setState({ status: 'error' });
      const [f, d, m, p, s, cp, c, r, docs] = results.map((x) => x.data ?? []);
      setState({
        status: 'ready',
        data: {
          ...EMPTY,
          faculties: f as Faculty[],
          departments: d as Department[],
          majors: m as Major[],
          plans: p as AcademicPlan[],
          semesters: s as Semester[],
          policies: cp as CreditLimitPolicy[],
          courses: c as Course[],
          requisites: r as CoursePrerequisite[],
          documents: Object.fromEntries(
            (docs as { id: string; title: string; version_label: string | null }[]).map((x) => [
              x.id,
              x.version_label ? `${x.title} (${x.version_label})` : x.title,
            ]),
          ),
        },
      });
    })().catch(() => active && setState({ status: 'error' }));
    return () => {
      active = false;
    };
  }, []);
  return state;
}

export function usePlanCourses(planId: string | null) {
  const [rows, setRows] = useState<PlanCourse[] | null>(null);
  useEffect(() => {
    if (!planId) {
      setRows(null);
      return;
    }
    let active = true;
    getSupabase().then(async (sb) => {
      if (!sb) return;
      const { data } = await sb.from('plan_courses').select('*').eq('plan_id', planId).range(0, 1999);
      if (active) setRows((data as PlanCourse[]) ?? []);
    });
    return () => {
      active = false;
    };
  }, [planId]);
  return rows;
}

export type SectionWithMeetings = CourseSection & {
  section_meetings: (SectionMeeting & { classrooms: Pick<Classroom, 'code' | 'building' | 'name'> | null })[];
};

export function useSemesterSections(semesterId: string | null) {
  const [rows, setRows] = useState<Record<string, SectionWithMeetings[]> | null>(null);
  useEffect(() => {
    if (!semesterId) {
      setRows(null);
      return;
    }
    let active = true;
    getSupabase().then(async (sb) => {
      if (!sb) return;
      const { data } = await sb
        .from('course_sections')
        .select('*, section_meetings(*, classrooms(code,building,name))')
        .eq('semester_id', semesterId)
        .order('section_number')
        .range(0, 4999);
      if (!active) return;
      const grouped: Record<string, SectionWithMeetings[]> = {};
      for (const s of (data as SectionWithMeetings[]) ?? []) (grouped[s.course_number] ??= []).push(s);
      setRows(grouped);
    });
    return () => {
      active = false;
    };
  }, [semesterId]);
  return rows;
}
