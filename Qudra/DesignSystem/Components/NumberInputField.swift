import SwiftUI

/// حقل إدخال رقمي بعنوان ووحدة، يقبل الأرقام العربية واللاتينية.
struct NumberInputField: View {
    let title: String
    @Binding var text: String
    var unit: String?
    var hint: String?
    var allowsDecimal = true

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
            Text(title)
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.textSecondary)
            HStack {
                TextField("0", text: $text)
                    .keyboardType(allowsDecimal ? .decimalPad : .numberPad)
                    .font(.system(.title3, design: .rounded, weight: .semibold))
                    .foregroundStyle(Theme.Colors.textPrimary)
                    .accessibilityLabel(title)
                    .accessibilityHint(hint ?? "")
                if let unit {
                    Text(unit)
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.gold)
                        .accessibilityHidden(true)
                }
            }
            .padding(.horizontal, Theme.Spacing.m)
            .padding(.vertical, 14)
            .background(
                RoundedRectangle(cornerRadius: Theme.Radius.control, style: .continuous)
                    .fill(Theme.Colors.surfaceElevated)
            )
            if let hint {
                Text(hint)
                    .font(.caption2)
                    .foregroundStyle(Theme.Colors.textSecondary.opacity(0.8))
            }
        }
    }
}
