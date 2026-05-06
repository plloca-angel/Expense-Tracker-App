import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ThemeColors } from '../theme/colors';
import { radii, space, surfaceCard, type as typeStyles } from '../theme/tokens';

type Props = {
  colors: ThemeColors;
  title: string;
  description: string;
  icon?: ReactNode;
};

export function EmptyStateCard({ colors, title, description, icon }: Props) {
  return (
    <View style={[styles.card, surfaceCard(colors, true)]}>
      {icon ? <View style={styles.iconWrap}>{icon}</View> : null}
      <Text style={[typeStyles.bodyMedium, { color: colors.text }]}>{title}</Text>
      <Text style={[typeStyles.body, { color: colors.textMuted, marginTop: space[1] / 2 }]}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: space[2],
    marginBottom: space[2],
    borderRadius: radii.lg,
  },
  iconWrap: { marginBottom: space[1] },
});
