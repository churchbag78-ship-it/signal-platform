import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useBoard } from '../context/BoardContext';
import { CATEGORIES, categoryColors } from '../data/boards';
import { suggestLabel } from '../utils/vision';

// Camera/library capture -> crop/review -> save, per the starter README's
// planned photo-to-board flow. Cropping uses ImagePicker's built-in native
// editor (allowsEditing) rather than a separate crop library, since it
// covers the "crop before saving" need without extra native dependencies.
export default function PhotoToBoardScreen({ navigation }) {
  const { addTile } = useBoard();
  const [imageUri, setImageUri] = useState(null);
  const [label, setLabel] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [labeling, setLabeling] = useState(false);

  const runAutoLabel = async (uri) => {
    setLabeling(true);
    try {
      const suggestion = await suggestLabel(uri);
      if (suggestion) setLabel(suggestion);
    } finally {
      setLabeling(false);
    }
  };

  const pickFrom = async (source) => {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        'Permission needed',
        `Allow ${source === 'camera' ? 'camera' : 'photo library'} access to add a photo tile.`
      );
      return;
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.7 })
        : await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, quality: 0.7 });

    if (result.canceled || !result.assets?.length) return;

    const uri = result.assets[0].uri;
    setImageUri(uri);
    runAutoLabel(uri);
  };

  const handleRetake = () => {
    setImageUri(null);
    setLabel('');
  };

  const handleSave = () => {
    if (!label.trim()) return;
    addTile({ label: label.trim(), category, imageUri, emoji: null });
    navigation.goBack();
  };

  if (!imageUri) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Cancel">
            <Text style={styles.headerAction}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add from photo</Text>
          <View style={styles.headerAction} />
        </View>
        <View style={styles.pickContainer}>
          <TouchableOpacity style={styles.pickButton} onPress={() => pickFrom('camera')}>
            <Text style={styles.pickButtonText}>📷 Take a photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.pickButton} onPress={() => pickFrom('library')}>
            <Text style={styles.pickButtonText}>🖼 Choose from library</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleRetake} accessibilityLabel="Retake photo">
          <Text style={styles.headerAction}>Retake</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Review tile</Text>
        <View style={styles.headerAction} />
      </View>

      <ScrollView contentContainerStyle={styles.reviewContainer}>
        <Image source={{ uri: imageUri }} style={styles.preview} />

        <Text style={styles.label}>Word or phrase</Text>
        {labeling ? (
          <View style={styles.labelingRow}>
            <ActivityIndicator size="small" />
            <Text style={styles.labelingText}>Checking for a suggestion…</Text>
          </View>
        ) : null}
        <TextInput
          style={styles.input}
          value={label}
          onChangeText={setLabel}
          placeholder="Type what this photo means, e.g. Grandma's house"
          autoFocus
        />

        <Text style={styles.label}>Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              onPress={() => setCategory(cat)}
              style={[
                styles.categoryChip,
                { backgroundColor: categoryColors[cat] },
                category === cat && styles.categoryChipSelected,
              ]}
            >
              <Text style={styles.categoryChipText}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <TouchableOpacity
          style={[styles.saveButton, !label.trim() && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!label.trim()}
        >
          <Text style={styles.saveButtonText}>Save tile</Text>
        </TouchableOpacity>
      </ScrollView>
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
    minWidth: 44,
  },
  pickContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  pickButton: {
    backgroundColor: '#378ADD',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
    width: '100%',
    alignItems: 'center',
  },
  pickButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  reviewContainer: {
    padding: 16,
  },
  preview: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: '#eee',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    marginBottom: 6,
    marginTop: 10,
  },
  labelingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  labelingText: {
    marginLeft: 8,
    color: '#888',
    fontSize: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
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
  saveButton: {
    backgroundColor: '#1D9E75',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 24,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
