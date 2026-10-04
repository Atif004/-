import SwiftUI
import QudraEngine

/// إنشاء إصدار جديد من قواعد منتج، مع التحقق والمعاينة قبل النشر.
struct RuleEditorView: View {
    @State private var viewModel: RuleEditorViewModel
    let onPublished: () -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(RulesStore.self) private var rules
    @State private var isConfirming = false
    @State private var isPublishing = false
    @State private var errorMessage: String?

    private let service = AdminService()

    init(viewModel: RuleEditorViewModel, onPublished: @escaping () -> Void) {
        _viewModel = State(initialValue: viewModel)
        self.onPublished = onPublished
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Spacing.l) {
                parametersCard
                statusCard
                previewCard
                if !viewModel.changes.isEmpty { changesCard }
                issuesView
                PrimaryButton(title: "مراجعة ونشر", systemImage: "checkmark.shield", isLoading: isPublishing) {
                    isConfirming = true
                }
                .disabled(!viewModel.canPublish)
                .opacity(viewModel.canPublish ? 1 : 0.5)
            }
            .padding(Theme.Spacing.m)
        }
        .scrollDismissesKeyboard(.interactively)
        .qudraBackground()
        .navigationTitle("إصدار جديد — \(viewModel.product.arabicTitle)")
        .navigationBarTitleDisplayMode(.inline)
        .confirmationDialog("نشر القواعد الجديدة؟", isPresented: $isConfirming, titleVisibility: .visible) {
            Button("نشر وتفعيل الآن") { Task { await publish() } }
            Button("إلغاء", role: .cancel) {}
        } message: {
            Text("سيتم تطبيق \(viewModel.changes.count) تغيير على جميع المستخدمين فور النشر، ويمكن الرجوع لأي إصدار سابق لاحقًا.")
        }
    }

    // MARK: - Sections

    private var parametersCard: some View {
        QudraCard(padding: Theme.Spacing.l) {
            Text("المعاملات")
                .font(Theme.Fonts.headline)
                .foregroundStyle(Theme.Colors.textPrimary)
            VStack(spacing: Theme.Spacing.m) {
                NumberInputField(title: "أقصى نسبة استقطاع من الدخل", text: $viewModel.maxDebtRatioPercent, unit: "%",
                                 hint: "تشمل الالتزامات الحالية.")
                NumberInputField(title: "نسبة الربح السنوية", text: $viewModel.annualProfitRatePercent, unit: "%")
                VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
                    Text("طريقة احتساب الربح")
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.textSecondary)
                    Picker("طريقة احتساب الربح", selection: $viewModel.rateMethod) {
                        Text(RuleEditorViewModel.title(for: .reducing)).tag(RateMethod.reducing)
                        Text(RuleEditorViewModel.title(for: .flat)).tag(RateMethod.flat)
                    }
                    .pickerStyle(.segmented)
                }
                HStack(spacing: Theme.Spacing.m) {
                    NumberInputField(title: "أقل مدة", text: $viewModel.minTermMonths, unit: "شهر", allowsDecimal: false)
                    NumberInputField(title: "أقصى مدة", text: $viewModel.maxTermMonths, unit: "شهر", allowsDecimal: false)
                }
                NumberInputField(title: "الحد الأدنى للدخل الشهري", text: $viewModel.minMonthlyIncome,
                                 unit: AppConfig.currencyCode)
                NumberInputField(title: "الحد الأقصى لمبلغ التمويل", text: $viewModel.maxFinancingAmount,
                                 unit: AppConfig.currencyCode)
                NumberInputField(title: "أقصى عمر عند نهاية التمويل", text: $viewModel.maxAgeAtMaturity,
                                 unit: "سنة", allowsDecimal: false)
                if viewModel.product == .mortgage {
                    NumberInputField(title: "الحد الأدنى للدفعة الأولى", text: $viewModel.minDownPaymentPercent,
                                     unit: "%", hint: "اتركه فارغًا إن لم تكن الدفعة الأولى مطلوبة.")
                }
            }
        }
    }

    private var statusCard: some View {
        QudraCard {
            Toggle(isOn: $viewModel.isDemo) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("قيم تجريبية")
                        .font(Theme.Fonts.headline)
                        .foregroundStyle(Theme.Colors.textPrimary)
                    Text("عند التفعيل يظهر للمستخدمين تنبيه بأن النتائج غير معتمدة.")
                        .font(.caption2)
                        .foregroundStyle(Theme.Colors.textSecondary)
                }
            }
            .tint(Theme.Colors.gold)
            AuthTextField(title: "ملاحظات الإصدار (اختياري)", text: $viewModel.notes)
        }
    }

    private var previewCard: some View {
        QudraCard {
            Text("معاينة على عميل افتراضي")
                .font(Theme.Fonts.headline)
                .foregroundStyle(Theme.Colors.textPrimary)
            HStack(spacing: Theme.Spacing.m) {
                NumberInputField(title: "الدخل", text: $viewModel.sampleIncome)
                NumberInputField(title: "الالتزامات", text: $viewModel.sampleObligations)
            }
            HStack(spacing: Theme.Spacing.m) {
                NumberInputField(title: "العمر", text: $viewModel.sampleAge, allowsDecimal: false)
                if viewModel.product == .mortgage {
                    NumberInputField(title: "الدفعة الأولى", text: $viewModel.sampleDownPayment)
                }
            }
            if let preview = viewModel.preview {
                Grid(alignment: .leading, horizontalSpacing: Theme.Spacing.m, verticalSpacing: Theme.Spacing.s) {
                    GridRow {
                        Text("")
                        Text("الحالية").font(.caption.weight(.semibold)).foregroundStyle(Theme.Colors.textSecondary)
                        Text("الجديدة").font(.caption.weight(.semibold)).foregroundStyle(Theme.Colors.gold)
                    }
                    previewRow("الأهلية", preview.current.isEligible ? "مؤهل" : "غير مؤهل",
                               preview.proposed.isEligible ? "مؤهل" : "غير مؤهل")
                    previewRow("مبلغ التمويل", Formatters.number(preview.current.maxFinancingAmount),
                               Formatters.number(preview.proposed.maxFinancingAmount))
                    previewRow("القسط", Formatters.number(preview.current.maxMonthlyInstallment),
                               Formatters.number(preview.proposed.maxMonthlyInstallment))
                    previewRow("المدة", Formatters.months(compact: preview.current.termMonths),
                               Formatters.months(compact: preview.proposed.termMonths))
                    if viewModel.product == .mortgage {
                        previewRow("قيمة العقار", Formatters.number(preview.current.maxPropertyValue ?? 0),
                                   Formatters.number(preview.proposed.maxPropertyValue ?? 0))
                    }
                }
                .padding(.top, Theme.Spacing.s)
            } else {
                Text("أدخل الدخل والعمر لرؤية أثر التغييرات بأقصى مدة متاحة.")
                    .font(.caption2)
                    .foregroundStyle(Theme.Colors.textSecondary)
            }
        }
    }

    private func previewRow(_ title: String, _ current: String, _ proposed: String) -> some View {
        GridRow {
            Text(title).font(Theme.Fonts.caption).foregroundStyle(Theme.Colors.textSecondary)
            Text(current).font(.system(.footnote, design: .rounded)).foregroundStyle(Theme.Colors.textPrimary)
            Text(proposed)
                .font(.system(.footnote, design: .rounded, weight: current == proposed ? .regular : .bold))
                .foregroundStyle(current == proposed ? Theme.Colors.textPrimary : Theme.Colors.gold)
        }
    }

    private var changesCard: some View {
        QudraCard {
            Text("التغييرات (\(viewModel.changes.count))")
                .font(Theme.Fonts.headline)
                .foregroundStyle(Theme.Colors.textPrimary)
            ForEach(viewModel.changes) { change in
                HStack {
                    Text(change.field)
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.textSecondary)
                    Spacer()
                    Text(change.old)
                        .font(.caption)
                        .strikethrough()
                        .foregroundStyle(Theme.Colors.textSecondary)
                    // في RTL يشير "forward" إلى اليسار: من القيمة القديمة إلى الجديدة.
                    Image(systemName: "arrow.forward")
                        .font(.caption2)
                        .foregroundStyle(Theme.Colors.textSecondary)
                    Text(change.new)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Theme.Colors.gold)
                }
            }
        }
    }

    @ViewBuilder
    private var issuesView: some View {
        let messages = viewModel.issues + (errorMessage.map { [$0] } ?? [])
        if !messages.isEmpty {
            VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
                ForEach(messages, id: \.self) { message in
                    Label(message, systemImage: "exclamationmark.circle")
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.danger)
                }
            }
        } else if viewModel.changes.isEmpty {
            Text("لا توجد تغييرات عن الإصدار الحالي.")
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.textSecondary)
        }
    }

    // MARK: - Actions

    private func publish() async {
        guard let proposed = viewModel.proposedRules else { return }
        errorMessage = nil
        isPublishing = true
        defer { isPublishing = false }
        do {
            try await service.publish(product: viewModel.product, parameters: proposed,
                                      isDemo: viewModel.isDemo, notes: viewModel.notes)
            await rules.refresh()
            onPublished()
            dismiss()
        } catch {
            errorMessage = QudraError.wrap(error).localizedDescription
        }
    }
}
