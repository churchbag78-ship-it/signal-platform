import React, { useState } from 'react';
import { View, SafeAreaView, StyleSheet, TouchableOpacity, Text } from 'react-native';
import TileGrid from '../components/TileGrid';
import SentenceBar from '../components/SentenceBar';
import { useBoard } from '../context/BoardContext';
import { useSettings } from '../context/SettingsContext';
import { speak, speakSentence } from '../utils/tts';

export default function HomeScreen({ navigation }) {
  const [sentence, setSentence] = useState([]);
  const { board } = useBoard();
  const { settings } = useSettings();

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
      <View style={styles.navBar}>
        <Text style={styles.boardName}>{board.name}</Text>
        <View style={styles.navActions}>
          <TouchableOpacity
            onPress={() => navigation.navigate('BoardEditor')}
            accessibilityLabel="Edit board"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.navIcon}>✏️</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('Settings')}
            accessibilityLabel="Settings"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.navIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      <SentenceBar
        tiles={sentence}
        onSpeak={handleSpeakSentence}
        onBackspace={handleBackspace}
        highContrast={settings.highContrast}
      />
      <View style={styles.gridContainer}>
        <TileGrid
          tiles={board.tiles}
          onTilePress={handleTilePress}
          tileSize={settings.tileSize}
          highContrast={settings.highContrast}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 6,
  },
  boardName: {
    fontSize: 13,
    color: '#999',
    fontWeight: '600',
  },
  navActions: {
    flexDirection: 'row',
  },
  navIcon: {
    fontSize: 18,
    marginLeft: 14,
  },
  gridContainer: {
    flex: 1,
  },
});
