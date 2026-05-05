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
import { useFinance } from '../../src/context/FinanceContext';
import { formatMoney } from '../../src/lib/money';
import { filterByPeriod, type PeriodFilter } from '../../src/lib/period';
import type { Expense } from '../../src/types/expense';
import type { Income } from '../../src/types/income';

type Row =
  | { kind: 'expense'; data: Expense }
  | { kind: 'income'; data: Income };

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
      ex = ex.filter((e) => e.category === c);
      inc = inc.filter((i) => i.category === c);
    }
    if (paramAccount) {
      const aid = Number(paramAccount);
      if (Number.isFinite(aid)) {
        ex = ex.filter((e) => e.accountId === aid);
        inc = inc.filter((i) => i.accountId === aid);
      }
    }
    const q = search.trim().toLowerCase();
    if (q) {
      const match = (note: string | null, tag: string | null, cat: string) => {
        const t = `${note ?? ''} ${tag ?? ''} ${cat}`.toLowerCase();
        return t.includes(q);
      };
      ex = ex.filter((e) => match(e.note, e.tag, e.category));
      inc = inc.filter((i) => match(i.note, i.tag, i.category));
    }
    const rows: Row[] = [];
    if (kind !== 'income') for (const e of ex) rows.push({ kind: 'expense', data: e });
    if (kind !== 'expense') for (const i of inc) rows.push({ kind: 'income', data: i });
    rows.sort((a, b) => {
      const da = a.data.date;
      const db = b.data.date;
      if (da !== db) return db.localeCompare(da);
      return b.data.id - a.data.id;
    });
    return rows;
  }, [expenses, incomes, kind, period, search, paramCategory, paramAccount]);

  const confirmDelete = useCallback(
    (row: Row) => {
      const amt = formatMoney(row.data.amount, settings.currency);
      if (row.kind === 'expense') {
        Alert.alert('Delete expense', `Remove ${amt} — ${row.data.category}?`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => void removeExpense(row.data.id) },
        ]);
      } else {
        Alert.alert('Delete income', `Remove ${amt} — ${row.data.category}?`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => void removeIncome(row.data.id) },
        ]);
      }
    },
    [removeExpense, removeIncome, settings.currency]
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Row>) => {
      const d = item.data;
      const isExp = item.kind === 'expense';
      const acc =
        d.accountId != null ? (accountNameById.get(d.accountId) ?? `Account #${d.accountId}`) : null;
      return (
        <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.rowIcon}>
            <Ionicons
              name={isExp ? 'arrow-down-circle' : 'arrow-up-circle'}
              size={28}
              color={isExp ? colors.expense : colors.income}
            />
          </View>
          <View style={styles.rowMain}>
            <Text style={[styles.amount, { color: colors.text }]}>
              {isExp ? '−' : '+'}
              {formatMoney(d.amount, settings.currency)}
            </Text>
            <Text style={[styles.category, { color: colors.textSecondary }]}>{d.category}</Text>
            <Text style={[styles.meta, { color: colors.textMuted }]}>
              {d.date}
              {d.tag ? ` · ${d.tag}` : ''}
              {acc ? ` · ${acc}` : ''}
            </Text>
            {d.note ? <Text style={[styles.note, { color: colors.textMuted }]}>{d.note}</Text> : null}
          </View>
          <View style={styles.rowActions}>
            <Pressable
              onPress={() =>
                void router.push({
                  pathname: '/edit-transaction',
                  params: { id: String(d.id), kind: item.kind },
                })
              }
              style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${item.kind}, ${d.category}`}
            >
              <Ionicons name="pencil-outline" size={22} color={colors.accent} />
            </Pressable>
            <Pressable
              onPress={() => confirmDelete(item)}
              style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
              accessibilityRole="button"
              accessibilityLabel={isExp ? `Delete expense, ${d.category}` : `Delete income, ${d.category}`}
            >
              <Ionicons name="trash-outline" size={22} color={colors.danger} />
            </Pressable>
          </View>
        </View>
      );
    },
    [colors, settings.currency, confirmDelete, accountNameById]
  );

  const keyExtractor = useCallback((item: Row) => `${item.kind}-${item.data.id}`, []);

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
              accessibilityRole="button"
              accessibilityState={{ selected: kind === k }}
              accessibilityLabel={k === 'all' ? 'Show all transactions' : k === 'expense' ? 'Show expenses only' : 'Show income only'}
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
              accessibilityRole="button"
              accessibilityState={{ selected: period === k }}
              accessibilityLabel={
                k === 'all' ? 'Time range: all time' : k === 'month' ? 'Time range: this month' : 'Time range: last 30 days'
              }
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
          <Text style={[styles.empty, { color: colors.textMuted }]}>
            No entries match your filters.
          </Text>
        }
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
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
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
  meta: { marginTop: 4, fontSize: 13 },
  note: { marginTop: 6, fontSize: 14 },
  rowActions: { flexDirection: 'row', alignItems: 'flex-start' },
  iconBtn: { padding: 8 },
  filterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  filterText: { flex: 1, fontSize: 14 },
  clearFilter: { paddingVertical: 4, paddingHorizontal: 8 },
});
