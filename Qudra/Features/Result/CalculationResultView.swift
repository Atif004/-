import SwiftUI
import QudraEngine

struct CalculationResultView: View {
    let presentation: ResultPresentation

    // خصائص غير private حتى يبقى المُهيّئ التلقائي متاحًا من الملفات الأخرى.
    @Environment(AppSession.self) var session
    @State var saveState: SaveState = .idle
    @State var serverResult: CalculationResult?

    enum SaveState: Equatable {
        case idle, saving, saved
        case failed(String)
    }

    let repository = CalculationsRepository()

    /// بعد الحفظ نعرض نتيجة الخادم لأنها المرجع المعتمد.
    private var result: CalculationResult { serverResult ?? presentation.result }
    private var summary: ResultSummary { ResultSummary(input: presentation.input, result: result) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Spacing.l) {
                if result.isDemoRules {
                    DemoRulesBanner()
                }
                hero
                details
                if !result.notes.isEmpty { notes }
                inputsSummary
                actions
                Text("هذه النتيجة تقديرية مبنية على القواعد الحالية (إصدار \(result.rulesVersion)) ولا تمثل عرضًا تمويليًا.")
                    .font(.caption2)
                    .foregroundStyle(Theme.Colors.textSecondary)
            }
            .padding(Theme.Spacing.m)
        }
        .qudraBackground()
        .navigationTitle("نتيجة الحساب")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                ShareLink(item: summary.shareText) {
                    Image(systemName: "square.and.arrow.up")
                }
            }
        }
    }

    // MARK: - Sections

    private var hero: some View {
        QudraCard(padding: Theme.Spacing.l) {
            HStack {
                Text(result.product.arabicTitle)
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.textSecondary)
                Spacer()
                EligibilityBadge(isEligible: result.isEligible)
            }
            Text(result.product == .mortgage ? "أقصى قيمة عقار تقديرية" : "أقصى مبلغ تمويل تقديري")
                .font(Theme.Fonts.body)
                .foregroundStyle(Theme.Colors.textSecondary)
                .padding(.top, Theme.Spacing.s)
            Text(Formatters.currency(result.maxPropertyValue ?? result.maxFinancingAmount))
                .font(Theme.Fonts.amount)
                .foregroundStyle(Theme.Colors.goldGradient)
                .minimumScaleFactor(0.6)
                .lineLimit(1)
        }
        .accessibilityElement(children: .combine)
    }

    private var details: some View {
        QudraCard {
            InfoRow(title: "القسط الشهري", value: Formatters.currency(result.maxMonthlyInstallment), emphasized: true)
            Divider().overlay(Theme.Colors.border)
            if result.product == .mortgage {
                InfoRow(title: "مبلغ التمويل", value: Formatters.currency(result.maxFinancingAmount))
                InfoRow(title: "الدفعة الأولى", value: Formatters.currency(result.downPayment ?? 0))
            }
            InfoRow(title: "مدة التمويل", value: Formatters.months(result.termMonths))
            InfoRow(title: "إجمالي السداد", value: Formatters.currency(result.totalRepayment))
            InfoRow(title: "إجمالي الربح", value: Formatters.currency(result.totalProfit))
            if let ratio = summary.debtRatioAfterFinancing {
                InfoRow(title: "نسبة الأقساط من الدخل", value: Formatters.percent(ratio))
            }
            if let remaining = summary.remainingMonthlyIncome {
                InfoRow(title: "المتبقي من الدخل شهريًا", value: Formatters.currency(remaining))
            }
            if result.isEligible && result.totalRepayment > 0 {
                BreakdownBar(
                    principalShare: summary.principalShare,
                    principalLabel: Formatters.currency(result.maxFinancingAmount),
                    profitLabel: Formatters.currency(result.totalProfit)
                )
                .padding(.top, Theme.Spacing.s)
            }
        }
    }

    private var notes: some View {
        QudraCard {
            Text("ملاحظات")
                .font(Theme.Fonts.headline)
                .foregroundStyle(Theme.Colors.textPrimary)
            ForEach(result.notes, id: \.self) { note in
                Label(note.message, systemImage: icon(for: note.severity))
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(color(for: note.severity))
            }
        }
    }

    private var inputsSummary: some View {
        let input = presentation.input
        return QudraCard {
            Text("بيانات الحساب")
                .font(Theme.Fonts.headline)
                .foregroundStyle(Theme.Colors.textPrimary)
            InfoRow(title: "الدخل الشهري", value: Formatters.currency(input.monthlyIncome))
            InfoRow(title: "الالتزامات الشهرية", value: Formatters.currency(input.monthlyObligations))
            InfoRow(title: "العمر", value: "\(input.age) سنة")
            if input.product == .mortgage {
                InfoRow(title: "المتوفر للدفعة الأولى", value: Formatters.currency(input.downPaymentSavings))
            }
            if case .history(let date) = presentation.origin {
                InfoRow(title: "تاريخ الحساب", value: Formatters.date(date))
            }
        }
    }

    @ViewBuilder
    private var actions: some View {
        if presentation.origin == .fresh {
            if session.isAuthenticated {
                switch saveState {
                case .saved:
                    Label("تم حفظ النتيجة في سجلك", systemImage: "checkmark.seal.fill")
                        .font(Theme.Fonts.headline)
                        .foregroundStyle(Theme.Colors.success)
                        .frame(maxWidth: .infinity)
                case .failed(let message):
                    VStack(spacing: Theme.Spacing.s) {
                        Text(message)
                            .font(Theme.Fonts.caption)
                            .foregroundStyle(Theme.Colors.danger)
                        PrimaryButton(title: "إعادة المحاولة", systemImage: "arrow.clockwise") { save() }
                    }
                case .idle, .saving:
                    PrimaryButton(title: "حفظ النتيجة", systemImage: "square.and.arrow.down",
                                  isLoading: saveState == .saving) { save() }
                }
            } else {
                Text("سجّل الدخول لحفظ نتائجك والرجوع إليها لاحقًا.")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.textSecondary)
                    .frame(maxWidth: .infinity)
            }
        }
    }

    // MARK: - Actions

    private func save() {
        saveState = .saving
        Task {
            do {
                let response = try await repository.calculateAndSave(presentation.input)
                serverResult = response.result
                saveState = .saved
                NotificationCenter.default.post(name: .qudraCalculationSaved, object: nil)
            } catch {
                saveState = .failed(QudraError.wrap(error).localizedDescription)
            }
        }
    }

    private func icon(for severity: CalculationNote.Severity) -> String {
        switch severity {
        case .info: return "info.circle"
        case .warning: return "exclamationmark.triangle"
        case .blocking: return "xmark.octagon"
        }
    }

    private func color(for severity: CalculationNote.Severity) -> Color {
        switch severity {
        case .info: return Theme.Colors.textSecondary
        case .warning: return Theme.Colors.warning
        case .blocking: return Theme.Colors.danger
        }
    }
}

private struct EligibilityBadge: View {
    let isEligible: Bool

    var body: some View {
        Text(isEligible ? "مؤهل مبدئيًا" : "غير مؤهل")
            .font(.caption.weight(.semibold))
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .foregroundStyle(isEligible ? Theme.Colors.success : Theme.Colors.danger)
            .background(
                Capsule().fill((isEligible ? Theme.Colors.success : Theme.Colors.danger).opacity(0.15))
            )
    }
}
