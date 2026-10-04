import Foundation

/// مشكلة في قيم القواعد. الرموز تطابق `public.validate_rule_parameters` في
/// supabase/migrations/*_rules_admin.sql، حتى تُعرض رسائل الخادم بنفس النص.
public struct RuleValidationIssue: Equatable, Hashable, Sendable {
    public let code: String

    public init(code: String) {
        self.code = code
    }

    public var message: String {
        switch code {
        case "max_debt_ratio_range": return "نسبة الاستقطاع يجب أن تكون أكبر من 0% ولا تتجاوز 100%."
        case "annual_profit_rate_range": return "نسبة الربح السنوية يجب أن تكون بين 0% وأقل من 100%."
        case "rate_method_invalid": return "طريقة احتساب الربح غير صحيحة."
        case "min_term_range": return "الحد الأدنى للمدة يجب أن يكون شهرًا واحدًا على الأقل."
        case "max_term_range": return "الحد الأقصى للمدة يجب ألا يقل عن الحد الأدنى ولا يتجاوز 600 شهر."
        case "min_income_range": return "الحد الأدنى للدخل لا يمكن أن يكون سالبًا."
        case "max_amount_range": return "الحد الأقصى للتمويل يجب أن يكون أكبر من صفر."
        case "max_age_range": return "أقصى عمر عند نهاية التمويل يجب أن يكون بين 18 و120."
        case "down_payment_ratio_range": return "نسبة الدفعة الأولى يجب أن تكون بين 0% وأقل من 100%."
        case "not_finite": return "إحدى القيم غير صالحة."
        default:
            if code.hasPrefix("missing_key:") { return "قيمة مطلوبة مفقودة: \(code.dropFirst(12))." }
            if code.hasPrefix("unknown_key:") { return "مفتاح غير معروف: \(code.dropFirst(12))." }
            if code.hasPrefix("not_number:") { return "يجب أن تكون القيمة رقمًا: \(code.dropFirst(11))." }
            if code.hasPrefix("not_integer:") { return "يجب أن تكون القيمة عددًا صحيحًا: \(code.dropFirst(12))." }
            return "قيمة غير صالحة (\(code))."
        }
    }

    /// يستخرج الرموز من رسالة خطأ الخادم بصيغة `invalid_parameters:a,b`.
    public static func parseServerMessage(_ message: String) -> [RuleValidationIssue] {
        guard let range = message.range(of: "invalid_parameters:") else { return [] }
        let tail = message[range.upperBound...].prefix { !$0.isWhitespace && $0 != "\"" }
        return tail.split(separator: ",").map { RuleValidationIssue(code: String($0)) }
    }
}

/// تحقق من سلامة القواعد قبل نشرها (حدود منطقية فقط، وليست قواعد تمويل).
public enum RulesValidator {
    public static let maxTermMonthsLimit = 600

    public static func validate(_ rules: FinancingRules) -> [RuleValidationIssue] {
        var codes: [String] = []
        let numbers = [rules.maxDebtRatio, rules.annualProfitRate, rules.minMonthlyIncome,
                       rules.maxFinancingAmount, rules.minDownPaymentRatio ?? 0]
        if numbers.contains(where: { !$0.isFinite }) {
            return [RuleValidationIssue(code: "not_finite")]
        }

        if rules.maxDebtRatio <= 0 || rules.maxDebtRatio > 1 { codes.append("max_debt_ratio_range") }
        if rules.annualProfitRate < 0 || rules.annualProfitRate >= 1 { codes.append("annual_profit_rate_range") }
        if rules.minTermMonths < 1 { codes.append("min_term_range") }
        if rules.maxTermMonths < rules.minTermMonths || rules.maxTermMonths > maxTermMonthsLimit {
            codes.append("max_term_range")
        }
        if rules.minMonthlyIncome < 0 { codes.append("min_income_range") }
        if rules.maxFinancingAmount <= 0 { codes.append("max_amount_range") }
        if rules.maxAgeAtMaturity < 18 || rules.maxAgeAtMaturity > 120 { codes.append("max_age_range") }
        if let ratio = rules.minDownPaymentRatio, ratio < 0 || ratio >= 1 {
            codes.append("down_payment_ratio_range")
        }
        return codes.map(RuleValidationIssue.init(code:))
    }
}
