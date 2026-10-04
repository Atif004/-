-- =============================================================
-- بديل مبسّط لبيئة Supabase — للاختبار المحلي و CI فقط، ولا يُطبَّق على مشروع Supabase.
-- يحاكي: الأدوار (anon / authenticated / service_role / authenticator)،
-- جدول auth.users، الدالة auth.uid() كما يقرأها PostgREST، والصلاحيات الافتراضية.
-- =============================================================

-- الأدوار على مستوى الخادم كله، لذلك تُنشأ فقط إن لم تكن موجودة.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
  -- الدور الذي يتصل به PostgREST ثم يتقمّص دور صاحب التوكن.
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator login password 'authenticator' noinherit;
  end if;
end $$;
grant anon, authenticated, service_role to authenticator;

create schema auth;

create table auth.users (
  id                  uuid primary key default gen_random_uuid(),
  email               text unique,
  raw_user_meta_data  jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now()
);

-- مثل Supabase: يقرأ sub من request.jwt.claim.sub أو من request.jwt.claims (PostgREST 12).
create function auth.uid() returns uuid
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- الصلاحيات الافتراضية في Supabase: كل الجداول متاحة للأدوار، وRLS هي الحارس الفعلي.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
