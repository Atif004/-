import SwiftUI
import UIKit

struct AuthView: View {
    private enum Mode: String, CaseIterable, Identifiable {
        case signIn = "تسجيل الدخول"
        case signUp = "حساب جديد"
        var id: String { rawValue }
    }

    @Environment(AppSession.self) private var session

    @State private var mode: Mode = .signIn
    @State private var fullName = ""
    @State private var email = ""
    @State private var password = ""
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var infoMessage: String?
    @State private var shownDocument: LegalDocument?

    var body: some View {
        ScrollView {
            VStack(spacing: Theme.Spacing.l) {
                BrandMark(size: 64)
                    .padding(.top, 56)
                Text("اعرف قدرتك التمويلية بثقة")
                    .font(Theme.Fonts.body)
                    .foregroundStyle(Theme.Colors.textSecondary)

                Picker("", selection: $mode) {
                    ForEach(Mode.allCases) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented)

                QudraCard(padding: Theme.Spacing.l) {
                    VStack(spacing: Theme.Spacing.m) {
                        if mode == .signUp {
                            AuthTextField(title: "الاسم الكامل", text: $fullName, contentType: .name)
                        }
                        AuthTextField(title: "البريد الإلكتروني", text: $email,
                                      contentType: .emailAddress, keyboard: .emailAddress)
                        AuthTextField(title: "كلمة المرور", text: $password,
                                      contentType: mode == .signUp ? .newPassword : .password, isSecure: true)
                    }
                }

                if let errorMessage {
                    Label(errorMessage, systemImage: "exclamationmark.circle")
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.danger)
                }
                if let infoMessage {
                    Label(infoMessage, systemImage: "envelope.badge")
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.success)
                }

                PrimaryButton(title: mode.rawValue, isLoading: isLoading) {
                    Task { await submit() }
                }

                if mode == .signUp {
                    VStack(spacing: 4) {
                        Text("بإنشاء حساب فإنك توافق على")
                            .foregroundStyle(Theme.Colors.textSecondary)
                        HStack(spacing: 4) {
                            Button(LegalDocument.termsOfUse.title) { shownDocument = .termsOfUse }
                            Text("و").foregroundStyle(Theme.Colors.textSecondary)
                            Button(LegalDocument.privacyPolicy.title) { shownDocument = .privacyPolicy }
                        }
                        .foregroundStyle(Theme.Colors.gold)
                    }
                    .font(.caption)
                }

                if mode == .signIn {
                    Button("نسيت كلمة المرور؟") {
                        Task { await sendPasswordReset() }
                    }
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.textSecondary)
                    .disabled(isLoading)
                }

                Button("المتابعة كضيف") { session.continueAsGuest() }
                    .font(Theme.Fonts.headline)
                    .foregroundStyle(Theme.Colors.gold)

                if !AppConfig.isSupabaseConfigured {
                    Text("وضع التطوير: لم يتم ضبط مفاتيح Supabase بعد، يمكنك المتابعة كضيف.")
                        .font(.caption2)
                        .foregroundStyle(Theme.Colors.textSecondary)
                        .multilineTextAlignment(.center)
                }
            }
            .padding(Theme.Spacing.m)
        }
        .scrollDismissesKeyboard(.interactively)
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
        .onChange(of: mode) {
            errorMessage = nil
            infoMessage = nil
        }
    }

    private func submit() async {
        errorMessage = nil
        infoMessage = nil
        let trimmedEmail = email.trimmingCharacters(in: .whitespaces)
        guard AuthValidation.isValidEmail(trimmedEmail) else {
            errorMessage = "أدخل بريدًا إلكترونيًا صحيحًا."
            return
        }
        guard password.count >= AuthValidation.minPasswordLength else {
            errorMessage = AuthValidation.passwordTooShortMessage
            return
        }
        isLoading = true
        defer { isLoading = false }
        do {
            switch mode {
            case .signIn:
                try await session.signIn(email: trimmedEmail, password: password)
            case .signUp:
                let needsConfirmation = try await session.signUp(fullName: fullName, email: trimmedEmail,
                                                                 password: password)
                if needsConfirmation {
                    infoMessage = "تم إنشاء الحساب. تحقق من بريدك الإلكتروني لتأكيده ثم سجّل الدخول."
                    mode = .signIn
                }
            }
        } catch {
            errorMessage = QudraError.wrap(error).localizedDescription
        }
    }

    private func sendPasswordReset() async {
        errorMessage = nil
        infoMessage = nil
        let trimmedEmail = email.trimmingCharacters(in: .whitespaces)
        guard AuthValidation.isValidEmail(trimmedEmail) else {
            errorMessage = "أدخل بريدك الإلكتروني أولًا لإرسال رابط الاستعادة."
            return
        }
        isLoading = true
        defer { isLoading = false }
        do {
            try await session.sendPasswordReset(email: trimmedEmail)
            infoMessage = "أرسلنا رابط استعادة كلمة المرور إلى بريدك الإلكتروني."
        } catch {
            errorMessage = QudraError.wrap(error).localizedDescription
        }
    }
}

struct AuthTextField: View {
    let title: String
    @Binding var text: String
    var contentType: UITextContentType?
    var keyboard: UIKeyboardType = .default
    var isSecure = false

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
            Text(title)
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.textSecondary)
            Group {
                if isSecure {
                    SecureField("", text: $text)
                } else {
                    TextField("", text: $text)
                }
            }
            .accessibilityLabel(title)
            .textContentType(contentType)
            .keyboardType(keyboard)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .foregroundStyle(Theme.Colors.textPrimary)
            .padding(.horizontal, Theme.Spacing.m)
            .padding(.vertical, 14)
            .background(
                RoundedRectangle(cornerRadius: Theme.Radius.control, style: .continuous)
                    .fill(Theme.Colors.surfaceElevated)
            )
        }
    }
}
