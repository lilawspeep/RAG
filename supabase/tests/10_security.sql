\set ON_ERROR_STOP 1
create schema t;
grant usage on schema t to anon, authenticated, service_role;
create table t.results (label text, ok boolean, detail text);
grant all on t.results to anon, authenticated, service_role;

create function t.expect_fail(q text, label text) returns void language plpgsql as $$
declare n bigint;
begin
  begin
    execute q;
    get diagnostics n = row_count;
    -- RLS-filtered UPDATE/DELETE affect zero rows instead of raising.
    if n = 0 and (q ilike 'update%' or q ilike 'delete%') then
      insert into t.results values (label, true, 'no rows affected');
    else
      insert into t.results values (label, false, 'succeeded unexpectedly');
    end if;
  exception when others then
    insert into t.results values (label, true, sqlerrm);
  end;
end $$;
create function t.expect_ok(q text, label text) returns void language plpgsql as $$
begin
  execute q;
  insert into t.results values (label, true, null);
exception when others then
  insert into t.results values (label, false, sqlerrm);
end $$;
create function t.check(cond boolean, label text) returns void language plpgsql as $$
begin
  insert into t.results values (label, coalesce(cond, false), null);
end $$;
grant execute on all functions in schema t to anon, authenticated, service_role;

-- Sign-ups (as Supabase Auth would insert them). One tries to self-assign admin through metadata.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@example.com', '{"full_name":"Admin Person"}'),
  ('00000000-0000-0000-0000-00000000000b', 'student@example.com', '{"full_name":"Student B","university_id":"12345678","role":"admin","roles":["admin"]}'),
  ('00000000-0000-0000-0000-00000000000c', 'other@example.com', '{"full_name":"Student C","university_id":"bad-id","faculty_id":"not-a-uuid"}');

select t.check((select count(*) = 3 from public.profiles), 'trigger creates profiles');
select t.check((select bool_and(role = 'student') and count(*) = 3 from public.user_roles), 'every sign-up is student only (metadata role ignored)');
select t.check((select university_id is null and faculty_id is null from public.profiles where id = '00000000-0000-0000-0000-00000000000c'), 'invalid metadata sanitized');

-- Backend-only admin assignment (SQL editor / service role).
insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-00000000000a', 'admin');

-- ---------------- Student B ----------------
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';

select t.check(not public.is_admin(), 'student: is_admin false');
select t.expect_fail($$insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-00000000000b','admin')$$, 'student: cannot grant self admin');
select t.expect_fail($$update public.user_roles set role = 'admin' where user_id = '00000000-0000-0000-0000-00000000000b'$$, 'student: cannot update role');
select t.expect_fail($$insert into public.courses (course_number, name_ar) values ('X100','مساق')$$, 'student: cannot write courses');
select t.expect_fail($$insert into public.faculties (name_ar) values ('كلية')$$, 'student: cannot write faculties');
select t.check((select count(*) = 1 from public.profiles), 'student: sees only own profile');
select t.expect_ok($$update public.profiles set full_name = 'B Updated' where id = '00000000-0000-0000-0000-00000000000b'$$, 'student: can update own name');
select t.expect_fail($$update public.profiles set email = 'x@y.z' where id = '00000000-0000-0000-0000-00000000000b'$$, 'student: cannot change protected profile columns');
select t.expect_fail($$update public.profiles set full_name = 'hack' where id = '00000000-0000-0000-0000-00000000000c'$$, 'student: cannot edit others');
select t.check((select count(*) = 0 from public.documents), 'student: cannot read documents table');
select t.check((select count(*) = 0 from public.document_chunks), 'student: cannot read chunks');
select t.expect_fail($$select public.admin_dashboard_stats()$$, 'student: no admin stats');
select t.expect_fail($$select * from public.hybrid_search_chunks(array_fill(0.1, array[1536])::extensions.vector, 'x')$$, 'student: cannot call retrieval RPC');
select t.expect_fail($$insert into public.advisor_messages (conversation_id, user_id, role, content) values (gen_random_uuid(), '00000000-0000-0000-0000-00000000000b', 'assistant', 'fake grounded answer')$$, 'student: cannot forge advisor messages');
select t.expect_fail($$insert into storage.objects (bucket_id, name) values ('documents', 'x.pdf')$$, 'student: cannot upload to documents bucket');
select t.expect_ok($$insert into public.contact_messages (name, email, subject, message, user_id) values ('Student', 's@example.com', 'سؤال', 'رسالة اختبار طويلة بما يكفي', '00000000-0000-0000-0000-00000000000b')$$, 'student: can submit contact');
select t.expect_fail($$insert into public.contact_messages (name, email, subject, message, user_id) values ('Student', 's@example.com', 'سؤال', 'رسالة اختبار طويلة بما يكفي', '00000000-0000-0000-0000-00000000000c')$$, 'student: cannot submit as someone else');
select t.check((select count(*) = 0 from public.contact_messages), 'student: cannot read contact messages');
reset role;

-- ---------------- Anonymous ----------------
set role anon;
set request.jwt.claims = '{"role":"anon"}';
select t.expect_ok($$insert into public.contact_messages (name, email, subject, message) values ('Visitor', 'v@example.com', 'Hello', 'A message long enough')$$, 'anon: can submit contact');
select t.expect_fail($$insert into public.contact_messages (name, email, subject, message, status) values ('Visitor', 'v@example.com', 'Hello', 'A message long enough', 'read')$$, 'anon: cannot set status');
select t.expect_fail($$insert into public.contact_messages (name, email, subject, message) values ('V', 'bad', 'Hi', 'short')$$, 'anon: contact constraints enforced');
select t.check((select count(*) = 0 from public.profiles), 'anon: no profiles');
select t.expect_fail($$select public.set_current_document_version(gen_random_uuid())$$, 'anon: cannot change document versions');
reset role;

-- ---------------- Admin A ----------------
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
select t.check(public.is_admin(), 'admin: is_admin true');
select t.expect_ok($$insert into public.faculties (id, name_ar, name_en) values ('10000000-0000-0000-0000-000000000001', 'كلية اختبار', 'Test Faculty')$$, 'admin: create faculty');
select t.expect_ok($$insert into public.courses (course_number, name_ar, credit_hours) values ('cs-101 ', 'مساق تجريبي أ', 3), ('CS-102', 'مساق تجريبي ب', 3)$$, 'admin: create courses');
select t.check((select count(*) = 1 from public.courses where course_number = 'CS-101'), 'course number normalized to canonical upper-case');
select t.expect_ok($$insert into public.course_prerequisites (course_number, required_course_number) values ('cs-102', 'CS-101')$$, 'admin: add prerequisite');
select t.expect_fail($$insert into public.course_prerequisites (course_number, required_course_number) values ('CS-102', 'NOPE-999')$$, 'prerequisite must reference an existing course');
select t.expect_fail($$insert into public.course_prerequisites (course_number, required_course_number) values ('CS-101', 'CS-101')$$, 'course cannot require itself');
select t.expect_fail($$insert into public.courses (course_number, name_ar) values ('bad number!', 'x x')$$, 'invalid course number rejected');
select t.expect_ok($$insert into public.semesters (code, name_ar, academic_year, term, is_current) values ('S1', 'الفصل الأول', '2026/2027', 'fall', true)$$, 'admin: semester 1 current');
select t.expect_ok($$insert into public.semesters (code, name_ar, academic_year, term, is_current) values ('S2', 'الفصل الثاني', '2026/2027', 'spring', true)$$, 'admin: semester 2 current');
select t.check((select array_agg(code) = array['S2'] from public.semesters where is_current), 'only one current semester');
select t.expect_ok($$insert into public.documents (id, title, storage_path, version_group, is_current, status) values
  ('20000000-0000-0000-0000-000000000001', 'تعليمات الدراسة 2023', 'g1/v1.pdf', '20000000-0000-0000-0000-000000000001', true, 'indexed'),
  ('20000000-0000-0000-0000-000000000002', 'تعليمات الدراسة 2025', 'g1/v2.pdf', '20000000-0000-0000-0000-000000000001', false, 'indexed')$$, 'admin: upload two versions');
select t.expect_fail($$update public.documents set is_current = true where id = '20000000-0000-0000-0000-000000000002'$$, 'two current versions in a group are impossible');
select t.expect_ok($$select public.set_current_document_version('20000000-0000-0000-0000-000000000002')$$, 'admin: switch current version');
select t.check((select array_agg(id::text) = array['20000000-0000-0000-0000-000000000002'] from public.documents where is_current), 'new version is the only current one');
select t.check((select count(*) = 3 from public.profiles), 'admin: reads all profiles');
select t.check((select count(*) >= 2 from public.contact_messages), 'admin: reads contact messages');
select t.check((select (public.admin_dashboard_stats() ->> 'courses')::int = 2), 'admin: dashboard stats');
select t.expect_fail($$insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-00000000000c','admin')$$, 'admin: cannot grant roles from the client either');
select t.expect_ok($$insert into storage.objects (bucket_id, name) values ('documents', 'g1/v3.pdf')$$, 'admin: can upload to documents bucket');
reset role;

-- ---------------- Student reads public catalog ----------------
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select t.check((select count(*) = 2 from public.courses), 'student: reads public courses');
select t.check((select count(*) = 2 from public.document_catalog), 'student: reads document titles via catalog view');
reset role;

-- ---------------- Retrieval (service role) ----------------
set role service_role;
set request.jwt.claims = '{"role":"service_role"}';
insert into public.document_chunks (document_id, page_number, chunk_index, content, search_text, embedding)
select '20000000-0000-0000-0000-000000000002'::uuid, 3, 0, 'الحد الاعلى للعبء الدراسي ثمانية عشر ساعة', 'حد اعلي للعبء دراسي ثمانيه عشر ساعه',
       (select array_agg(case when i = 1 then 1.0 else 0.0 end) from generate_series(1, 1536) i)::extensions.vector
union all
select '20000000-0000-0000-0000-000000000001'::uuid, 5, 0, 'نسخة قديمة: الحد الاعلى خمسة عشر ساعة', 'نسخه قديمه حد اعلي خمسه عشر ساعه',
       (select array_agg(case when i = 1 then 1.0 else 0.0 end) from generate_series(1, 1536) i)::extensions.vector
union all
select '20000000-0000-0000-0000-000000000002'::uuid, 9, 1, 'شروط الانسحاب من المساق', 'شروط انسحاب من مساق',
       (select array_agg(case when i = 2 then 1.0 else 0.0 end) from generate_series(1, 1536) i)::extensions.vector;

select t.check((select count(*) = 1 and bool_and(page_number = 3) from public.hybrid_search_chunks(
  (select array_agg(case when i = 1 then 1.0 else 0.0 end) from generate_series(1, 1536) i)::extensions.vector, 'حد اعلي', 5, 0.3)),
  'retrieval: semantic hit from current version only (old version excluded)');
select t.check((select bool_or(page_number = 9) from public.hybrid_search_chunks(
  (select array_agg(case when i = 3 then 1.0 else 0.0 end) from generate_series(1, 1536) i)::extensions.vector, 'انسحاب', 5, 0.3)),
  'retrieval: keyword-only hit via normalized text');
select t.check((select count(*) = 0 from public.hybrid_search_chunks(
  (select array_agg(case when i = 4 then 1.0 else 0.0 end) from generate_series(1, 1536) i)::extensions.vector, 'غير موجود اطلاقا', 5, 0.3)),
  'retrieval: no evidence returns nothing');
select t.check((select count(*) = 0 from public.hybrid_search_chunks(
  (select array_agg(case when i = 4 then 1.0 else 0.0 end) from generate_series(1, 1536) i)::extensions.vector, '', 5, 0.3)),
  'retrieval: empty keyword query is safe');
select t.expect_ok($$select public.set_current_document_version('20000000-0000-0000-0000-000000000001')$$, 'service role: can switch versions');
reset role;

select label, ok, detail from t.results order by ok, label;
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from t.results;
