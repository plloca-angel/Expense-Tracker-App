import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
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

type EntryKind = 'expense' | 'income';

export default function AddScreen() {
  const { colors, addExpense, addIncome, expenseCategoryOptions, incomeCategoryOptions } = useFinance();
  const [entryKind, setEntryKind] = useState<EntryKind>('expense');
  const [amount, setAmount] = useState('');
  const categories = entryKind === 'expense' ? expenseCategoryOptions : incomeCategoryOptions;
  const [category, setCategory] = useState(categories[0] ?? 'Other');
  const [tag, setTag] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayISODate());
  const [saving, setSaving] = useState(false);

  const onKindChange = (k: EntryKind) => {
    setEntryKind(k);
    const next = k === 'expense' ? expenseCategoryOptions : incomeCategoryOptions;
    setCategory(next[0] ?? 'Other');
  };

  const onSave = async () => {
    const value = parseAmount(amount);
    if (value === null) {
      Alert.alert('Check amount', 'Enter a positive number.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
      Alert.alert('Check date', 'Use YYYY-MM-DD format.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        amount: value,
        category,
        tag: tag.trim() || null,
        note: note.trim() || null,
        date: date.trim(),
      };
      if (entryKind === 'expense') await addExpense(payload);
      else await addIncome(payload);
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        /* haptics optional */
      }
      setAmount('');
      setTag('');
      setNote('');
      setDate(todayISODate());
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
  kindRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  kindBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
  },
  kindText: { fontSize: 16 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, marginBottom: 16 },
  noteInput: { minHeight: 88, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 14 },
  saveBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
