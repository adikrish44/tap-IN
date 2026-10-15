# /chimpanzee BRICKS — Edition 03

A **separate** brick-inspired, tactile, animated edition of /chimpanzee. The earlier original app and PULSE edition are untouched. This is an independent web/PWA project and Android debug build under `bricks/`.

## Device music import (Edition 03.1)

Tap **Add music from device** on the first Home screen, inside a live station, or on the Queue page. The native Android picker accepts supported audio files (MP3/M4A/WAV and others); after picking files the app opens **My Crate**, where each imported song can be played offline. Files stay in this device's IndexedDB and are **not uploaded or broadcast to listeners**. The shared queue continues to support original beats and permitted HTTPS audio links.

## What it includes

- Animated `/chimpanzee` brick logo, splash assembly, 3D bricks, plastic-stud controls, hover lifts, tactile press motion, rotating record and reactive Web Audio visualization.
- Responsive mobile and desktop experiences, with **Slate** default and **Paper** alternative.
- Six **original synthesized tracks** produced locally with the Web Audio API, at six different tempos and melodic patterns. No external music service is required to hear these after enabling sound.
- WebSocket-backed room creation, a rotating 4-digit PIN (every 2 minutes), joins, live member presence, live chat, emoji reactions, queue reorder, selected track and playback timing synchronization, host-only closure, and host-controlled admin permissions (press and hold).
- Shared original synth beats stay approximately in sync across clients using server time. Latency and browser timer behavior can still cause drift; this is not sample-accurate broadcast audio.
- HTTPS direct audio links can be shared when the user has permission, with best-effort HTML Audio timing sync (host-dependent bandwidth, CORS and browser behavior).
- YouTube links can be queued and opened in the **official visible YouTube embedded player**. YouTube playback remains per-device, unsynchronized and subject to YouTube restrictions; no audio extraction, rebroadcast, or circumvention.
- Up to 12 shared Google Drive folder URLs can be saved to a station. The app **does not index the contents of a shared Drive folder or stream those files** from just the URL.
- User audio files can be imported to IndexedDB, played **only on the local device** and re-opened offline. Maximum 60 MB per imported file, subject to browser quota and codec support.

## Try locally

```sh
cd bricks
npm install
npm start
```

Open `http://localhost:3000` in two tabs or two devices on the same accessible network. Click **Create a station** on the first, copy the 4-digit PIN and join from the other. Tap **Enable sound** on both devices before playing an original synthesized track, as browsers block autoplay without a gesture.

For devices on different networks, deploy the WebSocket server on an HTTPS/WSS capable Node host, e.g. a Node/Docker service supporting persistent WebSocket connections. Enter the server's `wss://.../socket` URL in **Settings** for Android devices or a separately hosted static PWA. Do not use static-only serverless hosting for the WebSocket endpoint.

## Android test APK

Go to GitHub **Actions → Build chimpanzee BRICKS Android APK**. On success, download the `chimpanzee-bricks-android-debug-apk` artifact, extract `app-debug.apk`, and install on Android. This is a debug APK, not a Play Store signing/release process. Android and iOS cannot use each other's install formats. The app is packaged as a Capacitor WebView; functionality depends on OS permissions and WebView capabilities.

## Security and production limitations

This is a tested MVP, **not a production-certified music streaming service**. Rooms are ephemeral and in-memory, so they disappear on process restart. There is no registered account system, encrypted room identity, playback DRM, guaranteed low-latency sync, scalable media relay, push-to-talk, moderation automation or cloud persistence. PINs are low-entropy invitation codes; treat room content as non-sensitive. In production, use TLS, origin/IP rate-limiting, stronger invite authentication, persistent state, backend telemetry, unit/integration tests, privacy policy, consent and rights management.

## Project structure

- `web/index.html`, `web/styles.css`, `web/app.js`, `web/audio.js` — brick-inspired PWA interface and original synth player
- `web/sw.js`, `web/manifest.webmanifest`, `web/icon.svg` — offline shell and brand
- `server/index.js` — small Node WebSocket server, API validation and static delivery
- `android/IconMaker.java` — local Android launcher icon generator
- `.github/workflows/android-bricks-apk.yml` — Android 7 Capacitor build
- `tests/station.test.js` — station track validation smoke tests

Created specifically for the /chimpanzee idea, without representing this app as an official LEGO product or using their brand imagery.