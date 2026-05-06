import { useLayoutEffect } from 'react';
import { Platform } from 'react-native';
import { useNavigation } from 'expo-router';
import { HeaderTitleWithSubtitle } from '../components/HeaderTitleWithSubtitle';
import type { ThemeColors } from '../theme/colors';

export function useTabHeaderSubtitle(title: string, subtitle: string | undefined, colors: ThemeColors) {
  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => <HeaderTitleWithSubtitle title={title} subtitle={subtitle} colors={colors} />,
      headerTitleAlign: Platform.OS === 'ios' ? 'center' : 'left',
    });
  }, [navigation, title, subtitle, colors]);
}
