import SwiftUI
import QudraEngine

/// عرض السيناريوهات جنبًا إلى جنب مع إبراز الأفضل في كل مقياس.
struct ComparisonView: View {
    let presentation: ComparisonPresentation

    @State var selectedResult: ResultPresentation?

    private var outcomes: [ScenarioOutcome] { presentation.outcomes }
    private var highlights: ComparisonHighlights {
        ScenarioComparison.highlights(for: outcomes.map(\.result))
    }
    private var isMortgage: Bool { outcomes.first?.result.product == .mortgage }
    private var usesDemoRules: Bool { outcomes.contains { $0.result.isDemoRules } }
    private var hasMixedRuleVersions: Bool { Set(outcomes.map(\.result.rulesVersion)).count > 1 }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Spacing.l) {
                if usesDemoRules {
                    DemoRulesBanner()
                }
                Text(presentation.title)
                    .font(Theme.Fonts.title)
                    .foregroundStyle(Theme.Colors.textPrimary)

                if !highlights.isEmpty {
                    highlightsCard
                }
                tableCard
                notesCard
                Text("المقارنة تقديرية لأغراض التخطيط فقط ولا تمثل عرضًا تمويليًا.")
                    .font(.caption2)
                    .foregroundStyle(Theme.Colors.textSecondary)
            }
            .padding(Theme.Spacing.m)
        }
        .qudraBackground()
        .navigationTitle("المقارنة")
        .navigationBarTitleDisplayMode(.inline)
        .navigationDestination(item: $selectedResult) { CalculationResultView(presentation: $0) }
    }

    // MARK: - Highlights

    private var highlightsCard: some View {
        QudraCard {
            Text("أبرز الفروق")
                .font(Theme.Fonts.headline)
                .foregroundStyle(Theme.Colors.textPrimary)
            if isMortgage, let index = highlights.highestPropertyValue {
                highlightRow("أعلى قيمة عقار", index: index)
            }
            if let index = highlights.highestFinancing {
                highlightRow("أعلى مبلغ تمويل", index: index)
            }
            if let index = highlights.lowestInstallment {
                highlightRow("أقل قسط شهري", index: index)
            }
            if let index = highlights.lowestTotalProfit {
                highlightRow("أقل إجمالي ربح", index: index)
            }
        }
    }

    private func highlightRow(_ title: String, index: Int) -> some View {
        HStack {
            Image(systemName: "star.fill")
                .font(.caption)
                .foregroundStyle(Theme.Colors.gold)
            Text(title)
                .font(Theme.Fonts.body)
                .foregroundStyle(Theme.Colors.textSecondary)
            Spacer()
            Text(outcomes[index].label)
                .font(Theme.Fonts.headline)
                .foregroundStyle(Theme.Colors.gold)
        }
    }

    // MARK: - Table

    private var tableCard: some View {
        QudraCard(padding: Theme.Spacing.m) {
            Grid(alignment: .leading, horizontalSpacing: Theme.Spacing.s, verticalSpacing: Theme.Spacing.m) {
                GridRow {
                    Text("المبالغ بـ \(AppConfig.currencyCode)")
                        .font(.caption2)
                        .foregroundStyle(Theme.Colors.textSecondary)
                    ForEach(outcomes) { outcome in
                        Button {
                            open(outcome)
                        } label: {
                            VStack(spacing: 2) {
                                Text(outcome.label)
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(Theme.Colors.gold)
                                Text("التفاصيل")
                                    .font(.caption2)
                                    .foregroundStyle(Theme.Colors.textSecondary)
                            }
                            .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.plain)
                    }
                }
                Divider().overlay(Theme.Colors.border).gridCellUnsizedAxes(.horizontal)

                row("الأهلية") { outcome in
                    ValueCell(text: outcome.result.isEligible ? "مؤهل" : "غير مؤهل",
                              color: outcome.result.isEligible ? Theme.Colors.success : Theme.Colors.danger)
                }
                row("المدة") { ValueCell(text: Formatters.months(compact: $0.result.termMonths)) }
                if isMortgage {
                    row("قيمة العقار") {
                        amountCell($0.result.maxPropertyValue ?? 0, highlighted: highlights.highestPropertyValue == $0.id)
                    }
                    row("الدفعة الأولى") { amountCell($0.result.downPayment ?? 0) }
                }
                row("مبلغ التمويل") {
                    amountCell($0.result.maxFinancingAmount, highlighted: highlights.highestFinancing == $0.id)
                }
                row("القسط الشهري") {
                    amountCell($0.result.maxMonthlyInstallment, highlighted: highlights.lowestInstallment == $0.id)
                }
                row("إجمالي الربح") {
                    amountCell($0.result.totalProfit, highlighted: highlights.lowestTotalProfit == $0.id)
                }
                row("إجمالي السداد") { amountCell($0.result.totalRepayment) }
                if let dates = presentation.savedDates {
                    row("تاريخ الحفظ") { outcome in
                        ValueCell(text: outcome.id < dates.count ? Formatters.shortDate(dates[outcome.id]) : "—")
                    }
                }
                if hasMixedRuleVersions {
                    row("إصدار القواعد") { ValueCell(text: "\($0.result.rulesVersion)") }
                }
            }
        }
    }

    private func row<Cell: View>(_ title: String, @ViewBuilder cell: @escaping (ScenarioOutcome) -> Cell) -> some View {
        GridRow {
            Text(title)
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
            ForEach(outcomes) { outcome in
                cell(outcome)
            }
        }
    }

    private func amountCell(_ value: Double, highlighted: Bool = false) -> ValueCell {
        ValueCell(text: Formatters.number(value),
                  color: highlighted ? Theme.Colors.gold : Theme.Colors.textPrimary,
                  isHighlighted: highlighted)
    }

    // MARK: - Notes

    @ViewBuilder
    private var notesCard: some View {
        let withNotes = outcomes.filter { !$0.result.notes.isEmpty }
        if !withNotes.isEmpty {
            QudraCard {
                Text("ملاحظات")
                    .font(Theme.Fonts.headline)
                    .foregroundStyle(Theme.Colors.textPrimary)
                ForEach(withNotes) { outcome in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(outcome.label)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Theme.Colors.gold)
                        ForEach(outcome.result.notes, id: \.self) { note in
                            Text("• \(note.message)")
                                .font(Theme.Fonts.caption)
                                .foregroundStyle(note.severity == .blocking ? Theme.Colors.danger : Theme.Colors.textSecondary)
                        }
                    }
                    .padding(.vertical, 2)
                }
            }
        }
    }

    private func open(_ outcome: ScenarioOutcome) {
        let origin: ResultPresentation.Origin
        if let dates = presentation.savedDates, outcome.id < dates.count {
            origin = .history(savedAt: dates[outcome.id])
        } else {
            origin = .fresh
        }
        selectedResult = ResultPresentation(input: outcome.input, result: outcome.result, origin: origin)
    }
}

/// خلية قيمة في جدول المقارنة.
private struct ValueCell: View {
    let text: String
    var color: Color = Theme.Colors.textPrimary
    var isHighlighted = false

    var body: some View {
        HStack(spacing: 2) {
            if isHighlighted {
                Image(systemName: "star.fill")
                    .font(.system(size: 8))
                    .foregroundStyle(Theme.Colors.gold)
            }
            Text(text)
                .font(.system(.footnote, design: .rounded, weight: isHighlighted ? .bold : .medium))
                .foregroundStyle(color)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
        }
        .frame(maxWidth: .infinity)
    }
}
