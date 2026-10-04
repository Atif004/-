import Foundation
import Observation
import Supabase

/// حالة جلسة المستخدم على مستوى التطبيق.
@MainActor
@Observable
final class AppSession {
    enum State: Equatable {
        case loading
        case signedOut
        case guest
        case signedIn(AppUser)
    }

    struct AppUser: Equatable {
        let id: UUID
        let email: String?
    }

    private(set) var state: State = .loading

    /// يصبح `true` عند فتح رابط استعادة كلمة المرور، لعرض شاشة تعيين كلمة جديدة.
    var isRecoveringPassword = false

    var currentUser: AppUser? {
        if case .signedIn(let user) = state { return user }
        return nil
    }

    var isAuthenticated: Bool { currentUser != nil }

    @ObservationIgnored private var listenTask: Task<Void, Never>?

    /// يبدأ الاستماع لتغيّرات جلسة Supabase (بما فيها الجلسة المحفوظة عند فتح التطبيق).
    func start() {
        guard listenTask == nil else { return }
        guard let client = SupabaseService.client else {
            state = .signedOut
            return
        }
        listenTask = Task { [weak self] in
            for await (event, session) in client.auth.authStateChanges {
                guard let self else { return }
                if event == .passwordRecovery {
                    self.isRecoveringPassword = true
                }
                if let user = session?.user {
                    self.state = .signedIn(AppUser(id: user.id, email: user.email))
                } else if self.state != .guest {
                    self.state = .signedOut
                }
            }
        }
    }

    func signIn(email: String, password: String) async throws {
        let client = try SupabaseService.requireClient()
        do {
            _ = try await client.auth.signIn(email: email, password: password)
        } catch {
            throw QudraError.wrap(error)
        }
    }

    /// يعيد `true` إن احتاج المستخدم لتأكيد بريده قبل الدخول.
    func signUp(fullName: String, email: String, password: String) async throws -> Bool {
        let client = try SupabaseService.requireClient()
        do {
            let response = try await client.auth.signUp(
                email: email,
                password: password,
                data: ["full_name": .string(fullName)],
                redirectTo: AppConfig.authRedirectURL
            )
            return response.session == nil
        } catch {
            throw QudraError.wrap(error)
        }
    }

    func sendPasswordReset(email: String) async throws {
        let client = try SupabaseService.requireClient()
        do {
            try await client.auth.resetPasswordForEmail(email, redirectTo: AppConfig.passwordRecoveryRedirectURL)
        } catch {
            throw QudraError.wrap(error)
        }
    }

    func updatePassword(_ newPassword: String) async throws {
        let client = try SupabaseService.requireClient()
        do {
            _ = try await client.auth.update(user: UserAttributes(password: newPassword))
            isRecoveringPassword = false
        } catch {
            throw QudraError.wrap(error)
        }
    }

    /// يعالج روابط البريد (تأكيد الحساب أو استعادة كلمة المرور) القادمة عبر qudra://auth-callback.
    func handle(url: URL) async {
        guard let client = SupabaseService.client,
              url.scheme == AppConfig.authRedirectURL.scheme else { return }
        do {
            _ = try await client.auth.session(from: url)
            // في تدفق PKCE لا يصل حدث passwordRecovery، فنعتمد على مسار الرابط.
            if Self.isPasswordRecoveryURL(url) {
                isRecoveringPassword = true
            }
        } catch {
            // رابط منتهي أو مستخدم مسبقًا: يبقى المستخدم في حالته الحالية.
        }
    }

    nonisolated static func isPasswordRecoveryURL(_ url: URL) -> Bool {
        url.scheme == AppConfig.passwordRecoveryRedirectURL.scheme
            && url.host == AppConfig.passwordRecoveryRedirectURL.host
            && url.path == AppConfig.passwordRecoveryRedirectURL.path
    }

    func signOut() async {
        if let client = SupabaseService.client {
            try? await client.auth.signOut()
        }
        state = .signedOut
    }

    /// يحذف الحساب نهائيًا مع كل بياناته عبر Edge Function `delete-account`.
    func deleteAccount() async throws {
        let client = try SupabaseService.requireClient()
        guard isAuthenticated else { throw QudraError.notSignedIn }
        do {
            try await client.functions.invoke(AppConfig.deleteAccountFunctionName)
        } catch {
            throw QudraError.wrap(error)
        }
        // الجلسة المحلية لم تعد صالحة بعد حذف المستخدم.
        try? await client.auth.signOut(scope: .local)
        state = .signedOut
    }

    func continueAsGuest() {
        state = .guest
    }

    func exitGuestMode() {
        state = .signedOut
    }
}
