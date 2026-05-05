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
import { formatMoney } from '../../src/lib/money';
import { filterByPeriod, type PeriodFilter } from '../../src/lib/period';
import type { Expense } from '../../src/types/expense';
import type { Income } from '../../src/types/income';

type Row =
  | { kind: 'expense'; data: Expense }
  | { kind: 'income'; data: Income };

type FilterKind = 'all' | 'expense' | 'income';

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
  }, [expenses, incomes, kind, period, search]);

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
        keyExtractor={(item) => `${item.kind}-${item.data.id}`}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.accent} />
        }
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.textMuted }]}>
            No entries match your filters.
          </Text>
        }
        renderItem={({ item }) => {
          const d = item.data;
          const isExp = item.kind === 'expense';
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
                </Text>
                {d.note ? <Text style={[styles.note, { color: colors.textMuted }]}>{d.note}</Text> : null}
              </View>
              <Pressable
                onPress={() => confirmDelete(item)}
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
  meta: { marginTop: 4, fontSize: 13 },
  note: { marginTop: 6, fontSize: 14 },
  trash: { padding: 8 },
});
