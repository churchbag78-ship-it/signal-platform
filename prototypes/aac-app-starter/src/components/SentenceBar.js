import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

export default function SentenceBar({ tiles, onSpeak, onBackspace }) {
  return (
    <View style={styles.bar}>
      <ScrollView horizontal style={styles.tileRow} showsHorizontalScrollIndicator={false}>
        {tiles.map((tile, i) => (
          <View key={`${tile.id}-${i}`} style={styles.chip}>
            <Text style={styles.chipText}>{tile.label}</Text>
          </View>
        ))}
      </ScrollView>
      <TouchableOpacity onPress={onSpeak} accessibilityLabel="Speak sentence">
        <Text style={styles.icon}>🔊</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onBackspace} accessibilityLabel="Delete last word">
        <Text style={styles.icon}>⌫</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#ddd',
    minHeight: 44,
  },
  tileRow: {
    flex: 1,
    flexDirection: 'row',
  },
  chip: {
    backgroundColor: '#E6F1FB',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 6,
  },
  chipText: {
    color: '#185FA5',
    fontSize: 13,
    fontWeight: '600',
  },
  icon: {
    fontSize: 20,
    marginLeft: 8,
  },
});
