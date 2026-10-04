import SwiftUI
import UIKit
import QudraEngine

/// إنشاء مقارنة بين عدة سيناريوهات بنفس البيانات الأساسية.
struct ComparisonBuilderView: View {
    @State private var viewModel = ComparisonBuilderViewModel()
    @Environment(RulesStore.self) private var rules

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Spacing.l) {
                if rules.ruleSet.isDemo {
                    DemoRulesBanner()
                }

                Picker("المنتج", selection: $viewModel.product) {
                    ForEach(FinancingProduct.allCases) { Text($0.arabicTitle).tag($0) }
                }
                .pickerStyle(.segmented)

                baseCard
                scenariosSection

                if let message = viewModel.validationMessage {
                    Label(message, systemImage: "exclamationmark.circle")
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.danger)
                }

                PrimaryButton(title: "قارن السيناريوهات", systemImage: "rectangle.split.3x1") {
                    hideKeyboard()
                    viewModel.compare(using: rules.ruleSet)
                }
            }
            .padding(Theme.Spacing.m)
        }
        .scrollDismissesKeyboard(.interactively)
        .qudraBackground()
        .navigationTitle("مقارنة السيناريوهات")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { viewModel.prepareScenarios(using: rules.ruleSet) }
        .onChange(of: viewModel.product) { viewModel.productChanged(using: rules.ruleSet) }
        .navigationDestination(item: $viewModel.presentedComparison) { ComparisonView(presentation: $0) }
    }

    private var baseCard: some View {
        QudraCard(padding: Theme.Spacing.l) {
            Text("البيانات الأساسية")
                .font(Theme.Fonts.headline)
                .foregroundStyle(Theme.Colors.textPrimary)
            VStack(spacing: Theme.Spacing.m) {
                NumberInputField(title: "الدخل الشهري الصافي", text: $viewModel.monthlyIncome,
                                 unit: AppConfig.currencyCode)
                NumberInputField(title: "الالتزامات الشهرية الحالية", text: $viewModel.monthlyObligations,
                                 unit: AppConfig.currencyCode)
                NumberInputField(title: "العمر", text: $viewModel.age, unit: "سنة", allowsDecimal: false)
                if viewModel.product == .mortgage {
                    NumberInputField(title: "المبلغ المتوفر للدفعة الأولى", text: $viewModel.downPaymentSavings,
                                     unit: AppConfig.currencyCode,
                                     hint: "يمكن تغييره لكل سيناريو أدناه.")
                }
            }
        }
    }

    private var scenariosSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.m) {
            HStack {
                Text("السيناريوهات")
                    .font(Theme.Fonts.headline)
                    .foregroundStyle(Theme.Colors.textPrimary)
                Spacer()
                if viewModel.canAddScenario {
                    Button {
                        viewModel.addScenario()
                    } label: {
                        Label("إضافة", systemImage: "plus.circle.fill")
                            .font(Theme.Fonts.caption)
                    }
                    .foregroundStyle(Theme.Colors.gold)
                }
            }

            ForEach(Array(viewModel.scenarios.enumerated()), id: \.element.id) { index, draft in
                QudraCard {
                    HStack {
                        Text("سيناريو \(index + 1)")
                            .font(Theme.Fonts.headline)
                            .foregroundStyle(Theme.Colors.gold)
                        Spacer()
                        if viewModel.canRemoveScenario {
                            Button {
                                viewModel.removeScenario(id: draft.id)
                            } label: {
                                Image(systemName: "minus.circle")
                            }
                            .foregroundStyle(Theme.Colors.textSecondary)
                            .accessibilityLabel("حذف السيناريو \(index + 1)")
                        }
                    }
                    if let binding = binding(for: draft.id) {
                        NumberInputField(title: "المدة", text: binding.term,
                                         unit: viewModel.termUnit, allowsDecimal: false)
                        if viewModel.product == .mortgage {
                            NumberInputField(title: "الدفعة الأولى (اختياري)", text: binding.downPayment,
                                             unit: AppConfig.currencyCode)
                        }
                    }
                }
            }

            Text(termHint)
                .font(.caption2)
                .foregroundStyle(Theme.Colors.textSecondary)
        }
    }

    private var termHint: String {
        let productRules = rules.ruleSet.rules(for: viewModel.product)
        if viewModel.product == .mortgage {
            return "المدة بالسنوات، بين \(productRules.minTermMonths / 12) و\(productRules.maxTermMonths / 12) سنة وفق القواعد الحالية."
        }
        return "المدة بالأشهر، بين \(productRules.minTermMonths) و\(productRules.maxTermMonths) شهر وفق القواعد الحالية."
    }

    private func binding(for id: UUID) -> Binding<ComparisonBuilderViewModel.ScenarioDraft>? {
        guard let initial = viewModel.scenarios.first(where: { $0.id == id }) else { return nil }
        // البحث بالمعرّف (لا بالفهرس) حتى يبقى الربط صحيحًا بعد حذف سيناريو.
        return Binding(
            get: { viewModel.scenarios.first(where: { $0.id == id }) ?? initial },
            set: { newValue in
                if let current = viewModel.scenarios.firstIndex(where: { $0.id == id }) {
                    viewModel.scenarios[current] = newValue
                }
            }
        )
    }

    private func hideKeyboard() {
        UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
    }
}
