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

final class AuthRedirectTests: XCTestCase {
    func testRecoveryURLDetection() {
        XCTAssertTrue(AppSession.isPasswordRecoveryURL(URL(string: "qudra://auth-callback/recovery?code=abc")!))
        XCTAssertFalse(AppSession.isPasswordRecoveryURL(URL(string: "qudra://auth-callback?code=abc")!))
        XCTAssertFalse(AppSession.isPasswordRecoveryURL(URL(string: "https://auth-callback/recovery")!))
    }
}
