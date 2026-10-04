import XCTest
@testable import QudraEngine

/// الاختبارات تستخدم قواعد تجريبية مُعرّفة داخل الاختبار فقط.
final class CalculationEngineTests: XCTestCase {
    private let engine = CalculationEngine()

    private func rules(rate: Double = 0, maxAmount: Double = 1_000_000,
                       minDown: Double? = nil) -> FinancingRules {
        FinancingRules(maxDebtRatio: 0.5, annualProfitRate: rate, rateMethod: .reducing,
                       minTermMonths: 12, maxTermMonths: 120, minMonthlyIncome: 1_000,
                       maxFinancingAmount: maxAmount, maxAgeAtMaturity: 60,
                       minDownPaymentRatio: minDown)
    }

    private func ruleSet(_ personal: FinancingRules, _ mortgage: FinancingRules? = nil) -> RuleSet {
        RuleSet(version: 1, isDemo: true, personal: personal, mortgage: mortgage ?? personal)
    }

    func testZeroRateInstallmentTimesTerm() {
        let input = CalculationInput(product: .personal, monthlyIncome: 10_000, monthlyObligations: 1_000,
                                     age: 30, requestedTermMonths: 60)
        let result = engine.calculate(input, ruleSet: ruleSet(rules()))
        XCTAssertTrue(result.isEligible)
        XCTAssertEqual(result.maxMonthlyInstallment, 4_000)
        XCTAssertEqual(result.maxFinancingAmount, 240_000)
        XCTAssertEqual(result.totalProfit, 0)
    }

    func testPresentValueAndInstallmentAreInverse() {
        for method in [RateMethod.reducing, .flat] {
            let pv = CalculationEngine.presentValue(installment: 2_000, annualRate: 0.06, months: 48, method: method)
            let m = CalculationEngine.installment(principal: pv, annualRate: 0.06, months: 48, method: method)
            XCTAssertEqual(m, 2_000, accuracy: 0.0001)
        }
    }

    func testTermLimitedByAge() {
        let input = CalculationInput(product: .personal, monthlyIncome: 10_000, monthlyObligations: 0,
                                     age: 55, requestedTermMonths: 120)
        let result = engine.calculate(input, ruleSet: ruleSet(rules()))
        XCTAssertEqual(result.termMonths, 60)
        XCTAssertTrue(result.notes.contains { $0.code == "term_adjusted" })
    }

    func testCappedByMaxAmount() {
        let input = CalculationInput(product: .personal, monthlyIncome: 10_000, monthlyObligations: 0,
                                     age: 30, requestedTermMonths: 60)
        let result = engine.calculate(input, ruleSet: ruleSet(rules(maxAmount: 60_000)))
        XCTAssertEqual(result.maxFinancingAmount, 60_000)
        XCTAssertEqual(result.maxMonthlyInstallment, 1_000)
    }

    func testBelowMinimumIncomeIsIneligible() {
        let input = CalculationInput(product: .personal, monthlyIncome: 500, monthlyObligations: 0,
                                     age: 30, requestedTermMonths: 60)
        let result = engine.calculate(input, ruleSet: ruleSet(rules()))
        XCTAssertFalse(result.isEligible)
        XCTAssertEqual(result.maxFinancingAmount, 0)
    }

    func testMortgageLimitedByDownPayment() {
        let input = CalculationInput(product: .mortgage, monthlyIncome: 10_000, monthlyObligations: 0,
                                     age: 30, requestedTermMonths: 120, downPaymentSavings: 10_000)
        let result = engine.calculate(input, ruleSet: ruleSet(rules(), rules(minDown: 0.1)))
        XCTAssertTrue(result.isEligible)
        XCTAssertEqual(result.maxPropertyValue, 100_000)
        XCTAssertEqual(result.downPayment, 10_000)
        XCTAssertEqual(result.maxFinancingAmount, 90_000)
    }

    func testMortgageRequiresDownPayment() {
        let input = CalculationInput(product: .mortgage, monthlyIncome: 10_000, monthlyObligations: 0,
                                     age: 30, requestedTermMonths: 120, downPaymentSavings: 0)
        let result = engine.calculate(input, ruleSet: ruleSet(rules(), rules(minDown: 0.1)))
        XCTAssertFalse(result.isEligible)
        XCTAssertTrue(result.notes.contains { $0.code == "down_payment_required" })
    }

    func testResultJSONRoundTrip() throws {
        let input = CalculationInput(product: .personal, monthlyIncome: 10_000, monthlyObligations: 0,
                                     age: 30, requestedTermMonths: 60)
        let result = engine.calculate(input, ruleSet: .demo)
        let data = try JSONEncoder().encode(result)
        XCTAssertEqual(try JSONDecoder().decode(CalculationResult.self, from: data), result)
    }
}
