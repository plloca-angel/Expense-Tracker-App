import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { SQLiteDatabase } from 'expo-sqlite';
import * as database from '../db/database';
import type { NewExpenseInput } from '../db/database';
import type { Expense } from '../types/expense';

type ExpenseContextValue = {
  ready: boolean;
  expenses: Expense[];
  refresh: () => Promise<void>;
  addExpense: (input: NewExpenseInput) => Promise<void>;
  removeExpense: (id: number) => Promise<void>;
};

const ExpenseContext = createContext<ExpenseContextValue | null>(null);

export function ExpenseProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [db, setDb] = useState<SQLiteDatabase | null>(null);

  const refresh = useCallback(async () => {
    if (!db) return;
    const list = await database.fetchAllExpenses(db);
    setExpenses(list);
  }, [db]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sqlite = await database.openDb();
      if (cancelled) return;
      setDb(sqlite);
      const list = await database.fetchAllExpenses(sqlite);
      if (cancelled) return;
      setExpenses(list);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const addExpense = useCallback(
    async (input: NewExpenseInput) => {
      if (!db) return;
      await database.insertExpense(db, input);
      await refresh();
    },
    [db, refresh]
  );

  const removeExpense = useCallback(
    async (id: number) => {
      if (!db) return;
      await database.deleteExpense(db, id);
      await refresh();
    },
    [db, refresh]
  );

  const value = useMemo(
    () => ({ ready, expenses, refresh, addExpense, removeExpense }),
    [ready, expenses, refresh, addExpense, removeExpense]
  );

  return <ExpenseContext.Provider value={value}>{children}</ExpenseContext.Provider>;
}

export function useExpenses() {
  const ctx = useContext(ExpenseContext);
  if (!ctx) throw new Error('useExpenses must be used within ExpenseProvider');
  return ctx;
}
