-- Al-Quds AI Academic Advisor — initial schema
-- Course number is the canonical academic identifier for every course reference.
-- Roles live in public.user_roles and can only be written by the service role / SQL editor.

create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create type public.app_role as enum ('student', 'admin');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Academic structure
-- ---------------------------------------------------------------------------

create table public.faculties (
  id uuid primary key default gen_random_uuid(),
  code text unique check (code is null or char_length(code) between 1 and 20),
  name_ar text not null unique check (char_length(name_ar) between 2 and 200),
  name_en text check (name_en is null or char_length(name_en) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  faculty_id uuid not null references public.faculties (id) on delete restrict,
  code text check (code is null or char_length(code) between 1 and 20),
  name_ar text not null check (char_length(name_ar) between 2 and 200),
  name_en text check (name_en is null or char_length(name_en) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (faculty_id, name_ar)
);
create index departments_faculty_idx on public.departments (faculty_id);

create table public.majors (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete restrict,
  code text check (code is null or char_length(code) between 1 and 20),
  name_ar text not null check (char_length(name_ar) between 2 and 200),
  name_en text check (name_en is null or char_length(name_en) <= 200),
  degree text check (degree is null or char_length(degree) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department_id, name_ar)
);
create index majors_department_idx on public.majors (department_id);

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  email text,
  university_id text check (university_id is null or university_id ~ '^[0-9]{4,12}$'),
  faculty_id uuid references public.faculties (id) on delete set null,
  major_id uuid references public.majors (id) on delete set null,
  faculty_text text check (faculty_text is null or char_length(faculty_text) <= 120),
  major_text text check (major_text is null or char_length(major_text) <= 120),
  preferred_language text not null default 'ar' check (preferred_language in ('ar', 'en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_faculty_idx on public.profiles (faculty_id);
create index profiles_major_idx on public.profiles (major_id);

-- References profiles (which cascades from auth.users) so the API can embed roles in profile queries.
create table public.user_roles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid()) and role = 'admin'
  );
$$;
revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;

-- Creates the profile and assigns the student role for every new account.
-- Role metadata sent by a client is ignored on purpose: admins are granted only from the backend.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_faculty uuid;
  v_major uuid;
  v_uni text := nullif(btrim(meta ->> 'university_id'), '');
begin
  begin
    v_faculty := nullif(meta ->> 'faculty_id', '')::uuid;
  exception when others then
    v_faculty := null;
  end;
  begin
    v_major := nullif(meta ->> 'major_id', '')::uuid;
  exception when others then
    v_major := null;
  end;
  if v_faculty is not null and not exists (select 1 from public.faculties where id = v_faculty) then
    v_faculty := null;
  end if;
  if v_major is not null and not exists (select 1 from public.majors where id = v_major) then
    v_major := null;
  end if;
  if v_uni is not null and v_uni !~ '^[0-9]{4,12}$' then
    v_uni := null;
  end if;

  insert into public.profiles (id, full_name, email, university_id, faculty_id, major_id, faculty_text, major_text, preferred_language)
  values (
    new.id,
    left(coalesce(btrim(meta ->> 'full_name'), ''), 120),
    new.email,
    v_uni,
    v_faculty,
    v_major,
    left(nullif(btrim(meta ->> 'faculty_text'), ''), 120),
    left(nullif(btrim(meta ->> 'major_text'), ''), 120),
    case when meta ->> 'preferred_language' = 'en' then 'en' else 'ar' end
  );

  insert into public.user_roles (user_id, role) values (new.id, 'student');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Documents (official sources for RAG)
-- ---------------------------------------------------------------------------

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 300),
  doc_type text not null default 'other'
    check (doc_type in ('regulation', 'study_plan', 'course_catalog', 'schedule', 'guide', 'other')),
  language text not null default 'ar' check (language in ('ar', 'en', 'mixed')),
  storage_path text not null unique,
  file_size bigint check (file_size is null or file_size between 1 and 20971520),
  mime_type text not null default 'application/pdf' check (mime_type = 'application/pdf'),
  version_label text check (version_label is null or char_length(version_label) <= 60),
  version_group uuid not null,
  effective_date date,
  is_current boolean not null default true,
  status text not null default 'pending' check (status in ('pending', 'processing', 'indexed', 'failed')),
  error_message text,
  page_count integer check (page_count is null or page_count >= 0),
  chunk_count integer check (chunk_count is null or chunk_count >= 0),
  embedding_model text,
  indexed_at timestamptz,
  uploaded_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index documents_one_current_per_group on public.documents (version_group) where is_current;
create index documents_status_idx on public.documents (status, is_current);

create table public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  page_number integer not null check (page_number >= 1),
  chunk_index integer not null check (chunk_index >= 0),
  section_title text,
  content text not null,
  -- Arabic-normalized, lightly stemmed text produced by the ingest function (same normalizer as queries).
  search_text text not null default '',
  search_tsv tsvector generated always as (to_tsvector('simple', search_text)) stored,
  embedding extensions.vector(1536),
  token_estimate integer,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);
create index document_chunks_document_idx on public.document_chunks (document_id);
create index document_chunks_tsv_idx on public.document_chunks using gin (search_tsv);
create index document_chunks_embedding_idx on public.document_chunks
  using hnsw (embedding extensions.vector_cosine_ops);

-- Public, non-sensitive listing of document titles (used to show course/plan sources).
create view public.document_catalog
with (security_barrier = true)
as
  select id, title, doc_type, language, version_label, effective_date, is_current
  from public.documents;
grant select on public.document_catalog to anon, authenticated;

create or replace function public.set_current_document_version(p_document_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group uuid;
begin
  if not (public.is_admin() or (select auth.role()) = 'service_role') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select version_group into v_group from public.documents where id = p_document_id;
  if v_group is null then
    raise exception 'document not found' using errcode = 'P0002';
  end if;
  update public.documents set is_current = false where version_group = v_group and id <> p_document_id and is_current;
  update public.documents set is_current = true where id = p_document_id;
end;
$$;
revoke execute on function public.set_current_document_version(uuid) from public, anon;
grant execute on function public.set_current_document_version(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Courses, plans and requisites
-- ---------------------------------------------------------------------------

create table public.courses (
  course_number text primary key check (course_number ~ '^[A-Z0-9-]{2,20}$'),
  name_ar text not null check (char_length(name_ar) between 2 and 200),
  name_en text check (name_en is null or char_length(name_en) <= 200),
  credit_hours numeric(4, 1) check (credit_hours is null or credit_hours between 0 and 30),
  description_ar text,
  description_en text,
  faculty_id uuid references public.faculties (id) on delete set null,
  department_id uuid references public.departments (id) on delete set null,
  source_document_id uuid references public.documents (id) on delete set null,
  source_page integer check (source_page is null or source_page >= 1),
  source_note text,
  last_verified_at date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index courses_faculty_idx on public.courses (faculty_id);
create index courses_department_idx on public.courses (department_id);
create index courses_source_idx on public.courses (source_document_id);

create or replace function public.normalize_course_refs()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.course_number := upper(btrim(new.course_number));
  if tg_table_name = 'course_prerequisites' then
    new.required_course_number := upper(btrim(new.required_course_number));
  end if;
  return new;
end;
$$;

create table public.academic_plans (
  id uuid primary key default gen_random_uuid(),
  major_id uuid not null references public.majors (id) on delete restrict,
  code text not null unique check (char_length(code) between 1 and 40),
  name_ar text not null check (char_length(name_ar) between 2 and 200),
  name_en text check (name_en is null or char_length(name_en) <= 200),
  catalog_year text check (catalog_year is null or char_length(catalog_year) <= 20),
  total_credits numeric(5, 1) check (total_credits is null or total_credits between 0 and 400),
  is_current boolean not null default false,
  source_document_id uuid references public.documents (id) on delete set null,
  source_note text,
  last_verified_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index academic_plans_major_idx on public.academic_plans (major_id);
create index academic_plans_source_idx on public.academic_plans (source_document_id);

create table public.plan_courses (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.academic_plans (id) on delete cascade,
  course_number text not null references public.courses (course_number) on update cascade on delete cascade,
  requirement_type text not null default 'other' check (requirement_type in (
    'university_required', 'university_elective', 'faculty_required', 'faculty_elective',
    'major_required', 'major_elective', 'free_elective', 'other'
  )),
  suggested_year smallint check (suggested_year is null or suggested_year between 1 and 8),
  suggested_term text check (suggested_term is null or suggested_term in ('fall', 'spring', 'summer')),
  created_at timestamptz not null default now(),
  unique (plan_id, course_number)
);
create index plan_courses_course_idx on public.plan_courses (course_number);

create table public.course_prerequisites (
  id uuid primary key default gen_random_uuid(),
  course_number text not null references public.courses (course_number) on update cascade on delete cascade,
  required_course_number text not null references public.courses (course_number) on update cascade on delete cascade,
  relation_type text not null default 'prerequisite' check (relation_type in ('prerequisite', 'corequisite')),
  note text,
  created_at timestamptz not null default now(),
  unique (course_number, required_course_number, relation_type),
  check (course_number <> required_course_number)
);
create index course_prerequisites_required_idx on public.course_prerequisites (required_course_number);

-- ---------------------------------------------------------------------------
-- Semesters, rooms, sections
-- ---------------------------------------------------------------------------

create table public.semesters (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (char_length(code) between 1 and 20),
  name_ar text not null check (char_length(name_ar) between 2 and 120),
  name_en text,
  academic_year text not null check (academic_year ~ '^[0-9]{4}/[0-9]{4}$'),
  term text not null check (term in ('fall', 'spring', 'summer')),
  starts_on date,
  ends_on date,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (academic_year, term),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);
create unique index semesters_one_current on public.semesters (is_current) where is_current;

create or replace function public.single_current_semester()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_current then
    update public.semesters set is_current = false where id <> new.id and is_current;
  end if;
  return new;
end;
$$;

create table public.classrooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (char_length(code) between 1 and 40),
  building text,
  name text,
  capacity integer check (capacity is null or capacity between 1 and 2000),
  created_at timestamptz not null default now()
);

create table public.course_sections (
  id uuid primary key default gen_random_uuid(),
  course_number text not null references public.courses (course_number) on update cascade on delete cascade,
  semester_id uuid not null references public.semesters (id) on delete cascade,
  section_number text not null check (char_length(section_number) between 1 and 10),
  instructor_name text,
  capacity integer check (capacity is null or capacity between 1 and 2000),
  notes text,
  last_verified_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (semester_id, course_number, section_number)
);
create index course_sections_course_idx on public.course_sections (course_number);

create table public.section_meetings (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.course_sections (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6), -- 0 = Sunday
  start_time time not null,
  end_time time not null,
  classroom_id uuid references public.classrooms (id) on delete set null,
  meeting_type text check (meeting_type is null or char_length(meeting_type) <= 30),
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);
create index section_meetings_section_idx on public.section_meetings (section_id);
create index section_meetings_classroom_idx on public.section_meetings (classroom_id);

create table public.credit_limit_policies (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null check (char_length(name_ar) between 2 and 200),
  name_en text,
  faculty_id uuid references public.faculties (id) on delete cascade,
  plan_id uuid references public.academic_plans (id) on delete cascade,
  term_type text not null default 'regular' check (term_type in ('regular', 'summer', 'any')),
  min_credits numeric(4, 1) check (min_credits is null or min_credits >= 0),
  max_credits numeric(4, 1) check (max_credits is null or max_credits >= 0),
  condition_ar text,
  condition_en text,
  source_document_id uuid references public.documents (id) on delete set null,
  source_page integer check (source_page is null or source_page >= 1),
  last_verified_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (min_credits is null or max_credits is null or min_credits <= max_credits)
);
create index credit_limit_policies_faculty_idx on public.credit_limit_policies (faculty_id);
create index credit_limit_policies_plan_idx on public.credit_limit_policies (plan_id);

-- ---------------------------------------------------------------------------
-- Advisor conversations
-- ---------------------------------------------------------------------------

create table public.advisor_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text check (title is null or char_length(title) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index advisor_conversations_user_idx on public.advisor_conversations (user_id, updated_at desc);

create table public.advisor_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.advisor_conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) <= 12000),
  citations jsonb not null default '[]'::jsonb check (jsonb_typeof(citations) = 'array'),
  grounded boolean,
  refusal_reason text check (refusal_reason is null or refusal_reason in ('no_documents', 'no_evidence', 'insufficient_evidence', 'smalltalk')),
  created_at timestamptz not null default now()
);
create index advisor_messages_conversation_idx on public.advisor_messages (conversation_id, created_at);
create index advisor_messages_user_idx on public.advisor_messages (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Contact messages
-- ---------------------------------------------------------------------------

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  email text not null check (email ~* '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' and char_length(email) <= 254),
  subject text not null check (char_length(btrim(subject)) between 3 and 200),
  message text not null check (char_length(btrim(message)) between 10 and 5000),
  status text not null default 'new' check (status in ('new', 'read', 'archived')),
  created_at timestamptz not null default now()
);
create index contact_messages_status_idx on public.contact_messages (status, created_at desc);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create trigger faculties_updated before update on public.faculties for each row execute function public.set_updated_at();
create trigger departments_updated before update on public.departments for each row execute function public.set_updated_at();
create trigger majors_updated before update on public.majors for each row execute function public.set_updated_at();
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger documents_updated before update on public.documents for each row execute function public.set_updated_at();
create trigger courses_updated before update on public.courses for each row execute function public.set_updated_at();
create trigger academic_plans_updated before update on public.academic_plans for each row execute function public.set_updated_at();
create trigger semesters_updated before update on public.semesters for each row execute function public.set_updated_at();
create trigger course_sections_updated before update on public.course_sections for each row execute function public.set_updated_at();
create trigger credit_limit_policies_updated before update on public.credit_limit_policies for each row execute function public.set_updated_at();
create trigger advisor_conversations_updated before update on public.advisor_conversations for each row execute function public.set_updated_at();

create trigger courses_normalize before insert or update on public.courses for each row execute function public.normalize_course_refs();
create trigger plan_courses_normalize before insert or update on public.plan_courses for each row execute function public.normalize_course_refs();
create trigger course_prerequisites_normalize before insert or update on public.course_prerequisites for each row execute function public.normalize_course_refs();
create trigger course_sections_normalize before insert or update on public.course_sections for each row execute function public.normalize_course_refs();

create trigger semesters_single_current before insert or update of is_current on public.semesters
  for each row when (new.is_current) execute function public.single_current_semester();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.faculties enable row level security;
alter table public.departments enable row level security;
alter table public.majors enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.courses enable row level security;
alter table public.academic_plans enable row level security;
alter table public.plan_courses enable row level security;
alter table public.course_prerequisites enable row level security;
alter table public.semesters enable row level security;
alter table public.classrooms enable row level security;
alter table public.course_sections enable row level security;
alter table public.section_meetings enable row level security;
alter table public.credit_limit_policies enable row level security;
alter table public.advisor_conversations enable row level security;
alter table public.advisor_messages enable row level security;
alter table public.contact_messages enable row level security;

-- Public academic catalog: readable by everyone, writable by verified admins only.
do $$
declare
  t text;
begin
  foreach t in array array[
    'faculties', 'departments', 'majors', 'courses', 'academic_plans', 'plan_courses',
    'course_prerequisites', 'semesters', 'classrooms', 'course_sections', 'section_meetings',
    'credit_limit_policies'
  ] loop
    execute format('create policy "%1$s: public read" on public.%1$I for select to anon, authenticated using (true)', t);
    execute format('create policy "%1$s: admin insert" on public.%1$I for insert to authenticated with check ((select public.is_admin()))', t);
    execute format('create policy "%1$s: admin update" on public.%1$I for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t);
    execute format('create policy "%1$s: admin delete" on public.%1$I for delete to authenticated using ((select public.is_admin()))', t);
  end loop;
end;
$$;

-- Profiles: users see and edit their own; admins can read all. Inserts happen only via the auth trigger.
create policy "profiles: read own or admin" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
create policy "profiles: update own" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke update on public.profiles from anon, authenticated;
grant update (full_name, university_id, faculty_id, major_id, faculty_text, major_text, preferred_language)
  on public.profiles to authenticated;

-- Roles: readable by the owner and admins. No insert/update/delete policies: only the service role
-- (SQL editor, migrations, server code) can change roles.
create policy "user_roles: read own or admin" on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- Documents and chunks: admin only. Students reach content exclusively through the advisor function.
create policy "documents: admin read" on public.documents for select to authenticated using ((select public.is_admin()));
create policy "documents: admin insert" on public.documents for insert to authenticated with check ((select public.is_admin()));
create policy "documents: admin update" on public.documents for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "documents: admin delete" on public.documents for delete to authenticated using ((select public.is_admin()));
create policy "document_chunks: admin read" on public.document_chunks for select to authenticated using ((select public.is_admin()));

-- Advisor history: owners can read and delete; messages are written only by the advisor function.
create policy "conversations: read own" on public.advisor_conversations for select to authenticated
  using (user_id = (select auth.uid()));
create policy "conversations: rename own" on public.advisor_conversations for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "conversations: delete own" on public.advisor_conversations for delete to authenticated
  using (user_id = (select auth.uid()));
create policy "messages: read own" on public.advisor_messages for select to authenticated
  using (user_id = (select auth.uid()));

-- Contact: anyone may submit; only admins can read or triage.
create policy "contact: submit" on public.contact_messages for insert to anon, authenticated
  with check (status = 'new' and (user_id is null or user_id = (select auth.uid())));
create policy "contact: admin read" on public.contact_messages for select to authenticated using ((select public.is_admin()));
create policy "contact: admin update" on public.contact_messages for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "contact: admin delete" on public.contact_messages for delete to authenticated using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Hybrid retrieval (vector + keyword, reciprocal rank fusion). Service role only.
-- ---------------------------------------------------------------------------

create or replace function public.hybrid_search_chunks(
  query_embedding extensions.vector(1536),
  query_text text,
  match_count integer default 8,
  min_similarity double precision default 0.3,
  rrf_k integer default 50
)
returns table (
  chunk_id uuid,
  document_id uuid,
  document_title text,
  version_label text,
  page_number integer,
  section_title text,
  content text,
  similarity double precision,
  keyword_rank double precision,
  score double precision
)
language sql
stable
set search_path = ''
as $$
  with eligible as (
    select c.id, c.embedding, c.search_tsv
    from public.document_chunks c
    join public.documents d on d.id = c.document_id
    where d.is_current and d.status = 'indexed'
  ),
  terms as (
    select string_agg(quote_literal(w), ' | ') as q
    from (
      select distinct w
      from regexp_split_to_table(coalesce(query_text, ''), '\s+') as w
      where char_length(w) >= 3
      limit 32
    ) t
  ),
  tsq as (
    select case when q is null then null else to_tsquery('simple', q) end as query from terms
  ),
  semantic as (
    select e.id,
           1 - (e.embedding operator(extensions.<=>) query_embedding) as similarity,
           row_number() over (order by e.embedding operator(extensions.<=>) query_embedding) as rnk
    from eligible e
    where e.embedding is not null
    order by e.embedding operator(extensions.<=>) query_embedding
    limit greatest(match_count, 1) * 4
  ),
  keyword as (
    select e.id,
           ts_rank_cd(e.search_tsv, tsq.query) as krank,
           row_number() over (order by ts_rank_cd(e.search_tsv, tsq.query) desc) as rnk
    from eligible e, tsq
    where tsq.query is not null and e.search_tsv @@ tsq.query
    order by krank desc
    limit greatest(match_count, 1) * 4
  ),
  fused as (
    select coalesce(s.id, k.id) as id,
           s.similarity,
           k.krank,
           coalesce(1.0 / (rrf_k + s.rnk), 0) + coalesce(1.0 / (rrf_k + k.rnk), 0) as score
    from semantic s
    full outer join keyword k on k.id = s.id
    where coalesce(s.similarity, 0) >= min_similarity or k.id is not null
  )
  select c.id, d.id, d.title, d.version_label, c.page_number, c.section_title, c.content,
         f.similarity, f.krank::double precision, f.score::double precision
  from fused f
  join public.document_chunks c on c.id = f.id
  join public.documents d on d.id = c.document_id
  order by f.score desc
  limit greatest(match_count, 1);
$$;
revoke execute on function public.hybrid_search_chunks(extensions.vector, text, integer, double precision, integer) from public, anon, authenticated;
grant execute on function public.hybrid_search_chunks(extensions.vector, text, integer, double precision, integer) to service_role;

-- ---------------------------------------------------------------------------
-- Admin metrics (aggregates only; admins never read students' advisor messages)
-- ---------------------------------------------------------------------------

create or replace function public.admin_dashboard_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'documents', (select count(*) from public.documents),
    'indexed_documents', (select count(*) from public.documents where status = 'indexed' and is_current),
    'chunks', (select count(*) from public.document_chunks),
    'courses', (select count(*) from public.courses),
    'plans', (select count(*) from public.academic_plans),
    'sections', (select count(*) from public.course_sections),
    'users', (select count(*) from public.profiles),
    'new_messages', (select count(*) from public.contact_messages where status = 'new'),
    'conversations', (select count(*) from public.advisor_conversations),
    'questions_7d', (select count(*) from public.advisor_messages where role = 'user' and created_at > now() - interval '7 days'),
    'grounded_7d', (select count(*) from public.advisor_messages where role = 'assistant' and grounded and created_at > now() - interval '7 days')
  );
end;
$$;
revoke execute on function public.admin_dashboard_stats() from public, anon;
grant execute on function public.admin_dashboard_stats() to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: private bucket for official PDFs (admins only; the ingest function uses the service role)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 20971520, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "documents bucket: admin read" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (select public.is_admin()));
create policy "documents bucket: admin upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (select public.is_admin()));
create policy "documents bucket: admin update" on storage.objects for update to authenticated
  using (bucket_id = 'documents' and (select public.is_admin()));
create policy "documents bucket: admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (select public.is_admin()));
