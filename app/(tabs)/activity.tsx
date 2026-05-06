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
import { EmptyStateCard } from '../../src/components/EmptyStateCard';
import { useFinance } from '../../src/context/FinanceContext';
import { useTabHeaderSubtitle } from '../../src/hooks/useTabHeaderSubtitle';
import { hapticLight, hapticWarning } from '../../src/lib/haptics';
import { formatMoney } from '../../src/lib/money';
import { filterByPeriod, type PeriodFilter } from '../../src/lib/period';
import { radii, space, surfaceCard, type as typeStyles } from '../../src/theme/tokens';
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

  const headerSubtitle = useMemo(() => {
    const kindLabel = kind === 'all' ? 'All' : kind === 'expense' ? 'Expenses' : 'Income';
    const periodLabel =
      period === 'all' ? 'All time' : period === 'month' ? 'This month' : 'Last 30 days';
    const searchNote = search.trim() ? ' · Search' : '';
    return `${kindLabel} · ${periodLabel}${searchNote}`;
  }, [kind, period, search]);
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
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () =>
              void removeExpense(row.data.id).then(() => {
                void hapticWarning();
              }),
          },
        ]);
      } else {
        Alert.alert('Delete income', `Remove ${amt} — ${row.data.category}?`, [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () =>
              void removeIncome(row.data.id).then(() => {
                void hapticWarning();
              }),
          },
        ]);
      }
    },
    [removeExpense, removeIncome, settings.currency]
  );

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
          style={[
            styles.search,
            surfaceCard(colors, false),
            { color: colors.text },
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
        initialNumToRender={14}
        maxToRenderPerBatch={14}
        windowSize={10}
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
        renderItem={({ item }) => {
          const d = item.data;
          const isExp = item.kind === 'expense';
          return (
            <View style={[styles.row, surfaceCard(colors, true)]}>
              <View style={styles.rowIcon}>
                <Ionicons
                  name={isExp ? 'arrow-down-circle' : 'arrow-up-circle'}
                  size={28}
                  color={isExp ? colors.expense : colors.income}
                />
              </View>
              <View style={styles.rowMain}>
                <Text style={[typeStyles.title, { color: colors.text }]}>
                  {isExp ? '−' : '+'}
                  {formatMoney(d.amount, settings.currency)}
                </Text>
                <Text style={[typeStyles.bodyMedium, { color: colors.textSecondary, marginTop: space[1] / 2 }]}>
                  {d.category}
                </Text>
                <Text style={[typeStyles.caption, { color: colors.textMuted, marginTop: space[1] / 2 }]}>
                  {d.date}
                  {d.tag ? ` · ${d.tag}` : ''}
                </Text>
                {d.note ? (
                  <Text style={[typeStyles.bodySmall, { color: colors.textMuted, marginTop: space[1] / 2 }]}>
                    {d.note}
                  </Text>
                ) : null}
              </View>
              <Pressable
                onPress={() => confirmDelete(item)}
                accessibilityRole="button"
                accessibilityLabel={isExp ? 'Delete expense' : 'Delete income'}
                hitSlop={12}
                style={({ pressed }) => [
                  styles.trash,
                  { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
                  pressed && { opacity: 0.65 },
                ]}
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
  loadingHint: { marginTop: space[1] + 4 },
  toolbar: { paddingHorizontal: space[2], paddingTop: space[1], paddingBottom: space[1] / 2, gap: space[1] + 2 },
  segment: { flexDirection: 'row', flexWrap: 'wrap', gap: space[1] },
  segBtn: {
    paddingHorizontal: space[1] + 4,
    paddingVertical: space[1],
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
  trash: {},
});
