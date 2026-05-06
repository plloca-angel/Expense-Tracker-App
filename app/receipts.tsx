import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PressableCard } from '../src/components/PressableCard';
import { useFinance } from '../src/context/FinanceContext';
import { formatISODateMedium } from '../src/lib/money';
import { radii, space, surfaceCard, type as typeStyles } from '../src/theme/tokens';

type ReceiptItem = {
  id: number;
  date: string;
  category: string;
  amount: number;
  uri: string;
};

function ymLabel(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, (m ?? 1) - 1, 1);
  return d.toLocaleString(undefined, { month: 'long', year: 'numeric' });
}

export default function ReceiptsScreen() {
  const { colors, settings, expenses } = useFinance();
  const [openUri, setOpenUri] = useState<string | null>(null);

  const groups = useMemo(() => {
    const items: ReceiptItem[] = expenses
      .filter((e) => Boolean(e.receiptUri))
      .map((e) => ({
        id: e.id,
        date: e.date.slice(0, 10),
        category: e.category,
        amount: e.amount,
        uri: e.receiptUri!,
      }))
      .sort((a, b) => (a.date === b.date ? b.id - a.id : b.date.localeCompare(a.date)));

    const byYm = new Map<string, ReceiptItem[]>();
    for (const it of items) {
      const ym = it.date.slice(0, 7);
      const cur = byYm.get(ym) ?? [];
      cur.push(it);
      byYm.set(ym, cur);
    }
    return [...byYm.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [expenses]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[typeStyles.titleLarge, { color: colors.text }]}>Receipts</Text>
        <Text style={[typeStyles.caption, { color: colors.textMuted, marginTop: 4 }]}>
          Stored locally on this device. Tap any receipt to view.
        </Text>

        {groups.length === 0 ? (
          <View style={[styles.empty, surfaceCard(colors, true)]}>
            <Ionicons name="receipt-outline" size={34} color={colors.textMuted} />
            <Text style={[typeStyles.bodyMedium, { color: colors.text, marginTop: space[1] }]}>
              No receipts yet
            </Text>
            <Text style={[typeStyles.body, { color: colors.textMuted, marginTop: space[1] / 2 }]}>
              Attach receipts when adding expenses to view them here.
            </Text>
          </View>
        ) : (
          groups.map(([ym, items]) => (
            <View key={ym} style={{ marginTop: space[2] }}>
              <Text style={[typeStyles.title, { color: colors.text, marginBottom: space[1] }]}>{ymLabel(ym)}</Text>
              <View style={styles.grid}>
                {items.map((it) => (
                  <PressableCard
                    key={it.id}
                    colors={colors}
                    elevated
                    style={styles.thumbCard}
                    onPress={() => setOpenUri(it.uri)}
                    accessibilityRole="button"
                    accessibilityLabel={`Receipt ${it.category}, ${formatISODateMedium(it.date)}`}
                  >
                    <Image source={{ uri: it.uri }} style={styles.thumb} resizeMode="cover" />
                    <View style={styles.thumbMeta}>
                      <Text style={[typeStyles.captionMedium, { color: colors.text }]} numberOfLines={1}>
                        {it.category}
                      </Text>
                      <Text style={[typeStyles.caption, { color: colors.textMuted }]} numberOfLines={1}>
                        {formatISODateMedium(it.date)} · {it.amount.toFixed(2)} {settings.currency}
                      </Text>
                    </View>
                  </PressableCard>
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {openUri ? (
        <Modal animationType="fade" transparent visible onRequestClose={() => setOpenUri(null)}>
          <Pressable style={styles.overlay} onPress={() => setOpenUri(null)}>
            <Pressable style={[styles.sheet, surfaceCard(colors, true)]} onPress={(e) => e.stopPropagation()}>
              <View style={styles.toolbar}>
                <Text style={[typeStyles.bodyMedium, { color: colors.text }]}>Receipt</Text>
                <Pressable
                  onPress={() => setOpenUri(null)}
                  accessibilityRole="button"
                  accessibilityLabel="Close receipt"
                  hitSlop={12}
                >
                  <Ionicons name="close" size={22} color={colors.textMuted} />
                </Pressable>
              </View>
              <Image source={{ uri: openUri }} style={styles.fullImage} resizeMode="contain" />
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: space[3], paddingBottom: space[5] },
  empty: { padding: space[3], marginTop: space[3], alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] - 2 },
  thumbCard: { width: '48%', borderRadius: radii.lg, overflow: 'hidden' },
  thumb: { width: '100%', height: 120, backgroundColor: 'rgba(0,0,0,0.05)' },
  thumbMeta: { padding: space[1] + 2 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: space[2] },
  sheet: { padding: space[2], borderRadius: radii.lg, maxHeight: '85%' },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space[1] },
  fullImage: { width: '100%', height: 440, borderRadius: radii.md },
});

