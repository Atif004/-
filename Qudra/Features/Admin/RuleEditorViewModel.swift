import Foundation
import Observation
import QudraEngine

/// نموذج تحرير إصدار جديد من القواعد. النِّسب تُدخل كنسبة مئوية (25 = 0.25).
@MainActor
@Observable
final class RuleEditorViewModel {
    struct Change: Identifiable, Hashable {
        var id: String { field }
        let field: String
        let old: String
        let new: String
    }

    struct Preview {
        let current: CalculationResult
        let proposed: CalculationResult
    }

    let product: FinancingProduct
    let base: FinancingRules
    let baseIsDemo: Bool

    var maxDebtRatioPercent: String
    var annualProfitRatePercent: String
    var rateMethod: RateMethod
    var minTermMonths: String
    var maxTermMonths: String
    var minMonthlyIncome: String
    var maxFinancingAmount: String
    var maxAgeAtMaturity: String
    var minDownPaymentPercent: String
    var isDemo: Bool
    var notes = ""

    // بيانات عميل افتراضي للمعاينة فقط.
    var sampleIncome = ""
    var sampleObligations = ""
    var sampleAge = ""
    var sampleDownPayment = ""

    init(product: FinancingProduct, base: FinancingRules, baseIsDemo: Bool) {
        self.product = product
        self.base = base
        self.baseIsDemo = baseIsDemo
        maxDebtRatioPercent = Self.plain(base.maxDebtRatio * 100)
        annualProfitRatePercent = Self.plain(base.annualProfitRate * 100)
        rateMethod = base.rateMethod
        minTermMonths = "\(base.minTermMonths)"
        maxTermMonths = "\(base.maxTermMonths)"
        minMonthlyIncome = Self.plain(base.minMonthlyIncome)
        maxFinancingAmount = Self.plain(base.maxFinancingAmount)
        maxAgeAtMaturity = "\(base.maxAgeAtMaturity)"
        minDownPaymentPercent = base.minDownPaymentRatio.map { Self.plain($0 * 100) } ?? ""
        isDemo = baseIsDemo
    }

    /// القواعد كما في النموذج، أو `nil` إن كان أحد الحقول فارغًا أو غير رقمي.
    var proposedRules: FinancingRules? {
        guard let debt = NumberParsing.double(from: maxDebtRatioPercent),
              let rate = NumberParsing.double(from: annualProfitRatePercent),
              let minTerm = NumberParsing.int(from: minTermMonths),
              let maxTerm = NumberParsing.int(from: maxTermMonths),
              let minIncome = NumberParsing.double(from: minMonthlyIncome),
              let maxAmount = NumberParsing.double(from: maxFinancingAmount),
              let maxAge = NumberParsing.int(from: maxAgeAtMaturity)
        else { return nil }
        let downPercent = NumberParsing.double(from: minDownPaymentPercent)
        return FinancingRules(
            maxDebtRatio: debt / 100,
            annualProfitRate: rate / 100,
            rateMethod: rateMethod,
            minTermMonths: minTerm,
            maxTermMonths: maxTerm,
            minMonthlyIncome: minIncome,
            maxFinancingAmount: maxAmount,
            maxAgeAtMaturity: maxAge,
            minDownPaymentRatio: product == .mortgage ? downPercent.map { $0 / 100 } : nil
        )
    }

    var issues: [String] {
        guard let rules = proposedRules else { return ["يرجى تعبئة كل الحقول بأرقام صحيحة."] }
        return RulesValidator.validate(rules).map(\.message)
    }

    var changes: [Change] {
        guard let new = proposedRules else { return [] }
        var list: [Change] = []
        func add(_ field: String, _ old: String, _ new: String) {
            if old != new { list.append(Change(field: field, old: old, new: new)) }
        }
        add("نسبة الاستقطاع", Formatters.percent(base.maxDebtRatio), Formatters.percent(new.maxDebtRatio))
        add("نسبة الربح السنوية", Formatters.percent(base.annualProfitRate), Formatters.percent(new.annualProfitRate))
        add("طريقة الاحتساب", Self.title(for: base.rateMethod), Self.title(for: new.rateMethod))
        add("أقل مدة", "\(base.minTermMonths) شهر", "\(new.minTermMonths) شهر")
        add("أقصى مدة", "\(base.maxTermMonths) شهر", "\(new.maxTermMonths) شهر")
        add("الحد الأدنى للدخل", Formatters.number(base.minMonthlyIncome), Formatters.number(new.minMonthlyIncome))
        add("الحد الأقصى للتمويل", Formatters.number(base.maxFinancingAmount), Formatters.number(new.maxFinancingAmount))
        add("أقصى عمر عند النهاية", "\(base.maxAgeAtMaturity)", "\(new.maxAgeAtMaturity)")
        if product == .mortgage {
            add("الدفعة الأولى الدنيا",
                base.minDownPaymentRatio.map(Formatters.percent) ?? "—",
                new.minDownPaymentRatio.map(Formatters.percent) ?? "—")
        }
        add("نوع القيم", baseIsDemo ? "تجريبية" : "معتمدة", isDemo ? "تجريبية" : "معتمدة")
        return list
    }

    var canPublish: Bool { issues.isEmpty && !changes.isEmpty }

    /// يحسب نفس العميل الافتراضي بالقواعد الحالية والمقترحة للمقارنة قبل النشر.
    var preview: Preview? {
        guard let proposed = proposedRules, RulesValidator.validate(proposed).isEmpty,
              let income = NumberParsing.double(from: sampleIncome), income > 0,
              let age = NumberParsing.int(from: sampleAge), age > 0
        else { return nil }
        let input = CalculationInput(
            product: product,
            monthlyIncome: income,
            monthlyObligations: NumberParsing.double(from: sampleObligations) ?? 0,
            age: age,
            requestedTermMonths: 0,
            downPaymentSavings: NumberParsing.double(from: sampleDownPayment) ?? 0
        )
        let engine = CalculationEngine()
        return Preview(
            current: engine.calculate(input, ruleSet: Self.ruleSet(product: product, rules: base, isDemo: baseIsDemo)),
            proposed: engine.calculate(input, ruleSet: Self.ruleSet(product: product, rules: proposed, isDemo: isDemo))
        )
    }

    static func title(for method: RateMethod) -> String {
        switch method {
        case .reducing: return "رصيد متناقص"
        case .flat: return "نسبة ثابتة"
        }
    }

    private static func ruleSet(product: FinancingProduct, rules: FinancingRules, isDemo: Bool) -> RuleSet {
        RuleSet(version: 0, isDemo: isDemo, personal: rules, mortgage: rules)
    }

    /// رقم بصيغة قابلة للتحرير: بدون فواصل آلاف ومع إزالة الأصفار الزائدة.
    static func plain(_ value: Double) -> String {
        value.formatted(.number.locale(Locale(identifier: "en_US_POSIX"))
            .grouping(.never)
            .precision(.fractionLength(0...4)))
    }
}
