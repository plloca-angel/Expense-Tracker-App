import { Ionicons } from '@expo/vector-icons';
import { useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useExpenses } from '../../src/context/ExpenseContext';
import { formatMoney } from '../../src/lib/money';
import type { Expense } from '../../src/types/expense';

export default function ExpensesScreen() {
  const { ready, expenses, removeExpense } = useExpenses();

  const confirmDelete = useCallback(
    (item: Expense) => {
      Alert.alert('Delete expense', `Remove ${formatMoney(item.amount)} — ${item.category}?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => void removeExpense(item.id),
        },
      ]);
    },
    [removeExpense]
  );

  if (!ready) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <FlatList
        data={expenses}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>No expenses yet. Tap Add to create your first entry.</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rowMain}>
              <Text style={styles.amount}>{formatMoney(item.amount)}</Text>
              <Text style={styles.category}>{item.category}</Text>
              <Text style={styles.meta}>
                {item.date}
                {item.tag ? ` · ${item.tag}` : ''}
              </Text>
              {item.note ? <Text style={styles.note}>{item.note}</Text> : null}
            </View>
            <Pressable
              onPress={() => confirmDelete(item)}
              style={({ pressed }) => [styles.trash, pressed && styles.trashPressed]}
              accessibilityLabel="Delete expense"
            >
              <Ionicons name="trash-outline" size={22} color="#dc2626" />
            </Pressable>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
  },
  list: {
    padding: 16,
    paddingBottom: 28,
    flexGrow: 1,
  },
  empty: {
    textAlign: 'center',
    color: '#64748b',
    marginTop: 48,
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  rowMain: {
    flex: 1,
  },
  amount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  category: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
  },
  meta: {
    marginTop: 4,
    fontSize: 13,
    color: '#94a3b8',
  },
  note: {
    marginTop: 6,
    fontSize: 14,
    color: '#64748b',
  },
  trash: {
    padding: 8,
    marginLeft: 4,
  },
  trashPressed: {
    opacity: 0.6,
  },
});
