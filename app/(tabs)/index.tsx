import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { BarChart, PieChart } from 'react-native-gifted-charts';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CATEGORY_CHART_COLORS } from '../../src/constants';
import { useFinance } from '../../src/context/FinanceContext';
import {
  byCategory,
  lastNDaysByDay,
  totalIncome,
  totalSpent,
} from '../../src/lib/aggregates';
import {
  averageDailySpend,
  spendChangeVsPreviousMonth,
  topCategoryShare,
} from '../../src/lib/insights';
import { formatMoney } from '../../src/lib/money';
import { currentMonthPrefix, expensesInMonth, filterByPeriod, type PeriodFilter } from '../../src/lib/period';

const screenW = Dimensions.get('window').width;

export default function OverviewScreen() {
  const { ready, colors, settings, expenses, incomes, budgets, goals, refresh } = useFinance();
  const isEmpty = expenses.length === 0 && incomes.length === 0;
  const [period, setPeriod] = useState<PeriodFilter>('month');
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const fExpenses = useMemo(() => filterByPeriod(expenses, period), [expenses, period]);
  const fIncomes = useMemo(() => filterByPeriod(incomes, period), [incomes, period]);

  const spent = totalSpent(fExpenses);
  const earned = totalIncome(fIncomes);
  const net = earned - spent;

  const ym = currentMonthPrefix();
  const catTotals = byCategory(fExpenses);
  const pieData = catTotals.map((item, i) => ({
    value: item.total,
    text: item.category,
    color: CATEGORY_CHART_COLORS[i % CATEGORY_CHART_COLORS.length],
  }));

  const last7 = lastNDaysByDay(fExpenses, 7);
  const barMax = Math.max(1, ...last7.map((d) => d.total));
  const barData = last7.map((d, i) => ({
    value: d.total,
    label: d.label,
    frontColor: CATEGORY_CHART_COLORS[i % CATEGORY_CHART_COLORS.length],
  }));

  const budgetRows = useMemo(() => {
    const monthExp = expensesInMonth(expenses, ym);
    return budgets.map((b) => {
      const used = monthExp.filter((e) => e.category === b.category).reduce((s, e) => s + e.amount, 0);
      const pct = b.monthlyLimit > 0 ? Math.min(100, (used / b.monthlyLimit) * 100) : 0;
      return { ...b, used, pct, over: used > b.monthlyLimit };
    });
  }, [budgets, expenses, ym]);

  const chartWidth = Math.min(screenW - 40, 360);

  const avgDaily = averageDailySpend(expenses, period);
  const topShare = topCategoryShare(expenses, period);
  const vsPrev = period === 'month' ? spendChangeVsPreviousMonth(expenses, ym) : null;

  if (!ready) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading your data…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode={Platform.OS === 'ios' ? 'on-drag' : 'none'}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.accent} />
        }
      >
        {isEmpty ? (
          <View style={[styles.emptyHero, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Start tracking</Text>
            <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
              Add your first expense or income on the Add tab. Open Analytics for calendar views and trends once you
              have data.
            </Text>
            <View style={styles.emptyActions}>
              <Pressable
                onPress={() => router.push('/(tabs)/add')}
                style={[styles.emptyBtn, { backgroundColor: colors.accent }]}
                accessibilityRole="button"
                accessibilityLabel="Go to add transaction"
              >
                <Text style={styles.emptyBtnText}>Add transaction</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push('/analytics')}
                style={[styles.emptyBtnOutline, { borderColor: colors.accent }]}
                accessibilityRole="button"
                accessibilityLabel="Open analytics"
              >
                <Text style={[styles.emptyBtnOutlineText, { color: colors.accent }]}>Browse analytics</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={styles.periodRow}>
          {(
            [
              ['month', 'This month'],
              ['30d', '30 days'],
              ['all', 'All time'],
            ] as const
          ).map(([key, label]) => {
            const active = period === key;
            return (
              <Pressable
                key={key}
                onPress={() => setPeriod(key)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={
                  key === 'month' ? 'Period: this month' : key === '30d' ? 'Period: last 30 days' : 'Period: all time'
                }
                style={[
                  styles.periodChip,
                  { borderColor: colors.border, backgroundColor: colors.card },
                  active && { backgroundColor: colors.accentMuted, borderColor: colors.accent },
                ]}
              >
                <Text
                  style={[
                    styles.periodChipText,
                    { color: colors.textSecondary },
                    active && { color: colors.accent, fontWeight: '700' },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={() => router.push('/analytics')}
          style={[
            styles.analyticsCta,
            { backgroundColor: colors.accentMuted, borderColor: colors.accent },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Open analytics and calendar"
        >
          <Ionicons name="stats-chart-outline" size={22} color={colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.analyticsTitle, { color: colors.text }]}>Analytics & calendar</Text>
            <Text style={[styles.analyticsSub, { color: colors.textSecondary }]}>
              Month heatmap, trends, category drill-down
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </Pressable>

        <LinearGradient
          colors={[colors.card, colors.bgElevated]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { borderColor: colors.border }]}
        >
          <View style={styles.heroGrid}>
            <View style={styles.heroCell}>
              <Text style={[styles.heroLabel, { color: colors.textMuted }]}>Expenses</Text>
              <Text style={[styles.heroAmount, { color: colors.expense }]}>{formatMoney(spent, settings.currency)}</Text>
            </View>
            <View style={styles.heroCell}>
              <Text style={[styles.heroLabel, { color: colors.textMuted }]}>Income</Text>
              <Text style={[styles.heroAmount, { color: colors.income }]}>{formatMoney(earned, settings.currency)}</Text>
            </View>
          </View>
          <View style={[styles.netRow, { borderTopColor: colors.border }]}>
            <Text style={[styles.netLabel, { color: colors.textSecondary }]}>Net</Text>
            <Text style={[styles.netValue, { color: net >= 0 ? colors.income : colors.expense }]}>
              {formatMoney(net, settings.currency)}
            </Text>
          </View>
          <Text style={[styles.heroHint, { color: colors.textMuted }]}>
            {fExpenses.length} expense{fExpenses.length === 1 ? '' : 's'} · {fIncomes.length} income
            {fIncomes.length === 1 ? '' : 's'}
          </Text>
        </LinearGradient>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Insights</Text>
          <Text style={[styles.insightLine, { color: colors.textSecondary }]}>
            Avg spend / day ({period === 'month' ? 'this month' : period === '30d' ? 'last 30 days' : 'all time'}):{' '}
            <Text style={{ fontWeight: '700', color: colors.text }}>{formatMoney(avgDaily, settings.currency)}</Text>
          </Text>
          {topShare ? (
            <Text style={[styles.insightLine, { color: colors.textSecondary }]}>
              Top category:{' '}
              <Text style={{ fontWeight: '700', color: colors.text }}>
                {topShare.category} ({Math.round(topShare.share * 100)}%)
              </Text>
            </Text>
          ) : null}
          {vsPrev && vsPrev.pctChange !== null ? (
            <Text style={[styles.insightLine, { color: colors.textSecondary }]}>
              vs {vsPrev.prevYm}:{' '}
              <Text
                style={{
                  fontWeight: '700',
                  color: vsPrev.pctChange > 0 ? colors.expense : vsPrev.pctChange < 0 ? colors.income : colors.text,
                }}
              >
                {vsPrev.pctChange > 0 ? '+' : ''}
                {vsPrev.pctChange.toFixed(0)}% spending
              </Text>
            </Text>
          ) : vsPrev && period === 'month' ? (
            <Text style={[styles.insightLine, { color: colors.textMuted }]}>No prior month to compare.</Text>
          ) : null}
        </View>

        {goals.length > 0 ? (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Savings goals</Text>
            {goals.slice(0, 3).map((g) => {
              const pct = g.targetAmount > 0 ? Math.min(100, (g.savedAmount / g.targetAmount) * 100) : 0;
              return (
                <View key={g.id} style={styles.goalPreview}>
                  <Text style={[styles.goalName, { color: colors.text }]}>{g.name}</Text>
                  <View style={[styles.progressTrack, { backgroundColor: colors.bgElevated }]}>
                    <View
                      style={[styles.progressFill, { width: `${pct}%`, backgroundColor: colors.income }]}
                    />
                  </View>
                  <Text style={[styles.goalSub, { color: colors.textMuted }]}>
                    {formatMoney(g.savedAmount, settings.currency)} / {formatMoney(g.targetAmount, settings.currency)}
                  </Text>
                </View>
              );
            })}
            {goals.length > 3 ? (
              <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 6 }}>+{goals.length - 3} more in Budgets</Text>
            ) : null}
          </View>
        ) : null}

        {budgetRows.length > 0 ? (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Budgets · {ym}</Text>
            {budgetRows.map((b) => (
              <View key={b.id} style={styles.budgetBlock}>
                <View style={styles.budgetTop}>
                  <Text style={[styles.budgetCat, { color: colors.text }]}>{b.category}</Text>
                  <Text style={[styles.budgetNums, { color: colors.textMuted }]}>
                    {formatMoney(b.used, settings.currency)} / {formatMoney(b.monthlyLimit, settings.currency)}
                  </Text>
                </View>
                <View style={[styles.progressTrack, { backgroundColor: colors.bgElevated }]}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${b.pct}%`, backgroundColor: b.over ? colors.expense : colors.accent },
                    ]}
                  />
                </View>
                {b.over ? (
                  <Text style={[styles.overBudget, { color: colors.expense }]}>Over budget</Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>By category</Text>
          {pieData.length === 0 ? (
            <Text style={[styles.empty, { color: colors.textMuted }]}>
              No expenses in this period — add entries or widen the range.
            </Text>
          ) : (
            <View style={styles.pieWrap}>
              <PieChart
                donut
                innerRadius={48}
                radius={chartWidth * 0.22}
                innerCircleColor={colors.pieInner}
                data={pieData}
                isAnimated
                showGradient={false}
                showText
                textColor={colors.text}
                textSize={12}
              />
            </View>
          )}
          {catTotals.length > 0 ? (
            <View style={{ marginTop: 16 }}>
              <Text style={[styles.breakdownTitle, { color: colors.textSecondary }]}>Tap to filter activity</Text>
              {catTotals.slice(0, 6).map((item, idx) => (
                <Pressable
                  key={item.category}
                  onPress={() =>
                    router.push(`/(tabs)/activity?category=${encodeURIComponent(item.category)}`)
                  }
                  style={[styles.breakdownRow, { borderColor: colors.border }]}
                >
                  <View
                    style={[
                      styles.breakdownDot,
                      { backgroundColor: CATEGORY_CHART_COLORS[idx % CATEGORY_CHART_COLORS.length] },
                    ]}
                  />
                  <Text style={[styles.breakdownCat, { color: colors.text }]}>{item.category}</Text>
                  <Text style={[styles.breakdownAmt, { color: colors.textSecondary }]}>
                    {formatMoney(item.total, settings.currency)}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Spending · last 7 days</Text>
          {fExpenses.length === 0 ? (
            <Text style={[styles.empty, { color: colors.textMuted }]}>No data in this period.</Text>
          ) : (
            <BarChart
              data={barData}
              width={chartWidth}
              height={200}
              barWidth={22}
              spacing={14}
              roundedTop
              roundedBottom
              hideRules
              showGradient={false}
              xAxisThickness={0}
              yAxisThickness={0}
              yAxisTextStyle={{ color: colors.chartLabel, fontSize: 10 }}
              maxValue={barMax}
              noOfSections={4}
              isAnimated
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 15 },
  periodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  periodChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 20,
    borderWidth: 1,
  },
  emptyHero: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
  },
  emptyTitle: { fontSize: 20, fontWeight: '800', marginBottom: 8 },
  emptyBody: { fontSize: 15, lineHeight: 22, marginBottom: 16 },
  emptyActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  emptyBtn: { paddingVertical: 12, paddingHorizontal: 18, borderRadius: 12 },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  emptyBtnOutline: { paddingVertical: 12, paddingHorizontal: 18, borderRadius: 12, borderWidth: 2 },
  emptyBtnOutlineText: { fontWeight: '700', fontSize: 15 },
  periodChipText: { fontSize: 13 },
  analyticsCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  analyticsTitle: { fontSize: 16, fontWeight: '700' },
  analyticsSub: { fontSize: 13, marginTop: 2 },
  hero: { borderRadius: 16, padding: 22, marginBottom: 16, borderWidth: 1 },
  heroGrid: { flexDirection: 'row', gap: 16 },
  heroCell: { flex: 1 },
  heroLabel: { fontSize: 13, fontWeight: '500' },
  heroAmount: { fontSize: 22, fontWeight: '700', marginTop: 6 },
  netRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  netLabel: { fontSize: 16, fontWeight: '600' },
  netValue: { fontSize: 22, fontWeight: '800' },
  heroHint: { marginTop: 10, fontSize: 13 },
  card: { borderRadius: 16, padding: 18, marginBottom: 16, borderWidth: 1 },
  cardTitle: { fontSize: 17, fontWeight: '600', marginBottom: 12 },
  empty: { fontSize: 15, lineHeight: 22 },
  pieWrap: { alignItems: 'center', paddingVertical: 8 },
  budgetBlock: { marginBottom: 14 },
  budgetTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  budgetCat: { fontWeight: '600' },
  budgetNums: { fontSize: 13 },
  progressTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  overBudget: { fontSize: 12, marginTop: 4, fontWeight: '600' },
  insightLine: { fontSize: 14, lineHeight: 22, marginBottom: 6 },
  goalPreview: { marginBottom: 12 },
  goalName: { fontWeight: '600', marginBottom: 6 },
  goalSub: { fontSize: 12, marginTop: 4 },
  breakdownTitle: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  breakdownDot: { width: 10, height: 10, borderRadius: 5 },
  breakdownCat: { flex: 1, fontSize: 15, fontWeight: '600' },
  breakdownAmt: { fontSize: 15, fontWeight: '700' },
});
