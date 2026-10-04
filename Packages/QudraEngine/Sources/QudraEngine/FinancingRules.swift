import Foundation

/// قواعد الحساب لمنتج تمويلي واحد.
///
/// هذه القواعد لا تُكتب داخل التطبيق؛ مصدرها جدول `calculation_rules` في Supabase
/// ويمكن تعديلها من الـ Cloud دون إصدار نسخة جديدة. مفاتيح JSON بصيغة snake_case
/// لتطابق عمود `parameters` ومحرك الـ Edge Function.
public struct FinancingRules: Codable, Equatable, Sendable {
    /// أقصى نسبة من الدخل الشهري يمكن أن تذهب للأقساط (شاملة الالتزامات الحالية).
    public var maxDebtRatio: Double
    /// نسبة الربح السنوية.
    public var annualProfitRate: Double
    public var rateMethod: RateMethod
    public var minTermMonths: Int
    public var maxTermMonths: Int
    public var minMonthlyIncome: Double
    public var maxFinancingAmount: Double
    /// أقصى عمر للعميل عند نهاية التمويل.
    public var maxAgeAtMaturity: Int
    /// نسبة الدفعة الأولى الدنيا من قيمة العقار (للتمويل العقاري فقط).
    public var minDownPaymentRatio: Double?

    public init(
        maxDebtRatio: Double,
        annualProfitRate: Double,
        rateMethod: RateMethod,
        minTermMonths: Int,
        maxTermMonths: Int,
        minMonthlyIncome: Double,
        maxFinancingAmount: Double,
        maxAgeAtMaturity: Int,
        minDownPaymentRatio: Double? = nil
    ) {
        self.maxDebtRatio = maxDebtRatio
        self.annualProfitRate = annualProfitRate
        self.rateMethod = rateMethod
        self.minTermMonths = minTermMonths
        self.maxTermMonths = maxTermMonths
        self.minMonthlyIncome = minMonthlyIncome
        self.maxFinancingAmount = maxFinancingAmount
        self.maxAgeAtMaturity = maxAgeAtMaturity
        self.minDownPaymentRatio = minDownPaymentRatio
    }

    enum CodingKeys: String, CodingKey {
        case maxDebtRatio = "max_debt_ratio"
        case annualProfitRate = "annual_profit_rate"
        case rateMethod = "rate_method"
        case minTermMonths = "min_term_months"
        case maxTermMonths = "max_term_months"
        case minMonthlyIncome = "min_monthly_income"
        case maxFinancingAmount = "max_financing_amount"
        case maxAgeAtMaturity = "max_age_at_maturity"
        case minDownPaymentRatio = "min_down_payment_ratio"
    }
}

/// مجموعة القواعد النشطة لكل المنتجات مع بيانات الإصدار.
public struct RuleSet: Codable, Equatable, Sendable {
    public var version: Int
    /// `true` عندما تكون القيم تجريبية وغير معتمدة.
    public var isDemo: Bool
    public var personal: FinancingRules
    public var mortgage: FinancingRules

    public init(version: Int, isDemo: Bool, personal: FinancingRules, mortgage: FinancingRules) {
        self.version = version
        self.isDemo = isDemo
        self.personal = personal
        self.mortgage = mortgage
    }

    public func rules(for product: FinancingProduct) -> FinancingRules {
        switch product {
        case .personal: return personal
        case .mortgage: return mortgage
        }
    }
}

public extension RuleSet {
    /// قيم تجريبية للتطوير فقط — ليست نسبًا أو قواعد تمويل حقيقية.
    /// تُستخدم فقط عند تعذّر جلب القواعد من الـ Cloud وعدم وجود نسخة محفوظة.
    /// يجب أن تطابق ملف `supabase/migrations/*_demo_rules.sql`.
    static let demo = RuleSet(
        version: 0,
        isDemo: true,
        personal: FinancingRules(
            maxDebtRatio: 0.25,
            annualProfitRate: 0.04,
            rateMethod: .reducing,
            minTermMonths: 12,
            maxTermMonths: 60,
            minMonthlyIncome: 1_000,
            maxFinancingAmount: 100_000,
            maxAgeAtMaturity: 60
        ),
        mortgage: FinancingRules(
            maxDebtRatio: 0.25,
            annualProfitRate: 0.04,
            rateMethod: .reducing,
            minTermMonths: 60,
            maxTermMonths: 240,
            minMonthlyIncome: 1_000,
            maxFinancingAmount: 1_000_000,
            maxAgeAtMaturity: 60,
            minDownPaymentRatio: 0.10
        )
    )
}
