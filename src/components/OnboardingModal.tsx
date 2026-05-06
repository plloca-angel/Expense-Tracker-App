import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ThemeColors } from '../theme/colors';

type Props = {
  colors: ThemeColors;
  onDone: () => void;
};

export function OnboardingModal({ colors, onDone }: Props) {
  return (
    <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.45)' }]}>
      <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>Welcome</Text>
        <Text style={[styles.sub, { color: colors.textMuted }]}>
          Inspired by polished planners like Budge — track spending, budgets, goals, and recurring bills in one place.
        </Text>
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={[styles.h, { color: colors.text }]}>How it works</Text>
          <Text style={[styles.p, { color: colors.textSecondary }]}>
            • <Text style={{ fontWeight: '700' }}>Budgets</Text> are monthly caps per category.{'\n'}
            • <Text style={{ fontWeight: '700' }}>Savings goals</Text> track money you set aside toward a target.{'\n'}
            • <Text style={{ fontWeight: '700' }}>Recurring</Text> posts rent, subscriptions, or salary on a schedule.{'\n'}
            • <Text style={{ fontWeight: '700' }}>Accounts</Text> label cash vs card for clearer reporting.
          </Text>
          <Text style={[styles.h, { color: colors.text }]}>Your data</Text>
          <Text style={[styles.p, { color: colors.textSecondary }]}>
            Everything stays on this device (SQLite). Use Settings → full backup JSON before switching phones or
            importing a file.
          </Text>
        </ScrollView>
        <Pressable
          style={[styles.btn, { backgroundColor: colors.accent }]}
          onPress={onDone}
          accessibilityRole="button"
          accessibilityLabel="Continue to app"
        >
          <Text style={styles.btnText}>Get started</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    padding: 20,
    zIndex: 50,
  },
  sheet: {
    borderRadius: 20,
    borderWidth: 1,
    maxHeight: '88%',
    padding: 22,
  },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 8 },
  sub: { fontSize: 15, lineHeight: 22, marginBottom: 16 },
  scroll: { maxHeight: 360, marginBottom: 16 },
  h: { fontSize: 16, fontWeight: '700', marginTop: 12, marginBottom: 8 },
  p: { fontSize: 15, lineHeight: 22 },
  btn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
