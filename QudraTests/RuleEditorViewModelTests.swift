import XCTest
import QudraEngine
@testable import Qudra

/// القيم هنا للاختبار فقط وليست قواعد تمويل حقيقية.
@MainActor
final class RuleEditorViewModelTests: XCTestCase {
    private let base = FinancingRules(
        maxDebtRatio: 0.25, annualProfitRate: 0.04, rateMethod: .reducing,
        minTermMonths: 12, maxTermMonths: 60, minMonthlyIncome: 1_000,
        maxFinancingAmount: 100_000, maxAgeAtMaturity: 60
    )

    private func makeVM(product: FinancingProduct = .personal) -> RuleEditorViewModel {
        RuleEditorViewModel(product: product, base: base, baseIsDemo: true)
    }

    func testPrefillUsesPercentAndPlainNumbers() {
        let vm = makeVM()
        XCTAssertEqual(vm.maxDebtRatioPercent, "25")
        XCTAssertEqual(vm.annualProfitRatePercent, "4")
        XCTAssertEqual(vm.maxFinancingAmount, "100000")
        XCTAssertEqual(vm.proposedRules, base)
    }

    func testNoChangesCannotPublish() {
        let vm = makeVM()
        XCTAssertTrue(vm.changes.isEmpty)
        XCTAssertTrue(vm.issues.isEmpty)
        XCTAssertFalse(vm.canPublish)
    }

    func testChangeDetectedAndPublishable() {
        let vm = makeVM()
        vm.maxDebtRatioPercent = "30"
        vm.isDemo = false
        XCTAssertEqual(vm.proposedRules?.maxDebtRatio ?? 0, 0.30, accuracy: 1e-9)
        XCTAssertEqual(vm.changes.map(\.field), ["نسبة الاستقطاع", "نوع القيم"])
        XCTAssertTrue(vm.canPublish)
    }

    func testInvalidValuesBlockPublishing() {
        let vm = makeVM()
        vm.maxDebtRatioPercent = "150"
        XCTAssertFalse(vm.issues.isEmpty)
        XCTAssertFalse(vm.canPublish)

        vm.maxDebtRatioPercent = ""
        XCTAssertNil(vm.proposedRules)
        XCTAssertFalse(vm.canPublish)
    }

    func testPersonalIgnoresDownPayment() {
        let vm = makeVM()
        vm.minDownPaymentPercent = "10"
        XCTAssertNil(vm.proposedRules?.minDownPaymentRatio)
    }

    func testPreviewComparesCurrentAndProposed() {
        let vm = makeVM()
        XCTAssertNil(vm.preview)
        vm.sampleIncome = "10000"
        vm.sampleAge = "30"
        vm.maxFinancingAmount = "200000"
        let preview = try? XCTUnwrap(vm.preview)
        XCTAssertEqual(preview?.current.maxFinancingAmount, 100_000)
        XCTAssertGreaterThan(preview?.proposed.maxFinancingAmount ?? 0, 100_000)
    }
}
