import XCTest
@testable import QudraEngine

/// قواعد الاختبار هنا للاختبار فقط وليست قواعد تمويل حقيقية.
final class ScenarioComparisonTests: XCTestCase {
    private let rules = FinancingRules(
        maxDebtRatio: 0.5, annualProfitRate: 0.06, rateMethod: .reducing,
        minTermMonths: 12, maxTermMonths: 120, minMonthlyIncome: 1_000,
        maxFinancingAmount: 1_000_000, maxAgeAtMaturity: 60
    )

    private var ruleSet: RuleSet { RuleSet(version: 1, isDemo: true, personal: rules, mortgage: rules) }

    private func input(term: Int, income: Double = 10_000) -> CalculationInput {
        CalculationInput(product: .personal, monthlyIncome: income, monthlyObligations: 0,
                         age: 30, requestedTermMonths: term)
    }

    func testEvaluateKeepsOrderAndLimit() {
        let scenarios = [12, 24, 36, 48].map { Scenario(label: "\($0)", input: input(term: $0)) }
        let outcomes = ScenarioComparison.evaluate(scenarios, ruleSet: ruleSet)
        XCTAssertEqual(outcomes.count, ScenarioComparison.maxScenarios)
        XCTAssertEqual(outcomes.map(\.result.termMonths), [12, 24, 36])
        XCTAssertEqual(outcomes.map(\.id), [0, 1, 2])
    }

    func testLongerTermGivesHigherFinancingAndShorterLowerProfit() {
        let outcomes = ScenarioComparison.evaluate(
            [12, 60].map { Scenario(label: "\($0)", input: input(term: $0)) }, ruleSet: ruleSet)
        let highlights = ScenarioComparison.highlights(for: outcomes.map(\.result))
        XCTAssertEqual(highlights.highestFinancing, 1)
        XCTAssertEqual(highlights.lowestTotalProfit, 0)
        // نفس الدخل ونفس النسبة: القسط متساوٍ فلا يوجد مميز.
        XCTAssertNil(highlights.lowestInstallment)
        XCTAssertNil(highlights.highestPropertyValue)
    }

    func testIneligibleScenariosAreIgnored() {
        let outcomes = ScenarioComparison.evaluate([
            Scenario(label: "a", input: input(term: 60, income: 500)),
            Scenario(label: "b", input: input(term: 60))
        ], ruleSet: ruleSet)
        XCTAssertTrue(ScenarioComparison.highlights(for: outcomes.map(\.result)).isEmpty)
    }

    func testSuggestedTermsWithinRules() {
        XCTAssertEqual(ScenarioComparison.suggestedTerms(for: rules), [12, 72, 120])
        var single = rules
        single.minTermMonths = 60
        single.maxTermMonths = 60
        XCTAssertEqual(ScenarioComparison.suggestedTerms(for: single), [60])
    }
}
