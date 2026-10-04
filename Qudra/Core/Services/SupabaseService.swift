import Foundation
import Supabase

/// نقطة الوصول الوحيدة لعميل Supabase.
/// تكون `client` فارغة عند عدم ضبط المفاتيح، فيعمل التطبيق بوضع محلي تجريبي.
enum SupabaseService {
    static let client: SupabaseClient? = {
        guard let url = AppConfig.supabaseURL, let key = AppConfig.supabaseAnonKey else {
            return nil
        }
        return SupabaseClient(supabaseURL: url, supabaseKey: key)
    }()

    static func requireClient() throws -> SupabaseClient {
        guard let client else { throw QudraError.supabaseNotConfigured }
        return client
    }
}

/// أخطاء التطبيق مع رسائل عربية جاهزة للعرض.
enum QudraError: LocalizedError {
    case supabaseNotConfigured
    case notSignedIn
    case invalidInput(String)
    case underlying(Error)

    var errorDescription: String? {
        switch self {
        case .supabaseNotConfigured:
            return "لم يتم ربط التطبيق بـ Supabase بعد. أضف المفاتيح في Secrets.xcconfig."
        case .notSignedIn:
            return "يجب تسجيل الدخول لاستخدام هذه الميزة."
        case .invalidInput(let message):
            return message
        case .underlying(let error):
            return Self.arabicMessage(for: error)
        }
    }

    static func wrap(_ error: Error) -> QudraError {
        (error as? QudraError) ?? .underlying(error)
    }

    private static func arabicMessage(for error: Error) -> String {
        let text = String(describing: error).lowercased()
        if text.contains("invalid login credentials") {
            return "البريد الإلكتروني أو كلمة المرور غير صحيحة."
        }
        if text.contains("already registered") {
            return "هذا البريد الإلكتروني مسجل مسبقًا."
        }
        if text.contains("email not confirmed") {
            return "يرجى تأكيد بريدك الإلكتروني أولًا."
        }
        if (error as? URLError) != nil {
            return "تعذّر الاتصال بالخادم. تحقق من اتصالك بالإنترنت."
        }
        return "حدث خطأ غير متوقع. حاول مرة أخرى."
    }
}
