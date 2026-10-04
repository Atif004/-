import SwiftUI

/// يحدد الشاشة الجذرية حسب حالة الجلسة.
struct RootView: View {
    @Environment(AppSession.self) private var session

    var body: some View {
        @Bindable var session = session
        Group {
            switch session.state {
            case .loading:
                SplashView()
            case .signedOut:
                AuthView()
            case .guest, .signedIn:
                MainTabView()
            }
        }
        .animation(.easeInOut(duration: 0.25), value: session.state)
        .sheet(isPresented: $session.isRecoveringPassword) {
            NewPasswordView()
        }
    }
}

private struct SplashView: View {
    var body: some View {
        VStack(spacing: Theme.Spacing.m) {
            BrandMark(size: 72)
            ProgressView().tint(Theme.Colors.gold)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .qudraBackground()
    }
}

/// شعار نصي للتطبيق.
struct BrandMark: View {
    var size: CGFloat = 48

    var body: some View {
        VStack(spacing: 2) {
            Text("قُدرة")
                .font(.system(size: size, weight: .heavy))
                .foregroundStyle(Theme.Colors.goldGradient)
            Text("QUDRA")
                .font(.system(size: size * 0.22, weight: .semibold, design: .rounded))
                .tracking(size * 0.08)
                .foregroundStyle(Theme.Colors.textSecondary)
        }
    }
}
