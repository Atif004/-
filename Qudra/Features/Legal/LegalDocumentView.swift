import SwiftUI

struct LegalDocumentView: View {
    let document: LegalDocument

    private var blocks: [SimpleMarkdown.Block] { SimpleMarkdown.parse(document.markdown) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Spacing.m) {
                ForEach(Array(blocks.enumerated()), id: \.offset) { _, block in
                    view(for: block)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(Theme.Spacing.m)
        }
        .qudraBackground()
        .navigationTitle(document.title)
        .navigationBarTitleDisplayMode(.inline)
    }

    @ViewBuilder
    private func view(for block: SimpleMarkdown.Block) -> some View {
        switch block {
        case .title(let text):
            Text(text)
                .font(Theme.Fonts.display)
                .foregroundStyle(Theme.Colors.textPrimary)
                .accessibilityAddTraits(.isHeader)
        case .heading(let text):
            Text(text)
                .font(Theme.Fonts.headline)
                .foregroundStyle(Theme.Colors.gold)
                .padding(.top, Theme.Spacing.s)
                .accessibilityAddTraits(.isHeader)
        case .bullet(let text):
            HStack(alignment: .firstTextBaseline, spacing: Theme.Spacing.s) {
                Circle()
                    .fill(Theme.Colors.gold)
                    .frame(width: 5, height: 5)
                    .accessibilityHidden(true)
                Text(SimpleMarkdown.inline(text))
                    .font(Theme.Fonts.body)
                    .foregroundStyle(Theme.Colors.textPrimary)
            }
        case .quote(let text):
            Text(SimpleMarkdown.inline(text))
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.textPrimary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(Theme.Spacing.m)
                .background(
                    RoundedRectangle(cornerRadius: Theme.Radius.control, style: .continuous)
                        .fill(Theme.Colors.warning.opacity(0.12))
                )
        case .paragraph(let text):
            Text(SimpleMarkdown.inline(text))
                .font(Theme.Fonts.body)
                .foregroundStyle(Theme.Colors.textSecondary)
        }
    }
}
