import SwiftUI

/// شاشات الترحيب + إخلاء المسؤولية والموافقة على الشروط.
/// تظهر عند أول تشغيل، ومجددًا عند رفع `LegalInfo.currentTermsVersion`.
struct OnboardingView: View {
    let onAccept: () -> Void

    @State private var page = 0
    @State private var hasAcknowledged = false
    @State private var shownDocument: LegalDocument?

    private struct Page {
        let systemImage: String
        let title: String
        let message: String
    }

    private let pages = [
        Page(systemImage: "gauge.with.dots.needle.67percent",
             title: "اعرف قدرتك التمويلية",
             message: "احسب تقديريًا أقصى مبلغ تمويل وقسط شهري يناسب دخلك، للتمويل الشخصي والعقاري."),
        Page(systemImage: "rectangle.split.3x1",
             title: "قارن قبل أن تقرر",
             message: "قارن بين مدد ودفعات أولى مختلفة جنبًا إلى جنب، واحفظ نتائجك للرجوع إليها."),
        Page(systemImage: "lock.shield",
             title: "بياناتك لك",
             message: "الحسابات تتم على جهازك، ولا يُحفظ شيء على الخادم إلا عندما تختار حفظ النتيجة.")
    ]

    private var isLastPage: Bool { page == pages.count }

    init(onAccept: @escaping () -> Void) {
        self.onAccept = onAccept
    }

    var body: some View {
        VStack(spacing: Theme.Spacing.l) {
            BrandMark(size: 44)
                .padding(.top, Theme.Spacing.xl)

            TabView(selection: $page) {
                ForEach(pages.indices, id: \.self) { index in
                    featurePage(pages[index]).tag(index)
                }
                disclaimerPage.tag(pages.count)
            }
            .tabViewStyle(.page(indexDisplayMode: .always))
            .indexViewStyle(.page(backgroundDisplayMode: .interactive))

            Group {
                if isLastPage {
                    PrimaryButton(title: "ابدأ", systemImage: "checkmark") { onAccept() }
                        .disabled(!hasAcknowledged)
                        .opacity(hasAcknowledged ? 1 : 0.5)
                } else {
                    PrimaryButton(title: "التالي") {
                        withAnimation { page += 1 }
                    }
                }
            }
            .padding(.horizontal, Theme.Spacing.m)
            .padding(.bottom, Theme.Spacing.l)
        }
        .qudraBackground()
        .sheet(item: $shownDocument) { document in
            NavigationStack {
                LegalDocumentView(document: document)
                    .toolbar {
                        ToolbarItem(placement: .confirmationAction) {
                            Button("تم") { shownDocument = nil }
                        }
                    }
            }
            .environment(\.layoutDirection, .rightToLeft)
        }
    }

    private func featurePage(_ page: Page) -> some View {
        VStack(spacing: Theme.Spacing.l) {
            Spacer()
            ZStack {
                Circle()
                    .fill(Theme.Colors.gold.opacity(0.12))
                    .frame(width: 140, height: 140)
                Image(systemName: page.systemImage)
                    .font(.system(size: 56))
                    .foregroundStyle(Theme.Colors.goldGradient)
            }
            .accessibilityHidden(true)
            Text(page.title)
                .font(Theme.Fonts.title)
                .foregroundStyle(Theme.Colors.textPrimary)
                .multilineTextAlignment(.center)
            Text(page.message)
                .font(Theme.Fonts.body)
                .foregroundStyle(Theme.Colors.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, Theme.Spacing.l)
            Spacer()
            Spacer()
        }
        .accessibilityElement(children: .combine)
    }

    private var disclaimerPage: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Spacing.m) {
                Text("قبل أن تبدأ")
                    .font(Theme.Fonts.title)
                    .foregroundStyle(Theme.Colors.textPrimary)
                    .accessibilityAddTraits(.isHeader)
                QudraCard {
                    disclaimerPoint("النتائج تقديرية لأغراض التخطيط فقط.")
                    disclaimerPoint("التطبيق لا يقدّم تمويلًا ولا يمثّل أي جهة تمويلية.")
                    disclaimerPoint("النتائج ليست عرضًا ولا موافقة، والقرار النهائي للجهة المموّلة.")
                    disclaimerPoint("قد تُستخدم قيم تجريبية أثناء التطوير، ويظهر تنبيه عند ذلك.")
                }
                Toggle(isOn: $hasAcknowledged) {
                    Text("قرأت ما سبق وأوافق على شروط الاستخدام وسياسة الخصوصية")
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.textPrimary)
                }
                .tint(Theme.Colors.gold)
                HStack(spacing: Theme.Spacing.m) {
                    Button(LegalDocument.termsOfUse.title) { shownDocument = .termsOfUse }
                    Button(LegalDocument.privacyPolicy.title) { shownDocument = .privacyPolicy }
                }
                .font(Theme.Fonts.caption.weight(.semibold))
                .foregroundStyle(Theme.Colors.gold)
            }
            .padding(Theme.Spacing.m)
        }
    }

    private func disclaimerPoint(_ text: String) -> some View {
        Label {
            Text(text)
                .font(Theme.Fonts.body)
                .foregroundStyle(Theme.Colors.textPrimary)
        } icon: {
            Image(systemName: "info.circle")
                .foregroundStyle(Theme.Colors.gold)
        }
        .padding(.vertical, 2)
    }
}
