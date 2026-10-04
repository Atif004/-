import Foundation
import Observation
import QudraEngine
import Supabase

/// يجلب قواعد الحساب من الـ Cloud ويحتفظ بآخر نسخة ناجحة محليًا.
/// ترتيب المصادر: Cloud ← النسخة المحفوظة ← القيم التجريبية المدمجة.
@MainActor
@Observable
final class RulesStore {
    enum Source: Equatable {
        case cloud
        case cache
        case bundledDemo
    }

    private(set) var ruleSet: RuleSet
    private(set) var source: Source
    private(set) var isLoading = false

    private static let cacheKey = "qudra.cachedRuleSet"

    init() {
        if let data = UserDefaults.standard.data(forKey: Self.cacheKey),
           let cached = try? JSONDecoder().decode(RuleSet.self, from: data) {
            ruleSet = cached
            source = .cache
        } else {
            ruleSet = .demo
            source = .bundledDemo
        }
    }

    func refresh() async {
        guard let client = SupabaseService.client else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            let rows: [CalculationRuleRow] = try await client
                .from("calculation_rules")
                .select("product_type, version, is_demo, parameters")
                .eq("is_active", value: true)
                .execute()
                .value
            guard let personal = rows.first(where: { $0.product == .personal }),
                  let mortgage = rows.first(where: { $0.product == .mortgage }) else { return }
            let fetched = RuleSet(
                version: max(personal.version, mortgage.version),
                isDemo: personal.isDemo || mortgage.isDemo,
                personal: personal.parameters,
                mortgage: mortgage.parameters
            )
            ruleSet = fetched
            source = .cloud
            if let data = try? JSONEncoder().encode(fetched) {
                UserDefaults.standard.set(data, forKey: Self.cacheKey)
            }
        } catch {
            // نُبقي على القواعد الحالية (المحفوظة أو التجريبية).
        }
    }
}
