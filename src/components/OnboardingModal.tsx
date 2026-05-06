import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { COMMON_CURRENCIES } from '../constants';
import { useFinance } from '../context/FinanceContext';
import type { ThemePreference } from '../types/settings';
import type { ThemeColors } from '../theme/colors';

type Props = {
  colors: ThemeColors;
  onDone: () => void | Promise<void>;
};

export function OnboardingModal({ colors, onDone }: Props) {
  const { settings, setSettings, accounts, addAccount } = useFinance();
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [currency, setCurrency] = useState(settings.currency);
  const [theme, setTheme] = useState<ThemePreference>(settings.theme);
  const [accountName, setAccountName] = useState('');
  const [accountKind, setAccountKind] = useState<'cash' | 'card' | 'bank' | 'other'>('cash');
  const [saving, setSaving] = useState(false);

  const canCreateAccount = useMemo(() => accountName.trim().length > 0, [accountName]);

  const finish = async () => {
    setSaving(true);
    try {
      await setSettings({ currency, theme });
      if (canCreateAccount && accounts.length === 0) {
        await addAccount(accountName.trim(), accountKind);
      }
      await onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.45)' }]}>
      <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.topRow}>
          <Text style={[styles.title, { color: colors.text }]}>
            {step === 0 ? 'Welcome' : step === 1 ? 'Preferences' : step === 2 ? 'First account' : 'All set'}
          </Text>
          <Text style={[styles.step, { color: colors.textMuted }]}>
            {step + 1}/4
          </Text>
        </View>

        {step === 0 ? (
          <>
            <Text style={[styles.sub, { color: colors.textMuted }]}>
              Track spending, budgets, goals, and recurring bills in one place.
            </Text>
            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
              <Text style={[styles.h, { color: colors.text }]}>Quick tour</Text>
              <Text style={[styles.p, { color: colors.textSecondary }]}>
                • <Text style={{ fontWeight: '700' }}>Budgets</Text> are monthly caps per category.{'\n'}
                • <Text style={{ fontWeight: '700' }}>Savings goals</Text> track progress toward a target.{'\n'}
                • <Text style={{ fontWeight: '700' }}>Recurring</Text> helps you remember rent / subscriptions.{'\n'}
                • <Text style={{ fontWeight: '700' }}>Splits</Text> let one payment span multiple categories.{'\n'}
                • <Text style={{ fontWeight: '700' }}>Receipts</Text> are stored locally on this device.
              </Text>
              <Text style={[styles.h, { color: colors.text }]}>Your data</Text>
              <Text style={[styles.p, { color: colors.textSecondary }]}>
                Data stays on this device (SQLite). Export a full backup JSON in Settings before switching phones.
              </Text>
            </ScrollView>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <Text style={[styles.sub, { color: colors.textMuted }]}>
              Set defaults. You can change these any time in Settings.
            </Text>
            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
              <Text style={[styles.h, { color: colors.text }]}>Currency</Text>
              <View style={styles.chips}>
                {COMMON_CURRENCIES.slice(0, 8).map((c) => {
                  const active = currency === c;
                  return (
                    <Pressable
                      key={c}
                      onPress={() => setCurrency(c)}
                      style={[
                        styles.chip,
                        { borderColor: colors.border, backgroundColor: colors.card },
                        active && { backgroundColor: colors.accentMuted, borderColor: colors.accent },
                      ]}
                    >
                      <Text style={[styles.chipText, { color: active ? colors.accent : colors.textSecondary }]}>
                        {c}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.h, { color: colors.text }]}>Theme</Text>
              <View style={styles.chips}>
                {(['system', 'light', 'dark'] as const).map((t) => {
                  const active = theme === t;
                  return (
                    <Pressable
                      key={t}
                      onPress={() => setTheme(t)}
                      style={[
                        styles.chip,
                        { borderColor: colors.border, backgroundColor: colors.card },
                        active && { backgroundColor: colors.accentMuted, borderColor: colors.accent },
                      ]}
                    >
                      <Text style={[styles.chipText, { color: active ? colors.accent : colors.textSecondary }]}>
                        {t === 'system' ? 'System' : t === 'light' ? 'Light' : 'Dark'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Text style={[styles.sub, { color: colors.textMuted }]}>
              Accounts label transactions (cash vs card). Skip if you want.
            </Text>
            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
              {accounts.length > 0 ? (
                <View style={[styles.info, { borderColor: colors.border, backgroundColor: colors.bgElevated }]}>
                  <Ionicons name="checkmark-circle-outline" size={18} color={colors.income} />
                  <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                    You already have accounts. We’ll keep them.
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={[styles.h, { color: colors.text }]}>Name</Text>
                  <TextInput
                    value={accountName}
                    onChangeText={setAccountName}
                    placeholder="e.g. Cash"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="words"
                    style={[
                      styles.input,
                      { borderColor: colors.border, backgroundColor: colors.card, color: colors.text },
                    ]}
                  />
                  <Text style={[styles.h, { color: colors.text }]}>Kind</Text>
                  <View style={styles.chips}>
                    {(['cash', 'card', 'bank', 'other'] as const).map((k) => {
                      const active = accountKind === k;
                      return (
                        <Pressable
                          key={k}
                          onPress={() => setAccountKind(k)}
                          style={[
                            styles.chip,
                            { borderColor: colors.border, backgroundColor: colors.card },
                            active && { backgroundColor: colors.accentMuted, borderColor: colors.accent },
                          ]}
                        >
                          <Text style={[styles.chipText, { color: active ? colors.accent : colors.textSecondary }]}>
                            {k === 'cash' ? 'Cash' : k === 'card' ? 'Card' : k === 'bank' ? 'Bank' : 'Other'}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              )}
            </ScrollView>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <Text style={[styles.sub, { color: colors.textMuted }]}>Ready to start tracking.</Text>
            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
              <Text style={[styles.h, { color: colors.text }]}>Tip</Text>
              <Text style={[styles.p, { color: colors.textSecondary }]}>
                Use the Home range filter to focus on specific dates, and Settings to export a full backup JSON.
              </Text>
            </ScrollView>
          </>
        ) : null}

        <View style={styles.footer}>
          <Pressable
            onPress={() => setStep((s) => (s > 0 ? ((s - 1) as 0 | 1 | 2 | 3) : s))}
            disabled={step === 0 || saving}
            style={({ pressed }) => [
              styles.footerBtn,
              { borderColor: colors.border, backgroundColor: colors.card },
              (step === 0 || saving) && { opacity: 0.5 },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={[styles.footerBtnText, { color: colors.textSecondary }]}>Back</Text>
          </Pressable>

          {step < 3 ? (
            <Pressable
              onPress={() => setStep((s) => ((s + 1) as 0 | 1 | 2 | 3))}
              disabled={saving}
              style={({ pressed }) => [
                styles.btn,
                { backgroundColor: colors.accent },
                saving && { opacity: 0.6 },
                pressed && { opacity: 0.9 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Next onboarding step"
            >
              <Text style={styles.btnText}>Next</Text>
            </Pressable>
          ) : (
            <Pressable
              style={[styles.btn, { backgroundColor: colors.accent }, saving && { opacity: 0.6 }]}
              onPress={() => void finish()}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Finish onboarding"
            >
              <Text style={styles.btnText}>{saving ? 'Saving…' : 'Get started'}</Text>
            </Pressable>
          )}
        </View>
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
  topRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 8 },
  step: { fontSize: 13, fontWeight: '700' },
  sub: { fontSize: 15, lineHeight: 22, marginBottom: 16 },
  scroll: { maxHeight: 360, marginBottom: 16 },
  h: { fontSize: 16, fontWeight: '700', marginTop: 12, marginBottom: 8 },
  p: { fontSize: 15, lineHeight: 22 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  chipText: { fontSize: 14, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  info: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  infoText: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  footer: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  footerBtn: { flex: 1, borderRadius: 14, paddingVertical: 16, alignItems: 'center', borderWidth: 1 },
  footerBtnText: { fontSize: 16, fontWeight: '700' },
  btn: { flex: 1, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
