import SwiftUI
import UIKit
import QudraEngine

struct PersonalFinanceCalculatorView: View {
    @State private var viewModel = CalculatorViewModel(product: .personal)
    @Environment(RulesStore.self) private var rules

    var body: some View {
        CalculatorFormView(viewModel: viewModel, title: "التمويل الشخصي") {
            NumberInputField(title: "مدة التمويل المطلوبة", text: $viewModel.term,
                             unit: viewModel.termUnit,
                             hint: viewModel.termHint(rules: rules.ruleSet.personal),
                             allowsDecimal: false)
        }
    }
}

/// نموذج الحاسبة المشترك بين المنتجين. `extraFields` للحقول الخاصة بكل منتج.
struct CalculatorFormView<ExtraFields: View>: View {
    @Bindable var viewModel: CalculatorViewModel
    let title: String
    @ViewBuilder var extraFields: ExtraFields

    @Environment(RulesStore.self) var rules

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Spacing.l) {
                if rules.ruleSet.isDemo {
                    DemoRulesBanner()
                }

                QudraCard(padding: Theme.Spacing.l) {
                    VStack(spacing: Theme.Spacing.m) {
                        NumberInputField(title: "الدخل الشهري الصافي", text: $viewModel.monthlyIncome,
                                         unit: AppConfig.currencyCode)
                        NumberInputField(title: "الالتزامات الشهرية الحالية", text: $viewModel.monthlyObligations,
                                         unit: AppConfig.currencyCode, hint: "مجموع الأقساط الشهرية القائمة إن وجدت.")
                        NumberInputField(title: "العمر", text: $viewModel.age, unit: "سنة", allowsDecimal: false)
                        extraFields
                    }
                }

                if let message = viewModel.validationMessage {
                    Label(message, systemImage: "exclamationmark.circle")
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.danger)
                }

                PrimaryButton(title: "احسب القدرة التمويلية", systemImage: "function") {
                    hideKeyboard()
                    viewModel.calculate(using: rules.ruleSet)
                }
            }
            .padding(Theme.Spacing.m)
        }
        .scrollDismissesKeyboard(.interactively)
        .qudraBackground()
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .navigationDestination(item: $viewModel.presentedResult) { presentation in
            CalculationResultView(presentation: presentation)
        }
    }

    private func hideKeyboard() {
        UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
    }
}
