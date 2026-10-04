import Foundation

/// محرك حساب القدرة التمويلية.
///
/// - لا يحتوي على أي نسب أو قواعد ثابتة؛ كل القيم تأتي من `RuleSet`.
/// - دالة نقية (pure): نفس المدخلات + نفس القواعد = نفس النتيجة.
/// - يجب أن يبقى منطقه مطابقًا لـ `supabase/functions/_shared/engine.ts`.
public struct CalculationEngine: Sendable {
    public init() {}

    public func calculate(_ input: CalculationInput, ruleSet: RuleSet) -> CalculationResult {
        let rules = ruleSet.rules(for: input.product)
        var notes: [CalculationNote] = []

        // 1) التحقق من المدخلات والأهلية الأساسية.
        if input.monthlyIncome <= 0 {
            notes.append(.init(code: "invalid_income", severity: .blocking,
                               message: "يرجى إدخال دخل شهري صحيح."))
        } else if input.monthlyIncome < rules.minMonthlyIncome {
            notes.append(.init(code: "below_min_income", severity: .blocking,
                               message: "الدخل الشهري أقل من الحد الأدنى المطلوب لهذا المنتج."))
        }
        if input.age <= 0 {
            notes.append(.init(code: "invalid_age", severity: .blocking,
                               message: "يرجى إدخال عمر صحيح."))
        }

        // 2) تحديد المدة الفعلية وفق الحد الأقصى وعمر العميل عند نهاية التمويل.
        let ageLimitMonths = max(0, (rules.maxAgeAtMaturity - input.age) * 12)
        let requested = input.requestedTermMonths > 0 ? input.requestedTermMonths : rules.maxTermMonths
        let term = min(requested, rules.maxTermMonths, ageLimitMonths)
        if term < requested {
            notes.append(.init(code: "term_adjusted", severity: .info,
                               message: "تم تعديل مدة التمويل لتتوافق مع الحد الأقصى المسموح."))
        }
        if term < rules.minTermMonths {
            notes.append(.init(code: "term_too_short", severity: .blocking,
                               message: "المدة المتاحة أقل من الحد الأدنى لمدة التمويل."))
        }

        // 3) القسط الشهري المتاح.
        let obligations = max(0, input.monthlyObligations)
        var installment = max(0, input.monthlyIncome * rules.maxDebtRatio - obligations)
        if input.monthlyIncome > 0 && installment <= 0 {
            notes.append(.init(code: "obligations_exceed_limit", severity: .blocking,
                               message: "الالتزامات الحالية تستهلك كامل النسبة المسموحة من الدخل."))
        }

        if notes.contains(where: { $0.severity == .blocking }) {
            return ineligible(input: input, ruleSet: ruleSet, term: max(0, term), notes: notes)
        }

        // 4) مبلغ التمويل من القسط.
        var principal = Self.presentValue(installment: installment, annualRate: rules.annualProfitRate,
                                          months: term, method: rules.rateMethod)
        if principal > rules.maxFinancingAmount {
            principal = rules.maxFinancingAmount
            installment = Self.installment(principal: principal, annualRate: rules.annualProfitRate,
                                           months: term, method: rules.rateMethod)
            notes.append(.init(code: "capped_by_max_amount", severity: .info,
                               message: "تم تحديد المبلغ بالحد الأقصى للتمويل."))
        }

        // 5) التمويل العقاري: قيمة العقار والدفعة الأولى.
        var propertyValue: Double?
        var downPayment: Double?
        if input.product == .mortgage {
            let savings = max(0, input.downPaymentSavings)
            let minDownRatio = rules.minDownPaymentRatio ?? 0
            var value = principal + savings
            if minDownRatio > 0 {
                if savings <= 0 {
                    notes.append(.init(code: "down_payment_required", severity: .blocking,
                                       message: "يتطلب هذا المنتج دفعة أولى."))
                    return ineligible(input: input, ruleSet: ruleSet, term: term, notes: notes)
                }
                let maxValueBySavings = savings / minDownRatio
                if maxValueBySavings < value {
                    value = maxValueBySavings
                    principal = value - savings
                    installment = Self.installment(principal: principal, annualRate: rules.annualProfitRate,
                                                   months: term, method: rules.rateMethod)
                    notes.append(.init(code: "limited_by_down_payment", severity: .info,
                                       message: "قيمة العقار محدودة بمبلغ الدفعة الأولى المتوفر."))
                }
            }
            propertyValue = value
            downPayment = value - principal
        }

        let totalRepayment = installment * Double(term)
        return CalculationResult(
            product: input.product,
            isEligible: true,
            maxMonthlyInstallment: Self.round2(installment),
            maxFinancingAmount: Self.round2(principal),
            termMonths: term,
            totalRepayment: Self.round2(totalRepayment),
            totalProfit: Self.round2(totalRepayment - principal),
            maxPropertyValue: propertyValue.map(Self.round2),
            downPayment: downPayment.map(Self.round2),
            rulesVersion: ruleSet.version,
            isDemoRules: ruleSet.isDemo,
            notes: notes
        )
    }

    // MARK: - Helpers

    private func ineligible(input: CalculationInput, ruleSet: RuleSet, term: Int,
                            notes: [CalculationNote]) -> CalculationResult {
        CalculationResult(
            product: input.product, isEligible: false,
            maxMonthlyInstallment: 0, maxFinancingAmount: 0, termMonths: term,
            totalRepayment: 0, totalProfit: 0,
            maxPropertyValue: input.product == .mortgage ? 0 : nil,
            downPayment: input.product == .mortgage ? 0 : nil,
            rulesVersion: ruleSet.version, isDemoRules: ruleSet.isDemo, notes: notes
        )
    }

    /// أصل التمويل الذي يمكن سداده بقسط معيّن.
    static func presentValue(installment: Double, annualRate: Double, months: Int, method: RateMethod) -> Double {
        guard months > 0, installment > 0 else { return 0 }
        let n = Double(months)
        switch method {
        case .flat:
            return installment * n / (1 + annualRate * n / 12)
        case .reducing:
            let r = annualRate / 12
            guard r > 0 else { return installment * n }
            return installment * (1 - pow(1 + r, -n)) / r
        }
    }

    /// القسط الشهري لأصل تمويل معيّن (معكوس `presentValue`).
    static func installment(principal: Double, annualRate: Double, months: Int, method: RateMethod) -> Double {
        guard months > 0, principal > 0 else { return 0 }
        let n = Double(months)
        switch method {
        case .flat:
            return principal * (1 + annualRate * n / 12) / n
        case .reducing:
            let r = annualRate / 12
            guard r > 0 else { return principal / n }
            return principal * r / (1 - pow(1 + r, -n))
        }
    }

    static func round2(_ value: Double) -> Double {
        (value * 100).rounded() / 100
    }
}
