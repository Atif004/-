import Foundation
import Observation
import QudraEngine

/// يبني سيناريوهات المقارنة: بيانات أساسية مشتركة + اختلاف في المدة (والدفعة الأولى للعقاري).
@MainActor
@Observable
final class ComparisonBuilderViewModel {
    struct ScenarioDraft: Identifiable {
        let id = UUID()
        /// للتمويل الشخصي بالأشهر، وللعقاري بالسنوات.
        var term: String
        /// للتمويل العقاري فقط. فارغ = استخدام المبلغ الأساسي.
        var downPayment: String = ""
    }

    var product: FinancingProduct = .personal

    var monthlyIncome = ""
    var monthlyObligations = ""
    var age = ""
    var downPaymentSavings = ""

    var scenarios: [ScenarioDraft] = []
    var validationMessage: String?
    var presentedComparison: ComparisonPresentation?

    var termUnit: String { product == .mortgage ? "سنة" : "شهر" }
    var canAddScenario: Bool { scenarios.count < ScenarioComparison.maxScenarios }
    var canRemoveScenario: Bool { scenarios.count > 2 }

    /// يُستدعى عند تغيير المنتج: المدد تختلف في وحدتها وحدودها.
    func productChanged(using ruleSet: RuleSet) {
        scenarios = []
        validationMessage = nil
        prepareScenarios(using: ruleSet)
    }

    /// يملأ السيناريوهات بمدد مقترحة من القواعد الحالية إن كانت فارغة.
    func prepareScenarios(using ruleSet: RuleSet) {
        guard scenarios.isEmpty else { return }
        let terms = ScenarioComparison.suggestedTerms(for: ruleSet.rules(for: product))
        var drafts = terms.map { ScenarioDraft(term: displayTerm(fromMonths: $0)) }
        while drafts.count < 2 { drafts.append(ScenarioDraft(term: "")) }
        scenarios = drafts
    }

    func addScenario() {
        guard canAddScenario else { return }
        scenarios.append(ScenarioDraft(term: ""))
    }

    func removeScenario(id: UUID) {
        guard canRemoveScenario else { return }
        scenarios.removeAll { $0.id == id }
    }

    func compare(using ruleSet: RuleSet) {
        validationMessage = nil
        guard let income = NumberParsing.double(from: monthlyIncome), income > 0 else {
            validationMessage = "يرجى إدخال الدخل الشهري."
            return
        }
        guard let ageValue = NumberParsing.int(from: age), ageValue > 0 else {
            validationMessage = "يرجى إدخال العمر."
            return
        }
        let obligations = NumberParsing.double(from: monthlyObligations) ?? 0
        let baseDownPayment = NumberParsing.double(from: downPaymentSavings) ?? 0

        var built: [Scenario] = []
        for (index, draft) in scenarios.enumerated() {
            guard let termValue = NumberParsing.int(from: draft.term), termValue > 0 else {
                validationMessage = "يرجى إدخال مدة السيناريو \(index + 1)."
                return
            }
            let termMonths = product == .mortgage ? termValue * 12 : termValue
            let downPayment = NumberParsing.double(from: draft.downPayment) ?? baseDownPayment
            built.append(Scenario(
                label: "سيناريو \(index + 1)",
                input: CalculationInput(
                    product: product,
                    monthlyIncome: income,
                    monthlyObligations: obligations,
                    age: ageValue,
                    requestedTermMonths: termMonths,
                    downPaymentSavings: product == .mortgage ? downPayment : 0
                )
            ))
        }
        guard built.count >= 2 else {
            validationMessage = "أضف سيناريوهين على الأقل للمقارنة."
            return
        }
        let outcomes = ScenarioComparison.evaluate(built, ruleSet: ruleSet)
        presentedComparison = ComparisonPresentation(title: product.arabicTitle, outcomes: outcomes, savedDates: nil)
    }

    private func displayTerm(fromMonths months: Int) -> String {
        product == .mortgage ? "\(max(1, months / 12))" : "\(months)"
    }
}

/// غلاف للتنقل إلى صفحة المقارنة.
struct ComparisonPresentation: Identifiable, Hashable {
    let id = UUID()
    let title: String
    let outcomes: [ScenarioOutcome]
    /// تواريخ الحفظ عند المقارنة بين نتائج محفوظة (بنفس ترتيب `outcomes`).
    let savedDates: [Date]?

    static func == (lhs: Self, rhs: Self) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}

extension ComparisonPresentation {
    /// مقارنة نتائج محفوظة مسبقًا كما هي (دون إعادة الحساب).
    init(saved items: [SavedCalculation]) {
        let sorted = items.sorted { $0.createdAt < $1.createdAt }
        self.init(
            title: sorted.first?.product.arabicTitle ?? "",
            outcomes: sorted.prefix(ScenarioComparison.maxScenarios).enumerated().map { index, item in
                ScenarioOutcome(id: index, label: "نتيجة \(index + 1)", input: item.input, result: item.result)
            },
            savedDates: sorted.prefix(ScenarioComparison.maxScenarios).map(\.createdAt)
        )
    }
}
