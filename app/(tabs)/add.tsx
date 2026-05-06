import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PressableCard } from '../../src/components/PressableCard';
import { useFinance } from '../../src/context/FinanceContext';
import { useTabHeaderSubtitle } from '../../src/hooks/useTabHeaderSubtitle';
import { hapticLight, hapticSuccess } from '../../src/lib/haptics';
import { runLayoutAnimation } from '../../src/lib/layoutAnimation';
import { parseAmount, parseISODateLocal, todayISODate, toISODateString } from '../../src/lib/money';
import { pickAndStoreReceipt, receiptSizeLimitLabel } from '../../src/lib/receipts';
import { radii, space, surfaceCard, type as typeStyles } from '../../src/theme/tokens';

type EntryKind = 'expense' | 'income';

type SplitLine = { category: string; amount: string };

export default function AddScreen() {
  const {
    colors,
    accounts,
    expenses,
    incomes,
    addExpense,
    addSplitExpense,
    addIncome,
    expenseCategoryOptions,
    incomeCategoryOptions,
  } = useFinance();
  useTabHeaderSubtitle('Add', 'New entry', colors);
  const [entryKind, setEntryKind] = useState<EntryKind>('expense');
  const [amount, setAmount] = useState('');
  const categories = entryKind === 'expense' ? expenseCategoryOptions : incomeCategoryOptions;
  const [category, setCategory] = useState(categories[0] ?? 'Other');
  const [accountId, setAccountId] = useState<number | null>(null);
  const [tag, setTag] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayISODate());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [splitMode, setSplitMode] = useState(false);
  const [splitLines, setSplitLines] = useState<SplitLine[]>([
    { category: expenseCategoryOptions[0] ?? 'Other', amount: '' },
    { category: expenseCategoryOptions[1] ?? expenseCategoryOptions[0] ?? 'Other', amount: '' },
  ]);
  const [receiptUri, setReceiptUri] = useState<string | null>(null);

  const recentQuickFill = useMemo(() => {
    const ex = expenses
      .filter((e) => !e.splitGroupId)
      .slice()
      .sort((a, b) => (a.date === b.date ? b.id - a.id : b.date.localeCompare(a.date)))
      .slice(0, 4)
      .map((e) => ({
        kind: 'expense' as const,
        id: e.id,
        label: `${e.category} · ${e.amount.toFixed(2)}`,
        amount: String(e.amount),
        category: e.category,
        accountId: e.accountId,
        tag: e.tag ?? '',
        note: e.note ?? '',
        date: e.date.slice(0, 10),
        receiptUri: e.receiptUri,
      }));

    const inc = incomes
      .slice()
      .sort((a, b) => (a.date === b.date ? b.id - a.id : b.date.localeCompare(a.date)))
      .slice(0, 4)
      .map((i) => ({
        kind: 'income' as const,
        id: i.id,
        label: `${i.category} · ${i.amount.toFixed(2)}`,
        amount: String(i.amount),
        category: i.category,
        accountId: i.accountId,
        tag: i.tag ?? '',
        note: i.note ?? '',
        date: i.date.slice(0, 10),
      }));

    return [...ex, ...inc].slice(0, 6);
  }, [expenses, incomes]);

  const applyQuickFill = (q: (typeof recentQuickFill)[number]) => {
    void hapticLight();
    runLayoutAnimation();
    setEntryKind(q.kind);
    setSplitMode(false);
    setAmount(q.amount);
    setCategory(q.category);
    setAccountId(q.accountId ?? null);
    setTag(q.tag);
    setNote(q.note);
    setDate(q.date);
    setReceiptUri(q.kind === 'expense' ? (q.receiptUri ?? null) : null);
  };

  const splitTotal = useMemo(() => {
    let s = 0;
    for (const l of splitLines) {
      const v = parseAmount(l.amount);
      if (v !== null) s += v;
    }
    return s;
  }, [splitLines]);

  const onKindChange = (k: EntryKind) => {
    void hapticLight();
    runLayoutAnimation();
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

  const onPickReceipt = async () => {
    try {
      const uri = await pickAndStoreReceipt();
      if (uri) setReceiptUri(uri);
    } catch (e) {
      Alert.alert('Receipt', e instanceof Error ? e.message : 'Could not attach.');
    }
  };

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
          accountId,
          receiptUri,
        });
      } else {
        const value = parseAmount(amount);
        if (value === null) {
          Alert.alert('Check amount', 'Enter a positive number.');
          setSaving(false);
          return;
        }
        const payload = {
          amount: value,
          category,
          tag: tag.trim() || null,
          note: note.trim() || null,
          date: date.trim(),
          accountId,
          receiptUri: entryKind === 'expense' ? receiptUri : undefined,
        };
        if (entryKind === 'expense') await addExpense(payload);
        else await addIncome(payload);
      }
      void hapticSuccess();
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

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <PressableCard colors={colors} elevated style={styles.sectionCard} accessibilityLabel="Type selector">
            <View style={styles.sectionTitleRow}>
              <Ionicons name="create-outline" size={18} color={colors.textMuted} />
              <Text style={[typeStyles.title, { color: colors.text }]}>New entry</Text>
            </View>

            {recentQuickFill.length > 0 ? (
              <>
                <Text style={[typeStyles.captionMedium, styles.label, { color: colors.textSecondary }]}>Recent</Text>
                <View style={styles.chips}>
                  {recentQuickFill.map((q) => (
                    <Pressable
                      key={`${q.kind}-${q.id}`}
                      onPress={() => applyQuickFill(q)}
                      style={({ pressed }) => [styles.chip, surfaceCard(colors, false), pressed && { opacity: 0.88 }]}
                      accessibilityRole="button"
                      accessibilityLabel={`Use recent ${q.kind} ${q.label}`}
                    >
                      <View style={styles.recentChipRow}>
                        <Ionicons
                          name={q.kind === 'expense' ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline'}
                          size={16}
                          color={q.kind === 'expense' ? colors.expense : colors.income}
                        />
                        <Text style={[typeStyles.bodySmall, { color: colors.textSecondary }]} numberOfLines={1}>
                          {q.label}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}
            <Text style={[typeStyles.captionMedium, styles.label, { color: colors.textSecondary }]}>Type</Text>
            <View style={styles.kindRow}>
              <Pressable
                onPress={() => onKindChange('expense')}
                style={({ pressed }) => [
                  styles.kindBtn,
                  { borderColor: colors.border, backgroundColor: colors.card },
                  entryKind === 'expense' && { borderColor: colors.expense, backgroundColor: colors.bgElevated },
                  pressed && { opacity: 0.92 },
                ]}
              >
                <View style={styles.kindBtnRow}>
                  <Ionicons
                    name={entryKind === 'expense' ? 'arrow-down-circle' : 'arrow-down-circle-outline'}
                    size={18}
                    color={entryKind === 'expense' ? colors.expense : colors.textMuted}
                  />
                  <Text
                    style={[
                      typeStyles.bodySmall,
                      { color: colors.text },
                      entryKind === 'expense' && { color: colors.expense, fontWeight: '700' },
                    ]}
                  >
                    Expense
                  </Text>
                </View>
              </Pressable>
              <Pressable
                onPress={() => onKindChange('income')}
                style={({ pressed }) => [
                  styles.kindBtn,
                  { borderColor: colors.border, backgroundColor: colors.card },
                  entryKind === 'income' && { borderColor: colors.income, backgroundColor: colors.bgElevated },
                  pressed && { opacity: 0.92 },
                ]}
              >
                <View style={styles.kindBtnRow}>
                  <Ionicons
                    name={entryKind === 'income' ? 'arrow-up-circle' : 'arrow-up-circle-outline'}
                    size={18}
                    color={entryKind === 'income' ? colors.income : colors.textMuted}
                  />
                  <Text
                    style={[
                      typeStyles.bodySmall,
                      { color: colors.text },
                      entryKind === 'income' && { color: colors.income, fontWeight: '700' },
                    ]}
                  >
                    Income
                  </Text>
                </View>
              </Pressable>
            </View>

          {entryKind === 'expense' ? (
            <Pressable
              onPress={() => {
                void hapticLight();
                runLayoutAnimation();
                setSplitMode((s) => !s);
              }}
              style={({ pressed }) => [
                styles.splitToggle,
                surfaceCard(colors, false),
                splitMode && { backgroundColor: colors.accentMuted, borderColor: colors.accent },
                pressed && { opacity: 0.88 },
              ]}
            >
              <Text
                style={[
                  typeStyles.bodySmall,
                  { color: splitMode ? colors.accent : colors.textSecondary, fontWeight: '600', textAlign: 'center' },
                ]}
              >
                {splitMode ? 'Split payment (multiple categories)' : 'Single category — tap for split'}
              </Text>
            </Pressable>
          ) : null}
          </PressableCard>

          {entryKind === 'expense' && splitMode ? (
            <>
              <Text style={[typeStyles.captionMedium, styles.label, { color: colors.textSecondary }]}>Lines</Text>
              {splitLines.map((line, idx) => (
                <View key={idx} style={[styles.splitBlock, surfaceCard(colors, false)]}>
                  <View style={styles.splitHead}>
                    <Text style={[typeStyles.captionMedium, { color: colors.textMuted }]}>#{idx + 1}</Text>
                    {splitLines.length > 2 ? (
                      <Pressable
                        onPress={() => setSplitLines((rows) => rows.filter((_, i) => i !== idx))}
                        hitSlop={8}
                      >
                        <Text style={{ color: colors.danger, fontWeight: '600' }}>Remove</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  <Text style={[typeStyles.captionMedium, { color: colors.textSecondary, marginBottom: space[1] / 2 }]}>
                    Amount
                  </Text>
                  <TextInput
                    style={[styles.input, surfaceCard(colors, false), { color: colors.text }]}
                    placeholder="0.00"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="decimal-pad"
                    value={line.amount}
                    onChangeText={(t) =>
                      setSplitLines((rows) => rows.map((r, i) => (i === idx ? { ...r, amount: t } : r)))
                    }
                  />
                  <Text style={[typeStyles.captionMedium, { color: colors.textSecondary, marginBottom: space[1] / 2 }]}>
                    Category
                  </Text>
                  <View style={styles.chips}>
                    {expenseCategoryOptions.map((c) => {
                      const active = c === line.category;
                      return (
                        <Pressable
                          key={`${idx}-${c}`}
                          onPress={() => {
                            void hapticLight();
                            setSplitLines((rows) => rows.map((r, i) => (i === idx ? { ...r, category: c } : r)));
                          }}
                          style={({ pressed }) => [
                            styles.chip,
                            surfaceCard(colors, false),
                            active && { backgroundColor: colors.accentMuted, borderColor: colors.accent },
                            pressed && { opacity: 0.88 },
                          ]}
                        >
                          <Text
                            style={[
                              typeStyles.bodySmall,
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
                onPress={() => {
                  void hapticLight();
                  setSplitLines((rows) => [
                    ...rows,
                    { category: expenseCategoryOptions[0] ?? 'Other', amount: '' },
                  ]);
                }}
                style={({ pressed }) => [styles.addLineBtn, { borderColor: colors.accent }, pressed && { opacity: 0.88 }]}
              >
                <Text style={{ color: colors.accent, fontWeight: '600' }}>+ Add category line</Text>
              </Pressable>
              <Text style={[typeStyles.caption, { color: colors.textMuted, marginBottom: space[1] }]}>
                Sum: {splitTotal.toFixed(2)} (one payment, several categories)
              </Text>
            </>
          ) : (
            <>
              <Text style={[typeStyles.captionMedium, styles.label, { color: colors.textSecondary }]}>Amount</Text>
              <TextInput
                style={[styles.input, surfaceCard(colors, false), { color: colors.text }]}
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
              />

              <Text style={[typeStyles.captionMedium, styles.label, { color: colors.textSecondary }]}>Category</Text>
              <View style={styles.chips}>
                {categories.map((c) => {
                  const active = c === category;
                  return (
                    <Pressable
                      key={c}
                      onPress={() => {
                        void hapticLight();
                        setCategory(c);
                      }}
                      style={({ pressed }) => [
                        styles.chip,
                        surfaceCard(colors, false),
                        active && { backgroundColor: colors.accentMuted, borderColor: colors.accent },
                        pressed && { opacity: 0.88 },
                      ]}
                    >
                      <Text
                        style={[
                          typeStyles.bodySmall,
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

          <Text style={[typeStyles.captionMedium, styles.label, { color: colors.textSecondary }]}>Account</Text>
          <View style={styles.chips}>
            <Pressable
              onPress={() => {
                void hapticLight();
                setAccountId(null);
              }}
              style={({ pressed }) => [
                styles.chip,
                surfaceCard(colors, false),
                accountId === null && { backgroundColor: colors.accentMuted, borderColor: colors.accent },
                pressed && { opacity: 0.88 },
              ]}
            >
              <Text
                style={[
                  typeStyles.bodySmall,
                  { color: colors.textSecondary },
                  accountId === null && { color: colors.accent, fontWeight: '700' },
                ]}
              >
                Unspecified
              </Text>
            </Pressable>
            {accounts.map((a) => {
              const active = accountId === a.id;
              return (
                <Pressable
                  key={a.id}
                  onPress={() => {
                    void hapticLight();
                    setAccountId(a.id);
                  }}
                  style={({ pressed }) => [
                    styles.chip,
                    surfaceCard(colors, false),
                    active && { backgroundColor: colors.accentMuted, borderColor: colors.accent },
                    pressed && { opacity: 0.88 },
                  ]}
                >
                  <Text
                    style={[
                      typeStyles.bodySmall,
                      { color: colors.textSecondary },
                      active && { color: colors.accent, fontWeight: '700' },
                    ]}
                  >
                    {a.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[typeStyles.captionMedium, styles.label, { color: colors.textSecondary }]}>Tag (optional)</Text>
          <TextInput
            style={[
              styles.input,
              surfaceCard(colors, false),
              { color: colors.text },
            ]}
            placeholder="e.g. Business, Trip"
            placeholderTextColor={colors.textMuted}
            value={tag}
            onChangeText={setTag}
          />

          <Text style={[typeStyles.captionMedium, styles.label, { color: colors.textSecondary }]}>Date</Text>
          {Platform.OS === 'web' ? (
            <TextInput
              style={[styles.input, surfaceCard(colors, false), { color: colors.text }]}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
              value={date}
              onChangeText={setDate}
              keyboardType="numbers-and-punctuation"
            />
          ) : (
            <Pressable
              onPress={() => {
                void hapticLight();
                runLayoutAnimation();
                setPickerOpen(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="Pick date"
              style={({ pressed }) => [styles.dateTrigger, surfaceCard(colors, false), pressed && { opacity: 0.9 }]}
            >
              <Text style={[typeStyles.bodyMedium, { color: colors.text }]}>{date}</Text>
              <Ionicons name="calendar-outline" size={20} color={colors.textMuted} />
            </Pressable>
          )}

          <Text style={[typeStyles.captionMedium, styles.label, { color: colors.textSecondary }]}>Note (optional)</Text>
          <TextInput
            style={[
              styles.input,
              styles.noteInput,
              surfaceCard(colors, false),
              { color: colors.text },
            ]}
            placeholder="Details"
            placeholderTextColor={colors.textMuted}
            multiline
            value={note}
            onChangeText={setNote}
          />

          {entryKind === 'expense' ? (
            <View style={[styles.receiptCard, surfaceCard(colors, false)]}>
              <View style={styles.receiptTitleRow}>
                <Ionicons name="receipt-outline" size={18} color={colors.textMuted} />
                <Text style={[typeStyles.bodyMedium, { color: colors.text }]}>Receipt (optional)</Text>
              </View>
              <Text style={[typeStyles.caption, { color: colors.textMuted, marginBottom: space[2] }]}>
                Stored only on this device. Max {receiptSizeLimitLabel()} per photo. Not included in JSON backup bytes
                (only the file path).
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                <Pressable
                  onPress={() => void onPickReceipt()}
                  style={({ pressed }) => [
                    styles.receiptBtn,
                    { backgroundColor: colors.accentMuted, borderColor: colors.accent },
                    pressed && { opacity: 0.88 },
                  ]}
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
            </View>
          ) : null}

          <Pressable
            style={({ pressed }) => [
              styles.saveBtn,
              { backgroundColor: colors.accent },
              saving && { opacity: 0.7 },
              pressed && !saving && { opacity: 0.92 },
            ]}
            onPress={() => void onSave()}
            disabled={saving}
          >
            <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save'}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      {pickerOpen && Platform.OS === 'ios' ? (
        <Modal animationType="slide" transparent visible onRequestClose={() => setPickerOpen(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => setPickerOpen(false)}>
            <Pressable
              style={[styles.modalSheet, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={[styles.modalToolbar, { borderBottomColor: colors.border }]}>
                <Pressable onPress={() => setPickerOpen(false)} hitSlop={12} accessibilityRole="button">
                  <Text style={[typeStyles.bodyMedium, { color: colors.accent, fontWeight: '600' }]}>Done</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={parseISODateLocal(date)}
                mode="date"
                display="spinner"
                onChange={(_, picked) => {
                  if (picked) setDate(toISODateString(picked));
                }}
              />
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}

      {pickerOpen && Platform.OS === 'android' ? (
        <DateTimePicker
          value={parseISODateLocal(date)}
          mode="date"
          display="default"
          onChange={(event: DateTimePickerEvent, picked?: Date) => {
            setPickerOpen(false);
            if (event.type !== 'set' || !picked) return;
            setDate(toISODateString(picked));
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: { padding: space[3], paddingBottom: space[5] },
  label: { marginBottom: space[1], marginTop: space[1] / 2 },
  sectionCard: { padding: space[2], marginBottom: space[2] },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: space[1], marginBottom: space[1] + 2 },
  kindRow: { flexDirection: 'row', gap: space[1] + 4, marginBottom: space[2] },
  kindBtn: {
    flex: 1,
    paddingVertical: space[2] - 2,
    borderRadius: radii.lg - 2,
    borderWidth: 2,
    alignItems: 'center',
  },
  kindBtnRow: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  recentChipRow: { flexDirection: 'row', alignItems: 'center', gap: space[1] - 2, maxWidth: 220 },
  input: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: space[2] - 2,
    paddingVertical: space[1] + 4,
    fontSize: 16,
    marginBottom: space[2],
  },
  noteInput: { minHeight: 88, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[1], marginBottom: space[2] },
  chip: { paddingHorizontal: space[2] - 2, paddingVertical: space[1], borderRadius: radii.pill, borderWidth: 1 },
  splitToggle: { padding: space[2] - 2, borderRadius: radii.md, borderWidth: 1, marginBottom: space[2] },
  splitBlock: { padding: space[2] - 2, marginBottom: space[2], borderWidth: 1, borderRadius: radii.lg },
  splitHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: space[1] },
  addLineBtn: { alignSelf: 'flex-start', paddingVertical: space[1] + 2, paddingHorizontal: space[2] - 2, borderRadius: radii.md, borderWidth: 1, marginBottom: space[1] },
  receiptCard: { padding: space[2], marginBottom: space[2], borderWidth: 1, borderRadius: radii.lg },
  receiptTitleRow: { flexDirection: 'row', alignItems: 'center', gap: space[1], marginBottom: space[1] },
  receiptBtn: { paddingVertical: space[1] + 2, paddingHorizontal: space[2] - 2, borderRadius: radii.md, borderWidth: 1 },
  saveBtn: { borderRadius: radii.lg - 2, paddingVertical: space[2], alignItems: 'center', marginTop: space[1] },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  dateTrigger: {
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: space[2] - 2,
    paddingVertical: space[1] + 4,
    marginBottom: space[2],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
});
