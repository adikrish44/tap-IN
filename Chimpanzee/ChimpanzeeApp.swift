import SwiftUI

@main
struct ChimpanzeeApp: App {
    @StateObject private var model = StationModel()
    var body: some Scene {
        WindowGroup {
            RootView().environmentObject(model)
                .preferredColorScheme(model.paper ? .light : .dark)
        }
    }
}