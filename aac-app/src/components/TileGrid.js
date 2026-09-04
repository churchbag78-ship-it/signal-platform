import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { categoryColors, highContrastCategoryColors } from '../data/boards';

// tileSize controls how many tiles fit per row — bigger tiles are easier to
// hit accurately for users with fine motor-control difficulty.
const WIDTH_BY_SIZE = {
  small: '22%',
  medium: '30%',
  large: '47%',
};

const FONT_BY_SIZE = {
  small: 12,
  medium: 14,
  large: 18,
};

const ICON_FONT_BY_SIZE = {
  small: 22,
  medium: 30,
  large: 42,
};

export default function TileGrid({ tiles, onTilePress, onTileLongPress, tileSize = 'medium', highContrast = false }) {
  const palette = highContrast ? highContrastCategoryColors : categoryColors;
  const width = WIDTH_BY_SIZE[tileSize] || WIDTH_BY_SIZE.medium;

  return (
    <View style={styles.grid}>
      {tiles.map((tile) => (
        <TouchableOpacity
          key={tile.id}
          style={[
            styles.tile,
            { width, backgroundColor: palette[tile.category] || palette.other },
            highContrast && styles.tileHighContrastBorder,
          ]}
          onPress={() => onTilePress(tile)}
          onLongPress={onTileLongPress ? () => onTileLongPress(tile) : undefined}
          accessibilityLabel={tile.label}
          accessibilityRole="button"
        >
          {tile.imageUri ? (
            <Image source={{ uri: tile.imageUri }} style={styles.tileImage} resizeMode="cover" />
          ) : tile.emoji ? (
            <Text style={[styles.tileIcon, { fontSize: ICON_FONT_BY_SIZE[tileSize] }]}>{tile.emoji}</Text>
          ) : null}
          <Text style={[styles.tileLabel, { fontSize: FONT_BY_SIZE[tileSize] }]}>{tile.label}</Text>
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
    aspectRatio: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    overflow: 'hidden',
  },
  tileHighContrastBorder: {
    borderWidth: 2,
    borderColor: '#000',
  },
  tileImage: {
    width: '70%',
    height: '55%',
    borderRadius: 6,
    marginBottom: 4,
  },
  tileIcon: {
    marginBottom: 2,
  },
  tileLabel: {
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
  },
});
