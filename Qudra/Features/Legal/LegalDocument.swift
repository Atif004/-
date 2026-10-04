import Foundation

/// المستندات القانونية المضمّنة في التطبيق (Resources/Legal/*.md).
/// نفس الملفات تُحوَّل إلى صفحات ويب عبر scripts/build_legal_pages.py.
enum LegalDocument: String, Identifiable, CaseIterable {
    case privacyPolicy = "privacy_policy"
    case termsOfUse = "terms_of_use"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .privacyPolicy: return "سياسة الخصوصية"
        case .termsOfUse: return "شروط الاستخدام"
        }
    }

    var markdown: String {
        guard let url = Bundle.main.url(forResource: rawValue, withExtension: "md"),
              let text = try? String(contentsOf: url, encoding: .utf8) else {
            return "# \(title)\n\nتعذّر تحميل المستند."
        }
        return text
    }
}

/// نسخة الشروط الحالية. رفعها يُظهر شاشة الموافقة مجددًا لكل المستخدمين.
enum LegalInfo {
    static let currentTermsVersion = 1
    static let acceptedTermsVersionKey = "qudra.acceptedTermsVersion"
}

/// محلل Markdown مبسّط يكفي للمستندات القانونية:
/// عناوين (#، ##)، قوائم (-)، اقتباس (>)، وفقرات، مع تنسيق داخلي (عريض/روابط).
enum SimpleMarkdown {
    enum Block: Equatable {
        case title(String)
        case heading(String)
        case bullet(String)
        case quote(String)
        case paragraph(String)
    }

    static func parse(_ text: String) -> [Block] {
        var blocks: [Block] = []
        var paragraph: [String] = []

        func flush() {
            if !paragraph.isEmpty {
                blocks.append(.paragraph(paragraph.joined(separator: " ")))
                paragraph.removeAll()
            }
        }

        for rawLine in text.components(separatedBy: .newlines) {
            let line = rawLine.trimmingCharacters(in: .whitespaces)
            if line.isEmpty {
                flush()
            } else if line.hasPrefix("## ") {
                flush(); blocks.append(.heading(String(line.dropFirst(3))))
            } else if line.hasPrefix("# ") {
                flush(); blocks.append(.title(String(line.dropFirst(2))))
            } else if line.hasPrefix("- ") {
                flush(); blocks.append(.bullet(String(line.dropFirst(2))))
            } else if line.hasPrefix("> ") {
                flush(); blocks.append(.quote(String(line.dropFirst(2))))
            } else {
                paragraph.append(line)
            }
        }
        flush()
        return blocks
    }

    /// تنسيق داخلي (عريض، روابط) عبر محلل Markdown في النظام.
    static func inline(_ text: String) -> AttributedString {
        (try? AttributedString(markdown: text,
                               options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace)))
            ?? AttributedString(text)
    }
}
