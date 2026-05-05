import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
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

type TabMode = 'budgets' | 'goals' | 'recurring';

export default function BudgetsScreen() {
  const {
    ready,
    colors,
    settings,
    expenses,
    budgets,
    goals,
    upsertBudget,
    removeBudget,
    expenseCategoryOptions,
    incomeCategoryOptions,
    addGoal,
    updateGoalSaved,
    removeGoal,
    accounts,
    recurringItems,
    addRecurring,
    removeRecurring,
    postRecurringForMonth,
    refresh,
  } = useFinance();
  const [mode, setMode] = useState<TabMode>('budgets');
  const [category, setCategory] = useState<string>(expenseCategoryOptions[0] ?? 'Other');
  const [limitStr, setLimitStr] = useState('');
  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalDeadline, setGoalDeadline] = useState('');
  const [savedDrafts, setSavedDrafts] = useState<Record<number, string>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [recTitle, setRecTitle] = useState('');
  const [recAmount, setRecAmount] = useState('');
  const [recCategory, setRecCategory] = useState<string>(expenseCategoryOptions[0] ?? 'Other');
  const [recKind, setRecKind] = useState<'expense' | 'income'>('expense');
  const [recDay, setRecDay] = useState('1');
  const [recNote, setRecNote] = useState('');
  const [recAccountId, setRecAccountId] = useState<number | null>(null);

  useEffect(() => {
    const first = expenseCategoryOptions[0] ?? 'Other';
    if (!expenseCategoryOptions.includes(category)) setCategory(first);
  }, [expenseCategoryOptions, category]);

  useEffect(() => {
    const opts = recKind === 'expense' ? expenseCategoryOptions : incomeCategoryOptions;
    const first = opts[0] ?? 'Other';
    if (!opts.includes(recCategory)) setRecCategory(first);
  }, [expenseCategoryOptions, incomeCategoryOptions, recKind, recCategory]);

  useEffect(() => {
    const next: Record<number, string> = {};
    for (const g of goals) next[g.id] = String(g.savedAmount);
    setSavedDrafts(next);
  }, [goals]);

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

  const addSavingsGoal = () => {
    const name = goalName.trim();
    if (!name) {
      Alert.alert('Goal', 'Enter a name.');
      return;
    }
    const t = parseAmount(goalTarget);
    if (t === null) {
      Alert.alert('Goal', 'Enter a positive target amount.');
      return;
    }
    const dl = goalDeadline.trim();
    if (dl && !/^\d{4}-\d{2}-\d{2}$/.test(dl)) {
      Alert.alert('Goal', 'Deadline must be YYYY-MM-DD or empty.');
      return;
    }
    void (async () => {
      await addGoal({ name, targetAmount: t, deadline: dl || null });
      setGoalName('');
      setGoalTarget('');
      setGoalDeadline('');
    })();
  };

  const confirmRemoveBudget = (id: number, cat: string) => {
    Alert.alert('Remove budget', `Stop tracking budget for ${cat}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void removeBudget(id) },
    ]);
  };

  const addRecurringItem = () => {
    const title = recTitle.trim();
    if (!title) {
      Alert.alert('Recurring', 'Enter a name (e.g. Rent, Netflix).');
      return;
    }
    const amt = parseAmount(recAmount);
    if (amt === null) {
      Alert.alert('Recurring', 'Enter a positive amount.');
      return;
    }
    const d = Number.parseInt(recDay, 10);
    if (!Number.isFinite(d) || d < 1 || d > 28) {
      Alert.alert('Recurring', 'Day of month must be 1–28.');
      return;
    }
    void (async () => {
      await addRecurring({
        title,
        amount: amt,
        category: recCategory,
        kind: recKind,
        dayOfMonth: d,
        accountId: recAccountId,
        note: recNote.trim() || null,
      });
      setRecTitle('');
      setRecAmount('');
      setRecDay('1');
      setRecNote('');
      setRecAccountId(null);
    })();
  };

  const postRecurring = () => {
    void (async () => {
      const n = await postRecurringForMonth(ym);
      Alert.alert('Recurring', n === 0 ? 'Nothing due to post for this month (already posted or none active).' : `Posted ${n} item(s) for ${ym}.`);
    })();
  };

  const confirmRemoveGoal = (id: number, name: string) => {
    Alert.alert('Remove goal', `Delete “${name}”?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void removeGoal(id) },
    ]);
  };

  const applySaved = (id: number) => {
    const raw = savedDrafts[id] ?? '0';
    const n = Number.parseFloat(raw.replace(/,/g, ''));
    if (!Number.isFinite(n) || n < 0) {
      Alert.alert('Invalid amount');
      return;
    }
    void updateGoalSaved(id, Math.round(n * 100) / 100);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
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
      <View style={styles.modeRow}>
        {(
          [
            ['budgets', 'Budgets'],
            ['goals', 'Goals'],
            ['recurring', 'Recurring'],
          ] as const
        ).map(([key, label]) => (
          <Pressable
            key={key}
            onPress={() => setMode(key)}
            style={[
              styles.modeBtn,
              { borderColor: colors.border, backgroundColor: colors.card },
              mode === key && { backgroundColor: colors.accent, borderColor: colors.accent },
            ]}
          >
            <Text
              style={[
                styles.modeBtnText,
                { color: colors.textSecondary },
                mode === key && { color: '#fff', fontWeight: '700' },
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'on-drag' : 'none'}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.accent} />
        }
      >
        {mode === 'budgets' ? (
          <>
            <Text style={[styles.hint, { color: colors.textMuted }]}>
              Monthly cap per category. Progress uses expenses in {ym}.
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
              <Pressable style={[styles.btn, { backgroundColor: colors.accent }]} onPress={addBudget}>
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
                    <Pressable onPress={() => confirmRemoveBudget(b.id, b.category)} hitSlop={8}>
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
          </>
        ) : mode === 'goals' ? (
          <>
            <Text style={[styles.hint, { color: colors.textMuted }]}>
              Track savings targets. Update “saved so far” as you set money aside (manual progress).
            </Text>

            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>New goal</Text>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Name</Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.bg, borderColor: colors.border, color: colors.text },
                ]}
                placeholder="e.g. Emergency fund"
                placeholderTextColor={colors.textMuted}
                value={goalName}
                onChangeText={setGoalName}
              />
              <Text style={[styles.label, { color: colors.textSecondary }]}>Target amount</Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.bg, borderColor: colors.border, color: colors.text },
                ]}
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                value={goalTarget}
                onChangeText={setGoalTarget}
              />
              <Text style={[styles.label, { color: colors.textSecondary }]}>Deadline (optional)</Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.bg, borderColor: colors.border, color: colors.text },
                ]}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textMuted}
                value={goalDeadline}
                onChangeText={setGoalDeadline}
              />
              <Pressable style={[styles.btn, { backgroundColor: colors.income }]} onPress={addSavingsGoal}>
                <Text style={styles.btnText}>Add goal</Text>
              </Pressable>
            </View>

            <Text style={[styles.sectionTitle, { color: colors.text }]}>Your goals</Text>
            {goals.length === 0 ? (
              <Text style={[styles.empty, { color: colors.textMuted }]}>No savings goals yet.</Text>
            ) : (
              goals.map((g) => {
                const pct = g.targetAmount > 0 ? Math.min(100, (g.savedAmount / g.targetAmount) * 100) : 0;
                return (
                  <View key={g.id} style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.rowTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.cat, { color: colors.text }]}>{g.name}</Text>
                        {g.deadline ? (
                          <Text style={[styles.deadline, { color: colors.textMuted }]}>By {g.deadline}</Text>
                        ) : null}
                      </View>
                      <Pressable onPress={() => confirmRemoveGoal(g.id, g.name)} hitSlop={8}>
                        <Ionicons name="trash-outline" size={22} color={colors.danger} />
                      </Pressable>
                    </View>
                    <View style={[styles.track, { backgroundColor: colors.bgElevated }]}>
                      <View
                        style={[styles.fill, { width: `${pct}%`, backgroundColor: colors.income }]}
                      />
                    </View>
                    <Text style={[styles.nums, { color: colors.textMuted }]}>
                      {formatMoney(g.savedAmount, settings.currency)} / {formatMoney(g.targetAmount, settings.currency)}
                    </Text>
                    <Text style={[styles.label, { color: colors.textSecondary, marginTop: 10 }]}>Saved amount</Text>
                    <View style={styles.savedRow}>
                      <TextInput
                        style={[
                          styles.savedInput,
                          { backgroundColor: colors.bg, borderColor: colors.border, color: colors.text },
                        ]}
                        keyboardType="decimal-pad"
                        value={savedDrafts[g.id] ?? ''}
                        onChangeText={(t) => setSavedDrafts((prev) => ({ ...prev, [g.id]: t }))}
                      />
                      <Pressable
                        style={[styles.applyBtn, { backgroundColor: colors.accent }]}
                        onPress={() => applySaved(g.id)}
                      >
                        <Text style={styles.applyBtnText}>Apply</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })
            )}
          </>
        ) : (
          <>
            <Text style={[styles.hint, { color: colors.textMuted }]}>
              Bills and subscriptions (Budge-style). Post creates real transactions for {ym} when not already posted.
            </Text>
            <Pressable
              style={[styles.btn, { backgroundColor: colors.income, marginBottom: 16 }]}
              onPress={postRecurring}
            >
              <Text style={styles.btnText}>Post due items for {ym}</Text>
            </Pressable>

            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>New recurring</Text>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Name</Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.bg, borderColor: colors.border, color: colors.text },
                ]}
                placeholder="Rent, Netflix…"
                placeholderTextColor={colors.textMuted}
                value={recTitle}
                onChangeText={setRecTitle}
              />
              <Text style={[styles.label, { color: colors.textSecondary }]}>Type</Text>
              <View style={styles.recKindRow}>
                {(['expense', 'income'] as const).map((k) => (
                  <Pressable
                    key={k}
                    onPress={() => setRecKind(k)}
                    style={[
                      styles.modeBtn,
                      { borderColor: colors.border, backgroundColor: colors.bg },
                      recKind === k && { backgroundColor: colors.accent, borderColor: colors.accent },
                    ]}
                  >
                    <Text
                      style={[
                        styles.modeBtnText,
                        { color: colors.textSecondary },
                        recKind === k && { color: '#fff', fontWeight: '700' },
                      ]}
                    >
                      {k === 'expense' ? 'Expense' : 'Income'}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Amount</Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.bg, borderColor: colors.border, color: colors.text },
                ]}
                keyboardType="decimal-pad"
                value={recAmount}
                onChangeText={setRecAmount}
              />
              <Text style={[styles.label, { color: colors.textSecondary }]}>Category</Text>
              <View style={styles.chips}>
                {(recKind === 'expense' ? expenseCategoryOptions : incomeCategoryOptions).map((c) => {
                  const active = c === recCategory;
                  return (
                    <Pressable
                      key={c}
                      onPress={() => setRecCategory(c)}
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
              <Text style={[styles.label, { color: colors.textSecondary }]}>Day of month (1–28)</Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.bg, borderColor: colors.border, color: colors.text },
                ]}
                keyboardType="number-pad"
                value={recDay}
                onChangeText={setRecDay}
              />
              <Text style={[styles.label, { color: colors.textSecondary }]}>Account (optional)</Text>
              <View style={styles.chips}>
                <Pressable
                  onPress={() => setRecAccountId(null)}
                  style={[
                    styles.chip,
                    { borderColor: colors.border, backgroundColor: colors.bg },
                    recAccountId === null && { backgroundColor: colors.accentMuted, borderColor: colors.accent },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: colors.textSecondary },
                      recAccountId === null && { color: colors.accent, fontWeight: '700' },
                    ]}
                  >
                    None
                  </Text>
                </Pressable>
                {accounts.map((a) => {
                  const active = recAccountId === a.id;
                  return (
                    <Pressable
                      key={a.id}
                      onPress={() => setRecAccountId(a.id)}
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
                        {a.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Note (optional)</Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.bg, borderColor: colors.border, color: colors.text },
                ]}
                value={recNote}
                onChangeText={setRecNote}
              />
              <Pressable style={[styles.btn, { backgroundColor: colors.accent }]} onPress={addRecurringItem}>
                <Text style={styles.btnText}>Save recurring</Text>
              </Pressable>
            </View>

            <Text style={[styles.sectionTitle, { color: colors.text }]}>Active recurring</Text>
            {recurringItems.length === 0 ? (
              <Text style={[styles.empty, { color: colors.textMuted }]}>None yet.</Text>
            ) : (
              recurringItems.map((r) => (
                <View key={r.id} style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.rowTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.cat, { color: colors.text }]}>{r.title}</Text>
                      <Text style={[styles.nums, { color: colors.textMuted }]}>
                        {formatMoney(r.amount, settings.currency)} · {r.category} · day {r.dayOfMonth} ·{' '}
                        {r.kind}
                        {r.lastPostedYm ? ` · last posted ${r.lastPostedYm}` : ''}
                      </Text>
                    </View>
                    <Pressable onPress={() => void removeRecurring(r.id)} hitSlop={8}>
                      <Ionicons name="trash-outline" size={22} color={colors.danger} />
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modeRow: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 8, gap: 10 },
  recKindRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  modeBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  modeBtnText: { fontSize: 14 },
  scroll: { padding: 20, paddingBottom: 40 },
  hint: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  card: { borderRadius: 16, padding: 18, marginBottom: 20, borderWidth: 1 },
  cardTitle: { fontSize: 17, fontWeight: '600', marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 13 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 14,
  },
  btn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  empty: { fontSize: 15 },
  row: { borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cat: { fontSize: 17, fontWeight: '700' },
  deadline: { fontSize: 13, marginTop: 4 },
  nums: { fontSize: 14, marginTop: 6 },
  track: { height: 8, borderRadius: 4, marginTop: 10, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  savedRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  savedInput: { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  applyBtn: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12 },
  applyBtnText: { color: '#fff', fontWeight: '700' },
});
