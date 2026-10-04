-- اختبارات إدارة القواعد. تُشغَّل على قاعدة اختبار بعد تطبيق كل الـ migrations.
-- كل الاختبارات داخل transaction يُلغى في النهاية.
-- القيم هنا للاختبار فقط وليست قواعد تمويل حقيقية.
\set ON_ERROR_STOP 1
begin;

-- مستخدمان: مدير وعادي.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'user@test.local');
insert into public.app_admins (user_id) values ('00000000-0000-0000-0000-00000000000a');

create temp table t_params as select '{
  "max_debt_ratio": 0.3, "annual_profit_rate": 0.02, "rate_method": "flat",
  "min_term_months": 12, "max_term_months": 48, "min_monthly_income": 500,
  "max_financing_amount": 50000, "max_age_at_maturity": 65
}'::jsonb as p;
grant select on t_params to authenticated;

-- 1) التحقق من المعاملات
do $$
declare p jsonb := (select p from t_params);
begin
  assert cardinality(public.validate_rule_parameters(p)) = 0, 'valid params rejected';
  assert public.validate_rule_parameters(p - 'rate_method') = array['missing_key:rate_method'], 'missing key';
  assert public.validate_rule_parameters(p || '{"typo": 1}') = array['unknown_key:typo'], 'unknown key';
  assert public.validate_rule_parameters(p || '{"max_debt_ratio": "0.3"}') = array['not_number:max_debt_ratio'], 'string number';
  assert public.validate_rule_parameters(p || '{"max_debt_ratio": 1.5}') = array['max_debt_ratio_range'], 'ratio range';
  assert public.validate_rule_parameters(p || '{"max_term_months": 6}') = array['max_term_range'], 'max < min';
  assert public.validate_rule_parameters(p || '{"min_term_months": 12.5}') @> array['not_integer:min_term_months'], 'integer';
  assert public.validate_rule_parameters(p || '{"rate_method": "x"}') = array['rate_method_invalid'], 'method';
  assert public.validate_rule_parameters(p || '{"min_down_payment_ratio": 1}') = array['down_payment_ratio_range'], 'down';
  assert cardinality(public.validate_rule_parameters(p || '{"min_down_payment_ratio": null}')) = 0, 'null down ok';
  assert public.validate_rule_parameters('[]'::jsonb) = array['not_object'], 'not object';
end $$;

-- 2) القيد يمنع إدخال قواعد غير صالحة مباشرة حتى من لوحة التحكم.
do $$
begin
  begin
    insert into public.calculation_rules (product_type, version, parameters)
    values ('personal', 99, (select p from t_params) || '{"max_debt_ratio": 2}');
    raise exception 'constraint did not fire';
  exception when check_violation then null;
  end;
end $$;

-- 3) مستخدم عادي: لا يرى إلا القواعد النشطة، ولا يستطيع النشر.
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$
begin
  assert not public.is_admin(), 'regular user is admin';
  assert (select count(*) from public.app_admins) = 0, 'user sees admins';
  assert (select count(*) from public.rules_audit_log) = 0, 'user sees audit';
  begin
    perform public.publish_calculation_rules('personal', (select p from t_params), true, null);
    raise exception 'regular user could publish';
  exception when insufficient_privilege then null;
  end;
end $$;

-- 4) المدير: ينشر إصدارًا جديدًا.
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$
declare r public.calculation_rules;
begin
  assert public.is_admin(), 'admin not detected';
  r := public.publish_calculation_rules('personal', (select p from t_params), false, '  اختبار  ');
  assert r.version = 2 and r.is_active and not r.is_demo, 'publish result';
  assert r.notes = 'اختبار', 'notes trimmed';
  assert r.created_by = '00000000-0000-0000-0000-00000000000a', 'created_by';
  assert (select count(*) from public.calculation_rules where product_type = 'personal' and is_active) = 1, 'one active';
  assert (select version from public.calculation_rules where product_type = 'personal' and is_active) = 2, 'v2 active';
  assert (select count(*) from public.calculation_rules) = 3, 'admin sees all versions';
  assert (select previous_version from public.rules_audit_log where action = 'publish') = 1, 'audit previous';

  -- نشر بقيم غير صالحة يُرفض برسالة تحمل رموز الأخطاء.
  begin
    perform public.publish_calculation_rules('personal', (select p from t_params) || '{"max_debt_ratio": 0}', true, null);
    raise exception 'invalid publish accepted';
  exception when invalid_parameter_value then
    assert sqlerrm like 'invalid_parameters:%max_debt_ratio_range%', sqlerrm;
  end;

  -- 5) الرجوع للإصدار 1.
  r := public.activate_calculation_rules_version('personal', 1);
  assert r.version = 1 and r.is_active, 'rollback';
  assert (select count(*) from public.calculation_rules where product_type = 'personal' and is_active) = 1, 'one active after rollback';
  assert (select count(*) from public.rules_audit_log) = 2, 'audit rows';
  -- تفعيل الإصدار النشط نفسه لا يضيف سجلًا.
  r := public.activate_calculation_rules_version('personal', 1);
  assert (select count(*) from public.rules_audit_log) = 2, 'no-op activation logged';
  begin
    perform public.activate_calculation_rules_version('personal', 42);
    raise exception 'missing version activated';
  exception when no_data_found then null;
  end;
  -- المنتج الآخر لم يتأثر.
  assert (select version from public.calculation_rules where product_type = 'mortgage' and is_active) = 1, 'mortgage untouched';
end $$;

-- 6) anon لا يملك صلاحية تنفيذ النشر.
reset role;
do $$
begin
  assert not has_function_privilege('anon', 'public.publish_calculation_rules(text, jsonb, boolean, text)', 'execute'), 'anon can publish';
  assert not has_function_privilege('anon', 'public.activate_calculation_rules_version(text, integer)', 'execute'), 'anon can activate';
end $$;

rollback;
\echo 'ALL RULES ADMIN SQL TESTS PASSED'
