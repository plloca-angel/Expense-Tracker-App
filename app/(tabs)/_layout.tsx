import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';
import { useFinance } from '../../src/context/FinanceContext';

export default function TabLayout() {
  const { ready, colors } = useFinance();
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const show = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hide = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const subShow = Keyboard.addListener(show, () => setKeyboardOpen(true));
    const subHide = Keyboard.addListener(hide, () => setKeyboardOpen(false));
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  const tabBarVisibleStyle = {
    backgroundColor: colors.tabBar,
    borderTopColor: colors.border,
    paddingTop: 4,
    height: 58,
  };

  const tabBarHiddenStyle = {
    height: 0,
    minHeight: 0,
    paddingTop: 0,
    paddingBottom: 0,
    borderTopWidth: 0,
    opacity: 0,
    overflow: 'hidden' as const,
  };

  const tabBarStyle = !ready
    ? {
        height: 0,
        overflow: 'hidden' as const,
        opacity: 0,
        borderTopWidth: 0,
        paddingTop: 0,
      }
    : keyboardOpen
      ? { ...tabBarVisibleStyle, ...tabBarHiddenStyle }
      : tabBarVisibleStyle;

  return (
    <Tabs
      screenOptions={{
        headerShown: ready,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        headerStyle: { backgroundColor: colors.headerBg },
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '600', color: colors.text, fontSize: 18 },
        tabBarStyle,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Overview',
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: 'Activity',
          tabBarIcon: ({ color, size }) => <Ionicons name="reorder-four-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: 'Add',
          tabBarIcon: ({ color, size }) => <Ionicons name="add-circle-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="budgets"
        options={{
          title: 'Budgets & goals',
          tabBarLabel: 'Plans',
          tabBarIcon: ({ color, size }) => <Ionicons name="wallet-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
