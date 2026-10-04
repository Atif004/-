import Foundation
import QudraEngine
import Supabase

/// عمليات إدارة القواعد. الصلاحية الفعلية تُفرض على الخادم (RLS + دوال security definer)؛
/// إخفاء الواجهة عن غير المدراء لتحسين التجربة فقط.
struct AdminService {
    private struct AdminRow: Decodable {
        let userId: UUID
        enum CodingKeys: String, CodingKey { case userId = "user_id" }
    }

    private struct PublishParams: Encodable {
        let productType: FinancingProduct
        let parameters: FinancingRules
        let isDemo: Bool
        let notes: String?

        enum CodingKeys: String, CodingKey {
            case productType = "p_product_type"
            case parameters = "p_parameters"
            case isDemo = "p_is_demo"
            case notes = "p_notes"
        }
    }

    private struct ActivateParams: Encodable {
        let productType: FinancingProduct
        let version: Int

        enum CodingKeys: String, CodingKey {
            case productType = "p_product_type"
            case version = "p_version"
        }
    }

    private static let versionColumns = "id, product_type, version, parameters, is_active, is_demo, notes, created_at"

    func isAdmin(userId: UUID) async -> Bool {
        guard let client = SupabaseService.client else { return false }
        let rows: [AdminRow]? = try? await client
            .from("app_admins")
            .select("user_id")
            .eq("user_id", value: userId.uuidString)
            .limit(1)
            .execute()
            .value
        return !(rows ?? []).isEmpty
    }

    func fetchVersions(product: FinancingProduct) async throws -> [RuleVersion] {
        let client = try SupabaseService.requireClient()
        do {
            return try await client
                .from("calculation_rules")
                .select(Self.versionColumns)
                .eq("product_type", value: product.rawValue)
                .order("version", ascending: false)
                .execute()
                .value
        } catch {
            throw QudraError.wrap(error)
        }
    }

    func fetchAuditLog(limit: Int = 30) async throws -> [RulesAuditEntry] {
        let client = try SupabaseService.requireClient()
        do {
            return try await client
                .from("rules_audit_log")
                .select("id, product_type, action, version, previous_version, is_demo, notes, created_at")
                .order("created_at", ascending: false)
                .limit(limit)
                .execute()
                .value
        } catch {
            throw QudraError.wrap(error)
        }
    }

    @discardableResult
    func publish(product: FinancingProduct, parameters: FinancingRules, isDemo: Bool,
                 notes: String?) async throws -> RuleVersion {
        let client = try SupabaseService.requireClient()
        do {
            return try await client
                .rpc("publish_calculation_rules",
                     params: PublishParams(productType: product, parameters: parameters,
                                           isDemo: isDemo, notes: notes))
                .select(Self.versionColumns)
                .single()
                .execute()
                .value
        } catch {
            throw Self.mapError(error)
        }
    }

    @discardableResult
    func activate(product: FinancingProduct, version: Int) async throws -> RuleVersion {
        let client = try SupabaseService.requireClient()
        do {
            return try await client
                .rpc("activate_calculation_rules_version",
                     params: ActivateParams(productType: product, version: version))
                .select(Self.versionColumns)
                .single()
                .execute()
                .value
        } catch {
            throw Self.mapError(error)
        }
    }

    /// يحوّل أخطاء دوال الخادم إلى رسائل عربية واضحة.
    private static func mapError(_ error: Error) -> QudraError {
        let text = (error as? PostgrestError)?.message ?? String(describing: error)
        let issues = RuleValidationIssue.parseServerMessage(text)
        if !issues.isEmpty {
            return .invalidInput(issues.map(\.message).joined(separator: "\n"))
        }
        if text.contains("not_authorized") {
            return .invalidInput("ليست لديك صلاحية إدارة القواعد.")
        }
        if text.contains("version_not_found") {
            return .invalidInput("الإصدار المطلوب غير موجود.")
        }
        return QudraError.wrap(error)
    }
}
