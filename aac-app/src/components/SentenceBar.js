import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

export default function SentenceBar({ tiles, onSpeak, onBackspace, highContrast = false }) {
  return (
    <View style={[styles.bar, highContrast && styles.barHighContrast]}>
      <ScrollView horizontal style={styles.tileRow} showsHorizontalScrollIndicator={false}>
        {tiles.map((tile, i) => (
          <View key={`${tile.id}-${i}`} style={[styles.chip, highContrast && styles.chipHighContrast]}>
            <Text style={[styles.chipText, highContrast && styles.chipTextHighContrast]}>{tile.label}</Text>
          </View>
        ))}
      </ScrollView>
      <TouchableOpacity
        onPress={onSpeak}
        accessibilityLabel="Speak sentence"
        accessibilityRole="button"
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={styles.icon}>🔊</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onBackspace}
        accessibilityLabel="Delete last word"
        accessibilityRole="button"
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
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
  barHighContrast: {
    borderBottomWidth: 2,
    borderBottomColor: '#000',
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
  chipHighContrast: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
  },
  chipText: {
    color: '#185FA5',
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextHighContrast: {
    color: '#000',
  },
  icon: {
    fontSize: 20,
    marginLeft: 8,
  },
});
