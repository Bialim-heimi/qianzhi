import SwiftUI

@main
struct QianZhiApp: App {
    var body: some Scene {
        WindowGroup { RitualHost().ignoresSafeArea() }
    }
}

struct RitualHost: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> RitualViewController { RitualViewController() }
    func updateUIViewController(_ controller: RitualViewController, context: Context) {}
}
