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
import { CATEGORIES } from '../../src/constants';
import { useExpenses } from '../../src/context/ExpenseContext';
import { parseAmount, todayISODate } from '../../src/lib/money';

export default function AddExpenseScreen() {
  const { addExpense } = useExpenses();
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [tag, setTag] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayISODate());
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    const value = parseAmount(amount);
    if (value === null) {
      Alert.alert('Check amount', 'Enter a positive number for the expense.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
      Alert.alert('Check date', 'Use YYYY-MM-DD format for the date.');
      return;
    }
    setSaving(true);
    try {
      await addExpense({
        amount: value,
        category,
        tag: tag.trim() || null,
        note: note.trim() || null,
        date: date.trim(),
      });
      setAmount('');
      setTag('');
      setNote('');
      setDate(todayISODate());
      router.replace('/(tabs)/expenses');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.label}>Amount</Text>
          <TextInput
            style={styles.input}
            placeholder="0.00"
            placeholderTextColor="#94a3b8"
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
          />

          <Text style={styles.label}>Category</Text>
          <View style={styles.chips}>
            {CATEGORIES.map((c) => {
              const active = c === category;
              return (
                <Pressable
                  key={c}
                  onPress={() => setCategory(c)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{c}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>Tag (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Business, Trip"
            placeholderTextColor="#94a3b8"
            value={tag}
            onChangeText={setTag}
          />

          <Text style={styles.label}>Date</Text>
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#94a3b8"
            value={date}
            onChangeText={setDate}
          />

          <Text style={styles.label}>Note (optional)</Text>
          <TextInput
            style={[styles.input, styles.noteInput]}
            placeholder="What was this for?"
            placeholderTextColor="#94a3b8"
            multiline
            value={note}
            onChangeText={setNote}
          />

          <Pressable
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={() => void onSave()}
            disabled={saving}
          >
            <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save expense'}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  flex: {
    flex: 1,
  },
  scroll: {
    padding: 20,
    paddingBottom: 40,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
    marginTop: 4,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#0f172a',
    marginBottom: 16,
  },
  noteInput: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chipActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#2563eb',
  },
  chipText: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#1d4ed8',
  },
  saveBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnDisabled: {
    opacity: 0.7,
  },
  saveText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
