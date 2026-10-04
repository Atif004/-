import SwiftUI

@main
struct QudraApp: App {
    @State private var session = AppSession()
    @State private var rules = RulesStore()

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
        }
    }
}
