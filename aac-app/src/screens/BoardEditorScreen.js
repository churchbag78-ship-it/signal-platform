import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Alert } from 'react-native';
import TileGrid from '../components/TileGrid';
import TileEditorModal from '../components/TileEditorModal';
import { useBoard } from '../context/BoardContext';
import { useSettings } from '../context/SettingsContext';

export default function BoardEditorScreen({ navigation }) {
  const { board, addTile, updateTile, removeTile, resetToDefaultBoard } = useBoard();
  const { settings } = useSettings();
  const [editingTile, setEditingTile] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  const openAddModal = () => {
    setEditingTile(null);
    setModalVisible(true);
  };

  const openEditModal = (tile) => {
    setEditingTile(tile);
    setModalVisible(true);
  };

  const handleSave = (tileData) => {
    if (editingTile) {
      updateTile(editingTile.id, tileData);
    } else {
      addTile(tileData);
    }
    setModalVisible(false);
  };

  const handleDelete = () => {
    if (!editingTile) return;
    removeTile(editingTile.id);
    setModalVisible(false);
  };

  const handleReset = () => {
    Alert.alert(
      'Reset board?',
      'This replaces your current tiles with the default core-words board.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: resetToDefaultBoard },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Done editing">
          <Text style={styles.headerAction}>Done</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit board</Text>
        <TouchableOpacity onPress={handleReset} accessibilityLabel="Reset board to default">
          <Text style={[styles.headerAction, styles.resetAction]}>Reset</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.toolbarButton} onPress={openAddModal}>
          <Text style={styles.toolbarButtonText}>+ Add tile</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toolbarButton, styles.toolbarButtonSecondary]}
          onPress={() => navigation.navigate('PhotoToBoard')}
        >
          <Text style={styles.toolbarButtonText}>📷 Add from photo</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.hint}>Tap a tile to edit it.</Text>

      <TileGrid
        tiles={board.tiles}
        onTilePress={openEditModal}
        tileSize={settings.tileSize}
        highContrast={settings.highContrast}
      />

      <TileEditorModal
        visible={modalVisible}
        initialTile={editingTile}
        onSave={handleSave}
        onCancel={() => setModalVisible(false)}
        onDelete={editingTile ? handleDelete : undefined}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#ddd',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  headerAction: {
    fontSize: 15,
    color: '#185FA5',
    fontWeight: '600',
  },
  resetAction: {
    color: '#B00020',
  },
  toolbar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  toolbarButton: {
    backgroundColor: '#1D9E75',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    marginRight: 10,
  },
  toolbarButtonSecondary: {
    backgroundColor: '#378ADD',
  },
  toolbarButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  hint: {
    color: '#777',
    fontSize: 12,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
  },
});
