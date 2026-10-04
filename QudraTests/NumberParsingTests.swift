import XCTest
@testable import Qudra

final class NumberParsingTests: XCTestCase {
    func testLatinDigits() {
        XCTAssertEqual(NumberParsing.double(from: "12,500.5"), 12_500.5)
    }

    func testArabicIndicDigits() {
        XCTAssertEqual(NumberParsing.double(from: "١٢٬٥٠٠٫٥"), 12_500.5)
    }

    func testEmptyIsNil() {
        XCTAssertNil(NumberParsing.double(from: ""))
        XCTAssertNil(NumberParsing.int(from: "abc"))
    }
}
