import Foundation

/// نوع منتج التمويل. القيم الخام تطابق عمود `product_type` في قاعدة البيانات.
public enum FinancingProduct: String, Codable, CaseIterable, Sendable, Identifiable {
    case personal
    case mortgage

    public var id: String { rawValue }

    public var arabicTitle: String {
        switch self {
        case .personal: return "التمويل الشخصي"
        case .mortgage: return "التمويل العقاري"
        }
    }
}

/// طريقة احتساب الربح. الاختيار بينهما يأتي من قواعد الـ Cloud وليس من التطبيق.
public enum RateMethod: String, Codable, Sendable {
    /// رصيد متناقص (قسط ثابت وفق معادلة الدفعات).
    case reducing
    /// نسبة ثابتة على أصل المبلغ طوال المدة.
    case flat
}
