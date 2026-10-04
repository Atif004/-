import Foundation
import Supabase

struct ProfileService {
    private struct ProfileUpdate: Encodable {
        let fullName: String?
        let phone: String?

        enum CodingKeys: String, CodingKey {
            case fullName = "full_name"
            case phone
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
            try await client
                .from("profiles")
                .update(ProfileUpdate(fullName: fullName, phone: phone))
                .eq("id", value: userId.uuidString)
                .execute()
        } catch {
            throw QudraError.wrap(error)
        }
    }
}
