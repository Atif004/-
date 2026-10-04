// محرك حساب القدرة التمويلية — نسخة الخادم.
// يجب أن يبقى مطابقًا لـ Packages/QudraEngine/Sources/QudraEngine/CalculationEngine.swift
// لا يحتوي على أي نسب ثابتة؛ كل القيم تأتي من جدول calculation_rules.

export type ProductType = "personal" | "mortgage";
export type RateMethod = "reducing" | "flat";

export interface FinancingRules {
  max_debt_ratio: number;
  annual_profit_rate: number;
  rate_method: RateMethod;
  min_term_months: number;
  max_term_months: number;
  min_monthly_income: number;
  max_financing_amount: number;
  max_age_at_maturity: number;
  min_down_payment_ratio?: number | null;
}

export interface CalculationInput {
  product_type: ProductType;
  monthly_income: number;
  monthly_obligations: number;
  age: number;
  requested_term_months: number;
  down_payment_savings: number;
}

export interface CalculationNote {
  code: string;
  severity: "info" | "warning" | "blocking";
  message: string;
}

export interface CalculationResult {
  product_type: ProductType;
  is_eligible: boolean;
  max_monthly_installment: number;
  max_financing_amount: number;
  term_months: number;
  total_repayment: number;
  total_profit: number;
  max_property_value: number | null;
  down_payment: number | null;
  rules_version: number;
  is_demo_rules: boolean;
  notes: CalculationNote[];
}

export interface RuleContext {
  rules: FinancingRules;
  version: number;
  isDemo: boolean;
}

export function presentValue(installment: number, annualRate: number, months: number, method: RateMethod): number {
  if (months <= 0 || installment <= 0) return 0;
  if (method === "flat") return (installment * months) / (1 + (annualRate * months) / 12);
  const r = annualRate / 12;
  if (r <= 0) return installment * months;
  return (installment * (1 - Math.pow(1 + r, -months))) / r;
}

export function installmentFor(principal: number, annualRate: number, months: number, method: RateMethod): number {
  if (months <= 0 || principal <= 0) return 0;
  if (method === "flat") return (principal * (1 + (annualRate * months) / 12)) / months;
  const r = annualRate / 12;
  if (r <= 0) return principal / months;
  return (principal * r) / (1 - Math.pow(1 + r, -months));
}

const round2 = (v: number) => Math.round(v * 100) / 100;

export function calculate(input: CalculationInput, ctx: RuleContext): CalculationResult {
  const { rules } = ctx;
  const notes: CalculationNote[] = [];
  const isMortgage = input.product_type === "mortgage";

  if (input.monthly_income <= 0) {
    notes.push({ code: "invalid_income", severity: "blocking", message: "يرجى إدخال دخل شهري صحيح." });
  } else if (input.monthly_income < rules.min_monthly_income) {
    notes.push({
      code: "below_min_income",
      severity: "blocking",
      message: "الدخل الشهري أقل من الحد الأدنى المطلوب لهذا المنتج.",
    });
  }
  if (input.age <= 0) {
    notes.push({ code: "invalid_age", severity: "blocking", message: "يرجى إدخال عمر صحيح." });
  }

  const ageLimitMonths = Math.max(0, (rules.max_age_at_maturity - input.age) * 12);
  const requested = input.requested_term_months > 0 ? input.requested_term_months : rules.max_term_months;
  const term = Math.min(requested, rules.max_term_months, ageLimitMonths);
  if (term < requested) {
    notes.push({
      code: "term_adjusted",
      severity: "info",
      message: "تم تعديل مدة التمويل لتتوافق مع الحد الأقصى المسموح.",
    });
  }
  if (term < rules.min_term_months) {
    notes.push({
      code: "term_too_short",
      severity: "blocking",
      message: "المدة المتاحة أقل من الحد الأدنى لمدة التمويل.",
    });
  }

  const obligations = Math.max(0, input.monthly_obligations);
  let installment = Math.max(0, input.monthly_income * rules.max_debt_ratio - obligations);
  if (input.monthly_income > 0 && installment <= 0) {
    notes.push({
      code: "obligations_exceed_limit",
      severity: "blocking",
      message: "الالتزامات الحالية تستهلك كامل النسبة المسموحة من الدخل.",
    });
  }

  const ineligible = (t: number): CalculationResult => ({
    product_type: input.product_type,
    is_eligible: false,
    max_monthly_installment: 0,
    max_financing_amount: 0,
    term_months: t,
    total_repayment: 0,
    total_profit: 0,
    max_property_value: isMortgage ? 0 : null,
    down_payment: isMortgage ? 0 : null,
    rules_version: ctx.version,
    is_demo_rules: ctx.isDemo,
    notes,
  });

  if (notes.some((n) => n.severity === "blocking")) return ineligible(Math.max(0, term));

  let principal = presentValue(installment, rules.annual_profit_rate, term, rules.rate_method);
  if (principal > rules.max_financing_amount) {
    principal = rules.max_financing_amount;
    installment = installmentFor(principal, rules.annual_profit_rate, term, rules.rate_method);
    notes.push({ code: "capped_by_max_amount", severity: "info", message: "تم تحديد المبلغ بالحد الأقصى للتمويل." });
  }

  let propertyValue: number | null = null;
  let downPayment: number | null = null;
  if (isMortgage) {
    const savings = Math.max(0, input.down_payment_savings);
    const minDownRatio = rules.min_down_payment_ratio ?? 0;
    let value = principal + savings;
    if (minDownRatio > 0) {
      if (savings <= 0) {
        notes.push({ code: "down_payment_required", severity: "blocking", message: "يتطلب هذا المنتج دفعة أولى." });
        return ineligible(term);
      }
      const maxValueBySavings = savings / minDownRatio;
      if (maxValueBySavings < value) {
        value = maxValueBySavings;
        principal = value - savings;
        installment = installmentFor(principal, rules.annual_profit_rate, term, rules.rate_method);
        notes.push({
          code: "limited_by_down_payment",
          severity: "info",
          message: "قيمة العقار محدودة بمبلغ الدفعة الأولى المتوفر.",
        });
      }
    }
    propertyValue = value;
    downPayment = value - principal;
  }

  const totalRepayment = installment * term;
  return {
    product_type: input.product_type,
    is_eligible: true,
    max_monthly_installment: round2(installment),
    max_financing_amount: round2(principal),
    term_months: term,
    total_repayment: round2(totalRepayment),
    total_profit: round2(totalRepayment - principal),
    max_property_value: propertyValue === null ? null : round2(propertyValue),
    down_payment: downPayment === null ? null : round2(downPayment),
    rules_version: ctx.version,
    is_demo_rules: ctx.isDemo,
    notes,
  };
}

/** يتحقق من شكل المدخلات القادمة من العميل ويعيد نسخة نظيفة أو رسالة خطأ. */
export function parseInput(raw: unknown): CalculationInput | string {
  if (typeof raw !== "object" || raw === null) return "input is required";
  const o = raw as Record<string, unknown>;
  if (o.product_type !== "personal" && o.product_type !== "mortgage") return "invalid product_type";
  const num = (k: string, fallback?: number): number | null => {
    const v = o[k];
    if (v === undefined || v === null) return fallback ?? null;
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  };
  const income = num("monthly_income");
  const age = num("age");
  if (income === null || age === null) return "monthly_income and age are required numbers";
  return {
    product_type: o.product_type,
    monthly_income: income,
    monthly_obligations: num("monthly_obligations", 0) ?? 0,
    age: Math.trunc(age),
    requested_term_months: Math.trunc(num("requested_term_months", 0) ?? 0),
    down_payment_savings: num("down_payment_savings", 0) ?? 0,
  };
}
