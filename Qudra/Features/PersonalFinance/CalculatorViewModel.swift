import Foundation
import Observation
import QudraEngine

/// منطق شاشات الحاسبة. يجمع المدخلات ويمررها لمحرك الحساب دون أي قواعد داخلية.
@MainActor
@Observable
final class CalculatorViewModel {
    let product: FinancingProduct

    var monthlyIncome = ""
    var monthlyObligations = ""
    var age = ""
    /// للتمويل الشخصي بالأشهر، وللعقاري بالسنوات.
    var term = ""
    var downPaymentSavings = ""

    var validationMessage: String?
    var presentedResult: ResultPresentation?

    @ObservationIgnored private let engine = CalculationEngine()

    init(product: FinancingProduct) {
        self.product = product
    }

    var termUnit: String { product == .mortgage ? "سنة" : "شهر" }

    func calculate(using ruleSet: RuleSet) {
        validationMessage = nil
        guard let income = NumberParsing.double(from: monthlyIncome), income > 0 else {
            validationMessage = "يرجى إدخال الدخل الشهري."
            return
        }
        guard let ageValue = NumberParsing.int(from: age), ageValue > 0 else {
            validationMessage = "يرجى إدخال العمر."
            return
        }
        let termValue = NumberParsing.int(from: term) ?? 0
        let termMonths = product == .mortgage ? termValue * 12 : termValue

        let input = CalculationInput(
            product: product,
            monthlyIncome: income,
            monthlyObligations: NumberParsing.double(from: monthlyObligations) ?? 0,
            age: ageValue,
            requestedTermMonths: termMonths,
            downPaymentSavings: product == .mortgage ? (NumberParsing.double(from: downPaymentSavings) ?? 0) : 0
        )
        let result = engine.calculate(input, ruleSet: ruleSet)
        presentedResult = ResultPresentation(input: input, result: result, origin: .fresh)
    }
}

/// غلاف للتنقل إلى صفحة النتيجة.
struct ResultPresentation: Identifiable, Hashable {
    enum Origin: Hashable {
        case fresh
        case history(savedAt: Date)
    }

    let id = UUID()
    let input: CalculationInput
    let result: CalculationResult
    let origin: Origin

    static func == (lhs: Self, rhs: Self) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}
