import Foundation

enum Formatters {
    /// لغة عربية مع أرقام لاتينية لوضوح المبالغ المالية.
    static let locale = Locale(identifier: "ar@numbers=latn")

    static func currency(_ value: Double) -> String {
        value.formatted(.currency(code: AppConfig.currencyCode)
            .locale(locale)
            .precision(.fractionLength(0)))
    }

    static func number(_ value: Double) -> String {
        value.formatted(.number.locale(locale).precision(.fractionLength(0)))
    }

    static func percent(_ value: Double) -> String {
        value.formatted(.percent.locale(locale).precision(.fractionLength(0...2)))
    }

    static func months(_ months: Int) -> String {
        let years = months / 12
        let rest = months % 12
        switch (years, rest) {
        case (0, _): return "\(months) شهر"
        case (_, 0): return "\(years) سنة (\(months) شهر)"
        default: return "\(years) سنة و\(rest) شهر"
        }
    }

    /// صيغة مختصرة للجداول الضيقة: "5 سنة" أو "18 شهر".
    static func months(compact months: Int) -> String {
        if months > 0, months % 12 == 0 { return "\(months / 12) سنة" }
        return "\(months) شهر"
    }

    static func shortDate(_ date: Date) -> String {
        date.formatted(.dateTime.day().month(.abbreviated).year(.twoDigits).locale(locale))
    }

    static func date(_ date: Date) -> String {
        date.formatted(.dateTime.day().month(.wide).year().hour().minute().locale(locale))
    }
}
