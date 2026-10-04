import SwiftUI
import QudraEngine

/// لوحة إدارة قواعد الحساب (للمدراء فقط).
struct AdminRulesView: View {
    @Environment(RulesStore.self) private var rules

    @State private var product: FinancingProduct = .personal
    @State private var versions: [RuleVersion] = []
    @State private var auditLog: [RulesAuditEntry] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var editorBase: RuleVersion?
    @State private var versionToActivate: RuleVersion?
    @State private var isActivating = false

    private let service = AdminService()

    private var activeVersion: RuleVersion? { versions.first(where: \.isActive) }
    private var productAudit: [RulesAuditEntry] { auditLog.filter { $0.product == product } }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Spacing.l) {
                Picker("المنتج", selection: $product) {
                    ForEach(FinancingProduct.allCases) { Text($0.arabicTitle).tag($0) }
                }
                .pickerStyle(.segmented)

                if let errorMessage {
                    Label(errorMessage, systemImage: "exclamationmark.triangle")
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.danger)
                }

                if isLoading && versions.isEmpty {
                    ProgressView().tint(Theme.Colors.gold).frame(maxWidth: .infinity)
                } else {
                    activeCard
                    PrimaryButton(title: "إنشاء إصدار جديد", systemImage: "square.and.pencil") {
                        editorBase = activeVersion ?? versions.first
                    }
                    .disabled(versions.isEmpty)
                    versionsCard
                    auditCard
                }
            }
            .padding(Theme.Spacing.m)
        }
        .qudraBackground()
        .navigationTitle("إدارة قواعد الحساب")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await load() }
        .task(id: product) { await load() }
        .navigationDestination(item: $editorBase) { base in
            RuleEditorView(
                viewModel: RuleEditorViewModel(product: base.product, base: base.parameters, baseIsDemo: base.isDemo),
                onPublished: { Task { await load() } }
            )
        }
        .confirmationDialog(
            "تفعيل إصدار سابق؟",
            isPresented: Binding(get: { versionToActivate != nil }, set: { if !$0 { versionToActivate = nil } }),
            titleVisibility: .visible,
            presenting: versionToActivate
        ) { version in
            Button("تفعيل الإصدار \(version.version)") { Task { await activate(version) } }
            Button("إلغاء", role: .cancel) {}
        } message: { version in
            Text("سيُطبَّق الإصدار \(version.version) على جميع المستخدمين فورًا بدلًا من الإصدار الحالي.")
        }
    }

    // MARK: - Sections

    @ViewBuilder
    private var activeCard: some View {
        if let active = activeVersion {
            QudraCard(padding: Theme.Spacing.l) {
                HStack {
                    Text("الإصدار النشط \(active.version)")
                        .font(Theme.Fonts.title)
                        .foregroundStyle(Theme.Colors.textPrimary)
                    Spacer()
                    StatusBadge(text: active.isDemo ? "تجريبية" : "معتمدة",
                                color: active.isDemo ? Theme.Colors.warning : Theme.Colors.success)
                }
                RulesSummary(rules: active.parameters, product: active.product)
                if let notes = active.notes {
                    Text(notes)
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.textSecondary)
                }
                Text("منذ \(Formatters.date(active.createdAt))")
                    .font(.caption2)
                    .foregroundStyle(Theme.Colors.textSecondary)
            }
        } else if !isLoading {
            QudraCard {
                Text("لا يوجد إصدار نشط لهذا المنتج.")
                    .font(Theme.Fonts.body)
                    .foregroundStyle(Theme.Colors.danger)
            }
        }
    }

    private var versionsCard: some View {
        QudraCard {
            Text("كل الإصدارات")
                .font(Theme.Fonts.headline)
                .foregroundStyle(Theme.Colors.textPrimary)
            ForEach(versions) { version in
                HStack(alignment: .center, spacing: Theme.Spacing.s) {
                    VStack(alignment: .leading, spacing: 2) {
                        HStack(spacing: 6) {
                            Text("الإصدار \(version.version)")
                                .font(Theme.Fonts.body.weight(.semibold))
                                .foregroundStyle(Theme.Colors.textPrimary)
                            if version.isActive {
                                StatusBadge(text: "نشط", color: Theme.Colors.success)
                            }
                            if version.isDemo {
                                StatusBadge(text: "تجريبي", color: Theme.Colors.warning)
                            }
                        }
                        Text(version.notes ?? Formatters.shortDate(version.createdAt))
                            .font(.caption2)
                            .foregroundStyle(Theme.Colors.textSecondary)
                            .lineLimit(1)
                    }
                    Spacer()
                    Button("نسخ") { editorBase = version }
                        .font(.caption)
                        .foregroundStyle(Theme.Colors.gold)
                        .accessibilityHint("إنشاء إصدار جديد يبدأ من قيم هذا الإصدار")
                    if !version.isActive {
                        Button("تفعيل") { versionToActivate = version }
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Theme.Colors.gold)
                            .disabled(isActivating)
                    }
                }
                .buttonStyle(.borderless)
                .padding(.vertical, 4)
                if version.id != versions.last?.id {
                    Divider().overlay(Theme.Colors.border)
                }
            }
        }
    }

    @ViewBuilder
    private var auditCard: some View {
        if !productAudit.isEmpty {
            QudraCard {
                Text("سجل التغييرات")
                    .font(Theme.Fonts.headline)
                    .foregroundStyle(Theme.Colors.textPrimary)
                ForEach(productAudit) { entry in
                    VStack(alignment: .leading, spacing: 2) {
                        Text(entry.arabicDescription)
                            .font(Theme.Fonts.caption)
                            .foregroundStyle(Theme.Colors.textPrimary)
                        Text(Formatters.date(entry.createdAt))
                            .font(.caption2)
                            .foregroundStyle(Theme.Colors.textSecondary)
                    }
                    .padding(.vertical, 2)
                }
            }
        }
    }

    // MARK: - Actions

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            async let fetchedVersions = service.fetchVersions(product: product)
            async let fetchedAudit = service.fetchAuditLog()
            versions = try await fetchedVersions
            auditLog = (try? await fetchedAudit) ?? []
            errorMessage = nil
        } catch {
            errorMessage = QudraError.wrap(error).localizedDescription
        }
    }

    private func activate(_ version: RuleVersion) async {
        isActivating = true
        defer { isActivating = false }
        do {
            try await service.activate(product: version.product, version: version.version)
            await rules.refresh()
            await load()
        } catch {
            errorMessage = QudraError.wrap(error).localizedDescription
        }
    }
}

/// ملخص مختصر لمعاملات القواعد.
struct RulesSummary: View {
    let rules: FinancingRules
    let product: FinancingProduct

    var body: some View {
        VStack(spacing: 0) {
            InfoRow(title: "نسبة الاستقطاع", value: Formatters.percent(rules.maxDebtRatio))
            InfoRow(title: "نسبة الربح السنوية",
                    value: "\(Formatters.percent(rules.annualProfitRate)) — \(RuleEditorViewModel.title(for: rules.rateMethod))")
            InfoRow(title: "المدة", value: "\(rules.minTermMonths)–\(rules.maxTermMonths) شهر")
            InfoRow(title: "الحد الأدنى للدخل", value: Formatters.currency(rules.minMonthlyIncome))
            InfoRow(title: "الحد الأقصى للتمويل", value: Formatters.currency(rules.maxFinancingAmount))
            InfoRow(title: "أقصى عمر عند النهاية", value: "\(rules.maxAgeAtMaturity) سنة")
            if product == .mortgage {
                InfoRow(title: "الدفعة الأولى الدنيا",
                        value: rules.minDownPaymentRatio.map(Formatters.percent) ?? "غير مطلوبة")
            }
        }
    }
}

struct StatusBadge: View {
    let text: String
    let color: Color

    var body: some View {
        Text(text)
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 8)
            .padding(.vertical, 2)
            .foregroundStyle(color)
            .background(Capsule().fill(color.opacity(0.15)))
    }
}
