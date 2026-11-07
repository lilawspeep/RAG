import { useState } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { COURSE_NUMBER_RE } from '../../lib/validation';
import { formatTime } from '../../lib/format';
import { TERMS, type CourseSection, type SectionMeeting, type Semester, type Classroom } from '../../lib/types';
import { Badge } from '../../components/ui';
import { EntityManager } from './EntityManager';
import { opts, useLookups } from './lookups';

export default function Sections() {
  const { t, pick } = useI18n();
  const s = t.admin.sectionsPage;
  const lk = useLookups();
  const [semester, setSemester] = useState<Semester | null>(null);
  const [section, setSection] = useState<CourseSection | null>(null);
  const roomLabel = (id: string | null) => {
    const r = lk.classrooms.find((c) => c.id === id);
    return r ? [r.code, r.building].filter(Boolean).join(' · ') : '—';
  };

  return (
    <>
      <EntityManager<Semester & Record<string, unknown>>
        title={s.semesters}
        table="semesters"
        order={{ column: 'starts_on', ascending: false }}
        selectedId={semester?.id}
        onSelect={(r) => {
          setSemester(r);
          setSection(null);
        }}
        onChanged={lk.reload}
        fields={[
          { name: 'code', label: s.semesterCode, required: true, ltr: true },
          { name: 'academic_year', label: s.academicYear, required: true, ltr: true, hint: '2026/2027' },
          { name: 'term', label: s.term, type: 'select', required: true, options: TERMS.map((k) => ({ value: k, label: t.syllabus.terms[k] })) },
          { name: 'name_ar', label: t.admin.catalogPage.nameAr, required: true },
          { name: 'name_en', label: t.admin.catalogPage.nameEn, ltr: true },
          { name: 'starts_on', label: s.startsOn, type: 'date' },
          { name: 'ends_on', label: s.endsOn, type: 'date' },
          { name: 'is_current', label: s.isCurrent, type: 'checkbox' },
        ]}
        columns={[
          { key: 'code', label: s.semesterCode, ltr: true },
          { key: 'name', label: t.syllabus.semester, render: (r) => pick(r.name_ar, r.name_en) },
          { key: 'term', label: s.term, render: (r) => t.syllabus.terms[r.term] },
          { key: 'is_current', label: s.isCurrent, render: (r) => (r.is_current ? <Badge tone="gold">{t.common.yes}</Badge> : null) },
        ]}
      />

      <EntityManager<Classroom & Record<string, unknown>>
        title={s.classrooms}
        table="classrooms"
        order={{ column: 'code' }}
        searchKeys={['code', 'building', 'name']}
        onChanged={lk.reload}
        fields={[
          { name: 'code', label: s.roomCode, required: true, ltr: true },
          { name: 'building', label: s.building },
          { name: 'name', label: t.admin.catalogPage.nameAr },
          { name: 'capacity', label: s.capacity, type: 'number' },
        ]}
        columns={[
          { key: 'code', label: s.roomCode, ltr: true },
          { key: 'building', label: s.building },
          { key: 'name', label: t.admin.catalogPage.nameAr },
          { key: 'capacity', label: s.capacity },
        ]}
      />

      {semester ? (
        <EntityManager<CourseSection & Record<string, unknown>>
          key={semester.id}
          title={`${t.admin.sections} — ${pick(semester.name_ar, semester.name_en)}`}
          table="course_sections"
          order={{ column: 'course_number' }}
          filter={{ semester_id: semester.id }}
          searchKeys={['course_number', 'section_number', 'instructor_name']}
          emptyText={s.empty}
          selectedId={section?.id}
          onSelect={setSection}
          fields={[
            { name: 'course_number', label: t.syllabus.courseNumber, required: true, ltr: true, pattern: COURSE_NUMBER_RE, patternMessage: t.validation.courseNumber },
            { name: 'section_number', label: t.syllabus.sectionNo, required: true, ltr: true },
            { name: 'instructor_name', label: t.syllabus.instructor },
            { name: 'capacity', label: s.capacity, type: 'number' },
            { name: 'notes', label: s.notes, type: 'textarea' },
            { name: 'last_verified_at', label: t.common.lastVerified, type: 'date' },
          ]}
          columns={[
            { key: 'course_number', label: t.syllabus.courseNumber, ltr: true, render: (r) => <span className="font-mono font-bold">{r.course_number}</span> },
            { key: 'section_number', label: t.syllabus.sectionNo, ltr: true },
            { key: 'instructor_name', label: t.syllabus.instructor },
            { key: 'capacity', label: s.capacity },
          ]}
        />
      ) : (
        <p className="card px-5 py-6 text-center text-sm text-muted">{s.selectSemester}</p>
      )}

      {section && (
        <EntityManager<SectionMeeting & Record<string, unknown>>
          key={section.id}
          title={`${t.syllabus.meetings} — ${section.course_number} / ${section.section_number}`}
          table="section_meetings"
          order={{ column: 'day_of_week' }}
          filter={{ section_id: section.id }}
          fields={[
            { name: 'day_of_week', label: s.day, type: 'select', numeric: true, required: true, options: t.syllabus.days.map((d, i) => ({ value: String(i), label: d })) },
            { name: 'start_time', label: s.start, type: 'time', required: true },
            { name: 'end_time', label: s.end, type: 'time', required: true },
            { name: 'classroom_id', label: s.room, type: 'select', options: opts(lk.classrooms, (c) => [c.code, c.building].filter(Boolean).join(' · ')) },
            { name: 'meeting_type', label: s.meetingType, hint: 'lecture / lab' },
          ]}
          columns={[
            { key: 'day_of_week', label: s.day, render: (r) => t.syllabus.days[r.day_of_week] },
            { key: 'time', label: `${s.start} – ${s.end}`, ltr: true, render: (r) => `${formatTime(r.start_time)} – ${formatTime(r.end_time)}` },
            { key: 'classroom_id', label: s.room, render: (r) => roomLabel(r.classroom_id) },
            { key: 'meeting_type', label: s.meetingType },
          ]}
        />
      )}
    </>
  );
}
