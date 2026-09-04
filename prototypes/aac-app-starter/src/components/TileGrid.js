import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { categoryColors } from '../data/boards';

export default function TileGrid({ tiles, onTilePress }) {
  return (
    <View style={styles.grid}>
      {tiles.map((tile) => (
        <TouchableOpacity
          key={tile.id}
          style={[
            styles.tile,
            { backgroundColor: categoryColors[tile.category] || '#888' },
          ]}
          onPress={() => onTilePress(tile)}
          accessibilityLabel={tile.label}
          accessibilityRole="button"
        >
          {/* Swap this Text for an Image once symbol assets are wired in */}
          <Text style={styles.tileLabel}>{tile.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
    gap: 8,
  },
  tile: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  tileLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
