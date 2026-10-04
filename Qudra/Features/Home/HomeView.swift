import SwiftUI

struct HomeView: View {
    @Environment(AppSession.self) private var session
    @Environment(RulesStore.self) private var rules

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Spacing.l) {
                header

                if rules.ruleSet.isDemo {
                    DemoRulesBanner()
                }

                VStack(spacing: Theme.Spacing.m) {
                    NavigationLink(value: AppRoute.personalCalculator) {
                        ProductCard(
                            title: "التمويل الشخصي",
                            subtitle: "اعرف أقصى مبلغ تمويل وقسط شهري تقديري",
                            systemImage: "person.text.rectangle"
                        )
                    }
                    NavigationLink(value: AppRoute.mortgageCalculator) {
                        ProductCard(
                            title: "التمويل العقاري",
                            subtitle: "قدّر قيمة العقار التي يمكنك تملّكها",
                            systemImage: "building.2"
                        )
                    }
                    NavigationLink(value: AppRoute.comparison) {
                        ProductCard(
                            title: "مقارنة السيناريوهات",
                            subtitle: "قارن بين مدد ودفعات مختلفة جنبًا إلى جنب",
                            systemImage: "rectangle.split.3x1"
                        )
                    }
                }
                .buttonStyle(.plain)

                disclaimer
            }
            .padding(Theme.Spacing.m)
        }
        .qudraBackground()
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) { BrandMark(size: 22) }
        }
        .refreshable { await rules.refresh() }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
            Text(greeting)
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.textSecondary)
            Text("احسب قدرتك التمويلية")
                .font(Theme.Fonts.display)
                .foregroundStyle(Theme.Colors.textPrimary)
            Text("تقدير سريع وواضح قبل اتخاذ قرارك المالي.")
                .font(Theme.Fonts.body)
                .foregroundStyle(Theme.Colors.textSecondary)
        }
        .padding(.top, Theme.Spacing.m)
    }

    private var greeting: String {
        if let email = session.currentUser?.email {
            return "مرحبًا، \(email)"
        }
        return "مرحبًا بك"
    }

    private var disclaimer: some View {
        Text("النتائج تقديرية لأغراض التخطيط فقط ولا تُعد عرضًا تمويليًا أو موافقة من أي جهة.")
            .font(.caption2)
            .foregroundStyle(Theme.Colors.textSecondary)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct ProductCard: View {
    let title: String
    let subtitle: String
    let systemImage: String

    var body: some View {
        QudraCard(padding: Theme.Spacing.l) {
            HStack(spacing: Theme.Spacing.m) {
                ZStack {
                    Circle()
                        .fill(Theme.Colors.gold.opacity(0.15))
                        .frame(width: 56, height: 56)
                    Image(systemName: systemImage)
                        .font(.title2)
                        .foregroundStyle(Theme.Colors.gold)
                }
                VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
                    Text(title)
                        .font(Theme.Fonts.title)
                        .foregroundStyle(Theme.Colors.textPrimary)
                    Text(subtitle)
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.textSecondary)
                }
                Spacer()
                // السهم يتبع اتجاه RTL تلقائيًا.
                Image(systemName: "chevron.forward")
                    .foregroundStyle(Theme.Colors.textSecondary)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isButton)
    }
}
