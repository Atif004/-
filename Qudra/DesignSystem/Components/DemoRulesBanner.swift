import SwiftUI

/// تنبيه يظهر عندما تكون قواعد الحساب تجريبية.
struct DemoRulesBanner: View {
    var body: some View {
        HStack(alignment: .top, spacing: Theme.Spacing.s) {
            Image(systemName: "flask.fill")
                .foregroundStyle(Theme.Colors.warning)
            Text("تُستخدم حاليًا قيم تجريبية للتطوير فقط، والنتائج غير معتمدة.")
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.textPrimary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Theme.Spacing.m)
        .background(
            RoundedRectangle(cornerRadius: Theme.Radius.control, style: .continuous)
                .fill(Theme.Colors.warning.opacity(0.12))
        )
    }
}

/// سطر معلومة (عنوان + قيمة) داخل البطاقات.
struct InfoRow: View {
    let title: String
    let value: String
    var emphasized = false

    var body: some View {
        HStack {
            Text(title)
                .font(Theme.Fonts.body)
                .foregroundStyle(Theme.Colors.textSecondary)
            Spacer()
            Text(value)
                .font(emphasized ? Theme.Fonts.headline : Theme.Fonts.body)
                .foregroundStyle(emphasized ? Theme.Colors.gold : Theme.Colors.textPrimary)
        }
        .padding(.vertical, 6)
    }
}
