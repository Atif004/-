import XCTest
import QudraEngine
@testable import Qudra

final class ResultSummaryTests: XCTestCase {
    private func makeResult(eligible: Bool = true, installment: Double = 2_000,
                            principal: Double = 80_000, total: Double = 100_000) -> CalculationResult {
        CalculationResult(product: .personal, isEligible: eligible,
                          maxMonthlyInstallment: installment, maxFinancingAmount: principal,
                          termMonths: 50, totalRepayment: total, totalProfit: total - principal,
                          maxPropertyValue: nil, downPayment: nil,
                          rulesVersion: 1, isDemoRules: true, notes: [])
    }

    private let input = CalculationInput(product: .personal, monthlyIncome: 10_000,
                                         monthlyObligations: 1_000, age: 30, requestedTermMonths: 50)

    func testPrincipalShare() {
        XCTAssertEqual(ResultSummary(input: input, result: makeResult()).principalShare, 0.8, accuracy: 0.0001)
    }

    func testDebtRatioAndRemainingIncome() {
        let summary = ResultSummary(input: input, result: makeResult())
        XCTAssertEqual(summary.debtRatioAfterFinancing ?? 0, 0.3, accuracy: 0.0001)
        XCTAssertEqual(summary.remainingMonthlyIncome ?? 0, 7_000, accuracy: 0.0001)
    }

    func testIneligibleHasNoRatios() {
        let summary = ResultSummary(input: input, result: makeResult(eligible: false))
        XCTAssertNil(summary.debtRatioAfterFinancing)
        XCTAssertNil(summary.remainingMonthlyIncome)
        XCTAssertTrue(summary.shareText.contains("غير مؤهل"))
    }

    func testShareTextMentionsDemoRules() {
        XCTAssertTrue(ResultSummary(input: input, result: makeResult()).shareText.contains("تجريبية"))
    }
}

final class AuthValidationTests: XCTestCase {
    func testEmailValidation() {
        XCTAssertTrue(AuthValidation.isValidEmail("user@example.com"))
        XCTAssertFalse(AuthValidation.isValidEmail("user@example"))
        XCTAssertFalse(AuthValidation.isValidEmail("@example.com"))
        XCTAssertFalse(AuthValidation.isValidEmail("userexample.com"))
    }
}
