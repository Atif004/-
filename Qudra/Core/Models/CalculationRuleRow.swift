import Foundation
import QudraEngine

/// صف من جدول `calculation_rules`.
struct CalculationRuleRow: Codable {
    let product: FinancingProduct
    let version: Int
    let isDemo: Bool
    let parameters: FinancingRules

    enum CodingKeys: String, CodingKey {
        case product = "product_type"
        case version
        case isDemo = "is_demo"
        case parameters
    }
}
