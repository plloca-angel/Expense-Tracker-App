import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
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
import { EmptyStateCard } from '../../src/components/EmptyStateCard';
import { PressableCard } from '../../src/components/PressableCard';
import { useFinance } from '../../src/context/FinanceContext';
import { useTabHeaderSubtitle } from '../../src/hooks/useTabHeaderSubtitle';
import { hapticLight, hapticSuccess, hapticWarning } from '../../src/lib/haptics';
import { runLayoutAnimation } from '../../src/lib/layoutAnimation';
import { currentMonthPrefix, expensesInMonth } from '../../src/lib/period';
import { formatMoney, parseAmount, parseISODateLocal, toISODateString } from '../../src/lib/money';
import { radii, space, surfaceCard, type as typeStyles } from '../../src/theme/tokens';

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
  const [goalPickerOpen, setGoalPickerOpen] = useState(false);
  const [savedDrafts, setSavedDrafts] = useState<Record<number, string>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [recTitle, setRecTitle] = useState('');
  const [recAmount, setRecAmount] = useState('');
  const [recCategory, setRecCategory] = useState<string>(expenseCategoryOptions[0] ?? 'Other');
  const [recKind, setRecKind] = useState<'expense' | 'income'>('expense');
  const [recDay, setRecDay] = useState('1');
  const [recNote, setRecNote] = useState('');
  const [recAccountId, setRecAccountId] = useState<number | null>(null);

  const plansSubtitle =
    mode === 'budgets'
      ? 'Monthly limits by category'
      : mode === 'goals'
        ? 'Manual savings targets'
        : 'Scheduled bills & income';
  useTabHeaderSubtitle('Plans', plansSubtitle, colors);

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
      void hapticSuccess();
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
      void hapticSuccess();
      setGoalName('');
      setGoalTarget('');
      setGoalDeadline('');
    })();
  };

  const confirmRemoveBudget = (id: number, cat: string) => {
    Alert.alert('Remove budget', `Stop tracking budget for ${cat}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () =>
          void removeBudget(id).then(() => {
            void hapticWarning();
          }),
      },
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
      void hapticSuccess();
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
      await refresh();
      Alert.alert('Recurring', n === 0 ? 'Nothing due to post for this month (already posted or none active).' : `Posted ${n} item(s) for ${ym}.`);
    })();
  };

  const confirmRemoveGoal = (id: number, name: string) => {
    Alert.alert('Remove goal', `Delete “${name}”?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () =>
          void removeGoal(id).then(() => {
            void hapticWarning();
          }),
      },
    ]);
  };

  const applySaved = (id: number) => {
    const raw = savedDrafts[id] ?? '0';
    const n = Number.parseFloat(raw.replace(/,/g, ''));
    if (!Number.isFinite(n) || n < 0) {
      Alert.alert('Invalid amount');
      return;
    }
    void updateGoalSaved(id, Math.round(n * 100) / 100).then(() => {
      void hapticSuccess();
    });
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
        <Text style={[typeStyles.body, styles.loadingHint, { color: colors.textMuted }]}>
          Loading plans…
        </Text>
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
            onPress={() => {
              void hapticLight();
              runLayoutAnimation();
              setMode(key);
            }}
            style={({ pressed }) => [
              styles.modeBtn,
              surfaceCard(colors, false),
              mode === key && { backgroundColor: colors.accent, borderColor: colors.accent },
              pressed && { opacity: 0.9 },
            ]}
          >
            <Text
              style={[
                typeStyles.bodySmall,
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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.accent} />
        }
      >
        {mode === 'budgets' ? (
          <>
            <Text style={[typeStyles.bodySmall, styles.hint, { color: colors.textMuted }]}>
              Monthly cap per category. Progress uses expenses in {ym}.
            </Text>

            <PressableCard colors={colors} elevated style={styles.card} accessibilityLabel="Add or update budget">
              <View style={styles.titleRow}>
                <Ionicons name="pie-chart-outline" size={18} color={colors.textMuted} />
                <Text style={[typeStyles.title, styles.cardTitle, { color: colors.text }]}>Add or update budget</Text>
              </View>
              <Text style={[typeStyles.captionMedium, styles.label, { color: colors.textSecondary }]}>Category</Text>
              <View style={styles.chips}>
                {expenseCategoryOptions.map((c) => {
                  const active = c === category;
                  return (
                    <Pressable
                      key={c}
                      onPress={() => {
                        void hapticLight();
                        runLayoutAnimation();
                        setCategory(c);
                      }}
                      style={({ pressed }) => [
                        styles.chip,
                        { borderColor: colors.border, backgroundColor: colors.bg },
                        active && { backgroundColor: colors.accentMuted, borderColor: colors.accent },
                        pressed && { opacity: 0.88 },
                      ]}
                    >
                      <Text
                        style={[
                          typeStyles.captionMedium,
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
              <Text style={[typeStyles.captionMedium, styles.label, { color: colors.textSecondary }]}>
                Monthly limit
              </Text>
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
                style={({ pressed }) => [styles.btn, { backgroundColor: colors.accent }, pressed && { opacity: 0.9 }]}
                onPress={addBudget}
              >
                <Text style={styles.btnText}>Save budget</Text>
              </Pressable>
            </PressableCard>

            <Text style={[typeStyles.title, styles.sectionTitle, { color: colors.text, fontSize: 18 }]}>Active budgets</Text>
            {rows.length === 0 ? (
              <EmptyStateCard
                colors={colors}
                title="No budgets yet"
                description={`Set a monthly limit for a category. Spending in ${ym} counts toward each cap.`}
                icon={<Ionicons name="pie-chart-outline" size={36} color={colors.textMuted} />}
              />
            ) : (
              rows.map((b) => (
                <PressableCard
                  key={b.id}
                  colors={colors}
                  elevated
                  style={styles.row}
                  accessibilityLabel={`Budget row, ${b.category}`}
                >
                  <View style={styles.rowTop}>
                    <Text style={[typeStyles.title, { color: colors.text }]}>{b.category}</Text>
                    <Pressable
                      onPress={() => confirmRemoveBudget(b.id, b.category)}
                      hitSlop={12}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove budget for ${b.category}`}
                      style={({ pressed }) => [styles.iconHit, pressed && { opacity: 0.65 }]}
                    >
                      <Ionicons name="close-circle-outline" size={24} color={colors.textMuted} />
                    </Pressable>
                  </View>
                  <Text style={[typeStyles.bodySmall, styles.nums, { color: colors.textMuted }]}>
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
                </PressableCard>
              ))
            )}
          </>
        ) : mode === 'goals' ? (
          <>
            <Text style={[typeStyles.bodySmall, styles.hint, { color: colors.textMuted }]}>
              Track savings targets. Update “saved so far” as you set money aside (manual progress).
            </Text>

            <PressableCard colors={colors} elevated style={styles.card} accessibilityLabel="New goal">
              <View style={styles.titleRow}>
                <Ionicons name="flag-outline" size={18} color={colors.textMuted} />
                <Text style={[typeStyles.title, styles.cardTitle, { color: colors.text }]}>New goal</Text>
              </View>
              <Text style={[typeStyles.captionMedium, styles.label, { color: colors.textSecondary }]}>Name</Text>
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
              <Text style={[typeStyles.captionMedium, styles.label, { color: colors.textSecondary }]}>Target amount</Text>
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
              <Text style={[typeStyles.captionMedium, styles.label, { color: colors.textSecondary }]}>
                Deadline (optional)
              </Text>
              {Platform.OS === 'web' ? (
                <TextInput
                  style={[styles.input, { backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }]}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textMuted}
                  value={goalDeadline}
                  onChangeText={setGoalDeadline}
                  keyboardType="numbers-and-punctuation"
                />
              ) : (
                <Pressable
                  onPress={() => {
                    void hapticLight();
                    runLayoutAnimation();
                    setGoalPickerOpen(true);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Pick goal deadline"
                  style={({ pressed }) => [
                    styles.dateTrigger,
                    surfaceCard(colors, false),
                    { backgroundColor: colors.bg },
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <Text style={[typeStyles.bodyMedium, { color: colors.text }]}>
                    {goalDeadline.trim() ? goalDeadline.trim() : 'No deadline'}
                  </Text>
                  <Ionicons name="calendar-outline" size={20} color={colors.textMuted} />
                </Pressable>
              )}
              <Pressable
                style={({ pressed }) => [styles.btn, { backgroundColor: colors.income }, pressed && { opacity: 0.9 }]}
                onPress={addSavingsGoal}
              >
                <Text style={styles.btnText}>Add goal</Text>
              </Pressable>
            </PressableCard>

            <Text style={[typeStyles.title, styles.sectionTitle, { color: colors.text, fontSize: 18 }]}>Your goals</Text>
            {goals.length === 0 ? (
              <EmptyStateCard
                colors={colors}
                title="No savings goals yet"
                description="Create a target and update saved progress as you set money aside."
                icon={<Ionicons name="flag-outline" size={36} color={colors.textMuted} />}
              />
            ) : (
              goals.map((g) => {
                const pct = g.targetAmount > 0 ? Math.min(100, (g.savedAmount / g.targetAmount) * 100) : 0;
                return (
                  <PressableCard
                    key={g.id}
                    colors={colors}
                    elevated
                    style={styles.row}
                    accessibilityLabel={`Goal row, ${g.name}`}
                  >
                    <View style={styles.rowTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={[typeStyles.title, { color: colors.text }]}>{g.name}</Text>
                        {g.deadline ? (
                          <Text style={[typeStyles.caption, styles.deadline, { color: colors.textMuted }]}>
                            By {g.deadline}
                          </Text>
                        ) : null}
                      </View>
                      <Pressable
                        onPress={() => confirmRemoveGoal(g.id, g.name)}
                        hitSlop={12}
                        accessibilityRole="button"
                        accessibilityLabel={`Delete goal ${g.name}`}
                        style={({ pressed }) => [styles.iconHit, pressed && { opacity: 0.65 }]}
                      >
                        <Ionicons name="trash-outline" size={22} color={colors.danger} />
                      </Pressable>
                    </View>
                    <View style={[styles.track, { backgroundColor: colors.bgElevated }]}>
                      <View
                        style={[styles.fill, { width: `${pct}%`, backgroundColor: colors.income }]}
                      />
                    </View>
                    <Text style={[typeStyles.bodySmall, styles.nums, { color: colors.textMuted }]}>
                      {formatMoney(g.savedAmount, settings.currency)} / {formatMoney(g.targetAmount, settings.currency)}
                    </Text>
                    <Text
                      style={[
                        typeStyles.captionMedium,
                        styles.label,
                        { color: colors.textSecondary, marginTop: space[1] + 2 },
                      ]}
                    >
                      Saved amount
                    </Text>
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
                        style={({ pressed }) => [
                          styles.applyBtn,
                          { backgroundColor: colors.accent },
                          pressed && { opacity: 0.9 },
                        ]}
                        onPress={() => applySaved(g.id)}
                      >
                        <Text style={styles.applyBtnText}>Apply</Text>
                      </Pressable>
                    </View>
                  </PressableCard>
                );
              })
            )}
          </>
        ) : (
          <>
            <Text style={[typeStyles.bodySmall, styles.hint, { color: colors.textMuted }]}>
              Bills and subscriptions (Budge-style). Post creates real transactions for {ym} when not already posted.
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.btn,
                { backgroundColor: colors.income, marginBottom: space[2] },
                pressed && { opacity: 0.92 },
              ]}
              onPress={postRecurring}
            >
              <Text style={styles.btnText}>Post due items for {ym}</Text>
            </Pressable>

            <PressableCard colors={colors} elevated style={styles.card} accessibilityLabel="New recurring item">
              <View style={styles.titleRow}>
                <Ionicons name="repeat-outline" size={18} color={colors.textMuted} />
                <Text style={[typeStyles.title, styles.cardTitle, { color: colors.text }]}>New recurring</Text>
              </View>
              <Text style={[typeStyles.captionMedium, styles.label, { color: colors.textSecondary }]}>Name</Text>
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
              <Text style={[typeStyles.captionMedium, styles.label, { color: colors.textSecondary }]}>Type</Text>
              <View style={styles.recKindRow}>
                {(['expense', 'income'] as const).map((k) => (
                  <Pressable
                    key={k}
                    onPress={() => {
                      void hapticLight();
                      runLayoutAnimation();
                      setRecKind(k);
                    }}
                    style={({ pressed }) => [
                      styles.recKindBtn,
                      { borderColor: colors.border, backgroundColor: colors.bg },
                      recKind === k && { backgroundColor: colors.accent, borderColor: colors.accent },
                      pressed && { opacity: 0.9 },
                    ]}
                  >
                    <Text
                      style={[
                        typeStyles.bodySmall,
                        { color: colors.textSecondary },
                        recKind === k && { color: '#fff', fontWeight: '700' },
                      ]}
                    >
                      {k === 'expense' ? 'Expense' : 'Income'}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={[typeStyles.captionMedium, styles.label, { color: colors.textSecondary }]}>Amount</Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.bg, borderColor: colors.border, color: colors.text },
                ]}
                keyboardType="decimal-pad"
                value={recAmount}
                onChangeText={setRecAmount}
              />
              <Text style={[typeStyles.captionMedium, styles.label, { color: colors.textSecondary }]}>Category</Text>
              <View style={styles.chips}>
                {(recKind === 'expense' ? expenseCategoryOptions : incomeCategoryOptions).map((c) => {
                  const active = c === recCategory;
                  return (
                    <Pressable
                      key={c}
                      onPress={() => {
                        void hapticLight();
                        runLayoutAnimation();
                        setRecCategory(c);
                      }}
                      style={({ pressed }) => [
                        styles.chip,
                        { borderColor: colors.border, backgroundColor: colors.bg },
                        active && { backgroundColor: colors.accentMuted, borderColor: colors.accent },
                        pressed && { opacity: 0.88 },
                      ]}
                    >
                      <Text
                        style={[
                          typeStyles.captionMedium,
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
              <Text style={[typeStyles.captionMedium, styles.label, { color: colors.textSecondary }]}>
                Day of month (1–28)
              </Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.bg, borderColor: colors.border, color: colors.text },
                ]}
                keyboardType="number-pad"
                value={recDay}
                onChangeText={setRecDay}
              />
              <Text style={[typeStyles.captionMedium, styles.label, { color: colors.textSecondary }]}>
                Account (optional)
              </Text>
              <View style={styles.chips}>
                <Pressable
                  onPress={() => {
                    void hapticLight();
                    setRecAccountId(null);
                  }}
                  style={({ pressed }) => [
                    styles.chip,
                    { borderColor: colors.border, backgroundColor: colors.bg },
                    recAccountId === null && { backgroundColor: colors.accentMuted, borderColor: colors.accent },
                    pressed && { opacity: 0.88 },
                  ]}
                >
                  <Text
                    style={[
                      typeStyles.captionMedium,
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
                      onPress={() => {
                        void hapticLight();
                        runLayoutAnimation();
                        setRecAccountId(a.id);
                      }}
                      style={({ pressed }) => [
                        styles.chip,
                        { borderColor: colors.border, backgroundColor: colors.bg },
                        active && { backgroundColor: colors.accentMuted, borderColor: colors.accent },
                        pressed && { opacity: 0.88 },
                      ]}
                    >
                      <Text
                        style={[
                          typeStyles.captionMedium,
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
              <Text style={[typeStyles.captionMedium, styles.label, { color: colors.textSecondary }]}>
                Note (optional)
              </Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.bg, borderColor: colors.border, color: colors.text },
                ]}
                value={recNote}
                onChangeText={setRecNote}
              />
              <Pressable
                style={({ pressed }) => [styles.btn, { backgroundColor: colors.accent }, pressed && { opacity: 0.92 }]}
                onPress={addRecurringItem}
              >
                <Text style={styles.btnText}>Save recurring</Text>
              </Pressable>
            </PressableCard>

            <Text style={[typeStyles.title, styles.sectionTitle, { color: colors.text, fontSize: 18 }]}>
              Active recurring
            </Text>
            {recurringItems.length === 0 ? (
              <EmptyStateCard
                colors={colors}
                title="No recurring items yet"
                description="Add rent, subscriptions, or transfers. Post due items to create transactions for this month."
                icon={<Ionicons name="repeat-outline" size={36} color={colors.textMuted} />}
              />
            ) : (
              recurringItems.map((r) => (
                <PressableCard
                  key={r.id}
                  colors={colors}
                  elevated
                  style={styles.row}
                  accessibilityLabel={`Recurring item, ${r.title}`}
                >
                  <View style={styles.rowTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={[typeStyles.title, { color: colors.text }]}>{r.title}</Text>
                      <Text style={[typeStyles.bodySmall, styles.nums, { color: colors.textMuted }]}>
                        {formatMoney(r.amount, settings.currency)} · {r.category} · day {r.dayOfMonth} ·{' '}
                        {r.kind}
                        {r.lastPostedYm ? ` · last posted ${r.lastPostedYm}` : ''}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => void removeRecurring(r.id)}
                      hitSlop={12}
                      accessibilityRole="button"
                      accessibilityLabel={`Delete recurring ${r.title}`}
                      style={({ pressed }) => [styles.iconHit, pressed && { opacity: 0.65 }]}
                    >
                      <Ionicons name="trash-outline" size={22} color={colors.danger} />
                    </Pressable>
                  </View>
                </PressableCard>
              ))
            )}
          </>
        )}
      </ScrollView>

      {goalPickerOpen && Platform.OS === 'ios' ? (
        <Modal animationType="slide" transparent visible onRequestClose={() => setGoalPickerOpen(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => setGoalPickerOpen(false)}>
            <Pressable
              style={[styles.modalSheet, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={[styles.modalToolbar, { borderBottomColor: colors.border }]}>
                <Pressable onPress={() => setGoalPickerOpen(false)} hitSlop={12} accessibilityRole="button">
                  <Text style={[typeStyles.bodyMedium, { color: colors.accent, fontWeight: '600' }]}>Done</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={parseISODateLocal(goalDeadline.trim() || `${ym}-01`)}
                mode="date"
                display="spinner"
                onChange={(_, picked) => {
                  if (picked) setGoalDeadline(toISODateString(picked));
                }}
              />
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}

      {goalPickerOpen && Platform.OS === 'android' ? (
        <DateTimePicker
          value={parseISODateLocal(goalDeadline.trim() || `${ym}-01`)}
          mode="date"
          display="default"
          onChange={(event: DateTimePickerEvent, picked?: Date) => {
            setGoalPickerOpen(false);
            if (event.type !== 'set' || !picked) return;
            setGoalDeadline(toISODateString(picked));
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingHint: { marginTop: space[1] + 4 },
  modeRow: { flexDirection: 'row', paddingHorizontal: space[2], paddingTop: space[1], gap: space[1] + 2 },
  modeBtn: { flex: 1, paddingVertical: space[1] + 4, borderRadius: radii.md, alignItems: 'center' },
  recKindRow: { flexDirection: 'row', gap: space[1] + 2, marginBottom: space[1] / 2 },
  recKindBtn: {
    flex: 1,
    paddingVertical: space[1] + 4,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  scroll: { padding: space[3], paddingBottom: space[5] },
  hint: { marginBottom: space[2] },
  card: { padding: space[2], marginBottom: space[3] - 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  cardTitle: { marginBottom: space[1] + 4 },
  label: { marginBottom: space[1] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[1], marginBottom: space[2] - 2 },
  chip: { paddingHorizontal: space[1] + 4, paddingVertical: space[1], borderRadius: radii.pill, borderWidth: 1 },
  input: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: space[2] - 2,
    paddingVertical: space[1] + 4,
    fontSize: 16,
    marginBottom: space[2] - 2,
  },
  btn: { borderRadius: radii.md, paddingVertical: space[2] - 2, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  sectionTitle: { marginBottom: space[1] + 4 },
  row: { borderRadius: radii.lg - 2, padding: space[2], marginBottom: space[1] + 4 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  deadline: { marginTop: space[1] / 2 },
  nums: { marginTop: space[1] - 2 },
  track: { height: space[1], borderRadius: radii.sm / 2, marginTop: space[1] + 2, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radii.sm / 2 },
  savedRow: { flexDirection: 'row', gap: space[1] + 2, alignItems: 'center' },
  savedInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: space[1] + 4,
    paddingVertical: space[1] + 2,
    fontSize: 16,
  },
  applyBtn: { paddingHorizontal: space[2] + 2, paddingVertical: space[1] + 4, borderRadius: radii.md },
  applyBtnText: { color: '#fff', fontWeight: '700' },
  iconHit: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  dateTrigger: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: space[2] - 2,
    paddingVertical: space[1] + 4,
    marginBottom: space[2] - 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: space[2],
  },
  modalToolbar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
