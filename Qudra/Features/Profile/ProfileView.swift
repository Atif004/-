import SwiftUI

struct ProfileView: View {
    @Environment(AppSession.self) private var session
    @Environment(RulesStore.self) private var rules

    @State private var fullName = ""
    @State private var phone = ""
    @State private var isSaving = false
    @State private var statusMessage: String?
    @State private var isConfirmingDeletion = false
    @State private var isDeleting = false
    @State private var deletionError: String?
    @State private var isAdmin = false

    private let service = ProfileService()
    private let adminService = AdminService()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Spacing.l) {
                if let user = session.currentUser {
                    accountCard(email: user.email)
                    profileForm(userId: user.id)
                } else {
                    guestCard
                }
                rulesCard
                if isAdmin {
                    NavigationLink {
                        AdminRulesView()
                    } label: {
                        QudraCard {
                            HStack {
                                Image(systemName: "slider.horizontal.3")
                                    .foregroundStyle(Theme.Colors.gold)
                                Text("إدارة قواعد الحساب")
                                    .font(Theme.Fonts.headline)
                                    .foregroundStyle(Theme.Colors.textPrimary)
                                Spacer()
                                Image(systemName: "chevron.forward")
                                    .foregroundStyle(Theme.Colors.textSecondary)
                            }
                        }
                    }
                    .buttonStyle(.plain)
                }
                NavigationLink {
                    AboutView()
                } label: {
                    QudraCard {
                        HStack {
                            Image(systemName: "info.circle")
                                .foregroundStyle(Theme.Colors.gold)
                            Text("حول التطبيق والخصوصية")
                                .font(Theme.Fonts.headline)
                                .foregroundStyle(Theme.Colors.textPrimary)
                            Spacer()
                            Image(systemName: "chevron.forward")
                                .foregroundStyle(Theme.Colors.textSecondary)
                        }
                    }
                }
                .buttonStyle(.plain)
                if session.isAuthenticated {
                    SecondaryButton(title: "تسجيل الخروج", systemImage: "rectangle.portrait.and.arrow.right") {
                        Task { await session.signOut() }
                    }
                    deleteAccountSection
                }
            }
            .padding(Theme.Spacing.m)
        }
        .qudraBackground()
        .navigationTitle("حسابي")
        .task(id: session.currentUser?.id) { await loadProfile() }
        .confirmationDialog(
            "حذف الحساب نهائيًا؟",
            isPresented: $isConfirmingDeletion,
            titleVisibility: .visible
        ) {
            Button("حذف الحساب وجميع البيانات", role: .destructive) {
                Task { await deleteAccount() }
            }
            Button("إلغاء", role: .cancel) {}
        } message: {
            Text("سيتم حذف حسابك ونتائجك المحفوظة ولا يمكن التراجع عن ذلك.")
        }
    }

    private var deleteAccountSection: some View {
        VStack(spacing: Theme.Spacing.s) {
            Button(role: .destructive) {
                isConfirmingDeletion = true
            } label: {
                if isDeleting {
                    ProgressView().tint(Theme.Colors.danger)
                } else {
                    Text("حذف الحساب")
                        .font(Theme.Fonts.caption)
                }
            }
            .foregroundStyle(Theme.Colors.danger)
            .disabled(isDeleting)
            if let deletionError {
                Text(deletionError)
                    .font(.caption2)
                    .foregroundStyle(Theme.Colors.danger)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.top, Theme.Spacing.s)
    }

    private func accountCard(email: String?) -> some View {
        QudraCard(padding: Theme.Spacing.l) {
            HStack(spacing: Theme.Spacing.m) {
                Image(systemName: "person.crop.circle.fill")
                    .font(.system(size: 48))
                    .foregroundStyle(Theme.Colors.goldGradient)
                VStack(alignment: .leading, spacing: 4) {
                    Text(fullName.isEmpty ? "مستخدم قُدرة" : fullName)
                        .font(Theme.Fonts.title)
                        .foregroundStyle(Theme.Colors.textPrimary)
                    Text(email ?? "")
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.textSecondary)
                }
            }
        }
    }

    private func profileForm(userId: UUID) -> some View {
        QudraCard {
            Text("البيانات الشخصية")
                .font(Theme.Fonts.headline)
                .foregroundStyle(Theme.Colors.textPrimary)
            AuthTextField(title: "الاسم الكامل", text: $fullName, contentType: .name)
            AuthTextField(title: "رقم الجوال", text: $phone, contentType: .telephoneNumber, keyboard: .phonePad)
            if let statusMessage {
                Text(statusMessage)
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.textSecondary)
            }
            PrimaryButton(title: "حفظ التعديلات", isLoading: isSaving) {
                Task { await saveProfile(userId: userId) }
            }
        }
    }

    private var guestCard: some View {
        QudraCard(padding: Theme.Spacing.l) {
            Text("أنت تستخدم التطبيق كضيف")
                .font(Theme.Fonts.title)
                .foregroundStyle(Theme.Colors.textPrimary)
            Text("سجّل الدخول لحفظ نتائجك ومزامنتها.")
                .font(Theme.Fonts.body)
                .foregroundStyle(Theme.Colors.textSecondary)
            PrimaryButton(title: "تسجيل الدخول / إنشاء حساب", systemImage: "person.badge.key") {
                session.exitGuestMode()
            }
            .padding(.top, Theme.Spacing.s)
        }
    }

    private var rulesCard: some View {
        QudraCard {
            Text("قواعد الحساب")
                .font(Theme.Fonts.headline)
                .foregroundStyle(Theme.Colors.textPrimary)
            InfoRow(title: "الإصدار", value: "\(rules.ruleSet.version)")
            InfoRow(title: "المصدر", value: sourceTitle)
            InfoRow(title: "النوع", value: rules.ruleSet.isDemo ? "تجريبية" : "معتمدة")
        }
    }

    private var sourceTitle: String {
        switch rules.source {
        case .cloud: return "Cloud"
        case .cache: return "نسخة محفوظة"
        case .bundledDemo: return "مدمجة (تجريبية)"
        }
    }

    private func loadProfile() async {
        guard let userId = session.currentUser?.id else {
            isAdmin = false
            return
        }
        isAdmin = await adminService.isAdmin(userId: userId)
        if let profile = try? await service.fetchProfile(userId: userId) {
            fullName = profile.fullName ?? ""
            phone = profile.phone ?? ""
        }
    }

    private func deleteAccount() async {
        deletionError = nil
        isDeleting = true
        defer { isDeleting = false }
        do {
            try await session.deleteAccount()
        } catch {
            deletionError = QudraError.wrap(error).localizedDescription
        }
    }

    private func saveProfile(userId: UUID) async {
        isSaving = true
        defer { isSaving = false }
        do {
            try await service.updateProfile(userId: userId,
                                            fullName: fullName.isEmpty ? nil : fullName,
                                            phone: phone.isEmpty ? nil : phone)
            statusMessage = "تم حفظ التعديلات."
        } catch {
            statusMessage = QudraError.wrap(error).localizedDescription
        }
    }
}
