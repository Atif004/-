import SwiftUI

struct PrimaryButton: View {
    let title: String
    var systemImage: String?
    var isLoading = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Theme.Spacing.s) {
                if isLoading {
                    ProgressView().tint(Theme.Colors.background)
                } else {
                    if let systemImage { Image(systemName: systemImage) }
                    Text(title).font(Theme.Fonts.headline)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .foregroundStyle(Theme.Colors.background)
            .background(
                RoundedRectangle(cornerRadius: Theme.Radius.control, style: .continuous)
                    .fill(Theme.Colors.goldGradient)
            )
        }
        .buttonStyle(.plain)
        .disabled(isLoading)
    }
}

struct SecondaryButton: View {
    let title: String
    var systemImage: String?
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Theme.Spacing.s) {
                if let systemImage { Image(systemName: systemImage) }
                Text(title).font(Theme.Fonts.headline)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .foregroundStyle(Theme.Colors.gold)
            .background(
                RoundedRectangle(cornerRadius: Theme.Radius.control, style: .continuous)
                    .stroke(Theme.Colors.gold.opacity(0.6), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}
