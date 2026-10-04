import SwiftUI
import QudraEngine

struct MortgageFinanceCalculatorView: View {
    @State private var viewModel = CalculatorViewModel(product: .mortgage)

    var body: some View {
        CalculatorFormView(viewModel: viewModel, title: "التمويل العقاري") {
            NumberInputField(title: "المبلغ المتوفر للدفعة الأولى", text: $viewModel.downPaymentSavings,
                             unit: AppConfig.currencyCode)
            NumberInputField(title: "مدة التمويل المطلوبة", text: $viewModel.term,
                             unit: viewModel.termUnit, hint: "اتركها فارغة لاستخدام أقصى مدة متاحة.",
                             allowsDecimal: false)
        }
    }
}
