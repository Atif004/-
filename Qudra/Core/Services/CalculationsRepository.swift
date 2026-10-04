import Foundation
import QudraEngine
import Supabase

/// طبقة الوصول لسجل الحسابات و الـ Edge Function.
struct CalculationsRepository {
    private struct CalculateRequest: Encodable {
        let input: CalculationInput
        let save: Bool
    }

    struct CalculateResponse: Decodable {
        let result: CalculationResult
        let savedId: UUID?

        enum CodingKeys: String, CodingKey {
            case result
            case savedId = "saved_id"
        }
    }

    /// يرسل المدخلات إلى الـ Edge Function التي تعيد الحساب بالقواعد المعتمدة على الخادم
    /// وتحفظه في سجل المستخدم. النتيجة المعادة هي المرجع النهائي.
    func calculateAndSave(_ input: CalculationInput) async throws -> CalculateResponse {
        let client = try SupabaseService.requireClient()
        do {
            return try await client.functions.invoke(
                AppConfig.calculateFunctionName,
                options: FunctionInvokeOptions(body: CalculateRequest(input: input, save: true))
            )
        } catch {
            throw QudraError.wrap(error)
        }
    }

    func fetchHistory() async throws -> [SavedCalculation] {
        let client = try SupabaseService.requireClient()
        do {
            return try await client
                .from("calculations")
                .select("id, product_type, input, result, rules_version, created_at")
                .order("created_at", ascending: false)
                .limit(100)
                .execute()
                .value
        } catch {
            throw QudraError.wrap(error)
        }
    }

    func delete(id: UUID) async throws {
        let client = try SupabaseService.requireClient()
        do {
            try await client.from("calculations").delete().eq("id", value: id.uuidString).execute()
        } catch {
            throw QudraError.wrap(error)
        }
    }
}
