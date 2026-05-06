import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
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
import { PressableCard } from '../../src/components/PressableCard';
import { useFinance } from '../../src/context/FinanceContext';
import { useTabHeaderSubtitle } from '../../src/hooks/useTabHeaderSubtitle';
import { hapticLight, hapticWarning } from '../../src/lib/haptics';
import { runLayoutAnimation } from '../../src/lib/layoutAnimation';
import {
  buildActivityRows,
  filterExpensesForActivitySearch,
  filterExpensesGroupAware,
  splitGroupTotal,
  type ActivityUnifiedRow,
} from '../../src/lib/activityGroups';
import { addCalendarDaysISO, filterByPeriod, type PeriodDateRange, type PeriodFilter } from '../../src/lib/period';
import { formatISODateMedium, formatMoney, parseISODateLocal, todayISODate, toISODateString } from '../../src/lib/money';
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
  const [customFrom, setCustomFrom] = useState(() => addCalendarDaysISO(todayISODate(), -29));
  const [customTo, setCustomTo] = useState(() => todayISODate());
  const [pickerTarget, setPickerTarget] = useState<'from' | 'to' | null>(null);
  const [receiptPreviewUri, setReceiptPreviewUri] = useState<string | null>(null);

  const accountNameById = useMemo(
    () => new Map(accounts.map((a) => [a.id, a.name] as const)),
    [accounts]
  );

  const headerSubtitle = useMemo(() => {
    const kindLabel = kind === 'all' ? 'All' : kind === 'expense' ? 'Expenses' : 'Income';
    const periodLabel =
      period === 'all'
        ? 'All time'
        : period === '30d'
          ? 'Last 30 days'
          : period === 'custom'
            ? 'Custom'
            : 'This month';
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

  const customRange = useMemo<PeriodDateRange | null>(() => {
    if (period !== 'custom') return null;
    const re = /^\d{4}-\d{2}-\d{2}$/;
    if (!re.test(customFrom.trim()) || !re.test(customTo.trim())) return null;
    const a = customFrom.trim();
    const b = customTo.trim();
    return a <= b ? { start: a, end: b } : { start: b, end: a };
  }, [period, customFrom, customTo]);

  const data = useMemo(() => {
    let ex = filterByPeriod(expenses, period, customRange);
    let inc = filterByPeriod(incomes, period, customRange);
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
  }, [expenses, incomes, kind, period, search, paramCategory, paramAccount, customRange]);

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
          <PressableCard
            colors={colors}
            elevated
            style={styles.row}
            accessibilityLabel={`Income, ${d.category}`}
          >
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
          </PressableCard>
        );
      }

      if (item.expenseRow.shape === 'single') {
        const d = item.expenseRow.expense;
        const acc =
          d.accountId != null ? (accountNameById.get(d.accountId) ?? `Account #${d.accountId}`) : null;
        return (
          <PressableCard
            colors={colors}
            elevated
            style={styles.row}
            accessibilityLabel={`Expense, ${d.category}`}
          >
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
              {d.receiptUri ? (
                <Pressable
                  onPress={() => setReceiptPreviewUri(d.receiptUri ?? null)}
                  style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
                  accessibilityRole="button"
                  accessibilityLabel={`View receipt, ${d.category}`}
                >
                  <Ionicons name="image-outline" size={22} color={colors.textMuted} />
                </Pressable>
              ) : null}
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
          </PressableCard>
        );
      }

      const lines = item.expenseRow.expenses;
      const total = splitGroupTotal(lines);
      const head = lines[0]!;
      const acc =
        head.accountId != null ? (accountNameById.get(head.accountId) ?? `Account #${head.accountId}`) : null;
      const hasReceipt = lines.some((l) => l.receiptUri);
      const firstReceipt = lines.find((l) => l.receiptUri)?.receiptUri ?? null;
      return (
        <PressableCard
          colors={colors}
          elevated
          style={styles.row}
          accessibilityLabel="Split payment"
        >
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
            {hasReceipt ? (
              <Pressable
                onPress={() => setReceiptPreviewUri(firstReceipt)}
                style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
                accessibilityRole="button"
                accessibilityLabel="View receipt"
              >
                <Ionicons name="image-outline" size={22} color={colors.textMuted} />
              </Pressable>
            ) : null}
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
        </PressableCard>
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
      <View style={styles.toolbarOuter}>
        <PressableCard
          colors={colors}
          elevated
          style={styles.toolbarCard}
          accessibilityLabel="Activity filters"
        >
          <View style={styles.toolbar}>
            <View style={styles.segmentRow}>
              {(['all', 'expense', 'income'] as const).map((k) => (
                <Pressable
                  key={k}
                  onPress={() => {
                    void hapticLight();
                    runLayoutAnimation();
                    setKind(k);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: kind === k }}
                  accessibilityLabel={
                    k === 'all'
                      ? 'Show all transactions'
                      : k === 'expense'
                        ? 'Show expenses only'
                        : 'Show income only'
                  }
                  style={({ pressed }) => [
                    styles.segBtn,
                    { borderColor: colors.border },
                    kind === k && { backgroundColor: colors.accent, borderColor: colors.accent },
                    pressed && { opacity: 0.88 },
                  ]}
                >
                  <View style={styles.segContent}>
                    <Ionicons
                      name={k === 'all' ? 'apps-outline' : k === 'expense' ? 'arrow-down' : 'arrow-up'}
                      size={16}
                      color={kind === k ? '#fff' : colors.textSecondary}
                    />
                    <Text
                      style={[
                        typeStyles.captionMedium,
                        { color: colors.textSecondary },
                        kind === k && { color: '#fff', fontWeight: '700' },
                      ]}
                    >
                      {k === 'all' ? 'All' : k === 'expense' ? 'Out' : 'In'}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>

            <View style={styles.segmentRow}>
              {(
                [
                  ['all', 'All'],
                  ['30d', '30d'],
                  ['custom', 'Custom'],
                ] as const
              ).map(([k, label]) => (
                <Pressable
                  key={k}
                  onPress={() => {
                    void hapticLight();
                    runLayoutAnimation();
                    setPeriod(k);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: period === k }}
                  accessibilityLabel={
                    k === 'all'
                      ? 'Time range: all time'
                      : k === '30d'
                        ? 'Time range: last 30 days'
                        : 'Time range: custom'
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

            {period === 'custom' ? (
              <View style={styles.customRangeRow}>
                {Platform.OS === 'web' ? (
                  <>
                    <View style={styles.customField}>
                      <Text style={[typeStyles.caption, { color: colors.textMuted, marginBottom: 4 }]}>From</Text>
                      <TextInput
                        value={customFrom}
                        onChangeText={setCustomFrom}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={colors.textMuted}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="numbers-and-punctuation"
                        style={[
                          styles.customInput,
                          { color: colors.text, borderColor: colors.border, backgroundColor: colors.card },
                        ]}
                      />
                    </View>
                    <View style={styles.customField}>
                      <Text style={[typeStyles.caption, { color: colors.textMuted, marginBottom: 4 }]}>To</Text>
                      <TextInput
                        value={customTo}
                        onChangeText={setCustomTo}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={colors.textMuted}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="numbers-and-punctuation"
                        style={[
                          styles.customInput,
                          { color: colors.text, borderColor: colors.border, backgroundColor: colors.card },
                        ]}
                      />
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.customField}>
                      <Text style={[typeStyles.caption, { color: colors.textMuted, marginBottom: 4 }]}>From</Text>
                      <Pressable
                        onPress={() => setPickerTarget('from')}
                        style={({ pressed }) => [
                          styles.customTrigger,
                          { borderColor: colors.border, backgroundColor: colors.card },
                          pressed && { opacity: 0.9 },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`From date, ${formatISODateMedium(customFrom)}`}
                      >
                        <Text style={[typeStyles.bodyMedium, { color: colors.text }]}>
                          {formatISODateMedium(customFrom)}
                        </Text>
                        <Ionicons name="calendar-outline" size={20} color={colors.textMuted} />
                      </Pressable>
                    </View>
                    <View style={styles.customField}>
                      <Text style={[typeStyles.caption, { color: colors.textMuted, marginBottom: 4 }]}>To</Text>
                      <Pressable
                        onPress={() => setPickerTarget('to')}
                        style={({ pressed }) => [
                          styles.customTrigger,
                          { borderColor: colors.border, backgroundColor: colors.card },
                          pressed && { opacity: 0.9 },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`To date, ${formatISODateMedium(customTo)}`}
                      >
                        <Text style={[typeStyles.bodyMedium, { color: colors.text }]}>{formatISODateMedium(customTo)}</Text>
                        <Ionicons name="calendar-outline" size={20} color={colors.textMuted} />
                      </Pressable>
                    </View>
                  </>
                )}
              </View>
            ) : null}

            {period === 'custom' && !customRange ? (
              <Text style={[typeStyles.caption, { color: colors.expense }]}>
                Choose two valid dates to load this period.
              </Text>
            ) : null}

            <View style={[styles.searchWrap, surfaceCard(colors, false)]}>
              <Ionicons name="search-outline" size={18} color={colors.textMuted} />
              <TextInput
                style={[styles.search, { color: colors.text }]}
                placeholder="Search note, tag, category"
                placeholderTextColor={colors.textMuted}
                value={search}
                onChangeText={(t) => {
                  runLayoutAnimation();
                  setSearch(t);
                }}
              />
              {search.trim() ? (
                <Pressable
                  onPress={() => {
                    runLayoutAnimation();
                    setSearch('');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                  hitSlop={10}
                  style={({ pressed }) => [styles.iconBtnSm, pressed && { opacity: 0.6 }]}
                >
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </Pressable>
              ) : null}
            </View>

            {paramCategory || paramAccount ? (
              <View
                style={[styles.filterBanner, { backgroundColor: colors.accentMuted, borderColor: colors.accent }]}
              >
                <Ionicons name="funnel-outline" size={16} color={colors.accent} />
                <Text style={[styles.filterText, { color: colors.text }]} numberOfLines={2}>
                  {paramCategory ? `Category: ${paramCategory}` : ''}
                  {paramCategory && paramAccount ? ' · ' : ''}
                  {paramAccount ? `Account: ${accountNameById.get(Number(paramAccount)) ?? paramAccount}` : ''}
                </Text>
                <Pressable
                  onPress={() => router.replace('/(tabs)/activity')}
                  style={({ pressed }) => [styles.clearFilter, pressed && { opacity: 0.7 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Clear filters"
                >
                  <Text style={{ color: colors.accent, fontWeight: '700' }}>Clear</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </PressableCard>
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

      {receiptPreviewUri ? (
        <Modal animationType="fade" transparent visible onRequestClose={() => setReceiptPreviewUri(null)}>
          <Pressable style={styles.receiptOverlay} onPress={() => setReceiptPreviewUri(null)}>
            <Pressable style={[styles.receiptSheet, surfaceCard(colors, true)]} onPress={(e) => e.stopPropagation()}>
              <View style={styles.receiptToolbar}>
                <Text style={[typeStyles.bodyMedium, { color: colors.text }]}>Receipt</Text>
                <Pressable
                  onPress={() => setReceiptPreviewUri(null)}
                  accessibilityRole="button"
                  accessibilityLabel="Close receipt"
                  hitSlop={12}
                >
                  <Ionicons name="close" size={22} color={colors.textMuted} />
                </Pressable>
              </View>
              <Image source={{ uri: receiptPreviewUri }} style={styles.receiptImage} resizeMode="contain" />
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}

      {pickerTarget && Platform.OS === 'ios' ? (
        <Modal animationType="slide" transparent visible onRequestClose={() => setPickerTarget(null)}>
          <Pressable style={styles.modalOverlay} onPress={() => setPickerTarget(null)}>
            <Pressable
              style={[styles.modalSheet, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={[styles.modalToolbar, { borderBottomColor: colors.border }]}>
                <Pressable onPress={() => setPickerTarget(null)} hitSlop={12} accessibilityRole="button">
                  <Text style={[typeStyles.bodyMedium, { color: colors.accent, fontWeight: '600' }]}>Done</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={parseISODateLocal(pickerTarget === 'from' ? customFrom : customTo)}
                mode="date"
                display="spinner"
                onChange={(_, picked) => {
                  if (!picked) return;
                  const iso = toISODateString(picked);
                  if (pickerTarget === 'from') setCustomFrom(iso);
                  else setCustomTo(iso);
                }}
              />
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}

      {pickerTarget && Platform.OS === 'android' ? (
        <DateTimePicker
          value={parseISODateLocal(pickerTarget === 'from' ? customFrom : customTo)}
          mode="date"
          display="default"
          onChange={(event: DateTimePickerEvent, picked?: Date) => {
            const target = pickerTarget;
            setPickerTarget(null);
            if (event.type !== 'set' || !picked || !target) return;
            const iso = toISODateString(picked);
            if (target === 'from') setCustomFrom(iso);
            else setCustomTo(iso);
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
  toolbarOuter: { paddingHorizontal: space[2], paddingTop: space[1], paddingBottom: space[1] / 2 },
  toolbarCard: { padding: space[2] - 2, borderRadius: radii.lg },
  toolbar: { gap: space[1] + 2 },
  segmentRow: { flexDirection: 'row', gap: space[1], alignItems: 'stretch' },
  segBtn: {
    flex: 1,
    paddingHorizontal: space[2] - 2,
    paddingVertical: space[1] + 2,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radii.md - 2,
    borderWidth: 1,
  },
  segContent: { flexDirection: 'row', alignItems: 'center', gap: space[1] - 2 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    borderRadius: radii.md,
    paddingHorizontal: space[2] - 2,
    paddingVertical: space[1] + 1,
  },
  search: { flex: 1, fontSize: 15, paddingVertical: 0 },
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
  iconBtnSm: { padding: 6, minWidth: 36, minHeight: 36, justifyContent: 'center', alignItems: 'center' },
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
  customRangeRow: { flexDirection: 'row', gap: space[2] },
  customField: { flex: 1 },
  customTrigger: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: space[2] - 2,
    paddingVertical: space[1] + 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[1],
  },
  customInput: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: space[2] - 2,
    paddingVertical: space[1] + 2,
    fontSize: 15,
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
  receiptOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: space[2] },
  receiptSheet: { padding: space[2], borderRadius: radii.lg, maxHeight: '85%' },
  receiptToolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space[1] },
  receiptImage: { width: '100%', height: 420, borderRadius: radii.md, backgroundColor: 'transparent' },
});
