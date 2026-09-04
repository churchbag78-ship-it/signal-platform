import * as Speech from 'expo-speech';

export function speak(text) {
  if (!text) return;
  Speech.stop(); // avoid overlapping speech
  Speech.speak(text, {
    rate: 0.95,
    pitch: 1.0,
  });
}

export function speakSentence(tiles) {
  const text = tiles.map((t) => t.label).join(' ');
  speak(text);
}
