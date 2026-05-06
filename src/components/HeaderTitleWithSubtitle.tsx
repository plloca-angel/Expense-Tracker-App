import { Platform, StyleSheet, Text, View } from 'react-native';
import { AppLogo } from './AppLogo';
import type { ThemeColors } from '../theme/colors';
import { type as typeStyles } from '../theme/tokens';

type Props = {
  title: string;
  subtitle?: string;
  colors: ThemeColors;
};

export function HeaderTitleWithSubtitle({ title, subtitle, colors }: Props) {
  const showSubtitle = Boolean(subtitle) && title !== 'Overview';
  return (
    <View
      style={[
        styles.wrap,
        Platform.OS === 'android' && styles.wrapAndroid,
      ]}
    >
      <View style={styles.titleRow}>
        {title === 'Overview' ? (
          <View style={styles.logoWrap}>
            <AppLogo size={28} />
          </View>
        ) : null}
        <Text style={[typeStyles.title, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
      </View>
      {showSubtitle ? (
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
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoWrap: { marginTop: 0 },
});
