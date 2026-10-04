import SwiftUI

/// معلومات التطبيق والمستندات القانونية والتواصل.
struct AboutView: View {
    @Environment(\.openURL) private var openURL

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Spacing.l) {
                VStack(spacing: Theme.Spacing.s) {
                    BrandMark(size: 56)
                    Text("الإصدار \(AppConfig.appVersion)")
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.textSecondary)
                }
                .frame(maxWidth: .infinity)
                .padding(.top, Theme.Spacing.m)

                QudraCard {
                    Text("تنبيه مهم")
                        .font(Theme.Fonts.headline)
                        .foregroundStyle(Theme.Colors.textPrimary)
                    Text("«قُدرة» أداة تقديرية للتخطيط المالي. لا يقدّم التطبيق تمويلًا ولا يمثّل أي جهة تمويلية، والنتائج ليست عرضًا ولا موافقة.")
                        .font(Theme.Fonts.body)
                        .foregroundStyle(Theme.Colors.textSecondary)
                }

                QudraCard {
                    ForEach(LegalDocument.allCases) { document in
                        NavigationLink {
                            LegalDocumentView(document: document)
                        } label: {
                            linkRow(title: document.title, systemImage: "doc.text")
                        }
                        .buttonStyle(.plain)
                    }
                    if let email = AppConfig.supportEmail,
                       let url = URL(string: "mailto:\(email)") {
                        Button {
                            openURL(url)
                        } label: {
                            linkRow(title: "تواصل معنا", systemImage: "envelope", detail: email)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding(Theme.Spacing.m)
        }
        .qudraBackground()
        .navigationTitle("حول التطبيق")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func linkRow(title: String, systemImage: String, detail: String? = nil) -> some View {
        HStack {
            Image(systemName: systemImage)
                .foregroundStyle(Theme.Colors.gold)
                .frame(width: 24)
                .accessibilityHidden(true)
            Text(title)
                .font(Theme.Fonts.body)
                .foregroundStyle(Theme.Colors.textPrimary)
            Spacer()
            if let detail {
                Text(detail)
                    .font(.caption)
                    .foregroundStyle(Theme.Colors.textSecondary)
            }
            Image(systemName: "chevron.forward")
                .font(.caption)
                .foregroundStyle(Theme.Colors.textSecondary)
                .accessibilityHidden(true)
        }
        .padding(.vertical, 8)
        .contentShape(Rectangle())
    }
}
