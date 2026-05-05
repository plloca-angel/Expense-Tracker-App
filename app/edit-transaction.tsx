import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { useHeaderHeight } from '@react-navigation/elements';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFinance } from '../src/context/FinanceContext';
import { parseAmount, todayISODate } from '../src/lib/money';

export default function EditTransactionScreen() {
  const headerHeight = useHeaderHeight();
  const { id: idStr, kind: kindStr } = useLocalSearchParams<{ id: string; kind: string }>();
  const id = Number(idStr);
  const kind = kindStr === 'income' ? 'income' : 'expense';
  const {
    ready,
    colors,
    expenses,
    incomes,
    expenseCategoryOptions,
    incomeCategoryOptions,
    accounts,
    updateExpense,
    updateIncome,
  } = useFinance();

  const row = useMemo(() => {
    if (!Number.isFinite(id)) return null;
    if (kind === 'expense') return expenses.find((e) => e.id === id) ?? null;
    return incomes.find((i) => i.id === id) ?? null;
  }, [id, kind, expenses, incomes]);

  const categories = kind === 'expense' ? expenseCategoryOptions : incomeCategoryOptions;
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(categories[0] ?? 'Other');
  const [tag, setTag] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayISODate());
  const [accountId, setAccountId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!row) return;
    setAmount(String(row.amount));
    setCategory(row.category);
    setTag(row.tag ?? '');
    setNote(row.note ?? '');
    setDate(row.date);
    setAccountId(row.accountId);
  }, [row]);

  useEffect(() => {
    if (!categories.includes(category)) setCategory(categories[0] ?? 'Other');
  }, [categories, category]);

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
        accountId,
      };
      if (kind === 'expense') await updateExpense(id, payload);
      else await updateIncome(id, payload);
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        /* optional */
      }
      router.back();
    } finally {
      setSaving(false);
    }
  };

  if (!ready || !Number.isFinite(id)) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!row) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['bottom']}>
        <Text style={{ color: colors.text, padding: 24 }}>Transaction not found.</Text>
        <Pressable onPress={() => router.back()} style={{ padding: 24 }}>
          <Text style={{ color: colors.accent }}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        keyboardVerticalOffset={headerHeight}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'}
          contentContainerStyle={styles.scroll}
        >
          <Text style={[styles.label, { color: colors.textSecondary }]}>Amount</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
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

          <Text style={[styles.label, { color: colors.textSecondary }]}>Account</Text>
          <View style={styles.chips}>
            <Pressable
              onPress={() => setAccountId(null)}
              style={[
                styles.chip,
                { borderColor: colors.border, backgroundColor: colors.card },
                accountId === null && { backgroundColor: colors.accentMuted, borderColor: colors.accent },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: colors.textSecondary },
                  accountId === null && { color: colors.accent, fontWeight: '700' },
                ]}
              >
                None
              </Text>
            </Pressable>
            {accounts.map((a) => {
              const active = accountId === a.id;
              return (
                <Pressable
                  key={a.id}
                  onPress={() => setAccountId(a.id)}
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
                    {a.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.label, { color: colors.textSecondary }]}>Tag</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
            value={tag}
            onChangeText={setTag}
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>Date</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
            value={date}
            onChangeText={setDate}
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>Note</Text>
          <TextInput
            style={[
              styles.input,
              styles.note,
              { backgroundColor: colors.card, borderColor: colors.border, color: colors.text },
            ]}
            multiline
            value={note}
            onChangeText={setNote}
          />

          <Pressable
            style={[styles.save, { backgroundColor: colors.accent }, saving && { opacity: 0.7 }]}
            onPress={() => void onSave()}
            disabled={saving}
          >
            <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save changes'}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20, paddingBottom: 40 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8, marginTop: 4 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, marginBottom: 14 },
  note: { minHeight: 80, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 14 },
  save: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
