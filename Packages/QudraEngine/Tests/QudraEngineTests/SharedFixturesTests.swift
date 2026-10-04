import XCTest
@testable import QudraEngine

/// يشغّل الحالات المشتركة في Fixtures/engine_cases.json،
/// وهي نفس الحالات التي يختبر بها محرك الخادم (engine.test.ts)،
/// لضمان تطابق نتائج المحركين.
final class SharedFixturesTests: XCTestCase {
    func testSharedFixtureCases() throws {
        let url = try XCTUnwrap(
            Bundle.module.url(forResource: "engine_cases", withExtension: "json", subdirectory: "Fixtures")
        )
        let root = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [String: Any])
        let baseRules = try XCTUnwrap(root["base_rules"] as? [String: Any])
        let cases = try XCTUnwrap(root["cases"] as? [[String: Any]])
        XCTAssertFalse(cases.isEmpty)

        let engine = CalculationEngine()
        let decoder = JSONDecoder()

        for testCase in cases {
            let name = testCase["name"] as? String ?? "?"
            let overrides = testCase["rules"] as? [String: Any] ?? [:]
            let rulesDict = baseRules.merging(overrides) { _, new in new }
            let rules = try decoder.decode(FinancingRules.self,
                                           from: JSONSerialization.data(withJSONObject: rulesDict))
            let inputDict = try XCTUnwrap(testCase["input"] as? [String: Any], "\(name): input")
            let input = try decoder.decode(CalculationInput.self,
                                           from: JSONSerialization.data(withJSONObject: inputDict))
            let ruleSet = RuleSet(version: 1, isDemo: true, personal: rules, mortgage: rules)

            let result = engine.calculate(input, ruleSet: ruleSet)
            let resultDict = try XCTUnwrap(
                JSONSerialization.jsonObject(with: JSONEncoder().encode(result)) as? [String: Any]
            )
            let expected = try XCTUnwrap(testCase["expected"] as? [String: Any])

            for (key, expectedValue) in expected {
                if key == "note_codes" {
                    XCTAssertEqual(result.notes.map(\.code), expectedValue as? [String], "\(name): note_codes")
                } else if key.hasPrefix("is_"), let bool = expectedValue as? Bool {
                    XCTAssertEqual(resultDict[key] as? Bool, bool, "\(name): \(key)")
                } else if let number = expectedValue as? Double {
                    let actual = try XCTUnwrap(resultDict[key] as? Double, "\(name): \(key) missing")
                    XCTAssertEqual(actual, number, accuracy: 0.01, "\(name): \(key)")
                } else {
                    XCTFail("\(name): unsupported expected value for \(key)")
                }
            }
        }
    }
}
