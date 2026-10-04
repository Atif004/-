-- =============================================================
-- قُدرة Qudra — إدارة قواعد الحساب من داخل التطبيق
--   • app_admins: من يملك صلاحية الإدارة (يُضاف يدويًا من لوحة Supabase)
--   • validate_rule_parameters: تحقق من سلامة القيم (شكلها وحدودها المنطقية فقط)
--   • publish_calculation_rules / activate_calculation_rules_version:
--       نشر إصدار جديد أو الرجوع لإصدار سابق بشكل ذري، مع سجل تدقيق
-- لا تحتوي هذه الملفات على أي نسب تمويل حقيقية.
-- =============================================================

-- -------------------------------------------------------------
-- المدراء
-- -------------------------------------------------------------
create table public.app_admins (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

alter table public.app_admins enable row level security;

-- يكفي أن يعرف المستخدم إن كان هو نفسه مديرًا.
create policy "app_admins: read own"
  on public.app_admins for select
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.app_admins where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- -------------------------------------------------------------
-- التحقق من معاملات القواعد
-- يعيد قائمة رموز أخطاء (فارغة = صالحة). نفس الرموز في RulesValidator.swift.
-- الحدود هنا منطقية فقط (مثل: النسبة بين 0 و 1)، وليست قواعد تمويل.
-- -------------------------------------------------------------
create or replace function public.validate_rule_parameters(p jsonb)
returns text[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  errors   text[] := '{}';
  allowed  text[] := array[
    'max_debt_ratio', 'annual_profit_rate', 'rate_method',
    'min_term_months', 'max_term_months', 'min_monthly_income',
    'max_financing_amount', 'max_age_at_maturity', 'min_down_payment_ratio'
  ];
  required text[] := allowed[1:8];
  k        text;
  num_keys text[] := array[
    'max_debt_ratio', 'annual_profit_rate', 'min_term_months', 'max_term_months',
    'min_monthly_income', 'max_financing_amount', 'max_age_at_maturity'
  ];
  int_keys text[] := array['min_term_months', 'max_term_months', 'max_age_at_maturity'];
  v        numeric;
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    return array['not_object'];
  end if;

  foreach k in array required loop
    if not p ? k then
      errors := errors || ('missing_key:' || k);
    end if;
  end loop;

  for k in select jsonb_object_keys(p) loop
    if not k = any (allowed) then
      errors := errors || ('unknown_key:' || k);
    end if;
  end loop;

  foreach k in array num_keys loop
    if p ? k and jsonb_typeof(p -> k) <> 'number' then
      errors := errors || ('not_number:' || k);
    end if;
  end loop;

  if p ? 'min_down_payment_ratio'
     and jsonb_typeof(p -> 'min_down_payment_ratio') not in ('number', 'null') then
    errors := errors || 'not_number:min_down_payment_ratio'::text;
  end if;

  -- إن وُجدت أخطاء في الشكل نتوقف قبل فحص القيم.
  if cardinality(errors) > 0 then
    return errors;
  end if;

  foreach k in array int_keys loop
    v := (p ->> k)::numeric;
    if v <> trunc(v) then
      errors := errors || ('not_integer:' || k);
    end if;
  end loop;

  v := (p ->> 'max_debt_ratio')::numeric;
  if v <= 0 or v > 1 then errors := errors || 'max_debt_ratio_range'::text; end if;

  v := (p ->> 'annual_profit_rate')::numeric;
  if v < 0 or v >= 1 then errors := errors || 'annual_profit_rate_range'::text; end if;

  if (p ->> 'rate_method') not in ('reducing', 'flat') then
    errors := errors || 'rate_method_invalid'::text;
  end if;

  if (p ->> 'min_term_months')::numeric < 1 then
    errors := errors || 'min_term_range'::text;
  end if;
  if (p ->> 'max_term_months')::numeric < (p ->> 'min_term_months')::numeric
     or (p ->> 'max_term_months')::numeric > 600 then
    errors := errors || 'max_term_range'::text;
  end if;

  if (p ->> 'min_monthly_income')::numeric < 0 then
    errors := errors || 'min_income_range'::text;
  end if;
  if (p ->> 'max_financing_amount')::numeric <= 0 then
    errors := errors || 'max_amount_range'::text;
  end if;

  v := (p ->> 'max_age_at_maturity')::numeric;
  if v < 18 or v > 120 then errors := errors || 'max_age_range'::text; end if;

  if jsonb_typeof(p -> 'min_down_payment_ratio') = 'number' then
    v := (p ->> 'min_down_payment_ratio')::numeric;
    if v < 0 or v >= 1 then errors := errors || 'down_payment_ratio_range'::text; end if;
  end if;

  return errors;
end;
$$;

grant execute on function public.validate_rule_parameters(jsonb) to authenticated;

-- كل صف في الجدول يجب أن يجتاز التحقق، أيًّا كان مصدر التعديل.
alter table public.calculation_rules
  add constraint parameters_valid
  check (cardinality(public.validate_rule_parameters(parameters)) = 0);

alter table public.calculation_rules
  add column created_by uuid references auth.users (id) on delete set null;

-- المدراء يقرؤون كل الإصدارات (النشطة وغير النشطة).
create policy "calculation_rules: admins read all"
  on public.calculation_rules for select
  to authenticated
  using ((select public.is_admin()));

-- -------------------------------------------------------------
-- سجل التدقيق
-- -------------------------------------------------------------
create table public.rules_audit_log (
  id                bigint generated always as identity primary key,
  product_type      text not null check (product_type in ('personal', 'mortgage')),
  action            text not null check (action in ('publish', 'activate')),
  version           integer not null,
  previous_version  integer,
  actor             uuid references auth.users (id) on delete set null,
  parameters        jsonb not null,
  is_demo           boolean not null,
  notes             text,
  created_at        timestamptz not null default now()
);

create index rules_audit_log_created_idx on public.rules_audit_log (created_at desc);

alter table public.rules_audit_log enable row level security;

create policy "rules_audit_log: admins read"
  on public.rules_audit_log for select
  to authenticated
  using ((select public.is_admin()));

-- -------------------------------------------------------------
-- نشر إصدار جديد: يتحقق، يعطّل الإصدار النشط، يضيف الجديد نشطًا، ويسجّل العملية.
-- -------------------------------------------------------------
create or replace function public.publish_calculation_rules(
  p_product_type text,
  p_parameters   jsonb,
  p_is_demo      boolean,
  p_notes        text default null
)
returns public.calculation_rules
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_errors   text[];
  v_previous integer;
  v_next     integer;
  v_row      public.calculation_rules;
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_product_type is null or p_product_type not in ('personal', 'mortgage') then
    raise exception 'invalid_product_type' using errcode = '22023';
  end if;

  v_errors := public.validate_rule_parameters(p_parameters);
  if cardinality(v_errors) > 0 then
    raise exception 'invalid_parameters:%', array_to_string(v_errors, ',') using errcode = '22023';
  end if;

  -- منع نشرين متزامنين لنفس المنتج.
  perform pg_advisory_xact_lock(hashtext('qudra.calculation_rules.' || p_product_type));

  select version into v_previous
    from public.calculation_rules
   where product_type = p_product_type and is_active;

  select coalesce(max(version), 0) + 1 into v_next
    from public.calculation_rules
   where product_type = p_product_type;

  -- التعطيل أولًا ثم الإضافة، احترامًا لقيد "إصدار نشط واحد لكل منتج".
  update public.calculation_rules
     set is_active = false
   where product_type = p_product_type and is_active;

  insert into public.calculation_rules
    (product_type, version, parameters, is_active, is_demo, notes, created_by)
  values
    (p_product_type, v_next, p_parameters, true, coalesce(p_is_demo, true), nullif(trim(p_notes), ''), auth.uid())
  returning * into v_row;

  insert into public.rules_audit_log
    (product_type, action, version, previous_version, actor, parameters, is_demo, notes)
  values
    (p_product_type, 'publish', v_next, v_previous, auth.uid(), p_parameters, v_row.is_demo, v_row.notes);

  return v_row;
end;
$$;

-- -------------------------------------------------------------
-- الرجوع إلى إصدار سابق (أو تفعيل أي إصدار موجود).
-- -------------------------------------------------------------
create or replace function public.activate_calculation_rules_version(
  p_product_type text,
  p_version      integer
)
returns public.calculation_rules
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previous integer;
  v_row      public.calculation_rules;
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtext('qudra.calculation_rules.' || p_product_type));

  select * into v_row
    from public.calculation_rules
   where product_type = p_product_type and version = p_version;
  if not found then
    raise exception 'version_not_found' using errcode = 'P0002';
  end if;
  if v_row.is_active then
    return v_row;
  end if;

  select version into v_previous
    from public.calculation_rules
   where product_type = p_product_type and is_active;

  update public.calculation_rules
     set is_active = false
   where product_type = p_product_type and is_active;

  update public.calculation_rules
     set is_active = true
   where id = v_row.id
  returning * into v_row;

  insert into public.rules_audit_log
    (product_type, action, version, previous_version, actor, parameters, is_demo, notes)
  values
    (p_product_type, 'activate', p_version, v_previous, auth.uid(), v_row.parameters, v_row.is_demo, null);

  return v_row;
end;
$$;

revoke all on function public.publish_calculation_rules(text, jsonb, boolean, text) from public, anon;
revoke all on function public.activate_calculation_rules_version(text, integer) from public, anon;
grant execute on function public.publish_calculation_rules(text, jsonb, boolean, text) to authenticated;
grant execute on function public.activate_calculation_rules_version(text, integer) to authenticated;
