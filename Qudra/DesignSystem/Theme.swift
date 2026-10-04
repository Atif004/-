import SwiftUI

/// الهوية البصرية لتطبيق قُدرة: خلفية داكنة عميقة مع لمسات ذهبية.
enum Theme {
    enum Colors {
        static let background = Color(hex: 0x0A0E1A)
        static let surface = Color(hex: 0x131A2B)
        static let surfaceElevated = Color(hex: 0x1B2438)
        static let gold = Color(hex: 0xC9A86A)
        static let goldLight = Color(hex: 0xE6CF9A)
        static let textPrimary = Color(hex: 0xF5F3EE)
        static let textSecondary = Color(hex: 0x9AA3B5)
        static let border = Color.white.opacity(0.08)
        static let success = Color(hex: 0x4CC38A)
        static let warning = Color(hex: 0xE5B454)
        static let danger = Color(hex: 0xE5636A)

        static let goldGradient = LinearGradient(
            colors: [goldLight, gold],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )

        static let backgroundGradient = LinearGradient(
            colors: [Color(hex: 0x10172A), background],
            startPoint: .top,
            endPoint: .bottom
        )
    }

    enum Spacing {
        static let xs: CGFloat = 4
        static let s: CGFloat = 8
        static let m: CGFloat = 16
        static let l: CGFloat = 24
        static let xl: CGFloat = 32
    }

    enum Radius {
        static let card: CGFloat = 20
        static let control: CGFloat = 14
    }

    enum Fonts {
        static let display = Font.system(.largeTitle, weight: .bold)
        static let title = Font.system(.title2, weight: .bold)
        static let headline = Font.system(.headline, weight: .semibold)
        static let body = Font.system(.body)
        static let caption = Font.system(.footnote)
        static let amount = Font.system(.largeTitle, design: .rounded, weight: .bold)
    }
}

extension Color {
    init(hex: UInt32, opacity: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: opacity
        )
    }
}

/// خلفية موحدة لكل الشاشات.
struct QudraBackground: ViewModifier {
    func body(content: Content) -> some View {
        content
            .scrollContentBackground(.hidden)
            .background(Theme.Colors.backgroundGradient.ignoresSafeArea())
    }
}

extension View {
    func qudraBackground() -> some View { modifier(QudraBackground()) }
}
