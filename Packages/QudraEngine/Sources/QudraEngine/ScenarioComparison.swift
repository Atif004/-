import Foundation

/// سيناريو واحد ضمن مقارنة: مدخلات كاملة مع اسم للعرض.
public struct Scenario: Equatable, Sendable {
    public var label: String
    public var input: CalculationInput

    public init(label: String, input: CalculationInput) {
        self.label = label
        self.input = input
    }
}

/// سيناريو مع نتيجته.
public struct ScenarioOutcome: Equatable, Sendable, Identifiable {
    public let id: Int
    public let label: String
    public let input: CalculationInput
    public let result: CalculationResult

    public init(id: Int, label: String, input: CalculationInput, result: CalculationResult) {
        self.id = id
        self.label = label
        self.input = input
        self.result = result
    }
}

/// مواضع السيناريوهات المميزة في كل مقياس (فهرس داخل المصفوفة).
/// تكون القيمة `nil` عندما لا يوجد فرق حقيقي بين السيناريوهات المؤهلة،
/// أو عندما يكون عدد السيناريوهات المؤهلة أقل من اثنين.
public struct ComparisonHighlights: Equatable, Sendable {
    public var highestFinancing: Int?
    public var lowestInstallment: Int?
    public var lowestTotalProfit: Int?
    public var highestPropertyValue: Int?

    public init(highestFinancing: Int? = nil, lowestInstallment: Int? = nil,
                lowestTotalProfit: Int? = nil, highestPropertyValue: Int? = nil) {
        self.highestFinancing = highestFinancing
        self.lowestInstallment = lowestInstallment
        self.lowestTotalProfit = lowestTotalProfit
        self.highestPropertyValue = highestPropertyValue
    }

    public var isEmpty: Bool {
        highestFinancing == nil && lowestInstallment == nil
            && lowestTotalProfit == nil && highestPropertyValue == nil
    }
}

public enum ScenarioComparison {
    /// أقصى عدد سيناريوهات في المقارنة (لتبقى قابلة للقراءة على شاشة الهاتف).
    public static let maxScenarios = 3

    /// يحسب كل سيناريو بنفس القواعد.
    public static func evaluate(_ scenarios: [Scenario], ruleSet: RuleSet,
                                engine: CalculationEngine = CalculationEngine()) -> [ScenarioOutcome] {
        scenarios.prefix(maxScenarios).enumerated().map { index, scenario in
            ScenarioOutcome(id: index, label: scenario.label, input: scenario.input,
                            result: engine.calculate(scenario.input, ruleSet: ruleSet))
        }
    }

    /// يحدد السيناريو المميز في كل مقياس بين النتائج المؤهلة فقط.
    public static func highlights(for results: [CalculationResult]) -> ComparisonHighlights {
        let eligible = results.enumerated().filter { $0.element.isEligible }
        guard eligible.count >= 2 else { return ComparisonHighlights() }

        func pick(_ value: (CalculationResult) -> Double?, preferHigher: Bool) -> Int? {
            let values = eligible.compactMap { item in value(item.element).map { (item.offset, $0) } }
            guard values.count >= 2,
                  let best = preferHigher ? values.max(by: { $0.1 < $1.1 }) : values.min(by: { $0.1 < $1.1 }),
                  let worst = preferHigher ? values.min(by: { $0.1 < $1.1 }) : values.max(by: { $0.1 < $1.1 }),
                  abs(best.1 - worst.1) >= 0.01
            else { return nil }
            // عند التعادل على الأفضل لا نميّز أيًّا منها.
            let tied = values.filter { abs($0.1 - best.1) < 0.01 }
            return tied.count == 1 ? best.0 : nil
        }

        return ComparisonHighlights(
            highestFinancing: pick({ $0.maxFinancingAmount }, preferHigher: true),
            lowestInstallment: pick({ $0.maxMonthlyInstallment }, preferHigher: false),
            lowestTotalProfit: pick({ $0.totalProfit }, preferHigher: false),
            highestPropertyValue: pick({ $0.maxPropertyValue }, preferHigher: true)
        )
    }

    /// مدد مقترحة موزعة بين الحد الأدنى والأقصى في القواعد الحالية (بالأشهر).
    /// لا تحتوي على أي قيم ثابتة؛ تُشتق من القواعد القادمة من الـ Cloud.
    public static func suggestedTerms(for rules: FinancingRules, count: Int = 3) -> [Int] {
        let minTerm = max(1, rules.minTermMonths)
        let maxTerm = max(minTerm, rules.maxTermMonths)
        guard count > 1, maxTerm > minTerm else { return [maxTerm] }
        let step = Double(maxTerm - minTerm) / Double(count - 1)
        // تقريب لأقرب سنة كاملة لتكون القيم مألوفة، مع إبقائها داخل الحدود.
        let terms = (0..<count).map { i -> Int in
            let raw = Double(minTerm) + step * Double(i)
            let rounded = Int((raw / 12).rounded()) * 12
            return min(maxTerm, max(minTerm, rounded))
        }
        var unique: [Int] = []
        for term in terms where !unique.contains(term) { unique.append(term) }
        return unique
    }
}
