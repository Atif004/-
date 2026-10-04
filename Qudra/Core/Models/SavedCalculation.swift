import Foundation
import QudraEngine

/// سجل حساب محفوظ في جدول `calculations`.
struct SavedCalculation: Codable, Identifiable, Hashable {
    let id: UUID
    let product: FinancingProduct
    let input: CalculationInput
    let result: CalculationResult
    let rulesVersion: Int
    let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case product = "product_type"
        case input
        case result
        case rulesVersion = "rules_version"
        case createdAt = "created_at"
    }

    static func == (lhs: Self, rhs: Self) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}
