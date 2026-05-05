import { BarChart, PieChart } from 'react-native-gifted-charts';
import { ActivityIndicator, Dimensions, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CATEGORY_CHART_COLORS } from '../../src/constants';
import { useExpenses } from '../../src/context/ExpenseContext';
import { byCategory, lastNDaysByDay, totalSpent } from '../../src/lib/aggregates';
import { formatMoney } from '../../src/lib/money';

const screenW = Dimensions.get('window').width;

export default function OverviewScreen() {
  const { ready, expenses } = useExpenses();

  if (!ready) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading your data…</Text>
      </View>
    );
  }

  const total = totalSpent(expenses);
  const catTotals = byCategory(expenses);
  const pieData = catTotals.map((item, i) => ({
    value: item.total,
    text: item.category,
    color: CATEGORY_CHART_COLORS[i % CATEGORY_CHART_COLORS.length],
  }));

  const last7 = lastNDaysByDay(expenses, 7);
  const barMax = Math.max(1, ...last7.map((d) => d.total));
  const barData = last7.map((d, i) => ({
    value: d.total,
    label: d.label,
    frontColor: CATEGORY_CHART_COLORS[i % CATEGORY_CHART_COLORS.length],
  }));

  const chartWidth = Math.min(screenW - 40, 360);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>Total tracked</Text>
          <Text style={styles.heroAmount}>{formatMoney(total)}</Text>
          <Text style={styles.heroHint}>{expenses.length} expense{expenses.length === 1 ? '' : 's'}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>By category</Text>
          {pieData.length === 0 ? (
            <Text style={styles.empty}>Add expenses to see how spending splits across categories.</Text>
          ) : (
            <View style={styles.pieWrap}>
              <PieChart
                donut
                innerRadius={48}
                radius={chartWidth * 0.22}
                innerCircleColor="#fff"
                data={pieData}
                isAnimated
                showText
                textColor="#0f172a"
                textSize={12}
              />
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Last 7 days</Text>
          {expenses.length === 0 ? (
            <Text style={styles.empty}>No entries yet — use the Add tab to log spending.</Text>
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
              yAxisTextStyle={styles.axisText}
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
  safe: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  scroll: {
    padding: 20,
    paddingBottom: 32,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
  },
  loadingText: {
    marginTop: 12,
    color: '#64748b',
    fontSize: 15,
  },
  hero: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 22,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  heroLabel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  heroAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 6,
    letterSpacing: -0.5,
  },
  heroHint: {
    marginTop: 8,
    fontSize: 14,
    color: '#94a3b8',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 12,
  },
  empty: {
    color: '#64748b',
    fontSize: 15,
    lineHeight: 22,
  },
  pieWrap: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  axisText: {
    color: '#64748b',
    fontSize: 10,
  },
});
