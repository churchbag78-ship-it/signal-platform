import React, { useState } from 'react';
import { View, SafeAreaView, StyleSheet } from 'react-native';
import TileGrid from '../components/TileGrid';
import SentenceBar from '../components/SentenceBar';
import { coreBoard } from '../data/boards';
import { speak, speakSentence } from '../utils/tts';

export default function HomeScreen() {
  const [sentence, setSentence] = useState([]);

  const handleTilePress = (tile) => {
    setSentence((prev) => [...prev, tile]);
    speak(tile.label); // speak each word as it's tapped, common AAC convention
  };

  const handleSpeakSentence = () => {
    speakSentence(sentence);
  };

  const handleBackspace = () => {
    setSentence((prev) => prev.slice(0, -1));
  };

  return (
    <SafeAreaView style={styles.container}>
      <SentenceBar
        tiles={sentence}
        onSpeak={handleSpeakSentence}
        onBackspace={handleBackspace}
      />
      <View style={styles.gridContainer}>
        <TileGrid tiles={coreBoard.tiles} onTilePress={handleTilePress} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  gridContainer: {
    flex: 1,
  },
});
