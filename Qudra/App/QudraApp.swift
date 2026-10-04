import SwiftUI

@main
struct QudraApp: App {
    @State private var session = AppSession()
    @State private var rules = RulesStore()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(session)
                .environment(rules)
                // التطبيق عربي بالكامل ويعرض من اليمين لليسار.
                .environment(\.layoutDirection, .rightToLeft)
                .environment(\.locale, Formatters.locale)
                .preferredColorScheme(.dark)
                .tint(Theme.Colors.gold)
                .task {
                    session.start()
                    await rules.refresh()
                }
                // روابط البريد: تأكيد الحساب واستعادة كلمة المرور.
                .onOpenURL { url in
                    Task { await session.handle(url: url) }
                }
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active {
                Task { await rules.refreshIfStale() }
            }
        }
    }
}
