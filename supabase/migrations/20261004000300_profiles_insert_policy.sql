-- =============================================================
-- يسمح للمستخدم بإنشاء صف ملفه الشخصي بنفسه (upsert من التطبيق)
-- في حال لم يُنشئه trigger التسجيل، مثل الحسابات التي سبقت تطبيق الـ migrations.
-- =============================================================

create policy "profiles: insert own"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);
