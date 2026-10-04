import XCTest
@testable import Qudra

final class SimpleMarkdownTests: XCTestCase {
    func testParsesBlocks() {
        let text = """
        # العنوان

        > تنبيه

        فقرة أولى
        تكملة الفقرة

        ## قسم
        - بند **مهم**
        - بند ثانٍ
        """
        XCTAssertEqual(SimpleMarkdown.parse(text), [
            .title("العنوان"),
            .quote("تنبيه"),
            .paragraph("فقرة أولى تكملة الفقرة"),
            .heading("قسم"),
            .bullet("بند **مهم**"),
            .bullet("بند ثانٍ")
        ])
    }

    func testInlineBoldIsParsed() {
        let attributed = SimpleMarkdown.inline("نص **عريض**")
        XCTAssertEqual(String(attributed.characters), "نص عريض")
    }
}

final class LegalDocumentTests: XCTestCase {
    /// المستندات مضمّنة في حزمة التطبيق وتبدأ بعنوانها.
    func testDocumentsAreBundled() {
        for document in LegalDocument.allCases {
            let blocks = SimpleMarkdown.parse(document.markdown)
            XCTAssertEqual(blocks.first, .title(document.title), document.rawValue)
            XCTAssertGreaterThan(blocks.count, 5, document.rawValue)
        }
    }
}
