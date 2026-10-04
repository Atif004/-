import SwiftUI
import QudraEngine

struct HistoryView: View {
    @Environment(AppSession.self) private var session
    @State private var items: [SavedCalculation] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var selected: ResultPresentation?

    private let repository = CalculationsRepository()

    var body: some View {
        content
            .qudraBackground()
            .navigationTitle("النتائج السابقة")
            .navigationDestination(item: $selected) { CalculationResultView(presentation: $0) }
            .task(id: session.currentUser?.id) { await load() }
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
            List {
                ForEach(items) { item in
                    Button {
                        selected = ResultPresentation(input: item.input, result: item.result,
                                                      origin: .history(savedAt: item.createdAt))
                    } label: {
                        HistoryRow(item: item)
                    }
                    .listRowBackground(Theme.Colors.surface)
                }
                .onDelete(perform: delete)
            }
            .refreshable { await load() }
        }
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
        let toDelete = offsets.map { items[$0] }
        items.remove(atOffsets: offsets)
        Task {
            for item in toDelete {
                try? await repository.delete(id: item.id)
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
