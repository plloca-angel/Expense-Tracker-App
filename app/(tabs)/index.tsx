import { BarChart, PieChart } from 'react-native-gifted-charts';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
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
import { formatMoney } from '../../src/lib/money';
import { currentMonthPrefix, expensesInMonth, filterByPeriod, type PeriodFilter } from '../../src/lib/period';

const screenW = Dimensions.get('window').width;

export default function OverviewScreen() {
  const { ready, colors, settings, expenses, incomes, budgets } = useFinance();
  const [period, setPeriod] = useState<PeriodFilter>('month');

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
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
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

        <View style={[styles.hero, { backgroundColor: colors.card, borderColor: colors.border }]}>
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
        </View>

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
                showText
                textColor={colors.text}
                textSize={12}
              />
            </View>
          )}
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
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  periodChipText: { fontSize: 13 },
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
});
