import Foundation
import QudraEngine

/// إصدار من قواعد منتج (صف كامل من `calculation_rules`، يراه المدراء فقط).
struct RuleVersion: Codable, Identifiable, Hashable {
    let id: UUID
    let product: FinancingProduct
    let version: Int
    let parameters: FinancingRules
    let isActive: Bool
    let isDemo: Bool
    let notes: String?
    let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case product = "product_type"
        case version
        case parameters
        case isActive = "is_active"
        case isDemo = "is_demo"
        case notes
        case createdAt = "created_at"
    }

    static func == (lhs: Self, rhs: Self) -> Bool { lhs.id == rhs.id && lhs.isActive == rhs.isActive }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}

/// سطر من سجل تدقيق القواعد `rules_audit_log`.
struct RulesAuditEntry: Codable, Identifiable {
    let id: Int
    let product: FinancingProduct
    let action: String
    let version: Int
    let previousVersion: Int?
    let isDemo: Bool
    let notes: String?
    let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case product = "product_type"
        case action
        case version
        case previousVersion = "previous_version"
        case isDemo = "is_demo"
        case notes
        case createdAt = "created_at"
    }

    var arabicDescription: String {
        let from = previousVersion.map { " (بدلًا من \($0))" } ?? ""
        switch action {
        case "publish": return "نشر الإصدار \(version)\(from)"
        case "activate": return "الرجوع إلى الإصدار \(version)\(from)"
        default: return "\(action) — الإصدار \(version)"
        }
    }
}
