import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { V2AppProvider } from './src/context/V2AppContext';
import { V2AppNavigator } from './src/navigation/AppNavigator';

export default function AppV2() {
  return (
    <SafeAreaProvider>
      <V2AppProvider>
        <StatusBar style="dark" />
        <V2AppNavigator />
      </V2AppProvider>
    </SafeAreaProvider>
  );
}
