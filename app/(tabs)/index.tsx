import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { BarChart, PieChart } from 'react-native-gifted-charts';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
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
import { useTabHeaderSubtitle } from '../../src/hooks/useTabHeaderSubtitle';
import { hapticLight } from '../../src/lib/haptics';
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
import { radii, space, surfaceCard, type as typeStyles } from '../../src/theme/tokens';

const screenW = Dimensions.get('window').width;

export default function OverviewScreen() {
  const { ready, colors, settings, expenses, incomes, budgets, goals, recurringItems, refresh } = useFinance();
  const [period, setPeriod] = useState<PeriodFilter>('month');
  const [refreshing, setRefreshing] = useState(false);

  const headerSubtitle =
    period === 'month' ? 'This month' : period === '30d' ? 'Last 30 days' : 'All time';
  useTabHeaderSubtitle('Overview', headerSubtitle, colors);

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

  const dueRecurring = useMemo(
    () => recurringItems.filter((r) => r.active && r.lastPostedYm !== ym),
    [recurringItems, ym]
  );

  if (!ready) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[typeStyles.body, styles.loadingText, { color: colors.textMuted }]}>
          Loading your data…
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.accent} />
        }
      >
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
                onPress={() => {
                  void hapticLight();
                  setPeriod(key);
                }}
                style={({ pressed }) => [
                  styles.periodChip,
                  { borderColor: colors.border, backgroundColor: colors.card },
                  active && { backgroundColor: colors.accentMuted, borderColor: colors.accent },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text
                  style={[
                    typeStyles.captionMedium,
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
              <Text style={[typeStyles.captionMedium, { color: colors.textMuted }]}>Expenses</Text>
              <Text style={[typeStyles.titleLarge, { color: colors.expense, marginTop: space[1] / 2 }]}>
                {formatMoney(spent, settings.currency)}
              </Text>
            </View>
            <View style={styles.heroCell}>
              <Text style={[typeStyles.captionMedium, { color: colors.textMuted }]}>Income</Text>
              <Text style={[typeStyles.titleLarge, { color: colors.income, marginTop: space[1] / 2 }]}>
                {formatMoney(earned, settings.currency)}
              </Text>
            </View>
          </View>
          <View style={[styles.netRow, { borderTopColor: colors.border }]}>
            <Text style={[typeStyles.bodyMedium, { color: colors.textSecondary }]}>Net</Text>
            <Text style={[styles.netValue, { color: net >= 0 ? colors.income : colors.expense }]}>
              {formatMoney(net, settings.currency)}
            </Text>
          </View>
          <Text style={[typeStyles.caption, { color: colors.textMuted, marginTop: space[1] + 2 }]}>
            {fExpenses.length} expense{fExpenses.length === 1 ? '' : 's'} · {fIncomes.length} income
            {fIncomes.length === 1 ? '' : 's'}
          </Text>
        </LinearGradient>

        <Pressable
          onPress={() => router.push('/month-snapshot')}
          style={[
            styles.analyticsCta,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Open month snapshot"
        >
          <Ionicons name="share-outline" size={22} color={colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.analyticsTitle, { color: colors.text }]}>Month snapshot</Text>
            <Text style={[styles.analyticsSub, { color: colors.textSecondary }]}>
              Net, top categories, vs last month — share as text
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </Pressable>

        {dueRecurring.length > 0 ? (
          <View style={[styles.card, surfaceCard(colors, true)]}>
            <Text style={[typeStyles.title, styles.cardTitle, { color: colors.text }]}>Recurring · {ym}</Text>
            <Text style={[typeStyles.caption, { color: colors.textMuted, marginBottom: space[1] + 2 }]}>
              Expected this month but not posted yet. Use Plans to post recurring items.
            </Text>
            {dueRecurring.slice(0, 5).map((r) => (
              <View key={r.id} style={[styles.dueRow, { borderColor: colors.border }]}>
                <Text style={[typeStyles.bodyMedium, { color: colors.text }]}>
                  {r.kind === 'expense' ? '−' : '+'}
                  {formatMoney(r.amount, settings.currency)} · {r.title || r.category}
                </Text>
                <Text style={[typeStyles.caption, { color: colors.textMuted, marginTop: space[1] / 4 }]}>
                  Day {r.dayOfMonth} · {r.category}
                </Text>
              </View>
            ))}
            {dueRecurring.length > 5 ? (
              <Text style={[typeStyles.caption, { color: colors.textMuted, marginTop: space[1] }]}>
                +{dueRecurring.length - 5} more in Plans
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={[styles.card, surfaceCard(colors, true)]}>
          <Text style={[typeStyles.title, styles.cardTitle, { color: colors.text }]}>Insights</Text>
          <Text style={[typeStyles.bodySmall, styles.insightLine, { color: colors.textSecondary }]}>
            Avg spend / day ({period === 'month' ? 'this month' : period === '30d' ? 'last 30 days' : 'all time'}):{' '}
            <Text style={{ fontWeight: '700', color: colors.text }}>{formatMoney(avgDaily, settings.currency)}</Text>
          </Text>
          {topShare ? (
            <Text style={[typeStyles.bodySmall, styles.insightLine, { color: colors.textSecondary }]}>
              Top category:{' '}
              <Text style={{ fontWeight: '700', color: colors.text }}>
                {topShare.category} ({Math.round(topShare.share * 100)}%)
              </Text>
            </Text>
          ) : null}
          {vsPrev && vsPrev.pctChange !== null ? (
            <Text style={[typeStyles.bodySmall, styles.insightLine, { color: colors.textSecondary }]}>
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
            <Text style={[typeStyles.bodySmall, styles.insightLine, { color: colors.textMuted }]}>
              No prior month to compare.
            </Text>
          ) : null}
        </View>

        {goals.length > 0 ? (
          <View style={[styles.card, surfaceCard(colors, true)]}>
            <Text style={[typeStyles.title, styles.cardTitle, { color: colors.text }]}>Savings goals</Text>
            {goals.slice(0, 3).map((g) => {
              const pct = g.targetAmount > 0 ? Math.min(100, (g.savedAmount / g.targetAmount) * 100) : 0;
              return (
                <View key={g.id} style={styles.goalPreview}>
                  <Text style={[typeStyles.bodyMedium, { color: colors.text }]}>{g.name}</Text>
                  <View style={[styles.progressTrack, { backgroundColor: colors.bgElevated }]}>
                    <View
                      style={[styles.progressFill, { width: `${pct}%`, backgroundColor: colors.income }]}
                    />
                  </View>
                  <Text style={[typeStyles.caption, { color: colors.textMuted }]}>
                    {formatMoney(g.savedAmount, settings.currency)} / {formatMoney(g.targetAmount, settings.currency)}
                  </Text>
                </View>
              );
            })}
            {goals.length > 3 ? (
              <Text style={[typeStyles.caption, { color: colors.textMuted, marginTop: space[1] / 2 + 2 }]}>
                +{goals.length - 3} more in Budgets
              </Text>
            ) : null}
          </View>
        ) : null}

        {budgetRows.length > 0 ? (
          <View style={[styles.card, surfaceCard(colors, true)]}>
            <Text style={[typeStyles.title, styles.cardTitle, { color: colors.text }]}>Budgets · {ym}</Text>
            {budgetRows.map((b) => (
              <View key={b.id} style={styles.budgetBlock}>
                <View style={styles.budgetTop}>
                  <Text style={[typeStyles.bodyMedium, { color: colors.text }]}>{b.category}</Text>
                  <Text style={[typeStyles.caption, { color: colors.textMuted }]}>
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
                  <Text style={[typeStyles.captionMedium, { color: colors.expense, marginTop: space[1] / 2, fontWeight: '600' }]}>
                    Over budget
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        <View style={[styles.card, surfaceCard(colors, true)]}>
          <Text style={[typeStyles.title, styles.cardTitle, { color: colors.text }]}>By category</Text>
          {pieData.length === 0 ? (
            <Text style={[typeStyles.body, styles.empty, { color: colors.textMuted }]}>
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

        <View style={[styles.card, surfaceCard(colors, true)]}>
          <Text style={[typeStyles.title, styles.cardTitle, { color: colors.text }]}>Spending · last 7 days</Text>
          {fExpenses.length === 0 ? (
            <Text style={[typeStyles.body, styles.empty, { color: colors.textMuted }]}>No data in this period.</Text>
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
  scroll: { paddingHorizontal: space[3], paddingTop: space[2], paddingBottom: space[4] },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: space[1] + 4 },
  periodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space[1], marginBottom: space[2] },
  periodChip: {
    paddingHorizontal: space[2] - 2,
    paddingVertical: space[1],
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  analyticsCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1] + 4,
    padding: space[2],
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: space[2],
  },
  dueRow: {
    paddingVertical: space[1] + 2,
    marginBottom: space[1],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  analyticsTitle: { fontSize: 16, fontWeight: '700' },
  analyticsSub: { fontSize: 13, marginTop: 2 },
  hero: {
    borderRadius: radii.lg,
    padding: space[3],
    marginBottom: space[2],
    borderWidth: 1,
    overflow: 'hidden',
  },
  heroGrid: { flexDirection: 'row', gap: space[2] },
  heroCell: { flex: 1 },
  netRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: space[2],
    paddingTop: space[2],
    borderTopWidth: 1,
  },
  netValue: { fontSize: 22, lineHeight: 28, fontWeight: '800' },
  card: { padding: space[2], marginBottom: space[2] },
  cardTitle: { marginBottom: space[1] + 4 },
  empty: {},
  pieWrap: { alignItems: 'center', paddingVertical: space[1] },
  budgetBlock: { marginBottom: space[2] - 2 },
  budgetTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: space[1] - 2 },
  progressTrack: { height: space[1], borderRadius: radii.sm / 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radii.sm / 2 },
  insightLine: { marginBottom: space[1] - 2 },
  goalPreview: { marginBottom: space[1] + 4 },
  breakdownTitle: { fontSize: 13, fontWeight: '600', marginBottom: space[1] },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space[1] + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: space[1] + 2,
  },
  breakdownDot: { width: 10, height: 10, borderRadius: 5 },
  breakdownCat: { flex: 1, fontSize: 15, fontWeight: '600' },
  breakdownAmt: { fontSize: 15, fontWeight: '700' },
});
