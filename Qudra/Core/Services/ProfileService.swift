import Foundation
import Supabase

struct ProfileService {
    /// يُرسل الحقول الفارغة كـ null صراحةً حتى يُمسح الحقل عند تفريغه
    /// (الترميز التلقائي يحذف المفاتيح الفارغة فلا يتغير شيء).
    private struct ProfileUpsert: Encodable {
        let id: UUID
        let fullName: String?
        let phone: String?

        enum CodingKeys: String, CodingKey {
            case id
            case fullName = "full_name"
            case phone
        }

        func encode(to encoder: Encoder) throws {
            var container = encoder.container(keyedBy: CodingKeys.self)
            try container.encode(id, forKey: .id)
            try container.encode(fullName, forKey: .fullName)
            try container.encode(phone, forKey: .phone)
        }
    }

    func fetchProfile(userId: UUID) async throws -> Profile? {
        let client = try SupabaseService.requireClient()
        do {
            let rows: [Profile] = try await client
                .from("profiles")
                .select("id, full_name, phone")
                .eq("id", value: userId.uuidString)
                .limit(1)
                .execute()
                .value
            return rows.first
        } catch {
            throw QudraError.wrap(error)
        }
    }

    func updateProfile(userId: UUID, fullName: String?, phone: String?) async throws {
        let client = try SupabaseService.requireClient()
        do {
            // upsert بدل update: يعمل حتى لو لم يُنشأ صف الملف الشخصي مسبقًا.
            try await client
                .from("profiles")
                .upsert(ProfileUpsert(id: userId, fullName: fullName, phone: phone),
                        onConflict: "id", returning: .minimal)
                .execute()
        } catch {
            throw QudraError.wrap(error)
        }
    }
}
