import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyStateCard } from '../../src/components/EmptyStateCard';
import { useFinance } from '../../src/context/FinanceContext';
import { useTabHeaderSubtitle } from '../../src/hooks/useTabHeaderSubtitle';
import { hapticLight, hapticWarning } from '../../src/lib/haptics';
import {
  buildActivityRows,
  filterExpensesForActivitySearch,
  filterExpensesGroupAware,
  splitGroupTotal,
  type ActivityUnifiedRow,
} from '../../src/lib/activityGroups';
import { formatMoney } from '../../src/lib/money';
import { filterByPeriod, type PeriodFilter } from '../../src/lib/period';
import { radii, space, surfaceCard, type as typeStyles } from '../../src/theme/tokens';
import type { Income } from '../../src/types/income';

type FilterKind = 'all' | 'expense' | 'income';

export default function ActivityScreen() {
  const { category: paramCategory, accountId: paramAccount } = useLocalSearchParams<{
    category?: string;
    accountId?: string;
  }>();
  const { ready, colors, settings, expenses, incomes, accounts, removeExpense, removeIncome, refresh } =
    useFinance();
  const [kind, setKind] = useState<FilterKind>('all');
  const [period, setPeriod] = useState<PeriodFilter>('all');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const accountNameById = useMemo(
    () => new Map(accounts.map((a) => [a.id, a.name] as const)),
    [accounts]
  );

  const headerSubtitle = useMemo(() => {
    const kindLabel = kind === 'all' ? 'All' : kind === 'expense' ? 'Expenses' : 'Income';
    const periodLabel =
      period === 'all' ? 'All time' : period === 'month' ? 'This month' : 'Last 30 days';
    const filterBits: string[] = [];
    if (paramCategory) filterBits.push(`Category: ${paramCategory}`);
    if (paramAccount) filterBits.push('Account');
    const filterNote = filterBits.length ? ` · ${filterBits.join(' · ')}` : '';
    const searchNote = search.trim() ? ' · Search' : '';
    return `${kindLabel} · ${periodLabel}${filterNote}${searchNote}`;
  }, [kind, period, search, paramCategory, paramAccount]);

  useTabHeaderSubtitle('Activity', headerSubtitle, colors);

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
    if (paramCategory) {
      const c = String(paramCategory);
      ex = filterExpensesGroupAware(ex, (e) => e.category === c);
      inc = inc.filter((i) => i.category === c);
    }
    if (paramAccount) {
      const aid = Number(paramAccount);
      if (Number.isFinite(aid)) {
        ex = filterExpensesGroupAware(ex, (e) => e.accountId === aid);
        inc = inc.filter((i) => i.accountId === aid);
      }
    }
    const q = search.trim();
    if (q) {
      ex = filterExpensesForActivitySearch(ex, q);
      const needle = q.toLowerCase();
      const matchInc = (i: Income) => {
        const t = `${i.note ?? ''} ${i.tag ?? ''} ${i.category}`.toLowerCase();
        return t.includes(needle);
      };
      inc = inc.filter(matchInc);
    }
    return buildActivityRows(kind === 'income' ? [] : ex, kind === 'expense' ? [] : inc);
  }, [expenses, incomes, kind, period, search, paramCategory, paramAccount]);

  const confirmDelete = useCallback(
    (row: ActivityUnifiedRow) => {
      if (row.kind === 'income') {
        const d = row.income;
        const amt = formatMoney(d.amount, settings.currency);
        Alert.alert('Delete income', `Remove ${amt} — ${d.category}?`, [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () =>
              void removeIncome(d.id).then(() => {
                void hapticWarning();
              }),
          },
        ]);
        return;
      }
      if (row.expenseRow.shape === 'single') {
        const d = row.expenseRow.expense;
        const amt = formatMoney(d.amount, settings.currency);
        Alert.alert('Delete expense', `Remove ${amt} — ${d.category}?`, [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () =>
              void removeExpense(d.id).then(() => {
                void hapticWarning();
              }),
          },
        ]);
        return;
      }
      const lines = row.expenseRow.expenses;
      const total = splitGroupTotal(lines);
      const amt = formatMoney(total, settings.currency);
      Alert.alert('Delete split payment', `Remove entire payment (${amt}, ${lines.length} lines)?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete all',
          style: 'destructive',
          onPress: () =>
            void removeExpense(lines[0]!.id).then(() => {
              void hapticWarning();
            }),
        },
      ]);
    },
    [removeExpense, removeIncome, settings.currency]
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<ActivityUnifiedRow>) => {
      if (item.kind === 'income') {
        const d = item.income;
        const acc =
          d.accountId != null ? (accountNameById.get(d.accountId) ?? `Account #${d.accountId}`) : null;
        return (
          <View style={[styles.row, surfaceCard(colors, true)]}>
            <View style={styles.rowIcon}>
              <Ionicons name="arrow-up-circle" size={28} color={colors.income} />
            </View>
            <View style={styles.rowMain}>
              <Text style={[typeStyles.title, { color: colors.text }]}>+{formatMoney(d.amount, settings.currency)}</Text>
              <Text style={[typeStyles.bodyMedium, { color: colors.textSecondary, marginTop: space[1] / 2 }]}>
                {d.category}
              </Text>
              <Text style={[typeStyles.caption, { color: colors.textMuted, marginTop: space[1] / 2 }]}>
                {d.date}
                {d.tag ? ` · ${d.tag}` : ''}
                {acc ? ` · ${acc}` : ''}
              </Text>
              {d.note ? (
                <Text style={[typeStyles.bodySmall, { color: colors.textMuted, marginTop: space[1] / 2 }]}>
                  {d.note}
                </Text>
              ) : null}
            </View>
            <View style={styles.rowActions}>
              <Pressable
                onPress={() =>
                  void router.push({
                    pathname: '/edit-transaction',
                    params: { id: String(d.id), kind: 'income' },
                  })
                }
                style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
                accessibilityRole="button"
                accessibilityLabel={`Edit income, ${d.category}`}
              >
                <Ionicons name="pencil-outline" size={22} color={colors.accent} />
              </Pressable>
              <Pressable
                onPress={() => confirmDelete(item)}
                style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
                accessibilityRole="button"
                accessibilityLabel={`Delete income, ${d.category}`}
              >
                <Ionicons name="trash-outline" size={22} color={colors.danger} />
              </Pressable>
            </View>
          </View>
        );
      }

      if (item.expenseRow.shape === 'single') {
        const d = item.expenseRow.expense;
        const acc =
          d.accountId != null ? (accountNameById.get(d.accountId) ?? `Account #${d.accountId}`) : null;
        return (
          <View style={[styles.row, surfaceCard(colors, true)]}>
            <View style={styles.rowIcon}>
              <Ionicons name="arrow-down-circle" size={28} color={colors.expense} />
            </View>
            <View style={styles.rowMain}>
              <Text style={[typeStyles.title, { color: colors.text }]}>
                −{formatMoney(d.amount, settings.currency)}
              </Text>
              <Text style={[typeStyles.bodyMedium, { color: colors.textSecondary, marginTop: space[1] / 2 }]}>
                {d.category}
              </Text>
              <Text style={[typeStyles.caption, { color: colors.textMuted, marginTop: space[1] / 2 }]}>
                {d.date}
                {d.tag ? ` · ${d.tag}` : ''}
                {acc ? ` · ${acc}` : ''}
                {d.receiptUri ? ' · receipt' : ''}
              </Text>
              {d.note ? (
                <Text style={[typeStyles.bodySmall, { color: colors.textMuted, marginTop: space[1] / 2 }]}>
                  {d.note}
                </Text>
              ) : null}
            </View>
            <View style={styles.rowActions}>
              <Pressable
                onPress={() =>
                  void router.push({
                    pathname: '/edit-transaction',
                    params: { id: String(d.id), kind: 'expense' },
                  })
                }
                style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
                accessibilityRole="button"
                accessibilityLabel={`Edit expense, ${d.category}`}
              >
                <Ionicons name="pencil-outline" size={22} color={colors.accent} />
              </Pressable>
              <Pressable
                onPress={() => confirmDelete(item)}
                style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
                accessibilityRole="button"
                accessibilityLabel={`Delete expense, ${d.category}`}
              >
                <Ionicons name="trash-outline" size={22} color={colors.danger} />
              </Pressable>
            </View>
          </View>
        );
      }

      const lines = item.expenseRow.expenses;
      const total = splitGroupTotal(lines);
      const head = lines[0]!;
      const acc =
        head.accountId != null ? (accountNameById.get(head.accountId) ?? `Account #${head.accountId}`) : null;
      const hasReceipt = lines.some((l) => l.receiptUri);
      return (
        <View style={[styles.row, surfaceCard(colors, true)]}>
          <View style={styles.rowIcon}>
            <Ionicons name="git-branch-outline" size={28} color={colors.expense} />
          </View>
          <View style={styles.rowMain}>
            <Text style={[typeStyles.title, { color: colors.text }]}>−{formatMoney(total, settings.currency)}</Text>
            <Text style={[typeStyles.captionMedium, { color: colors.accent, marginTop: space[1] / 2 }]}>
              Split · {lines.length} categories
            </Text>
            {lines.map((l) => (
              <Text
                key={l.id}
                style={[typeStyles.bodySmall, { color: colors.textSecondary, marginTop: space[1] / 4 }]}
              >
                {l.category}: {formatMoney(l.amount, settings.currency)}
              </Text>
            ))}
            <Text style={[typeStyles.caption, { color: colors.textMuted, marginTop: space[1] / 2 }]}>
              {head.date}
              {head.tag ? ` · ${head.tag}` : ''}
              {acc ? ` · ${acc}` : ''}
              {hasReceipt ? ' · receipt' : ''}
            </Text>
            {head.note ? (
              <Text style={[typeStyles.bodySmall, { color: colors.textMuted, marginTop: space[1] / 2 }]}>
                {head.note}
              </Text>
            ) : null}
          </View>
          <View style={styles.rowActions}>
            <Pressable
              onPress={() =>
                void router.push({
                  pathname: '/edit-transaction',
                  params: { id: String(head.id), kind: 'expense' },
                })
              }
              style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
              accessibilityRole="button"
              accessibilityLabel="Edit split payment line"
            >
              <Ionicons name="pencil-outline" size={22} color={colors.accent} />
            </Pressable>
            <Pressable
              onPress={() => confirmDelete(item)}
              style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
              accessibilityRole="button"
              accessibilityLabel="Delete split payment"
            >
              <Ionicons name="trash-outline" size={22} color={colors.danger} />
            </Pressable>
          </View>
        </View>
      );
    },
    [colors, settings.currency, confirmDelete, accountNameById]
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
        <Text style={[typeStyles.body, styles.loadingHint, { color: colors.textMuted }]}>
          Loading activity…
        </Text>
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
              onPress={() => {
                void hapticLight();
                setKind(k);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: kind === k }}
              accessibilityLabel={
                k === 'all' ? 'Show all transactions' : k === 'expense' ? 'Show expenses only' : 'Show income only'
              }
              style={({ pressed }) => [
                styles.segBtn,
                { borderColor: colors.border },
                kind === k && { backgroundColor: colors.accent, borderColor: colors.accent },
                pressed && { opacity: 0.88 },
              ]}
            >
              <Text
                style={[
                  typeStyles.captionMedium,
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
              onPress={() => {
                void hapticLight();
                setPeriod(k);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: period === k }}
              accessibilityLabel={
                k === 'all' ? 'Time range: all time' : k === 'month' ? 'Time range: this month' : 'Time range: last 30 days'
              }
              style={({ pressed }) => [
                styles.segBtn,
                { borderColor: colors.border },
                period === k && { backgroundColor: colors.accentMuted, borderColor: colors.accent },
                pressed && { opacity: 0.88 },
              ]}
            >
              <Text
                style={[
                  typeStyles.captionMedium,
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
          style={[styles.search, surfaceCard(colors, false), { color: colors.text }]}
          placeholder="Search note, tag, category"
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {paramCategory || paramAccount ? (
          <View style={[styles.filterBanner, { backgroundColor: colors.accentMuted, borderColor: colors.accent }]}>
            <Text style={[styles.filterText, { color: colors.text }]} numberOfLines={2}>
              {paramCategory ? `Category: ${paramCategory}` : ''}
              {paramCategory && paramAccount ? ' · ' : ''}
              {paramAccount
                ? `Account: ${accountNameById.get(Number(paramAccount)) ?? paramAccount}`
                : ''}
            </Text>
            <Pressable
              onPress={() => router.replace('/(tabs)/activity')}
              style={({ pressed }) => [styles.clearFilter, pressed && { opacity: 0.7 }]}
            >
              <Text style={{ color: colors.accent, fontWeight: '700' }}>Clear</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
      <FlatList
        data={data}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        initialNumToRender={14}
        maxToRenderPerBatch={12}
        windowSize={7}
        removeClippedSubviews={Platform.OS === 'android'}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.accent} />
        }
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyStateCard
            colors={colors}
            title="Nothing here yet"
            description="Change filters, clear search, or add a transaction from the Add tab."
            icon={<Ionicons name="file-tray-outline" size={36} color={colors.textMuted} />}
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingHint: { marginTop: space[1] + 4 },
  toolbar: { paddingHorizontal: space[2], paddingTop: space[1], paddingBottom: space[1] / 2, gap: space[1] + 2 },
  segment: { flexDirection: 'row', flexWrap: 'wrap', gap: space[1] },
  segBtn: {
    paddingHorizontal: space[2] - 2,
    paddingVertical: space[1] + 2,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: radii.md - 2,
    borderWidth: 1,
  },
  search: {
    borderRadius: radii.md,
    paddingHorizontal: space[2] - 2,
    paddingVertical: space[1] + 2,
    fontSize: 15,
  },
  list: { padding: space[2], paddingBottom: space[3] + 4, flexGrow: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: radii.lg - 2,
    padding: space[2] - 2,
    marginBottom: space[1] + 2,
  },
  rowIcon: { marginRight: space[1] + 2, marginTop: 2 },
  rowMain: { flex: 1 },
  rowActions: { flexDirection: 'row', alignItems: 'flex-start' },
  iconBtn: { padding: 8, minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  filterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1] + 2,
    paddingHorizontal: space[1] + 4,
    paddingVertical: space[1] + 2,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  filterText: { flex: 1, fontSize: 14 },
  clearFilter: { paddingVertical: 4, paddingHorizontal: space[1] },
});
