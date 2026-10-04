-- =============================================================
-- قُدرة Qudra — الهيكل الأساسي لقاعدة البيانات
-- =============================================================

-- -------------------------------------------------------------
-- updated_at helper
-- -------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -------------------------------------------------------------
-- profiles: ملف شخصي لكل مستخدم في auth.users
-- -------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  phone       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy "profiles: read own"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "profiles: update own"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- إنشاء الملف الشخصي تلقائيًا عند تسجيل مستخدم جديد.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -------------------------------------------------------------
-- calculation_rules: قواعد الحساب القابلة للتعديل من الـ Cloud
-- parameters (jsonb) يطابق FinancingRules في التطبيق و engine.ts
-- -------------------------------------------------------------
create table public.calculation_rules (
  id            uuid primary key default gen_random_uuid(),
  product_type  text not null check (product_type in ('personal', 'mortgage')),
  version       integer not null check (version > 0),
  parameters    jsonb not null,
  is_active     boolean not null default false,
  is_demo       boolean not null default true,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (product_type, version),
  constraint parameters_shape check (
        parameters ? 'max_debt_ratio'
    and parameters ? 'annual_profit_rate'
    and parameters ? 'rate_method'
    and parameters ? 'min_term_months'
    and parameters ? 'max_term_months'
    and parameters ? 'min_monthly_income'
    and parameters ? 'max_financing_amount'
    and parameters ? 'max_age_at_maturity'
    and parameters ->> 'rate_method' in ('reducing', 'flat')
  )
);

-- قاعدة نشطة واحدة فقط لكل منتج.
create unique index calculation_rules_one_active_per_product
  on public.calculation_rules (product_type)
  where is_active;

create trigger calculation_rules_set_updated_at
  before update on public.calculation_rules
  for each row execute function public.set_updated_at();

alter table public.calculation_rules enable row level security;

-- القراءة فقط للقواعد النشطة. التعديل يتم من لوحة Supabase أو بمفتاح service_role.
create policy "calculation_rules: read active"
  on public.calculation_rules for select
  to anon, authenticated
  using (is_active);

-- -------------------------------------------------------------
-- calculations: سجل نتائج المستخدم
-- -------------------------------------------------------------
create table public.calculations (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  product_type   text not null check (product_type in ('personal', 'mortgage')),
  input          jsonb not null,
  result         jsonb not null,
  rules_version  integer not null,
  created_at     timestamptz not null default now()
);

create index calculations_user_created_idx
  on public.calculations (user_id, created_at desc);

alter table public.calculations enable row level security;

create policy "calculations: read own"
  on public.calculations for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "calculations: insert own"
  on public.calculations for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "calculations: delete own"
  on public.calculations for delete
  to authenticated
  using ((select auth.uid()) = user_id);
