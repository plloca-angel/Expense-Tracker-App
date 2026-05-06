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
import { useTabHeaderSubtitle } from '../../src/hooks/useTabHeaderSubtitle';
import { hapticLight, hapticSuccess } from '../../src/lib/haptics';
import { parseAmount, todayISODate } from '../../src/lib/money';
import { radii, space, surfaceCard, type as typeStyles } from '../../src/theme/tokens';

type EntryKind = 'expense' | 'income';

export default function AddScreen() {
  const { colors, addExpense, addIncome, expenseCategoryOptions, incomeCategoryOptions } = useFinance();
  useTabHeaderSubtitle('Add', 'New entry', colors);
  const [entryKind, setEntryKind] = useState<EntryKind>('expense');
  const [amount, setAmount] = useState('');
  const categories = entryKind === 'expense' ? expenseCategoryOptions : incomeCategoryOptions;
  const [category, setCategory] = useState(categories[0] ?? 'Other');
  const [tag, setTag] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayISODate());
  const [saving, setSaving] = useState(false);

  const onKindChange = (k: EntryKind) => {
    void hapticLight();
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
      void hapticSuccess();
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
              <Text
                style={[
                  typeStyles.bodySmall,
                  { color: colors.text },
                  entryKind === 'expense' && { color: colors.expense, fontWeight: '700' },
                ]}
              >
                Expense
              </Text>
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
              <Text
                style={[
                  typeStyles.bodySmall,
                  { color: colors.text },
                  entryKind === 'income' && { color: colors.income, fontWeight: '700' },
                ]}
              >
                Income
              </Text>
            </Pressable>
          </View>

          <Text style={[typeStyles.captionMedium, styles.label, { color: colors.textSecondary }]}>Amount</Text>
          <TextInput
            style={[
              styles.input,
              surfaceCard(colors, false),
              { color: colors.text },
            ]}
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
          <TextInput
            style={[
              styles.input,
              surfaceCard(colors, false),
              { color: colors.text },
            ]}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textMuted}
            value={date}
            onChangeText={setDate}
          />

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: { padding: space[3], paddingBottom: space[5] },
  label: { marginBottom: space[1], marginTop: space[1] / 2 },
  kindRow: { flexDirection: 'row', gap: space[1] + 4, marginBottom: space[2] },
  kindBtn: {
    flex: 1,
    paddingVertical: space[2] - 2,
    borderRadius: radii.lg - 2,
    borderWidth: 2,
    alignItems: 'center',
  },
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
  saveBtn: { borderRadius: radii.lg - 2, paddingVertical: space[2], alignItems: 'center', marginTop: space[1] },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
