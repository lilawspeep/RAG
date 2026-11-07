export type AppRole = 'student' | 'admin';

export interface Profile {
  id: string;
  full_name: string;
  email: string | null;
  university_id: string | null;
  faculty_id: string | null;
  major_id: string | null;
  faculty_text: string | null;
  major_text: string | null;
  preferred_language: 'ar' | 'en';
  created_at: string;
}

export interface Faculty {
  id: string;
  code: string | null;
  name_ar: string;
  name_en: string | null;
}

export interface Department {
  id: string;
  faculty_id: string;
  code: string | null;
  name_ar: string;
  name_en: string | null;
}

export interface Major {
  id: string;
  department_id: string;
  code: string | null;
  name_ar: string;
  name_en: string | null;
  degree: string | null;
}

export interface AcademicPlan {
  id: string;
  major_id: string;
  code: string;
  name_ar: string;
  name_en: string | null;
  catalog_year: string | null;
  total_credits: number | null;
  is_current: boolean;
  source_document_id: string | null;
  source_note: string | null;
  last_verified_at: string | null;
}

export interface Course {
  course_number: string;
  name_ar: string;
  name_en: string | null;
  credit_hours: number | null;
  description_ar: string | null;
  description_en: string | null;
  faculty_id: string | null;
  department_id: string | null;
  source_document_id: string | null;
  source_page: number | null;
  source_note: string | null;
  last_verified_at: string | null;
  is_active: boolean;
}

export type RequirementType =
  | 'university_required'
  | 'university_elective'
  | 'faculty_required'
  | 'faculty_elective'
  | 'major_required'
  | 'major_elective'
  | 'free_elective'
  | 'other';

export const REQUIREMENT_TYPES: RequirementType[] = [
  'university_required',
  'university_elective',
  'faculty_required',
  'faculty_elective',
  'major_required',
  'major_elective',
  'free_elective',
  'other',
];

export interface PlanCourse {
  id: string;
  plan_id: string;
  course_number: string;
  requirement_type: RequirementType;
  suggested_year: number | null;
  suggested_term: Term | null;
}

export type RelationType = 'prerequisite' | 'corequisite';

export interface CoursePrerequisite {
  id: string;
  course_number: string;
  required_course_number: string;
  relation_type: RelationType;
  note: string | null;
}

export type Term = 'fall' | 'spring' | 'summer';
export const TERMS: Term[] = ['fall', 'spring', 'summer'];

export interface Semester {
  id: string;
  code: string;
  name_ar: string;
  name_en: string | null;
  academic_year: string;
  term: Term;
  starts_on: string | null;
  ends_on: string | null;
  is_current: boolean;
}

export interface Classroom {
  id: string;
  code: string;
  building: string | null;
  name: string | null;
  capacity: number | null;
}

export interface SectionMeeting {
  id: string;
  section_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  classroom_id: string | null;
  meeting_type: string | null;
}

export interface CourseSection {
  id: string;
  course_number: string;
  semester_id: string;
  section_number: string;
  instructor_name: string | null;
  capacity: number | null;
  notes: string | null;
  last_verified_at: string | null;
}

export interface CreditLimitPolicy {
  id: string;
  name_ar: string;
  name_en: string | null;
  faculty_id: string | null;
  plan_id: string | null;
  term_type: 'regular' | 'summer' | 'any';
  min_credits: number | null;
  max_credits: number | null;
  condition_ar: string | null;
  condition_en: string | null;
  source_document_id: string | null;
  source_page: number | null;
  last_verified_at: string | null;
}

export type DocumentStatus = 'pending' | 'processing' | 'indexed' | 'failed';
export type DocumentType = 'regulation' | 'study_plan' | 'course_catalog' | 'schedule' | 'guide' | 'other';
export const DOCUMENT_TYPES: DocumentType[] = ['regulation', 'study_plan', 'course_catalog', 'schedule', 'guide', 'other'];

export interface DocumentRow {
  id: string;
  title: string;
  doc_type: DocumentType;
  language: 'ar' | 'en' | 'mixed';
  storage_path: string;
  file_size: number | null;
  version_label: string | null;
  version_group: string;
  effective_date: string | null;
  is_current: boolean;
  status: DocumentStatus;
  error_message: string | null;
  page_count: number | null;
  chunk_count: number | null;
  indexed_at: string | null;
  created_at: string;
}

export interface Citation {
  index: number;
  kind: 'document' | 'course';
  document_id?: string;
  document_title?: string;
  version_label?: string | null;
  page_number?: number | null;
  section_title?: string | null;
  course_number?: string;
  snippet: string;
}

export interface AdvisorMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  citations: Citation[];
  grounded: boolean | null;
  created_at: string;
}

export interface AdvisorConversation {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: 'new' | 'read' | 'archived';
  created_at: string;
}
