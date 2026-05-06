import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { OnboardingModal } from '../src/components/OnboardingModal';
import { FinanceProvider, useFinance } from '../src/context/FinanceContext';

function ThemedRoot() {
  const { isDark, colors, needsOnboarding, dismissOnboarding } = useFinance();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="analytics"
          options={{
            presentation: 'fullScreenModal',
            headerShown: true,
            headerStyle: { backgroundColor: colors.headerBg },
            headerTintColor: colors.accent,
            headerTitleStyle: { color: colors.text, fontWeight: '600' },
            title: 'Analytics',
          }}
        />
        <Stack.Screen
          name="edit-transaction"
          options={{
            presentation: 'modal',
            headerShown: true,
            headerStyle: { backgroundColor: colors.headerBg },
            headerTintColor: colors.accent,
            headerTitleStyle: { color: colors.text, fontWeight: '600' },
            title: 'Edit',
          }}
        />
        <Stack.Screen
          name="month-snapshot"
          options={{
            presentation: 'fullScreenModal',
            headerShown: true,
            headerStyle: { backgroundColor: colors.headerBg },
            headerTintColor: colors.accent,
            headerTitleStyle: { color: colors.text, fontWeight: '600' },
            title: 'Month snapshot',
          }}
        />
      </Stack>
      {needsOnboarding ? (
        <OnboardingModal colors={colors} onDone={() => dismissOnboarding()} />
      ) : null}
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <FinanceProvider>
        <ThemedRoot />
      </FinanceProvider>
    </SafeAreaProvider>
  );
}
