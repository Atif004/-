import Foundation
import QudraEngine

/// قيم مشتقة من النتيجة للعرض فقط (لا تغيّر الحساب).
struct ResultSummary {
    let input: CalculationInput
    let result: CalculationResult

    /// نسبة الأصل من إجمالي السداد (0...1) لرسم توزيع المبلغ.
    var principalShare: Double {
        guard result.totalRepayment > 0 else { return 0 }
        return min(1, max(0, result.maxFinancingAmount / result.totalRepayment))
    }

    /// نسبة (القسط الجديد + الالتزامات الحالية) من الدخل بعد التمويل.
    var debtRatioAfterFinancing: Double? {
        guard input.monthlyIncome > 0, result.isEligible else { return nil }
        return (result.maxMonthlyInstallment + max(0, input.monthlyObligations)) / input.monthlyIncome
    }

    /// المتبقي من الدخل الشهري بعد كل الأقساط.
    var remainingMonthlyIncome: Double? {
        guard result.isEligible else { return nil }
        return input.monthlyIncome - max(0, input.monthlyObligations) - result.maxMonthlyInstallment
    }

    /// نص مختصر للمشاركة.
    var shareText: String {
        var lines = ["قُدرة — \(result.product.arabicTitle)"]
        if result.isEligible {
            if let value = result.maxPropertyValue {
                lines.append("أقصى قيمة عقار تقديرية: \(Formatters.currency(value))")
            }
            lines.append("مبلغ التمويل التقديري: \(Formatters.currency(result.maxFinancingAmount))")
            lines.append("القسط الشهري: \(Formatters.currency(result.maxMonthlyInstallment))")
            lines.append("المدة: \(Formatters.months(result.termMonths))")
        } else {
            lines.append("غير مؤهل مبدئيًا وفق القواعد الحالية.")
        }
        if result.isDemoRules {
            lines.append("⚠️ محسوبة بقيم تجريبية.")
        }
        lines.append("نتيجة تقديرية لا تمثل عرضًا تمويليًا.")
        return lines.joined(separator: "\n")
    }
}

extension Notification.Name {
    /// يُرسل بعد حفظ نتيجة جديدة لتحديث صفحة النتائج السابقة.
    static let qudraCalculationSaved = Notification.Name("qudra.calculationSaved")
}
