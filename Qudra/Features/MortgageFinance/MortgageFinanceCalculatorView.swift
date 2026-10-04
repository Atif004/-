import SwiftUI
import QudraEngine

struct MortgageFinanceCalculatorView: View {
    @State private var viewModel = CalculatorViewModel(product: .mortgage)
    @Environment(RulesStore.self) private var rules

    var body: some View {
        CalculatorFormView(viewModel: viewModel, title: "التمويل العقاري") {
            NumberInputField(title: "المبلغ المتوفر للدفعة الأولى", text: $viewModel.downPaymentSavings,
                             unit: AppConfig.currencyCode,
                             hint: viewModel.downPaymentHint(rules: rules.ruleSet.mortgage))
            NumberInputField(title: "مدة التمويل المطلوبة", text: $viewModel.term,
                             unit: viewModel.termUnit,
                             hint: viewModel.termHint(rules: rules.ruleSet.mortgage),
                             allowsDecimal: false)
        }
    }
}
