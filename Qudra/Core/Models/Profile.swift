import Foundation

/// الملف الشخصي في جدول `profiles`.
struct Profile: Codable, Equatable {
    let id: UUID
    var fullName: String?
    var phone: String?

    enum CodingKeys: String, CodingKey {
        case id
        case fullName = "full_name"
        case phone
    }
}
