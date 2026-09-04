import AsyncStorage from '@react-native-async-storage/async-storage';

// A single board is stored as one JSON blob. This app only supports editing
// the one active board today (per the starter's stated scope); if linked
// multi-board navigation is added later, swap the key for an array of boards
// plus an "active board id" pointer without changing this module's API.
const BOARD_KEY = 'aac.board.v1';

export async function loadBoard() {
  const raw = await AsyncStorage.getItem(BOARD_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function saveBoard(board) {
  await AsyncStorage.setItem(BOARD_KEY, JSON.stringify(board));
}
