import { Platform, StyleSheet, Text, View } from 'react-native';
import type { ThemeColors } from '../theme/colors';
import { type as typeStyles } from '../theme/tokens';

type Props = {
  title: string;
  subtitle?: string;
  colors: ThemeColors;
};

export function HeaderTitleWithSubtitle({ title, subtitle, colors }: Props) {
  return (
    <View
      style={[
        styles.wrap,
        Platform.OS === 'android' && styles.wrapAndroid,
      ]}
    >
      <Text style={[typeStyles.title, { color: colors.text }]} numberOfLines={1}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={[typeStyles.navSubtitle, { color: colors.textMuted }]} numberOfLines={2}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', maxWidth: 280 },
  wrapAndroid: { alignItems: 'flex-start' },
});
