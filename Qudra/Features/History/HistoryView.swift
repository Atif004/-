import Combine
import SwiftUI
import QudraEngine

struct HistoryView: View {
    @Environment(AppSession.self) private var session
    @State private var items: [SavedCalculation] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var selected: ResultPresentation?
    @State private var filter: HistoryFilter = .all
    @State private var selection = Set<UUID>()
    @State private var editMode: EditMode = .inactive
    @State private var comparison: ComparisonPresentation?

    private var isSelecting: Bool { editMode.isEditing }

    private var selectedItems: [SavedCalculation] {
        items.filter { selection.contains($0.id) }
    }

    /// سبب عدم إمكانية المقارنة، أو `nil` إن كانت ممكنة.
    private var comparisonBlocker: String? {
        let selected = selectedItems
        if selected.count < 2 { return "اختر نتيجتين على الأقل." }
        if selected.count > ScenarioComparison.maxScenarios {
            return "يمكن مقارنة \(ScenarioComparison.maxScenarios) نتائج كحد أقصى."
        }
        if Set(selected.map(\.product)).count > 1 { return "اختر نتائج من نفس نوع التمويل." }
        return nil
    }

    enum HistoryFilter: String, CaseIterable, Identifiable {
        case all = "الكل"
        case personal = "شخصي"
        case mortgage = "عقاري"
        var id: String { rawValue }

        func includes(_ product: FinancingProduct) -> Bool {
            switch self {
            case .all: return true
            case .personal: return product == .personal
            case .mortgage: return product == .mortgage
            }
        }
    }

    private var filteredItems: [SavedCalculation] {
        items.filter { filter.includes($0.product) }
    }

    private let repository = CalculationsRepository()

    var body: some View {
        content
            .qudraBackground()
            .navigationTitle("النتائج السابقة")
            .navigationDestination(item: $selected) { CalculationResultView(presentation: $0) }
            .navigationDestination(item: $comparison) { ComparisonView(presentation: $0) }
            .environment(\.editMode, $editMode)
            .toolbar { toolbarContent }
            .onChange(of: session.isAuthenticated) { stopSelecting() }
            .task(id: session.currentUser?.id) { await load() }
            .onReceive(NotificationCenter.default.publisher(for: .qudraCalculationSaved)) { _ in
                Task { await load() }
            }
    }

    @ViewBuilder
    private var content: some View {
        if !session.isAuthenticated {
            EmptyStateView(
                systemImage: "lock.fill",
                title: "سجّل الدخول لعرض نتائجك",
                message: "تُحفظ نتائجك بأمان في حسابك ويمكنك الرجوع إليها في أي وقت."
            )
        } else if isLoading && items.isEmpty {
            ProgressView().tint(Theme.Colors.gold).frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if let errorMessage, items.isEmpty {
            EmptyStateView(systemImage: "wifi.exclamationmark", title: "تعذّر التحميل", message: errorMessage)
        } else if items.isEmpty {
            EmptyStateView(
                systemImage: "tray",
                title: "لا توجد نتائج محفوظة",
                message: "احسب قدرتك التمويلية واحفظ النتيجة لتظهر هنا."
            )
        } else {
            List(selection: $selection) {
                Picker("", selection: $filter) {
                    ForEach(HistoryFilter.allCases) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented)
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets())

                if filteredItems.isEmpty {
                    Text("لا توجد نتائج في هذا التصنيف.")
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.textSecondary)
                        .listRowBackground(Color.clear)
                }

                ForEach(filteredItems) { item in
                    Group {
                        if isSelecting {
                            HistoryRow(item: item)
                        } else {
                            Button {
                                selected = ResultPresentation(input: item.input, result: item.result,
                                                              origin: .history(savedAt: item.createdAt))
                            } label: {
                                HistoryRow(item: item)
                            }
                        }
                    }
                    .listRowBackground(Theme.Colors.surface)
                }
                .onDelete(perform: delete)
            }
            .refreshable { await load() }
        }
    }

    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        if session.isAuthenticated && items.count >= 2 {
            ToolbarItem(placement: .primaryAction) {
                Button(isSelecting ? "إلغاء" : "مقارنة") {
                    if isSelecting { stopSelecting() } else { editMode = .active }
                }
            }
        }
        if isSelecting {
            ToolbarItem(placement: .bottomBar) {
                VStack(spacing: 2) {
                    Button("قارن المحدد (\(selection.count))") {
                        comparison = ComparisonPresentation(saved: selectedItems)
                        stopSelecting()
                    }
                    .font(Theme.Fonts.headline)
                    .disabled(comparisonBlocker != nil)
                    if let comparisonBlocker {
                        Text(comparisonBlocker)
                            .font(.caption2)
                            .foregroundStyle(Theme.Colors.textSecondary)
                    }
                }
            }
        }
    }

    private func stopSelecting() {
        editMode = .inactive
        selection.removeAll()
    }

    private func load() async {
        guard session.isAuthenticated else {
            items = []
            return
        }
        isLoading = true
        defer { isLoading = false }
        do {
            items = try await repository.fetchHistory()
            errorMessage = nil
        } catch {
            errorMessage = QudraError.wrap(error).localizedDescription
        }
    }

    private func delete(at offsets: IndexSet) {
        // الفهارس هنا من القائمة المفلترة.
        let toDelete = offsets.map { filteredItems[$0] }
        let ids = Set(toDelete.map(\.id))
        items.removeAll { ids.contains($0.id) }
        Task {
            do {
                for item in toDelete {
                    try await repository.delete(id: item.id)
                }
            } catch {
                // عند الفشل نعيد التحميل لإظهار الحالة الفعلية على الخادم.
                await load()
            }
        }
    }
}

private struct HistoryRow: View {
    let item: SavedCalculation

    var body: some View {
        HStack(spacing: Theme.Spacing.m) {
            Image(systemName: item.product == .mortgage ? "building.2" : "person.text.rectangle")
                .foregroundStyle(Theme.Colors.gold)
                .frame(width: 32)
            VStack(alignment: .leading, spacing: 4) {
                Text(item.product.arabicTitle)
                    .font(Theme.Fonts.headline)
                    .foregroundStyle(Theme.Colors.textPrimary)
                Text(Formatters.date(item.createdAt))
                    .font(.caption2)
                    .foregroundStyle(Theme.Colors.textSecondary)
            }
            Spacer()
            Text(Formatters.currency(item.result.maxPropertyValue ?? item.result.maxFinancingAmount))
                .font(.system(.subheadline, design: .rounded, weight: .semibold))
                .foregroundStyle(Theme.Colors.gold)
        }
        .padding(.vertical, 6)
        .accessibilityElement(children: .combine)
    }
}

struct EmptyStateView: View {
    let systemImage: String
    let title: String
    let message: String

    var body: some View {
        VStack(spacing: Theme.Spacing.m) {
            Image(systemName: systemImage)
                .font(.system(size: 44))
                .foregroundStyle(Theme.Colors.gold)
            Text(title)
                .font(Theme.Fonts.title)
                .foregroundStyle(Theme.Colors.textPrimary)
            Text(message)
                .font(Theme.Fonts.body)
                .foregroundStyle(Theme.Colors.textSecondary)
                .multilineTextAlignment(.center)
        }
        .padding(Theme.Spacing.xl)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
