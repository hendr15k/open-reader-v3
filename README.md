# Open Reader

**ElevenReader-Alternative** — PDF, TXT, EPUB zu Hörbuch mit TTS.

Eine Open-Source-Text-zu-Sprache-App, die Dateien lokal vorliest und Artikel aus dem Web fetched.

## Features

### 🎧 File Upload & TTS
- **PDF** → Textextraktion via pdf.js (CDN, lazy-loaded)
- **TXT/MD** → Direkter Import
- **EPUB** → Text aus EPUB-ZIP extrahieren
- **HTML** → Tags stripping für sauberen Text
- Drag & Drop oder Klick
- TTS: Play/Pause/Stop, Voice Selection, Speed Control

### 📖 Article Fetching
- URL einfügen → Jina Reader API → clean article view
- Kein API-Key nötig

### 💾 Offline & Library
- IndexedDB: Artikel + Dateien lokal gespeichert
- Reading Timer & Progress

### 🌙 Dark Mode
- System-Preference + manueller Toggle

### 📱 Mobile-First
- Responsive, Bottom Navigation, Capacitor-Ready
- Android APK via GitHub Actions

## Tech Stack

- React 18 + TypeScript + Vite
- TailwindCSS
- Web Speech API (TTS)
- pdf.js (PDF extraction)
- IndexedDB via idb
- Capacitor (Android)

## Getting Started

```bash
npm install
npm run dev           # Dev server
npm run build         # Production build
npm run android:build # Build + sync + Android Studio öffnen
npm run android:sync  # Sync only
npm run android:open  # Android Studio öffnen
```

## Screenshots & APK

- **Web:** https://hendr15k.github.io/open-reader/
- **APK / Nightly:** Siehe [Releases](https://github.com/hendr15k/open-reader/releases)

## Build Status

Das Projekt baut erfolgreich lokal via `npm run build`.
