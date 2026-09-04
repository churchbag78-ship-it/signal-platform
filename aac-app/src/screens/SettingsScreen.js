import React from 'react';
import { View, Text, TouchableOpacity, Switch, StyleSheet, SafeAreaView } from 'react-native';
import { useSettings } from '../context/SettingsContext';

const TILE_SIZES = [
  { key: 'small', label: 'Small', hint: 'More tiles per screen' },
  { key: 'medium', label: 'Medium', hint: 'Balanced' },
  { key: 'large', label: 'Large', hint: 'Easier to tap accurately' },
];

export default function SettingsScreen({ navigation }) {
  const { settings, updateSettings } = useSettings();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Done">
          <Text style={styles.headerAction}>Done</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerAction} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tile size</Text>
        {TILE_SIZES.map((size) => (
          <TouchableOpacity
            key={size.key}
            style={styles.row}
            onPress={() => updateSettings({ tileSize: size.key })}
            accessibilityRole="radio"
            accessibilityState={{ checked: settings.tileSize === size.key }}
          >
            <View>
              <Text style={styles.rowLabel}>{size.label}</Text>
              <Text style={styles.rowHint}>{size.hint}</Text>
            </View>
            <View style={[styles.radio, settings.tileSize === size.key && styles.radioSelected]} />
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.section}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowLabel}>High-contrast / CVI mode</Text>
            <Text style={styles.rowHint}>
              Bolder, more separated colors and thicker tile borders — for users with
              cortical/cerebral visual impairment (CVI) or low vision.
            </Text>
          </View>
          <Switch
            value={settings.highContrast}
            onValueChange={(value) => updateSettings({ highContrast: value })}
            accessibilityLabel="Toggle high-contrast mode"
          />
        </View>
      </View>
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
  section: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#777',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#eee',
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  rowHint: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
    maxWidth: 260,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#ccc',
  },
  radioSelected: {
    borderColor: '#1D9E75',
    backgroundColor: '#1D9E75',
  },
});
