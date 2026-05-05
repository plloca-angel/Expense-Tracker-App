import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { FinanceProvider, useFinance } from '../src/context/FinanceContext';

function ThemedRoot() {
  const { isDark, colors } = useFinance();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
    </View>
  );
}

export default function RootLayout() {
  return (
    <FinanceProvider>
      <ThemedRoot />
    </FinanceProvider>
  );
}
