-- =============================================================
-- قواعد تجريبية للتطوير فقط (is_demo = true)
-- هذه ليست نسبًا أو قواعد تمويل حقيقية.
-- استبدلها بالقواعد المعتمدة من لوحة Supabase عند الجاهزية:
--   1) أضف صفًا جديدًا بإصدار أعلى و is_demo = false
--   2) عطّل الصف القديم (is_active = false) ثم فعّل الجديد
-- القيم تطابق RuleSet.demo في التطبيق.
-- =============================================================

insert into public.calculation_rules (product_type, version, parameters, is_active, is_demo, notes)
values
  (
    'personal', 1,
    '{
      "max_debt_ratio": 0.25,
      "annual_profit_rate": 0.04,
      "rate_method": "reducing",
      "min_term_months": 12,
      "max_term_months": 60,
      "min_monthly_income": 1000,
      "max_financing_amount": 100000,
      "max_age_at_maturity": 60
    }'::jsonb,
    true, true, 'DEMO VALUES — for development only'
  ),
  (
    'mortgage', 1,
    '{
      "max_debt_ratio": 0.25,
      "annual_profit_rate": 0.04,
      "rate_method": "reducing",
      "min_term_months": 60,
      "max_term_months": 240,
      "min_monthly_income": 1000,
      "max_financing_amount": 1000000,
      "max_age_at_maturity": 60,
      "min_down_payment_ratio": 0.10
    }'::jsonb,
    true, true, 'DEMO VALUES — for development only'
  );
