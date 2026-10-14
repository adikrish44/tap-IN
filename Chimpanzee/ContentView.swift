import SwiftUI

private let coral = Color(red: 1, green: 0.41, blue: 0.30)

struct RootView: View {
    @EnvironmentObject var model: StationModel
    @State private var enteredPIN = ""
    var body: some View {
        ZStack {
            (model.paper ? Color(red: 0.965, green: 0.956, blue: 0.935) : Color(red: 0.075, green: 0.082, blue: 0.095)).ignoresSafeArea()
            if model.joined { StationView() }
            else {
                VStack(spacing: 24) {
                    Spacer()
                    Text("/chimpanzee").font(.system(size: 36, weight: .bold, design: .rounded)).foregroundStyle(coral)
                    Text("Your private listening space").foregroundStyle(.secondary)
                    Button("Start as Host") { model.isHost = true; model.joined = true }.buttonStyle(CoralButton())
                    TextField("Enter station PIN", text: $enteredPIN).keyboardType(.numberPad)
                        .textFieldStyle(.roundedBorder).multilineTextAlignment(.center)
                    Button("Join as Listener") { model.isHost = false; model.joined = true }.buttonStyle(CoralButton())
                    Text("Prototype: listener PINs are not verified by a server.").font(.caption).foregroundStyle(.secondary)
                    Spacer()
                    ThemeButton()
                }.padding(24)
            }
        }.tint(coral)
    }
}

struct StationView: View {
    @EnvironmentObject var model: StationModel
    @State private var tab = 0
    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("/chimpanzee").font(.headline).foregroundStyle(coral)
                Spacer()
                if model.isHost {
                    Button("PIN \(model.pin)") { UIPasteboard.general.string = model.pin }
                        .font(.caption.bold()).padding(9).background(.thinMaterial, in: RoundedRectangle(cornerRadius: 9))
                } else { Text(model.admin ? "ADMIN" : "LISTENER").font(.caption).foregroundStyle(.secondary) }
            }.padding()
            Group {
                switch tab {
                case 0: PlayerScreen()
                case 1: QueueScreen()
                case 2: ListenersScreen()
                case 3: ChatScreen()
                default: SettingsScreen()
                }
            }.frame(maxWidth: .infinity, maxHeight: .infinity)
            HStack {
                nav("Player", "play.circle", 0)
                nav("Queue", "list.bullet", 1)
                nav("Listeners", "person.2", 2)
                nav("Chat", "bubble.left", 3)
                nav("Settings", "gearshape", 4)
            }.padding(.vertical, 9).background(.regularMaterial)
            HStack { Spacer(); ThemeButton() }.padding(.trailing, 16).padding(.bottom, 6)
        }
    }
    private func nav(_ title: String, _ icon: String, _ index: Int) -> some View {
        Button { tab = index } label: {
            VStack(spacing: 4) {
                Image(systemName: icon).font(.system(size: 18))
                Text(title).font(.system(size: 10))
            }.foregroundStyle(tab == index ? coral : .secondary).frame(maxWidth: .infinity)
        }
    }
}

struct PlayerScreen: View {
    @EnvironmentObject var model: StationModel
    private var canControl: Bool { model.isHost || model.admin }
    var body: some View {
        VStack(spacing: 24) {
            Text(model.isHost ? "My Station" : "Live Station").font(.title2.bold())
            Spacer()
            RoundedRectangle(cornerRadius: 20).fill(.secondary.opacity(0.12))
                .overlay { Image(systemName: "music.note").font(.system(size: 78)).foregroundStyle(.secondary) }
                .frame(maxWidth: 310).aspectRatio(1, contentMode: .fit)
            Text(model.currentTrack?.title ?? "Nothing Playing").font(.title3.bold())
            Text(model.currentTrack?.source ?? "Add music from Queue").foregroundStyle(.secondary)
            HStack(spacing: 40) {
                Button { skip(-1) } label: { Image(systemName: "backward.fill").font(.title2).foregroundStyle(.secondary) }
                Button { withAnimation { model.isPlaying.toggle() } } label: {
                    Image(systemName: model.isPlaying ? "pause.fill" : "play.fill")
                        .font(.system(size: 36)).contentTransition(.symbolEffect(.replace))
                }
                Button { skip(1) } label: { Image(systemName: "forward.fill").font(.title2).foregroundStyle(.secondary) }
            }.disabled(!canControl)
            if !canControl { Text("Host controls playback").font(.caption).foregroundStyle(.secondary) }
            if let track = model.currentTrack, track.source == "YouTube", let url = URL(string: track.url) {
                Link("Open in YouTube", destination: url)
                Text("YouTube uses its authorized player. No audio extraction or streaming is provided.")
                    .font(.caption).foregroundStyle(.secondary).multilineTextAlignment(.center)
            }
            Spacer()
        }.padding()
    }
    private func skip(_ direction: Int) {
        guard canControl, !model.queue.isEmpty else { return }
        let index = model.queue.firstIndex(where: { $0.id == model.currentTrack?.id }) ?? 0
        model.currentTrack = model.queue[(index + direction + model.queue.count) % model.queue.count]
        model.isPlaying = false
    }
}

struct QueueScreen: View {
    @EnvironmentObject var model: StationModel
    @State private var youtubeURL = ""
    @State private var folderURL = ""
    @State private var feedback = ""
    var body: some View {
        NavigationStack {
            List {
                if model.isHost || model.admin {
                    Section("Add YouTube link") {
                        TextField("YouTube video URL", text: $youtubeURL)
                            .textInputAutocapitalization(.never).autocorrectionDisabled()
                        Button("Add to Queue") {
                            let added = model.addYouTube(youtubeURL)
                            feedback = added ? "Added to queue" : "Invalid YouTube URL"
                            if added { youtubeURL = "" }
                        }
                    }
                    Section("Google Drive folders") {
                        TextField("Shared folder URL", text: $folderURL)
                            .textInputAutocapitalization(.never).autocorrectionDisabled()
                        Button("Save Folder Link") {
                            let added = model.addDriveFolder(folderURL)
                            feedback = added ? "Folder saved" : "Invalid or duplicate folder URL"
                            if added { folderURL = "" }
                        }
                        ForEach(model.driveLinks, id: \.self) { link in
                            Text(link).font(.caption).lineLimit(2)
                        }.onDelete { model.driveLinks.remove(atOffsets: $0) }
                        Text("Links are saved locally. Google Drive music sync is not implemented.")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                    if !feedback.isEmpty { Text(feedback).font(.caption).foregroundStyle(coral) }
                }
                Section("Station Queue") {
                    if model.queue.isEmpty { Text("No tracks yet").foregroundStyle(.secondary) }
                    ForEach(model.queue) { track in
                        Button {
                            if model.isHost || model.admin {
                                model.currentTrack = track
                                model.isPlaying = false
                            }
                        } label: {
                            Label {
                                VStack(alignment: .leading) {
                                    Text(track.title)
                                    Text(track.source).font(.caption).foregroundStyle(.secondary)
                                }
                            } icon: {
                                Image(systemName: track.source == "YouTube" ? "play.rectangle" : "music.note")
                            }
                        }.foregroundStyle(.primary)
                    }.onMove { model.queue.move(fromOffsets: $0, toOffset: $1) }
                        .onDelete { model.queue.remove(atOffsets: $0) }
                }
            }.navigationTitle("Queue")
                .toolbar { if model.isHost || model.admin { EditButton() } }
        }
    }
}

struct ListenersScreen: View {
    @EnvironmentObject var model: StationModel
    @State private var showOptions = false
    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("Listeners").font(.title.bold())
            HStack {
                Image(systemName: "person.crop.circle.fill").font(.largeTitle).foregroundStyle(.secondary)
                VStack(alignment: .leading) {
                    Text(model.listenerName).bold()
                    Text(model.admin ? "Admin" : model.requestPending ? "Admin requested" : "Listener")
                        .font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                if model.admin { Image(systemName: "checkmark.shield.fill").foregroundStyle(coral) }
            }.padding().background(.secondary.opacity(0.1), in: RoundedRectangle(cornerRadius: 14))
                .onLongPressGesture { if model.isHost { showOptions = true } }
            if model.isHost {
                Text("Long-press the listener to manage admin access.").font(.caption).foregroundStyle(.secondary)
                if model.requestPending { Label("Admin access requested", systemImage: "bell.badge") }
                Button(model.admin ? "Revoke Admin" : "Give Admin Access") {
                    model.admin.toggle(); model.requestPending = false
                }.buttonStyle(CoralButton())
            } else {
                Button(model.requestPending ? "Cancel Request" : model.admin ? "Admin Granted" : "Request Admin Access") {
                    if !model.admin { model.requestPending.toggle() }
                }.buttonStyle(CoralButton()).disabled(model.admin)
            }
            Text("Local demo only; permissions are not shared across devices.")
                .font(.caption).foregroundStyle(.secondary)
            Spacer()
        }.padding()
            .confirmationDialog("Listener permissions", isPresented: $showOptions) {
                Button(model.admin ? "Revoke Admin" : "Give Admin Access") {
                    model.admin.toggle(); model.requestPending = false
                }
                if model.requestPending { Button("Decline") { model.requestPending = false } }
            }
    }
}

struct ChatScreen: View {
    @State private var messages = ["Welcome to /chimpanzee!"]
    @State private var draft = ""
    var body: some View {
        VStack {
            Text("Station Chat").font(.title2.bold()).padding()
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 12) {
                    ForEach(Array(messages.enumerated()), id: \.offset) { _, message in
                        Text(message).padding(12)
                            .background(.secondary.opacity(0.12), in: RoundedRectangle(cornerRadius: 12))
                    }
                }.frame(maxWidth: .infinity, alignment: .leading).padding()
            }
            HStack {
                TextField("Message", text: $draft).textFieldStyle(.roundedBorder)
                Button {
                    if !draft.isEmpty { messages.append(draft); draft = "" }
                } label: { Image(systemName: "paperplane.fill") }
            }.padding()
            Text("Local chat demo; real-time chat requires a backend.")
                .font(.caption).foregroundStyle(.secondary)
        }
    }
}

struct SettingsScreen: View {
    @EnvironmentObject var model: StationModel
    var body: some View {
        VStack(spacing: 20) {
            Text("Settings").font(.title.bold())
            ThemeButton()
            Button("Leave Station") { model.joined = false; model.isPlaying = false }
                .buttonStyle(CoralButton())
            Text("/chimpanzee prototype. Live networking and cloud sync are not connected.")
                .font(.caption).foregroundStyle(.secondary).multilineTextAlignment(.center)
            Spacer()
        }.padding()
    }
}

struct ThemeButton: View {
    @EnvironmentObject var model: StationModel
    var body: some View {
        Button {
            withAnimation(.easeInOut(duration: 0.7)) { model.toggleTheme() }
        } label: {
            Label(model.paper ? "Slate" : "Paper", systemImage: model.paper ? "moon" : "sun.max")
                .font(.system(size: 13, weight: .medium)).frame(width: 118, height: 46)
                .background(.thinMaterial, in: Capsule())
        }.buttonStyle(.plain)
    }
}

struct CoralButton: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.font(.headline).foregroundStyle(.white)
            .frame(maxWidth: .infinity).padding(14)
            .background(coral.opacity(configuration.isPressed ? 0.75 : 1), in: RoundedRectangle(cornerRadius: 12))
    }
}
