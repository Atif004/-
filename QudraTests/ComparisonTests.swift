import XCTest
import QudraEngine
@testable import Qudra

/// القواعد هنا للاختبار فقط وليست قواعد تمويل حقيقية.
@MainActor
final class ComparisonBuilderViewModelTests: XCTestCase {
    private let rules = FinancingRules(
        maxDebtRatio: 0.5, annualProfitRate: 0, rateMethod: .reducing,
        minTermMonths: 12, maxTermMonths: 120, minMonthlyIncome: 1_000,
        maxFinancingAmount: 1_000_000, maxAgeAtMaturity: 60, minDownPaymentRatio: 0.1
    )
    private var ruleSet: RuleSet { RuleSet(version: 3, isDemo: true, personal: rules, mortgage: rules) }

    func testPrepareUsesSuggestedTermsFromRules() {
        let vm = ComparisonBuilderViewModel()
        vm.prepareScenarios(using: ruleSet)
        XCTAssertEqual(vm.scenarios.map(\.term), ["12", "72", "120"])

        vm.product = .mortgage
        vm.productChanged(using: ruleSet)
        XCTAssertEqual(vm.scenarios.map(\.term), ["1", "6", "10"])
    }

    func testCompareRequiresIncome() {
        let vm = ComparisonBuilderViewModel()
        vm.prepareScenarios(using: ruleSet)
        vm.compare(using: ruleSet)
        XCTAssertNotNil(vm.validationMessage)
        XCTAssertNil(vm.presentedComparison)
    }

    func testCompareBuildsOutcomes() {
        let vm = ComparisonBuilderViewModel()
        vm.prepareScenarios(using: ruleSet)
        vm.monthlyIncome = "10000"
        vm.age = "30"
        vm.compare(using: ruleSet)
        let outcomes = try? XCTUnwrap(vm.presentedComparison?.outcomes)
        XCTAssertEqual(outcomes?.map(\.result.termMonths), [12, 72, 120])
        XCTAssertEqual(outcomes?.map(\.result.maxFinancingAmount), [60_000, 360_000, 600_000])
    }

    func testMortgageScenarioDownPaymentOverride() {
        let vm = ComparisonBuilderViewModel()
        vm.product = .mortgage
        vm.productChanged(using: ruleSet)
        vm.monthlyIncome = "10000"
        vm.age = "30"
        vm.downPaymentSavings = "10000"
        vm.scenarios[1].downPayment = "20000"
        vm.compare(using: ruleSet)
        let downPayments = vm.presentedComparison?.outcomes.map(\.input.downPaymentSavings)
        XCTAssertEqual(downPayments, [10_000, 20_000, 10_000])
    }

    func testScenarioCountLimits() {
        let vm = ComparisonBuilderViewModel()
        vm.prepareScenarios(using: ruleSet)
        XCTAssertFalse(vm.canAddScenario)
        vm.removeScenario(id: vm.scenarios[0].id)
        XCTAssertEqual(vm.scenarios.count, 2)
        XCTAssertFalse(vm.canRemoveScenario)
    }
}

final class ComparisonPresentationTests: XCTestCase {
    func testSavedItemsSortedOldestFirst() {
        let engine = CalculationEngine()
        func saved(_ date: Date) -> SavedCalculation {
            let input = CalculationInput(product: .personal, monthlyIncome: 10_000, monthlyObligations: 0,
                                         age: 30, requestedTermMonths: 24)
            return SavedCalculation(id: UUID(), product: .personal, input: input,
                                    result: engine.calculate(input, ruleSet: .demo),
                                    rulesVersion: 0, createdAt: date)
        }
        let newer = saved(Date(timeIntervalSince1970: 2_000))
        let older = saved(Date(timeIntervalSince1970: 1_000))
        let presentation = ComparisonPresentation(saved: [newer, older])
        XCTAssertEqual(presentation.savedDates, [older.createdAt, newer.createdAt])
        XCTAssertEqual(presentation.outcomes.map(\.id), [0, 1])
    }
}
