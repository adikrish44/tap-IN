# /chimpanzee — iOS starter

SwiftUI prototype for a private listening app. This is **not** a functional multiplayer radio service yet.

## Included
- Host/Listener UI and locally rotating four-digit Host PIN
- Slate/Paper theme
- Player and reorderable queue
- YouTube links added to queue and opened in YouTube
- Google Drive folder-link saving on device (no file syncing)
- Local admin access request demonstration
- Local chat demonstration

## Not implemented
Real station networking, PIN verification, synchronized music streaming, push-to-talk, real-time chat, cloud Drive discovery, YouTube embedding, push notifications and production authorization.

## Build without owning a Mac
Use a hosted macOS runner (such as GitHub Actions) with Xcode and [XcodeGen](https://github.com/yonaskolb/XcodeGen).

1. Run `xcodegen generate` to generate the Xcode project.
2. Configure a unique bundle identifier and Apple Developer team/signing.
3. Archive the iOS app on macOS.
4. Upload a signed archive to App Store Connect.
5. Configure TestFlight and invite testers.

Apple Developer Program membership is required for TestFlight. This source has **not** been compiled or tested in Xcode. Do not distribute as a working live radio service until the backend and security are implemented.
