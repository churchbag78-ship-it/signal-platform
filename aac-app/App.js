import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from './src/screens/HomeScreen';
import BoardEditorScreen from './src/screens/BoardEditorScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import PhotoToBoardScreen from './src/screens/PhotoToBoardScreen';
import { BoardProvider } from './src/context/BoardContext';
import { SettingsProvider } from './src/context/SettingsContext';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <SettingsProvider>
      <BoardProvider>
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen
              name="BoardEditor"
              component={BoardEditorScreen}
              options={{ presentation: 'modal' }}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{ presentation: 'modal' }}
            />
            <Stack.Screen
              name="PhotoToBoard"
              component={PhotoToBoardScreen}
              options={{ presentation: 'modal' }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </BoardProvider>
    </SettingsProvider>
  );
}
