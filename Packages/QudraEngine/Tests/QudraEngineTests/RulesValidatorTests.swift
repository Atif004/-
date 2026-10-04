import XCTest
@testable import QudraEngine

/// القيم هنا للاختبار فقط وليست قواعد تمويل حقيقية.
final class RulesValidatorTests: XCTestCase {
    private let valid = FinancingRules(
        maxDebtRatio: 0.3, annualProfitRate: 0.02, rateMethod: .flat,
        minTermMonths: 12, maxTermMonths: 48, minMonthlyIncome: 500,
        maxFinancingAmount: 50_000, maxAgeAtMaturity: 65
    )

    private func codes(_ change: (inout FinancingRules) -> Void) -> [String] {
        var rules = valid
        change(&rules)
        return RulesValidator.validate(rules).map(\.code)
    }

    func testValidRules() {
        XCTAssertTrue(RulesValidator.validate(valid).isEmpty)
        XCTAssertTrue(RulesValidator.validate(RuleSet.demo.personal).isEmpty)
        XCTAssertTrue(RulesValidator.validate(RuleSet.demo.mortgage).isEmpty)
    }

    func testRanges() {
        XCTAssertEqual(codes { $0.maxDebtRatio = 0 }, ["max_debt_ratio_range"])
        XCTAssertEqual(codes { $0.maxDebtRatio = 1.5 }, ["max_debt_ratio_range"])
        XCTAssertEqual(codes { $0.annualProfitRate = 1 }, ["annual_profit_rate_range"])
        XCTAssertEqual(codes { $0.minTermMonths = 0 }, ["min_term_range"])
        XCTAssertEqual(codes { $0.maxTermMonths = 6 }, ["max_term_range"])
        XCTAssertEqual(codes { $0.maxTermMonths = 601 }, ["max_term_range"])
        XCTAssertEqual(codes { $0.minMonthlyIncome = -1 }, ["min_income_range"])
        XCTAssertEqual(codes { $0.maxFinancingAmount = 0 }, ["max_amount_range"])
        XCTAssertEqual(codes { $0.maxAgeAtMaturity = 17 }, ["max_age_range"])
        XCTAssertEqual(codes { $0.minDownPaymentRatio = 1 }, ["down_payment_ratio_range"])
        XCTAssertEqual(codes { $0.annualProfitRate = .nan }, ["not_finite"])
    }

    func testParseServerMessage() {
        let issues = RuleValidationIssue.parseServerMessage(
            #"{"code":"22023","message":"invalid_parameters:max_debt_ratio_range,unknown_key:x"}"#)
        XCTAssertEqual(issues.map(\.code), ["max_debt_ratio_range", "unknown_key:x"])
        XCTAssertTrue(issues[1].message.contains("x"))
        XCTAssertTrue(RuleValidationIssue.parseServerMessage("other").isEmpty)
    }
}
