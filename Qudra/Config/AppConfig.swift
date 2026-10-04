import Foundation

/// إعدادات التطبيق المقروءة من Info.plist (والتي تأتي بدورها من ملفات xcconfig).
enum AppConfig {
    static let supabaseURL: URL? = {
        guard let raw = value(for: "SUPABASE_URL") else { return nil }
        return URL(string: raw)
    }()

    static let supabaseAnonKey: String? = value(for: "SUPABASE_ANON_KEY")

    /// `true` عند ضبط مفاتيح Supabase. إن لم تُضبط يعمل التطبيق محليًا بقيم تجريبية.
    static var isSupabaseConfigured: Bool {
        supabaseURL != nil && supabaseAnonKey != nil
    }

    /// بريد الدعم (اختياري). يُضبط عبر QUDRA_SUPPORT_EMAIL في xcconfig.
    static let supportEmail: String? = {
        guard let email = value(for: "QUDRA_SUPPORT_EMAIL"), email.contains("@"),
              !email.hasSuffix("@example.com") else { return nil }
        return email
    }()

    static var appVersion: String {
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "—"
        let build = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "—"
        return "\(version) (\(build))"
    }

    /// رمز العملة المعروض. قابل للتغيير لاحقًا.
    static let currencyCode = "SAR"

    /// اسم الـ Edge Function المسؤولة عن الحساب والحفظ على الخادم.
    static let calculateFunctionName = "calculate-capacity"
    static let deleteAccountFunctionName = "delete-account"

    /// رابط العودة من رسائل البريد (تأكيد الحساب واستعادة كلمة المرور).
    /// يجب إضافته في Supabase: Authentication → URL Configuration → Redirect URLs.
    static let authRedirectURL = URL(string: "qudra://auth-callback")!

    /// المدة التي تُعتبر بعدها القواعد المحلية قديمة ويُعاد جلبها عند العودة للتطبيق.
    static let rulesRefreshInterval: TimeInterval = 15 * 60

    private static func value(for key: String) -> String? {
        guard let value = Bundle.main.object(forInfoDictionaryKey: key) as? String else { return nil }
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        // قيمة فارغة أو متغير غير مُستبدل تعني أن الإعداد غير موجود.
        guard !trimmed.isEmpty, !trimmed.hasPrefix("$("), !trimmed.contains("YOUR-") else { return nil }
        return trimmed
    }
}
