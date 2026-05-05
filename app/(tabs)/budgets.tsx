import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFinance } from '../../src/context/FinanceContext';
import { currentMonthPrefix, expensesInMonth } from '../../src/lib/period';
import { formatMoney, parseAmount } from '../../src/lib/money';

export default function BudgetsScreen() {
  const { ready, colors, settings, expenses, budgets, upsertBudget, removeBudget, expenseCategoryOptions } =
    useFinance();
  const [category, setCategory] = useState<string>(expenseCategoryOptions[0] ?? 'Other');
  const [limitStr, setLimitStr] = useState('');

  const ym = currentMonthPrefix();
  const rows = useMemo(() => {
    const monthExp = expensesInMonth(expenses, ym);
    return budgets.map((b) => {
      const used = monthExp.filter((e) => e.category === b.category).reduce((s, e) => s + e.amount, 0);
      const pct = b.monthlyLimit > 0 ? Math.min(100, (used / b.monthlyLimit) * 100) : 0;
      return { ...b, used, pct, over: used > b.monthlyLimit };
    });
  }, [budgets, expenses, ym]);

  const addBudget = () => {
    const lim = parseAmount(limitStr);
    if (lim === null) {
      Alert.alert('Budget', 'Enter a positive monthly limit.');
      return;
    }
    void (async () => {
      await upsertBudget(category, lim);
      setLimitStr('');
    })();
  };

  const confirmRemove = (id: number, cat: string) => {
    Alert.alert('Remove budget', `Stop tracking budget for ${cat}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void removeBudget(id) },
    ]);
  };

  if (!ready) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          Set a monthly spending cap per category. Progress uses expenses dated in {ym}.
        </Text>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Add or update budget</Text>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Category</Text>
          <View style={styles.chips}>
            {expenseCategoryOptions.map((c) => {
              const active = c === category;
              return (
                <Pressable
                  key={c}
                  onPress={() => setCategory(c)}
                  style={[
                    styles.chip,
                    { borderColor: colors.border, backgroundColor: colors.bg },
                    active && { backgroundColor: colors.accentMuted, borderColor: colors.accent },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: colors.textSecondary },
                      active && { color: colors.accent, fontWeight: '700' },
                    ]}
                  >
                    {c}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Monthly limit</Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: colors.bg, borderColor: colors.border, color: colors.text },
            ]}
            placeholder="0.00"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
            value={limitStr}
            onChangeText={setLimitStr}
          />
          <Pressable
            style={[styles.btn, { backgroundColor: colors.accent }]}
            onPress={addBudget}
          >
            <Text style={styles.btnText}>Save budget</Text>
          </Pressable>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Active budgets</Text>
        {rows.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textMuted }]}>No budgets yet.</Text>
        ) : (
          rows.map((b) => (
            <View key={b.id} style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.rowTop}>
                <Text style={[styles.cat, { color: colors.text }]}>{b.category}</Text>
                <Pressable onPress={() => confirmRemove(b.id, b.category)} hitSlop={8}>
                  <Ionicons name="close-circle-outline" size={24} color={colors.textMuted} />
                </Pressable>
              </View>
              <Text style={[styles.nums, { color: colors.textMuted }]}>
                {formatMoney(b.used, settings.currency)} of {formatMoney(b.monthlyLimit, settings.currency)}
              </Text>
              <View style={[styles.track, { backgroundColor: colors.bgElevated }]}>
                <View
                  style={[
                    styles.fill,
                    { width: `${b.pct}%`, backgroundColor: b.over ? colors.expense : colors.accent },
                  ]}
                />
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20, paddingBottom: 40 },
  hint: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  card: { borderRadius: 16, padding: 18, marginBottom: 20, borderWidth: 1 },
  cardTitle: { fontSize: 17, fontWeight: '600', marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 13 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, marginBottom: 14 },
  btn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  empty: { fontSize: 15 },
  row: { borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cat: { fontSize: 17, fontWeight: '700' },
  nums: { fontSize: 14, marginTop: 6 },
  track: { height: 8, borderRadius: 4, marginTop: 10, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
});
