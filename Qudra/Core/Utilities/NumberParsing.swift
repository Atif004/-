import Foundation

/// تحويل نص إدخال المستخدم إلى رقم، مع دعم الأرقام العربية-الهندية (٠-٩) والفواصل.
enum NumberParsing {
    private static let arabicIndicDigits: [Character: Character] = [
        "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
        "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
        "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
        "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9"
    ]

    static func double(from text: String) -> Double? {
        var normalized = ""
        for char in text {
            if let latin = arabicIndicDigits[char] {
                normalized.append(latin)
            } else if char == "٫" || char == "." {
                normalized.append(".")
            } else if char.isASCII && char.isNumber {
                normalized.append(char)
            }
            // تجاهل فواصل الآلاف (، , ٬) والمسافات وأي رموز أخرى.
        }
        guard !normalized.isEmpty else { return nil }
        return Double(normalized)
    }

    static func int(from text: String) -> Int? {
        double(from: text).map { Int($0) }
    }
}
