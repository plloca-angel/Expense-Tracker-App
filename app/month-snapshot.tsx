import { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFinance } from '../src/context/FinanceContext';
import { buildMonthSnapshot, formatSnapshotShareText } from '../src/lib/monthSnapshot';
import { formatMoney } from '../src/lib/money';
import { currentMonthPrefix } from '../src/lib/period';

export default function MonthSnapshotScreen() {
  const { ready, colors, settings, expenses, incomes } = useFinance();
  const ym = currentMonthPrefix();
  const label = useMemo(() => {
    const [y, m] = ym.split('-').map(Number);
    const d = new Date(y, m - 1, 1);
    return d.toLocaleString(undefined, { month: 'long', year: 'numeric' });
  }, [ym]);

  const snap = useMemo(
    () => buildMonthSnapshot(expenses, incomes, ym, label),
    [expenses, incomes, ym, label]
  );

  const onShare = () => {
    const msg = formatSnapshotShareText(snap, settings.currency, formatMoney);
    void Share.share({ message: msg, title: 'Month snapshot' });
  };

  if (!ready) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.ym, { color: colors.textMuted }]}>{snap.label}</Text>
        <Text style={[styles.net, { color: snap.net >= 0 ? colors.income : colors.expense }]}>
          {formatMoney(snap.net, settings.currency)}
        </Text>
        <Text style={[styles.netLabel, { color: colors.textSecondary }]}>Net (income − expenses)</Text>

        <View style={[styles.row2, { borderColor: colors.border }]}>
          <View style={styles.cell}>
            <Text style={[styles.cellLabel, { color: colors.textMuted }]}>Spent</Text>
            <Text style={[styles.cellVal, { color: colors.expense }]}>
              {formatMoney(snap.spent, settings.currency)}
            </Text>
          </View>
          <View style={styles.cell}>
            <Text style={[styles.cellLabel, { color: colors.textMuted }]}>Income</Text>
            <Text style={[styles.cellVal, { color: colors.income }]}>
              {formatMoney(snap.earned, settings.currency)}
            </Text>
          </View>
        </View>

        {snap.vsPrevious.pctChange !== null ? (
          <Text style={[styles.vs, { color: colors.textSecondary }]}>
            vs {snap.vsPrevious.prevYm}:{' '}
            <Text
              style={{
                fontWeight: '700',
                color:
                  snap.vsPrevious.pctChange > 0
                    ? colors.expense
                    : snap.vsPrevious.pctChange < 0
                      ? colors.income
                      : colors.text,
              }}
            >
              {snap.vsPrevious.pctChange > 0 ? '+' : ''}
              {snap.vsPrevious.pctChange.toFixed(0)}% spending
            </Text>
          </Text>
        ) : (
          <Text style={[styles.vs, { color: colors.textMuted }]}>No prior month to compare.</Text>
        )}

        <Text style={[styles.section, { color: colors.text }]}>Top categories</Text>
        {snap.topCategories.length === 0 ? (
          <Text style={{ color: colors.textMuted }}>No expenses this month yet.</Text>
        ) : (
          snap.topCategories.map((t, i) => (
            <View key={t.category} style={[styles.catRow, { borderColor: colors.border }]}>
              <Text style={[styles.catName, { color: colors.text }]}>
                {i + 1}. {t.category}
              </Text>
              <Text style={[styles.catAmt, { color: colors.textSecondary }]}>
                {formatMoney(t.total, settings.currency)}
              </Text>
            </View>
          ))
        )}

        <Text style={[styles.hint, { color: colors.textMuted }]}>
          Screenshot this screen or share a text summary — no account or server required.
        </Text>

        <Pressable style={[styles.shareBtn, { backgroundColor: colors.accent }]} onPress={onShare}>
          <Text style={styles.shareBtnText}>Share text summary</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  safe: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40 },
  ym: { fontSize: 15, marginBottom: 8 },
  net: { fontSize: 36, fontWeight: '800' },
  netLabel: { fontSize: 15, marginTop: 6, marginBottom: 20 },
  row2: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: 16, marginBottom: 16 },
  cell: { flex: 1 },
  cellLabel: { fontSize: 13, marginBottom: 6 },
  cellVal: { fontSize: 20, fontWeight: '700' },
  vs: { fontSize: 15, lineHeight: 22, marginBottom: 24 },
  section: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  catRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  catName: { fontSize: 16, flex: 1, paddingRight: 12 },
  catAmt: { fontSize: 16, fontWeight: '600' },
  hint: { fontSize: 13, lineHeight: 18, marginTop: 24, marginBottom: 16 },
  shareBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  shareBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
