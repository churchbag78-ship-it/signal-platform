# AAC App

A tap-to-speak communication board app with offline text-to-speech, a board
editor, accessibility settings, and a photo-to-board flow.

## What's here
- `App.js` — navigation shell: Home, Board editor, Settings, Add-from-photo
  (the last three present as modal screens)
- `src/screens/HomeScreen.js` — main communication screen
- `src/screens/BoardEditorScreen.js` — add/edit/delete tiles on the board
- `src/screens/SettingsScreen.js` — tile size + high-contrast/CVI mode
- `src/screens/PhotoToBoardScreen.js` — camera/library capture → crop/review → save as a tile
- `src/components/TileGrid.js` — tap-to-speak tile grid (size + contrast aware, renders photo tiles)
- `src/components/SentenceBar.js` — builds and speaks the sentence
- `src/components/TileEditorModal.js` — add/edit form used by the board editor
- `src/context/BoardContext.js`, `src/context/SettingsContext.js` — app state, persisted locally
- `src/storage/boardStorage.js`, `src/storage/settingsStorage.js` — AsyncStorage read/write
- `src/data/boards.js` — seed "core words" board + category color palettes (default and high-contrast)
- `src/utils/tts.js` — text-to-speech wrapper (expo-speech)
- `src/utils/vision.js` — pluggable auto-label hook for photo tiles (stubbed, see below)

## Setup

You'll need Node.js installed. Then:

```bash
npm install -g expo-cli
cd aac-app
npm install
npx expo start
```

This opens the Expo dev tools. Scan the QR code with the Expo Go app on your phone
(iOS or Android) to run it live on your device — no build step needed for development.

## Status vs. the original Phase 1 plan

1. ✅ Tap-to-speak works, now with a real board editor instead of only the
   static sample board.
2. ⚠️ Real symbol images: **not done.** Swapping in a licensed symbol set
   (e.g. Mulberry Symbols) means adding real image assets for hundreds of
   words plus attribution/licensing — that's an asset-sourcing task, not
   something to fabricate here. What *is* done: tiles now support an
   `imageUri` (rendered in place of the emoji/label icon), so dropping in a
   real symbol library later is a data change, not a code change — see
   `src/data/boards.js` and `TileGrid.js`.
3. ✅ Board editor screen — add/edit/delete tiles, choose category/color/emoji,
   persisted locally via AsyncStorage (`src/context/BoardContext.js`).
4. ✅ Accessibility settings — tile size (small/medium/large) and a
   high-contrast/CVI color mode, persisted locally (`SettingsContext.js`).
5. ✅ Photo-to-board flow — camera or library capture, native crop
   (`allowsEditing`), review screen with label + category, saved as a tile.
   ⚠️ Auto-labeling from a cloud vision API is a documented stub
   (`src/utils/vision.js`) that always returns no suggestion: there's no
   backend here to hold API credentials safely, and embedding a key in the
   app would leak it. The flow works fully with manual labels today: wire a
   real backend endpoint into `suggestLabel()` when you have one.

## Notes
- Persistence uses `@react-native-async-storage/async-storage` (not
  `expo-sqlite`, which the original scaffold listed but never wired up) —
  a single JSON board blob and a settings blob are enough at this scale and
  need no schema/migration work.
- Tile colors come from `categoryColors` / `highContrastCategoryColors` in
  `src/data/boards.js`; add a new category there before using it as a tile's
  `category`.
