# AAC App — starter scaffold

This is a Phase 1 starting point: a working tile grid + sentence bar with offline
text-to-speech. No board editor or photo-to-board yet — this is the "prove the stack
works" prototype.

## What's here
- `App.js` — navigation shell (currently just Home)
- `src/screens/HomeScreen.js` — main communication screen
- `src/components/TileGrid.js` — tap-to-speak tile grid
- `src/components/SentenceBar.js` — builds and speaks the sentence
- `src/data/boards.js` — sample "core words" board (swap for real symbol data later)
- `src/utils/tts.js` — text-to-speech wrapper (expo-speech)

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

## Next steps (in order)
1. Get this running on your own phone and confirm tap-to-speak works
2. Swap the placeholder tile labels/emoji for real symbol images (Mulberry Symbols
   recommended — free/open license, avoids a licensing cost before you have revenue)
3. Add a board editor screen (add/edit/delete tiles)
4. Add accessibility settings (tile size, high-contrast/CVI mode)
5. Build the photo-to-board flow (camera capture → cloud vision API → crop/review → save)

## Notes
- `expo-sqlite` is included in package.json for when you add persistent board storage —
  not wired up yet, the sample board is just a static JS file for now
- `expo-image-picker` is included for the photo-to-board camera step, also not wired up yet
- Tile colors are hardcoded to match categories — will want this configurable once the
  board editor exists
