import SwiftUI

/// تعيين كلمة مرور جديدة بعد فتح رابط الاستعادة من البريد.
struct NewPasswordView: View {
    @Environment(AppSession.self) private var session
    @Environment(\.dismiss) private var dismiss

    @State private var password = ""
    @State private var confirmation = ""
    @State private var isSaving = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Spacing.l) {
                    Text("اختر كلمة مرور جديدة لحسابك.")
                        .font(Theme.Fonts.body)
                        .foregroundStyle(Theme.Colors.textSecondary)
                    QudraCard(padding: Theme.Spacing.l) {
                        VStack(spacing: Theme.Spacing.m) {
                            AuthTextField(title: "كلمة المرور الجديدة", text: $password,
                                          contentType: .newPassword, isSecure: true)
                            AuthTextField(title: "تأكيد كلمة المرور", text: $confirmation,
                                          contentType: .newPassword, isSecure: true)
                        }
                    }
                    if let errorMessage {
                        Label(errorMessage, systemImage: "exclamationmark.circle")
                            .font(Theme.Fonts.caption)
                            .foregroundStyle(Theme.Colors.danger)
                    }
                    PrimaryButton(title: "حفظ كلمة المرور", isLoading: isSaving) {
                        Task { await save() }
                    }
                }
                .padding(Theme.Spacing.m)
            }
            .qudraBackground()
            .navigationTitle("كلمة مرور جديدة")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("إلغاء") { dismiss() }
                }
            }
        }
        .environment(\.layoutDirection, .rightToLeft)
    }

    private func save() async {
        errorMessage = nil
        guard password.count >= AuthValidation.minPasswordLength else {
            errorMessage = AuthValidation.passwordTooShortMessage
            return
        }
        guard password == confirmation else {
            errorMessage = "كلمتا المرور غير متطابقتين."
            return
        }
        isSaving = true
        defer { isSaving = false }
        do {
            try await session.updatePassword(password)
            dismiss()
        } catch {
            errorMessage = QudraError.wrap(error).localizedDescription
        }
    }
}

enum AuthValidation {
    static let minPasswordLength = 6
    static let passwordTooShortMessage = "كلمة المرور يجب أن تكون 6 أحرف على الأقل."

    static func isValidEmail(_ email: String) -> Bool {
        let parts = email.split(separator: "@")
        return parts.count == 2 && parts[1].contains(".") && !parts[0].isEmpty
    }
}
