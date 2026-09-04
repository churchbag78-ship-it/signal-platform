import AsyncStorage from '@react-native-async-storage/async-storage';

const SETTINGS_KEY = 'aac.settings.v1';

export const defaultSettings = {
  tileSize: 'medium', // 'small' | 'medium' | 'large'
  highContrast: false, // high-contrast / CVI-friendly palette
};

export async function loadSettings() {
  const raw = await AsyncStorage.getItem(SETTINGS_KEY);
  if (!raw) return defaultSettings;
  return { ...defaultSettings, ...JSON.parse(raw) };
}

export async function saveSettings(settings) {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
