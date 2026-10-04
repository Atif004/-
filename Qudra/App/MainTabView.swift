import SwiftUI

enum AppRoute: Hashable {
    case personalCalculator
    case mortgageCalculator
    case comparison
}

struct MainTabView: View {
    var body: some View {
        TabView {
            NavigationStack {
                HomeView()
                    .navigationDestination(for: AppRoute.self) { route in
                        switch route {
                        case .personalCalculator: PersonalFinanceCalculatorView()
                        case .mortgageCalculator: MortgageFinanceCalculatorView()
                        case .comparison: ComparisonBuilderView()
                        }
                    }
            }
            .tabItem { Label("الرئيسية", systemImage: "house.fill") }

            NavigationStack { HistoryView() }
                .tabItem { Label("النتائج السابقة", systemImage: "clock.arrow.circlepath") }

            NavigationStack { ProfileView() }
                .tabItem { Label("حسابي", systemImage: "person.crop.circle") }
        }
    }
}
