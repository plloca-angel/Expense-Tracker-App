import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFinance } from '../../src/context/FinanceContext';
import { buildActivityRows, splitGroupTotal, type ActivityUnifiedRow } from '../../src/lib/activityGroups';
import { formatMoney } from '../../src/lib/money';
import { filterByPeriod, type PeriodFilter } from '../../src/lib/period';
import type { Expense } from '../../src/types/expense';
import type { Income } from '../../src/types/income';

type FilterKind = 'all' | 'expense' | 'income';

function expenseMatchesSearch(e: Expense, q: string): boolean {
  const t = `${e.note ?? ''} ${e.tag ?? ''} ${e.category}`.toLowerCase();
  return t.includes(q);
}

function incomeMatchesSearch(i: Income, q: string): boolean {
  const t = `${i.note ?? ''} ${i.tag ?? ''} ${i.category}`.toLowerCase();
  return t.includes(q);
}

function filterExpensesForActivity(expenses: Expense[], q: string): Expense[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return expenses;
  const groupHit = new Set<string>();
  for (const e of expenses) {
    if (e.splitGroupId && expenseMatchesSearch(e, needle)) groupHit.add(e.splitGroupId);
  }
  return expenses.filter((e) => {
    if (expenseMatchesSearch(e, needle)) return true;
    return !!(e.splitGroupId && groupHit.has(e.splitGroupId));
  });
}

export default function ActivityScreen() {
  const { ready, colors, settings, expenses, incomes, removeExpense, removeIncome, refresh } = useFinance();
  const [kind, setKind] = useState<FilterKind>('all');
  const [period, setPeriod] = useState<PeriodFilter>('all');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const data = useMemo(() => {
    let ex = filterByPeriod(expenses, period);
    let inc = filterByPeriod(incomes, period);
    const q = search.trim().toLowerCase();
    if (q) {
      ex = filterExpensesForActivity(ex, q);
      inc = inc.filter((i) => incomeMatchesSearch(i, q));
    }
    const rows = buildActivityRows(
      kind === 'income' ? [] : ex,
      kind === 'expense' ? [] : inc
    );
    return rows;
  }, [expenses, incomes, kind, period, search]);

  const confirmDeleteRow = useCallback(
    (row: ActivityUnifiedRow) => {
      if (row.kind === 'income') {
        const d = row.income;
        const amt = formatMoney(d.amount, settings.currency);
        Alert.alert('Delete income', `Remove ${amt} — ${d.category}?`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => void removeIncome(d.id) },
        ]);
        return;
      }
      if (row.expenseRow.shape === 'single') {
        const d = row.expenseRow.expense;
        const amt = formatMoney(d.amount, settings.currency);
        Alert.alert('Delete expense', `Remove ${amt} — ${d.category}?`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => void removeExpense(d.id) },
        ]);
        return;
      }
      const lines = row.expenseRow.expenses;
      const total = splitGroupTotal(lines);
      const amt = formatMoney(total, settings.currency);
      Alert.alert('Delete split payment', `Remove entire payment (${amt}, ${lines.length} lines)?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete all', style: 'destructive', onPress: () => void removeExpense(lines[0]!.id) },
      ]);
    },
    [removeExpense, removeIncome, settings.currency]
  );

  const keyExtractor = useCallback((item: ActivityUnifiedRow) => {
    if (item.kind === 'income') return `i-${item.income.id}`;
    if (item.expenseRow.shape === 'single') return `e-${item.expenseRow.expense.id}`;
    const g = item.expenseRow.expenses[0]?.splitGroupId ?? 'g';
    return `s-${g}`;
  }, []);

  if (!ready) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['bottom']}>
      <View style={styles.toolbar}>
        <View style={styles.segment}>
          {(['all', 'expense', 'income'] as const).map((k) => (
            <Pressable
              key={k}
              onPress={() => setKind(k)}
              style={[
                styles.segBtn,
                { borderColor: colors.border },
                kind === k && { backgroundColor: colors.accent, borderColor: colors.accent },
              ]}
            >
              <Text
                style={[
                  styles.segText,
                  { color: colors.textSecondary },
                  kind === k && { color: '#fff', fontWeight: '700' },
                ]}
              >
                {k === 'all' ? 'All' : k === 'expense' ? 'Out' : 'In'}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.segment}>
          {(
            [
              ['all', 'All'],
              ['month', 'Month'],
              ['30d', '30d'],
            ] as const
          ).map(([k, label]) => (
            <Pressable
              key={k}
              onPress={() => setPeriod(k)}
              style={[
                styles.segBtn,
                { borderColor: colors.border },
                period === k && { backgroundColor: colors.accentMuted, borderColor: colors.accent },
              ]}
            >
              <Text
                style={[
                  styles.segText,
                  { color: colors.textSecondary },
                  period === k && { color: colors.accent, fontWeight: '700' },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          style={[
            styles.search,
            { backgroundColor: colors.card, borderColor: colors.border, color: colors.text },
          ]}
          placeholder="Search note, tag, category"
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>
      <FlatList
        data={data}
        keyExtractor={keyExtractor}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.accent} />
        }
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.textMuted }]}>No entries match your filters.</Text>
        }
        renderItem={({ item }) => {
          if (item.kind === 'income') {
            const d = item.income;
            return (
              <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.rowIcon}>
                  <Ionicons name="arrow-up-circle" size={28} color={colors.income} />
                </View>
                <View style={styles.rowMain}>
                  <Text style={[styles.amount, { color: colors.text }]}>+{formatMoney(d.amount, settings.currency)}</Text>
                  <Text style={[styles.category, { color: colors.textSecondary }]}>{d.category}</Text>
                  <Text style={[styles.meta, { color: colors.textMuted }]}>
                    {d.date}
                    {d.tag ? ` · ${d.tag}` : ''}
                  </Text>
                  {d.note ? <Text style={[styles.note, { color: colors.textMuted }]}>{d.note}</Text> : null}
                </View>
                <Pressable
                  onPress={() => confirmDeleteRow(item)}
                  style={({ pressed }) => [styles.trash, pressed && { opacity: 0.6 }]}
                >
                  <Ionicons name="trash-outline" size={22} color={colors.danger} />
                </Pressable>
              </View>
            );
          }

          if (item.expenseRow.shape === 'single') {
            const d = item.expenseRow.expense;
            return (
              <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.rowIcon}>
                  <Ionicons name="arrow-down-circle" size={28} color={colors.expense} />
                </View>
                <View style={styles.rowMain}>
                  <Text style={[styles.amount, { color: colors.text }]}>
                    −{formatMoney(d.amount, settings.currency)}
                  </Text>
                  <Text style={[styles.category, { color: colors.textSecondary }]}>{d.category}</Text>
                  <Text style={[styles.meta, { color: colors.textMuted }]}>
                    {d.date}
                    {d.tag ? ` · ${d.tag}` : ''}
                    {d.receiptUri ? ' · receipt' : ''}
                  </Text>
                  {d.note ? <Text style={[styles.note, { color: colors.textMuted }]}>{d.note}</Text> : null}
                </View>
                <Pressable
                  onPress={() => confirmDeleteRow(item)}
                  style={({ pressed }) => [styles.trash, pressed && { opacity: 0.6 }]}
                >
                  <Ionicons name="trash-outline" size={22} color={colors.danger} />
                </Pressable>
              </View>
            );
          }

          const lines = item.expenseRow.expenses;
          const total = splitGroupTotal(lines);
          const head = lines[0]!;
          const hasReceipt = lines.some((l) => l.receiptUri);
          return (
            <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.rowIcon}>
                <Ionicons name="git-branch-outline" size={28} color={colors.expense} />
              </View>
              <View style={styles.rowMain}>
                <Text style={[styles.amount, { color: colors.text }]}>
                  −{formatMoney(total, settings.currency)}
                </Text>
                <Text style={[styles.splitBadge, { color: colors.accent }]}>Split · {lines.length} categories</Text>
                {lines.map((l) => (
                  <Text key={l.id} style={[styles.splitLine, { color: colors.textSecondary }]}>
                    {l.category}: {formatMoney(l.amount, settings.currency)}
                  </Text>
                ))}
                <Text style={[styles.meta, { color: colors.textMuted }]}>
                  {head.date}
                  {head.tag ? ` · ${head.tag}` : ''}
                  {hasReceipt ? ' · receipt' : ''}
                </Text>
                {head.note ? <Text style={[styles.note, { color: colors.textMuted }]}>{head.note}</Text> : null}
              </View>
              <Pressable
                onPress={() => confirmDeleteRow(item)}
                style={({ pressed }) => [styles.trash, pressed && { opacity: 0.6 }]}
              >
                <Ionicons name="trash-outline" size={22} color={colors.danger} />
              </Pressable>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  toolbar: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4, gap: 10 },
  segment: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  segBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  segText: { fontSize: 13 },
  search: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  list: { padding: 16, paddingBottom: 28, flexGrow: 1 },
  empty: { textAlign: 'center', marginTop: 48, fontSize: 15, paddingHorizontal: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
  },
  rowIcon: { marginRight: 10, marginTop: 2 },
  rowMain: { flex: 1 },
  amount: { fontSize: 17, fontWeight: '700' },
  category: { marginTop: 4, fontSize: 15, fontWeight: '600' },
  splitBadge: { marginTop: 4, fontSize: 13, fontWeight: '700' },
  splitLine: { marginTop: 2, fontSize: 14 },
  meta: { marginTop: 4, fontSize: 13 },
  note: { marginTop: 6, fontSize: 14 },
  trash: { padding: 8 },
});
