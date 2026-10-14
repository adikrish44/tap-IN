# /chimpanzee PULSE — Edition 02

A standalone redesigned /chimpanzee music player built as an offline-first Progressive Web App, packaged for Android using Capacitor. The original `/chimpanzee` app remains untouched.

## What actually works

- Import your own audio files (MP3, M4A, WAV, OGG and formats supported by the device's WebView).
- Persist audio files locally in IndexedDB, without uploading them; re-open offline and listen again.
- Play/pause, seek, skip, shuffle, repeat off/all/one, volume and mute, adjustable speed, sleep timer.
- Favorites, custom playlists, track title/artist editing, playback queue with reorder/delete.
- Reactive audio spectrum via Web Audio API, CSS-driven motion, dark/light themes, responsive interface.
- Media Session integration on supported devices; media controls depend on OS/WebView behavior.
- Optional real-time station PINs, chat, shared URL queue and admin roles when the separate compatible WebSocket backend is hosted.

## Limitations — stated plainly

- This is **not** a Spotify/Apple Music replacement or a commercial streaming catalog.
- The app does **not** rebroadcast or synchronize audio from YouTube, Google Drive, or personal files across devices. Station functionality requires deployment of an external WebSocket server; no cloud service is bundled or enabled by default.
- On Android, file import/audio support and background playback depend on the device and WebView. Long-running playback under lock screen is **not guaranteed** without a dedicated native Android foreground media service.
- User audio is stored in the local WebView IndexedDB. Clearing app data or uninstalling removes that local copy. Keep originals backed up elsewhere.
- Web fonts will fall back to system fonts offline. No external JS dependencies at runtime.
- The `android-pulse-apk.yml` GitHub workflow creates an **unsigned-for-production debug APK**, which is suitable for personal testing but not Play Store distribution.

## Development

Open `web/index.html` through a local static HTTP server for the PWA:

```bash
cd web && python3 -m http.server 8000
```

For Android, install Node 22, JDK 21, the Android SDK and Capacitor 7, then run `npx cap add android`, `npx cap sync android`, and `./gradlew assembleDebug` in an isolated Capacitor project whose `webDir` is the web folder. The CI workflow automates this.

Copyright and licensing: only import audio files you have the right to play. YouTube and Google Drive links are links, not sources of extracted audio.