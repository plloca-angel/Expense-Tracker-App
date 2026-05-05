import { Ionicons } from '@expo/vector-icons';
import { BarChart } from 'react-native-gifted-charts';
import { useMemo, useState } from 'react';
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { CATEGORY_CHART_COLORS } from '../src/constants';
import { useFinance } from '../src/context/FinanceContext';
import {
  categoryMovers,
  daysInMonthYm,
  netForMonth,
  spendByDayInMonth,
  topExpenseCategories,
} from '../src/lib/analytics';
import { lastNDaysNetByDay } from '../src/lib/aggregates';
import { formatMoney } from '../src/lib/money';
import { currentMonthPrefix, monthlyTotalsLastNMonths } from '../src/lib/period';

const screenW = Dimensions.get('window').width;

function shiftYm(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function AnalyticsScreen() {
  const { colors, settings, expenses, incomes } = useFinance();
  const [ym, setYm] = useState(() => currentMonthPrefix());
  const prevYm = useMemo(() => shiftYm(ym, -1), [ym]);

  const spendByDay = useMemo(() => spendByDayInMonth(expenses, ym), [expenses, ym]);
  const dim = daysInMonthYm(ym);
  const maxDaySpend = Math.max(1, ...spendByDay.values());

  const movers = useMemo(() => categoryMovers(expenses, ym, prevYm).slice(0, 6), [expenses, ym, prevYm]);
  const topCats = useMemo(() => topExpenseCategories(expenses, ym, 8), [expenses, ym]);

  const monthNet = useMemo(() => netForMonth(expenses, incomes, ym), [expenses, incomes, ym]);
  const prevNet = useMemo(() => netForMonth(expenses, incomes, prevYm), [expenses, incomes, prevYm]);

  const last12 = useMemo(() => monthlyTotalsLastNMonths(expenses, 12), [expenses]);
  const barMax = Math.max(1, ...last12.map((x) => x.total));
  const barData = last12.map((x, i) => ({
    value: x.total,
    label: x.label.slice(0, 3),
    frontColor: CATEGORY_CHART_COLORS[i % CATEGORY_CHART_COLORS.length],
  }));

  const flow30 = useMemo(() => lastNDaysNetByDay(expenses, incomes, 30), [expenses, incomes]);

  const chartW = Math.min(screenW - 48, 340);

  const openCategory = (category: string) => {
    router.push(`/(tabs)/activity?category=${encodeURIComponent(category)}`);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.monthNav}>
          <Pressable
            onPress={() => setYm((y) => shiftYm(y, -1))}
            style={styles.navBtn}
            accessibilityRole="button"
            accessibilityLabel="Previous month"
          >
            <Ionicons name="chevron-back" size={24} color={colors.accent} />
          </Pressable>
          <Text style={[styles.monthTitle, { color: colors.text }]}>{ym}</Text>
          <Pressable
            onPress={() => setYm((y) => shiftYm(y, 1))}
            style={styles.navBtn}
            accessibilityRole="button"
            accessibilityLabel="Next month"
          >
            <Ionicons name="chevron-forward" size={24} color={colors.accent} />
          </Pressable>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Month at a glance</Text>
          <View style={styles.row2}>
            <View style={styles.cell}>
              <Text style={[styles.muted, { color: colors.textMuted }]}>Net cash flow</Text>
              <Text style={[styles.big, { color: monthNet >= 0 ? colors.income : colors.expense }]}>
                {formatMoney(monthNet, settings.currency)}
              </Text>
              <Text style={[styles.cmp, { color: colors.textMuted }]}>
                vs {prevYm}: {formatMoney(prevNet, settings.currency)}
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Calendar · spending heat</Text>
          <Text style={[styles.hint, { color: colors.textMuted }]}>Tap a category below to filter the activity log.</Text>
          <View style={styles.calGrid}>
            {Array.from({ length: dim }, (_, i) => i + 1).map((day) => {
              const v = spendByDay.get(day) ?? 0;
              const intensity = v <= 0 ? 0 : 0.12 + (v / maxDaySpend) * 0.78;
              return (
                <View key={day} style={[styles.calCell, { backgroundColor: colors.bgElevated }]}>
                  {v > 0 ? (
                    <View
                      pointerEvents="none"
                      style={[
                        StyleSheet.absoluteFillObject,
                        {
                          borderRadius: 10,
                          backgroundColor: colors.expense,
                          opacity: intensity,
                        },
                      ]}
                    />
                  ) : null}
                  <Text style={[styles.calDay, { color: v <= 0 ? colors.textMuted : colors.text }]}>{day}</Text>
                  {v > 0 ? (
                    <Text style={[styles.calAmt, { color: colors.text }]} numberOfLines={1}>
                      {formatMoney(v, settings.currency)}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Top categories · {ym}</Text>
          {topCats.length === 0 ? (
            <Text style={{ color: colors.textMuted }}>No expenses this month.</Text>
          ) : (
            topCats.map((c, idx) => (
              <Pressable
                key={c.category}
                onPress={() => openCategory(c.category)}
                style={[styles.catRow, { borderColor: colors.border }]}
              >
                <View style={[styles.dot, { backgroundColor: CATEGORY_CHART_COLORS[idx % CATEGORY_CHART_COLORS.length] }]} />
                <Text style={[styles.catName, { color: colors.text }]}>{c.category}</Text>
                <Text style={[styles.catAmt, { color: colors.textSecondary }]}>
                  {formatMoney(c.total, settings.currency)}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            ))
          )}
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Category movers</Text>
          <Text style={[styles.hint, { color: colors.textMuted }]}>Compared to the previous month ({prevYm}).</Text>
          {movers.length === 0 ? (
            <Text style={{ color: colors.textMuted }}>No big changes between these months.</Text>
          ) : (
            movers.map((m) => (
              <View key={m.category} style={[styles.moverRow, { borderColor: colors.border }]}>
                <Text style={[styles.catName, { color: colors.text, flex: 1 }]}>{m.category}</Text>
                <Text
                  style={{
                    fontWeight: '700',
                    color: m.delta > 0 ? colors.expense : m.delta < 0 ? colors.income : colors.textSecondary,
                  }}
                >
                  {m.delta > 0 ? '+' : ''}
                  {formatMoney(m.delta, settings.currency)}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Spending · last 12 months</Text>
          <BarChart
            data={barData}
            width={chartW}
            height={200}
            barWidth={14}
            spacing={8}
            roundedTop
            roundedBottom
            hideRules
            showGradient={false}
            xAxisThickness={0}
            yAxisThickness={0}
            yAxisTextStyle={{ color: colors.chartLabel, fontSize: 9 }}
            maxValue={barMax}
            noOfSections={4}
            isAnimated
          />
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Daily net · last 7 days</Text>
          <Text style={[styles.hint, { color: colors.textMuted }]}>Income minus expenses per day.</Text>
          {flow30.slice(-7).map((d) => (
            <View key={d.key} style={[styles.netRow, { borderColor: colors.border }]}>
              <Text style={[styles.netLabel, { color: colors.textSecondary }]}>{d.label}</Text>
              <Text style={[styles.netVal, { color: d.net >= 0 ? colors.income : colors.expense }]}>
                {formatMoney(d.net, settings.currency)}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40 },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  navBtn: { padding: 8 },
  monthTitle: { fontSize: 20, fontWeight: '800' },
  card: { borderRadius: 16, padding: 18, marginBottom: 16, borderWidth: 1 },
  cardTitle: { fontSize: 17, fontWeight: '700', marginBottom: 10 },
  hint: { fontSize: 13, lineHeight: 18, marginBottom: 10 },
  row2: { flexDirection: 'row' },
  cell: { flex: 1 },
  muted: { fontSize: 13, marginBottom: 6 },
  big: { fontSize: 26, fontWeight: '800' },
  cmp: { fontSize: 13, marginTop: 6 },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  calCell: {
    width: '13.5%',
    minWidth: 44,
    aspectRatio: 1,
    borderRadius: 10,
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  calDay: { fontSize: 12, fontWeight: '700' },
  calAmt: { fontSize: 8, marginTop: 2 },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  catName: { flex: 1, fontSize: 15, fontWeight: '600' },
  catAmt: { fontSize: 15, fontWeight: '700' },
  moverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  netRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  netLabel: { fontSize: 14 },
  netVal: { fontSize: 15, fontWeight: '700' },
});
