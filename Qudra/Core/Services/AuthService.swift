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
            for await (_, session) in client.auth.authStateChanges {
                guard let self else { return }
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
                data: ["full_name": .string(fullName)]
            )
            return response.session == nil
        } catch {
            throw QudraError.wrap(error)
        }
    }

    func signOut() async {
        if let client = SupabaseService.client {
            try? await client.auth.signOut()
        }
        state = .signedOut
    }

    func continueAsGuest() {
        state = .guest
    }

    func exitGuestMode() {
        state = .signedOut
    }
}
