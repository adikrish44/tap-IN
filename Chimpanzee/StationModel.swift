import SwiftUI

struct Track: Identifiable, Codable, Equatable {
    var id = UUID()
    var title: String
    var source: String
    var url: String = ""
}

@MainActor final class StationModel: ObservableObject {
    @Published var isHost = false
    @Published var joined = false
    @Published var paper = false
    @Published var pin = String(format: "%04d", Int.random(in: 0...9999))
    @Published var listenerName = "Listener"
    @Published var requestPending = false
    @Published var admin = false
    @Published var queue: [Track] = []
    @Published var driveLinks: [String] = [] { didSet { UserDefaults.standard.set(driveLinks, forKey: "driveLinks") } }
    @Published var currentTrack: Track?
    @Published var isPlaying = false
    private var pinTimer: Timer?

    init() {
        driveLinks = UserDefaults.standard.stringArray(forKey: "driveLinks") ?? []
        paper = UserDefaults.standard.bool(forKey: "paper")
        startPINRotation()
    }
    func toggleTheme() { paper.toggle(); UserDefaults.standard.set(paper, forKey: "paper") }
    func startPINRotation() {
        pinTimer?.invalidate()
        pinTimer = Timer.scheduledTimer(withTimeInterval: 120, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.pin = String(format: "%04d", Int.random(in: 0...9999)) }
        }
    }
    func addYouTube(_ raw: String) -> Bool {
        guard let url = URL(string: raw), let host = url.host?.lowercased(),
              ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"].contains(host),
              (host == "youtu.be" || url.path == "/watch" || url.path.hasPrefix("/shorts/") || url.path.hasPrefix("/live/")) else { return false }
        queue.append(Track(title: "YouTube video", source: "YouTube", url: raw))
        return true
    }
    func addDriveFolder(_ raw: String) -> Bool {
        guard let url = URL(string: raw), url.host == "drive.google.com", url.path.contains("/folders/"), !driveLinks.contains(raw) else { return false }
        driveLinks.append(raw)
        return true
    }
}