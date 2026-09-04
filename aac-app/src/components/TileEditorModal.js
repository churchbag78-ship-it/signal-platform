import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
} from 'react-native';
import { CATEGORIES, categoryColors } from '../data/boards';

const EMPTY_TILE = { label: '', category: CATEGORIES[0], emoji: '', imageUri: null };

// Add/edit form for a single tile. Photo tiles are created via the
// PhotoToBoardScreen flow (camera/library -> crop/review -> save) and land
// here for label/category edits afterward — this modal itself never opens
// the camera.
export default function TileEditorModal({ visible, initialTile, onSave, onCancel, onDelete }) {
  const [draft, setDraft] = useState(EMPTY_TILE);

  useEffect(() => {
    if (visible) {
      setDraft(initialTile ? { ...EMPTY_TILE, ...initialTile } : EMPTY_TILE);
    }
  }, [visible, initialTile]);

  const isEditing = Boolean(initialTile);
  const canSave = draft.label.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      label: draft.label.trim(),
      category: draft.category,
      emoji: draft.emoji.trim() || null,
      imageUri: draft.imageUri || null,
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{isEditing ? 'Edit tile' : 'Add tile'}</Text>

          {draft.imageUri ? (
            <View style={styles.imagePreviewRow}>
              <Image source={{ uri: draft.imageUri }} style={styles.imagePreview} />
              <TouchableOpacity
                onPress={() => setDraft((d) => ({ ...d, imageUri: null }))}
                accessibilityLabel="Remove photo"
              >
                <Text style={styles.removePhoto}>Remove photo</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <Text style={styles.label}>Word or phrase</Text>
          <TextInput
            style={styles.input}
            value={draft.label}
            onChangeText={(text) => setDraft((d) => ({ ...d, label: text }))}
            placeholder="e.g. Water"
            autoFocus
          />

          {!draft.imageUri ? (
            <>
              <Text style={styles.label}>Icon (optional emoji)</Text>
              <TextInput
                style={styles.input}
                value={draft.emoji}
                onChangeText={(text) => setDraft((d) => ({ ...d, emoji: text }))}
                placeholder="e.g. 💧"
              />
            </>
          ) : null}

          <Text style={styles.label}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryRow}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                onPress={() => setDraft((d) => ({ ...d, category: cat }))}
                style={[
                  styles.categoryChip,
                  { backgroundColor: categoryColors[cat] },
                  draft.category === cat && styles.categoryChipSelected,
                ]}
                accessibilityLabel={`Category ${cat}`}
                accessibilityRole="button"
              >
                <Text style={styles.categoryChipText}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.actions}>
            {isEditing && onDelete ? (
              <TouchableOpacity onPress={onDelete} style={[styles.button, styles.deleteButton]}>
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.button} />
            )}
            <View style={styles.actionsRight}>
              <TouchableOpacity onPress={onCancel} style={[styles.button, styles.cancelButton]}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSave}
                disabled={!canSave}
                style={[styles.button, styles.saveButton, !canSave && styles.saveButtonDisabled]}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 32,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  categoryRow: {
    flexDirection: 'row',
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  categoryChipSelected: {
    borderWidth: 3,
    borderColor: '#111',
  },
  categoryChipText: {
    color: '#fff',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  imagePreviewRow: {
    alignItems: 'center',
    marginBottom: 8,
  },
  imagePreview: {
    width: 96,
    height: 96,
    borderRadius: 8,
    marginBottom: 6,
  },
  removePhoto: {
    color: '#B00020',
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
  },
  actionsRight: {
    flexDirection: 'row',
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  cancelButton: {
    backgroundColor: '#eee',
    marginRight: 8,
  },
  cancelButtonText: {
    color: '#333',
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#1D9E75',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  deleteButton: {
    backgroundColor: '#FBE7E9',
  },
  deleteButtonText: {
    color: '#B00020',
    fontWeight: '600',
  },
});
