-- اختبارات بيانات التطبيق: الملفات الشخصية وسجل الحسابات وصلاحيات RLS والحذف المتسلسل.
-- تُشغَّل بعد تطبيق كل الـ migrations، داخل transaction يُلغى في النهاية.
\set ON_ERROR_STOP 1
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000d1', 'one@test.local', '{"full_name": "الأول"}'),
  ('00000000-0000-0000-0000-0000000000d2', 'two@test.local', '{}');

-- 1) trigger التسجيل ينشئ الملف الشخصي بالاسم من بيانات التسجيل.
do $$
begin
  assert (select full_name from public.profiles where id = '00000000-0000-0000-0000-0000000000d1') = 'الأول', 'profile name';
  assert (select count(*) from public.profiles where id = '00000000-0000-0000-0000-0000000000d2') = 1, 'profile without name';
end $$;

-- 2) المستخدم الأول: يحفظ نتيجة ويقرأ ملفه فقط.
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
do $$
begin
  -- user_id يُملأ تلقائيًا من auth.uid().
  insert into public.calculations (product_type, input, result, rules_version)
  values ('personal', '{"age": 30}', '{"is_eligible": true}', 1);
  assert (select count(*) from public.calculations) = 1, 'own calculation visible';
  assert (select user_id from public.calculations) = '00000000-0000-0000-0000-0000000000d1', 'user_id default';
  assert (select count(*) from public.profiles) = 1, 'sees only own profile';

  update public.profiles set phone = '0500000000' where id = '00000000-0000-0000-0000-0000000000d1';
  assert (select phone from public.profiles) = '0500000000', 'update own profile';

  -- محاولة تعديل ملف مستخدم آخر لا تؤثر (RLS يخفي الصف).
  update public.profiles set full_name = 'x' where id = '00000000-0000-0000-0000-0000000000d2';

  begin
    insert into public.calculations (user_id, product_type, input, result, rules_version)
    values ('00000000-0000-0000-0000-0000000000d2', 'personal', '{}', '{}', 1);
    raise exception 'inserted calculation for another user';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.calculations (product_type, input, result, rules_version)
    values ('car', '{}', '{}', 1);
    raise exception 'invalid product_type accepted';
  exception when check_violation then null;
  end;

  begin
    insert into public.calculation_rules (product_type, version, parameters)
    values ('personal', 50, '{}');
    raise exception 'user wrote calculation_rules';
  exception when insufficient_privilege or check_violation then null;
  end;
end $$;

-- 3) المستخدم الثاني لا يرى بيانات الأول ولا يحذفها.
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d2';
do $$
begin
  assert (select count(*) from public.calculations) = 0, 'other user sees nothing';
  delete from public.calculations;
end $$;

reset role;
do $$
begin
  assert (select count(*) from public.calculations) = 1, 'row survived other user delete';
  assert (select full_name from public.profiles where id = '00000000-0000-0000-0000-0000000000d2') is null, 'other profile untouched';
end $$;

-- 4) الضيف (anon) لا يرى سجل أحد.
set local role anon;
do $$
begin
  assert (select count(*) from public.calculations) = 0, 'anon sees no calculations';
  assert (select count(*) from public.profiles) = 0, 'anon sees no profiles';
  assert (select count(*) from public.calculation_rules where is_active) = 2, 'anon sees active rules';
end $$;
reset role;

-- 5) حذف المستخدم يحذف ملفه ونتائجه (ما تعتمد عليه delete-account).
delete from auth.users where id = '00000000-0000-0000-0000-0000000000d1';
do $$
begin
  assert (select count(*) from public.profiles where id = '00000000-0000-0000-0000-0000000000d1') = 0, 'profile cascade';
  assert (select count(*) from public.calculations) = 0, 'calculations cascade';
end $$;

rollback;
\echo 'ALL APP DATA SQL TESTS PASSED'
