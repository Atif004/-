import Foundation

/// مدخلات المستخدم للحساب.
public struct CalculationInput: Codable, Equatable, Sendable {
    public var product: FinancingProduct
    public var monthlyIncome: Double
    public var monthlyObligations: Double
    public var age: Int
    public var requestedTermMonths: Int
    /// المبلغ المتوفر للدفعة الأولى (للتمويل العقاري).
    public var downPaymentSavings: Double

    public init(
        product: FinancingProduct,
        monthlyIncome: Double,
        monthlyObligations: Double,
        age: Int,
        requestedTermMonths: Int,
        downPaymentSavings: Double = 0
    ) {
        self.product = product
        self.monthlyIncome = monthlyIncome
        self.monthlyObligations = monthlyObligations
        self.age = age
        self.requestedTermMonths = requestedTermMonths
        self.downPaymentSavings = downPaymentSavings
    }

    enum CodingKeys: String, CodingKey {
        case product = "product_type"
        case monthlyIncome = "monthly_income"
        case monthlyObligations = "monthly_obligations"
        case age
        case requestedTermMonths = "requested_term_months"
        case downPaymentSavings = "down_payment_savings"
    }
}

/// ملاحظة تظهر للمستخدم مع النتيجة. `code` ثابت للتعامل البرمجي، و`message` نص عربي للعرض.
public struct CalculationNote: Codable, Equatable, Hashable, Sendable {
    public enum Severity: String, Codable, Sendable {
        case info
        case warning
        case blocking
    }

    public var code: String
    public var severity: Severity
    public var message: String

    public init(code: String, severity: Severity, message: String) {
        self.code = code
        self.severity = severity
        self.message = message
    }
}

/// نتيجة الحساب التقديرية.
public struct CalculationResult: Codable, Equatable, Sendable {
    public var product: FinancingProduct
    public var isEligible: Bool
    public var maxMonthlyInstallment: Double
    public var maxFinancingAmount: Double
    public var termMonths: Int
    public var totalRepayment: Double
    public var totalProfit: Double
    /// للتمويل العقاري: أقصى قيمة عقار تقديرية.
    public var maxPropertyValue: Double?
    /// للتمويل العقاري: الدفعة الأولى المستخدمة في الحساب.
    public var downPayment: Double?
    public var rulesVersion: Int
    public var isDemoRules: Bool
    public var notes: [CalculationNote]

    public init(
        product: FinancingProduct,
        isEligible: Bool,
        maxMonthlyInstallment: Double,
        maxFinancingAmount: Double,
        termMonths: Int,
        totalRepayment: Double,
        totalProfit: Double,
        maxPropertyValue: Double?,
        downPayment: Double?,
        rulesVersion: Int,
        isDemoRules: Bool,
        notes: [CalculationNote]
    ) {
        self.product = product
        self.isEligible = isEligible
        self.maxMonthlyInstallment = maxMonthlyInstallment
        self.maxFinancingAmount = maxFinancingAmount
        self.termMonths = termMonths
        self.totalRepayment = totalRepayment
        self.totalProfit = totalProfit
        self.maxPropertyValue = maxPropertyValue
        self.downPayment = downPayment
        self.rulesVersion = rulesVersion
        self.isDemoRules = isDemoRules
        self.notes = notes
    }

    enum CodingKeys: String, CodingKey {
        case product = "product_type"
        case isEligible = "is_eligible"
        case maxMonthlyInstallment = "max_monthly_installment"
        case maxFinancingAmount = "max_financing_amount"
        case termMonths = "term_months"
        case totalRepayment = "total_repayment"
        case totalProfit = "total_profit"
        case maxPropertyValue = "max_property_value"
        case downPayment = "down_payment"
        case rulesVersion = "rules_version"
        case isDemoRules = "is_demo_rules"
        case notes
    }
}
