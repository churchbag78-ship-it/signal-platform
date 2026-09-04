// Pluggable auto-labeling for photo-to-board tiles.
//
// No cloud vision API is wired up here: this app has no backend to hold an
// API key safely, and shipping a key inside the app bundle would leak it.
// The photo-to-board flow works fully today with manual labeling — the
// suggestion this returns is always treated as an editable starting point,
// never authoritative.
//
// To wire up real auto-labeling later, stand up a small backend endpoint
// that holds your provider credentials (e.g. Google Cloud Vision label
// detection) and call it here, e.g.:
//
//   const response = await fetch('https://your-backend/vision/label', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({ imageUri }),
//   });
//   const { label } = await response.json();
//   return label;
//
// Never call a cloud vision API directly from the app with an embedded key.
export async function suggestLabel(imageUri) {
  return null;
}
