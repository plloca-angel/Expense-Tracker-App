import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { FinanceProvider, useFinance } from '../src/context/FinanceContext';

function ThemedRoot() {
  const { isDark, colors } = useFinance();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="month-snapshot"
          options={{
            headerShown: true,
            title: 'Month snapshot',
            headerStyle: { backgroundColor: colors.headerBg },
            headerTintColor: colors.text,
            headerTitleStyle: { fontWeight: '600', color: colors.text, fontSize: 18 },
            contentStyle: { backgroundColor: colors.bg },
          }}
        />
      </Stack>
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
