import SwiftUI

/// شريط يوضح توزيع إجمالي السداد بين أصل التمويل والربح.
struct BreakdownBar: View {
    /// نسبة الأصل (0...1).
    let principalShare: Double
    let principalLabel: String
    let profitLabel: String

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s) {
            GeometryReader { proxy in
                HStack(spacing: 2) {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Theme.Colors.goldGradient)
                        .frame(width: max(0, proxy.size.width * principalShare - 1))
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Theme.Colors.textSecondary.opacity(0.35))
                }
            }
            .frame(height: 10)
            .accessibilityHidden(true)

            HStack {
                legend(color: Theme.Colors.gold, title: "أصل التمويل", value: principalLabel)
                Spacer()
                legend(color: Theme.Colors.textSecondary.opacity(0.6), title: "الربح", value: profitLabel)
            }
        }
        .accessibilityElement(children: .combine)
    }

    private func legend(color: Color, title: String, value: String) -> some View {
        HStack(spacing: 6) {
            Circle().fill(color).frame(width: 8, height: 8)
            VStack(alignment: .leading, spacing: 0) {
                Text(title)
                    .font(.caption2)
                    .foregroundStyle(Theme.Colors.textSecondary)
                Text(value)
                    .font(.system(.footnote, design: .rounded, weight: .semibold))
                    .foregroundStyle(Theme.Colors.textPrimary)
            }
        }
    }
}
