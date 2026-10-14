# Android APK — /chimpanzee

This repository includes a GitHub Actions workflow that packages the `web/` interface into a Capacitor Android WebView app.

## Build an APK without Android Studio
1. Go to **Actions → Build Android APK** in this GitHub repository.
2. Select **Run workflow** (or use the build triggered by a push).
3. Wait for a green successful build.
4. Open the run and download the artifact **chimpanzee-android-debug-apk**.
5. Extract the ZIP, then transfer `app-debug.apk` to your Android phone and open it to install.
6. Android may ask you to allow installation from the app that opened the APK.

This is a **debug APK for personal testing**, not a Play Store signed release. Do not distribute it as a production app.

## Functional limitations
- Host/Listener, queue, local chat, and themes run in the app.
- Live station networking requires a separately deployed HTTPS/WSS server and configuration in Settings.
- Server-side queue/chat coordination is code-added but not production-tested.
- Synchronized music streaming, microphone audio transport, automatic Drive folder music indexing, and embedded YouTube playback are not implemented.
- A native APK cannot be installed on iPhone.

The workflow needs an available GitHub Actions runner and internet access to fetch Android and Capacitor dependencies.
