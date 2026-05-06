import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFinance } from '../../src/context/FinanceContext';
import { parseAmount, todayISODate } from '../../src/lib/money';
import { pickAndStoreReceipt, receiptSizeLimitLabel } from '../../src/lib/receipts';

type EntryKind = 'expense' | 'income';

type SplitLine = { category: string; amount: string };

export default function AddScreen() {
  const {
    colors,
    addExpense,
    addSplitExpense,
    addIncome,
    expenseCategoryOptions,
    incomeCategoryOptions,
  } = useFinance();
  const [entryKind, setEntryKind] = useState<EntryKind>('expense');
  const [splitMode, setSplitMode] = useState(false);
  const [amount, setAmount] = useState('');
  const categories = entryKind === 'expense' ? expenseCategoryOptions : incomeCategoryOptions;
  const [category, setCategory] = useState(categories[0] ?? 'Other');
  const [splitLines, setSplitLines] = useState<SplitLine[]>([
    { category: categories[0] ?? 'Other', amount: '' },
    { category: categories[1] ?? categories[0] ?? 'Other', amount: '' },
  ]);
  const [tag, setTag] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayISODate());
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onKindChange = (k: EntryKind) => {
    setEntryKind(k);
    const next = k === 'expense' ? expenseCategoryOptions : incomeCategoryOptions;
    const first = next[0] ?? 'Other';
    setCategory(first);
    setSplitLines([
      { category: first, amount: '' },
      { category: next[1] ?? first, amount: '' },
    ]);
    if (k === 'income') {
      setSplitMode(false);
      setReceiptUri(null);
    }
  };

  const splitTotal = useMemo(() => {
    let s = 0;
    for (const l of splitLines) {
      const v = parseAmount(l.amount);
      if (v !== null) s += v;
    }
    return s;
  }, [splitLines]);

  const onSave = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
      Alert.alert('Check date', 'Use YYYY-MM-DD format.');
      return;
    }
    setSaving(true);
    try {
      if (entryKind === 'expense' && splitMode) {
        const lines: { amount: number; category: string }[] = [];
        for (const l of splitLines) {
          const v = parseAmount(l.amount);
          if (v === null) {
            Alert.alert('Split amounts', 'Enter a positive number on each line.');
            setSaving(false);
            return;
          }
          lines.push({ amount: v, category: l.category });
        }
        if (lines.length < 2) {
          Alert.alert('Split', 'Add at least two category lines.');
          setSaving(false);
          return;
        }
        await addSplitExpense({
          lines,
          tag: tag.trim() || null,
          note: note.trim() || null,
          date: date.trim(),
          receiptUri,
        });
      } else {
        const value = parseAmount(amount);
        if (value === null) {
          Alert.alert('Check amount', 'Enter a positive number.');
          setSaving(false);
          return;
        }
        if (entryKind === 'expense') {
          await addExpense({
            amount: value,
            category,
            tag: tag.trim() || null,
            note: note.trim() || null,
            date: date.trim(),
            receiptUri,
          });
        } else {
          await addIncome({
            amount: value,
            category,
            tag: tag.trim() || null,
            note: note.trim() || null,
            date: date.trim(),
          });
        }
      }
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        /* optional */
      }
      setAmount('');
      setTag('');
      setNote('');
      setDate(todayISODate());
      setReceiptUri(null);
      const first = expenseCategoryOptions[0] ?? 'Other';
      setSplitLines([
        { category: first, amount: '' },
        { category: expenseCategoryOptions[1] ?? first, amount: '' },
      ]);
      router.replace('/(tabs)/activity');
    } finally {
      setSaving(false);
    }
  };

  const onPickReceipt = async () => {
    try {
      const uri = await pickAndStoreReceipt();
      if (uri) setReceiptUri(uri);
    } catch (e) {
      Alert.alert('Receipt', e instanceof Error ? e.message : 'Could not attach.');
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.label, { color: colors.textSecondary }]}>Type</Text>
          <View style={styles.kindRow}>
            <Pressable
              onPress={() => onKindChange('expense')}
              style={[
                styles.kindBtn,
                { borderColor: colors.border, backgroundColor: colors.card },
                entryKind === 'expense' && { borderColor: colors.expense, backgroundColor: colors.bgElevated },
              ]}
            >
              <Text
                style={[
                  styles.kindText,
                  { color: colors.text },
                  entryKind === 'expense' && { color: colors.expense, fontWeight: '700' },
                ]}
              >
                Expense
              </Text>
            </Pressable>
            <Pressable
              onPress={() => onKindChange('income')}
              style={[
                styles.kindBtn,
                { borderColor: colors.border, backgroundColor: colors.card },
                entryKind === 'income' && { borderColor: colors.income, backgroundColor: colors.bgElevated },
              ]}
            >
              <Text
                style={[
                  styles.kindText,
                  { color: colors.text },
                  entryKind === 'income' && { color: colors.income, fontWeight: '700' },
                ]}
              >
                Income
              </Text>
            </Pressable>
          </View>

          {entryKind === 'expense' ? (
            <>
              <Pressable
                onPress={() => setSplitMode((s) => !s)}
                style={[
                  styles.splitToggle,
                  { borderColor: colors.border, backgroundColor: colors.card },
                  splitMode && { borderColor: colors.accent, backgroundColor: colors.accentMuted },
                ]}
              >
                <Text style={[styles.splitToggleText, { color: splitMode ? colors.accent : colors.textSecondary }]}>
                  {splitMode ? 'Split payment (multiple categories)' : 'Single category — tap for split'}
                </Text>
              </Pressable>
            </>
          ) : null}

          {entryKind === 'expense' && splitMode ? (
            <>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Lines</Text>
              {splitLines.map((line, idx) => (
                <View key={idx} style={[styles.splitBlock, { borderColor: colors.border }]}>
                  <View style={styles.splitHead}>
                    <Text style={[styles.splitIdx, { color: colors.textMuted }]}>#{idx + 1}</Text>
                    {splitLines.length > 2 ? (
                      <Pressable
                        onPress={() => setSplitLines((rows) => rows.filter((_, i) => i !== idx))}
                        hitSlop={8}
                      >
                        <Text style={{ color: colors.danger, fontWeight: '600' }}>Remove</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  <Text style={[styles.miniLabel, { color: colors.textSecondary }]}>Amount</Text>
                  <TextInput
                    style={[
                      styles.input,
                      { backgroundColor: colors.card, borderColor: colors.border, color: colors.text },
                    ]}
                    placeholder="0.00"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="decimal-pad"
                    value={line.amount}
                    onChangeText={(t) =>
                      setSplitLines((rows) => rows.map((r, i) => (i === idx ? { ...r, amount: t } : r)))
                    }
                  />
                  <Text style={[styles.miniLabel, { color: colors.textSecondary }]}>Category</Text>
                  <View style={styles.chips}>
                    {expenseCategoryOptions.map((c) => {
                      const active = c === line.category;
                      return (
                        <Pressable
                          key={`${idx}-${c}`}
                          onPress={() =>
                            setSplitLines((rows) => rows.map((r, i) => (i === idx ? { ...r, category: c } : r)))
                          }
                          style={[
                            styles.chip,
                            { borderColor: colors.border, backgroundColor: colors.card },
                            active && { backgroundColor: colors.accentMuted, borderColor: colors.accent },
                          ]}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              { color: colors.textSecondary },
                              active && { color: colors.accent, fontWeight: '700' },
                            ]}
                          >
                            {c}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
              <Pressable
                onPress={() =>
                  setSplitLines((rows) => [...rows, { category: expenseCategoryOptions[0] ?? 'Other', amount: '' }])
                }
                style={[styles.addLineBtn, { borderColor: colors.accent }]}
              >
                <Text style={{ color: colors.accent, fontWeight: '600' }}>+ Add category line</Text>
              </Pressable>
              <Text style={[styles.splitSum, { color: colors.textMuted }]}>
                Sum: {splitTotal.toFixed(2)} (one payment, several categories)
              </Text>
            </>
          ) : (
            <>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Amount</Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.card, borderColor: colors.border, color: colors.text },
                ]}
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
              />

              <Text style={[styles.label, { color: colors.textSecondary }]}>Category</Text>
              <View style={styles.chips}>
                {categories.map((c) => {
                  const active = c === category;
                  return (
                    <Pressable
                      key={c}
                      onPress={() => setCategory(c)}
                      style={[
                        styles.chip,
                        { borderColor: colors.border, backgroundColor: colors.card },
                        active && { backgroundColor: colors.accentMuted, borderColor: colors.accent },
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: colors.textSecondary },
                          active && { color: colors.accent, fontWeight: '700' },
                        ]}
                      >
                        {c}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          <Text style={[styles.label, { color: colors.textSecondary }]}>Tag (optional)</Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: colors.card, borderColor: colors.border, color: colors.text },
            ]}
            placeholder="e.g. Business, Trip"
            placeholderTextColor={colors.textMuted}
            value={tag}
            onChangeText={setTag}
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>Date</Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: colors.card, borderColor: colors.border, color: colors.text },
            ]}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textMuted}
            value={date}
            onChangeText={setDate}
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>Note (optional)</Text>
          <TextInput
            style={[
              styles.input,
              styles.noteInput,
              { backgroundColor: colors.card, borderColor: colors.border, color: colors.text },
            ]}
            placeholder="Details"
            placeholderTextColor={colors.textMuted}
            multiline
            value={note}
            onChangeText={setNote}
          />

          {entryKind === 'expense' ? (
            <View style={[styles.receiptCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.label, { color: colors.text, marginTop: 0 }]}>Receipt (optional)</Text>
              <Text style={[styles.receiptPrivacy, { color: colors.textMuted }]}>
                Stored only on this device in app storage (not uploaded). Photos are limited to {receiptSizeLimitLabel()}{' '}
                each. Remove by deleting the expense.
              </Text>
              <View style={styles.receiptRow}>
                <Pressable
                  onPress={() => void onPickReceipt()}
                  style={[styles.receiptBtn, { backgroundColor: colors.accentMuted, borderColor: colors.accent }]}
                >
                  <Text style={{ color: colors.accent, fontWeight: '600' }}>
                    {receiptUri ? 'Change photo' : 'Attach photo'}
                  </Text>
                </Pressable>
                {receiptUri ? (
                  <Pressable onPress={() => setReceiptUri(null)} hitSlop={12}>
                    <Text style={{ color: colors.danger, fontWeight: '600' }}>Clear</Text>
                  </Pressable>
                ) : null}
              </View>
              {receiptUri ? (
                <Text style={[styles.receiptPath, { color: colors.textMuted }]} numberOfLines={2}>
                  Saved locally
                </Text>
              ) : null}
            </View>
          ) : null}

          <Pressable
            style={[
              styles.saveBtn,
              { backgroundColor: colors.accent },
              saving && { opacity: 0.7 },
            ]}
            onPress={() => void onSave()}
            disabled={saving}
          >
            <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save'}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8, marginTop: 4 },
  miniLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  kindRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  kindBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
  },
  kindText: { fontSize: 16 },
  splitToggle: { padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  splitToggleText: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  splitBlock: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 12 },
  splitHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  splitIdx: { fontWeight: '700' },
  addLineBtn: { alignSelf: 'flex-start', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1 },
  splitSum: { fontSize: 13, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, marginBottom: 16 },
  noteInput: { minHeight: 88, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 14 },
  receiptCard: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 16 },
  receiptPrivacy: { fontSize: 13, lineHeight: 18, marginBottom: 12 },
  receiptRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  receiptBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1 },
  receiptPath: { fontSize: 12, marginTop: 8 },
  saveBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
