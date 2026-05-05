import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ExpenseProvider } from '../src/context/ExpenseContext';

export default function RootLayout() {
  return (
    <ExpenseProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </ExpenseProvider>
  );
}
