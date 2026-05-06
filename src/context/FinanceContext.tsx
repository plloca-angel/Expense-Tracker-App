import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';
import { CATEGORIES, INCOME_CATEGORIES } from '../constants';
import * as database from '../db/database';
import type { NewExpenseInput } from '../db/database';
import type { NewIncomeInput } from '../db/database';
import type { NewSplitExpenseInput } from '../db/database';
import type { NewGoalInput } from '../db/database';
import type { BackupPayload, BackupPayloadV3 } from '../lib/backup';
import { darkColors, lightColors, type ThemeColors } from '../theme/colors';
import type { Budget } from '../types/budget';
import type { SavingsGoal } from '../types/goal';
import type { Expense } from '../types/expense';
import type { Income } from '../types/income';
import type { NewRecurringRuleInput, RecurringRule } from '../types/recurring';
import type { AppSettings, ThemePreference } from '../types/settings';
import { DEFAULT_SETTINGS } from '../types/settings';

type FinanceContextValue = {
  ready: boolean;
  colors: ThemeColors;
  isDark: boolean;
  settings: AppSettings;
  setSettings: (s: AppSettings) => Promise<void>;
  expenses: Expense[];
  incomes: Income[];
  budgets: Budget[];
  goals: SavingsGoal[];
  recurringRules: RecurringRule[];
  expenseCategoryOptions: string[];
  incomeCategoryOptions: string[];
  refresh: () => Promise<void>;
  addExpense: (input: NewExpenseInput) => Promise<void>;
  addSplitExpense: (input: NewSplitExpenseInput) => Promise<void>;
  removeExpense: (id: number) => Promise<void>;
  addIncome: (input: NewIncomeInput) => Promise<void>;
  removeIncome: (id: number) => Promise<void>;
  upsertBudget: (category: string, monthlyLimit: number) => Promise<void>;
  removeBudget: (id: number) => Promise<void>;
  addCustomCategory: (name: string, kind: 'expense' | 'income') => Promise<void>;
  deleteCustomCategory: (name: string, kind: 'expense' | 'income') => Promise<void>;
  addGoal: (input: NewGoalInput) => Promise<void>;
  updateGoalSaved: (id: number, savedAmount: number) => Promise<void>;
  removeGoal: (id: number) => Promise<void>;
  addRecurringRule: (input: NewRecurringRuleInput) => Promise<void>;
  removeRecurringRule: (id: number) => Promise<void>;
  postRecurringRule: (id: number, entryDate: string) => Promise<void>;
  exportBackup: () => Promise<BackupPayloadV3>;
  importBackup: (data: BackupPayload) => Promise<void>;
};

const FinanceContext = createContext<FinanceContextValue | null>(null);

function mergeCategoryOptions(defaults: readonly string[], custom: string[]): string[] {
  const set = new Set<string>();
  for (const c of defaults) set.add(c);
  for (const c of custom) set.add(c);
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [ready, setReady] = useState(false);
  const [db, setDb] = useState<SQLiteDatabase | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [recurringRules, setRecurringRules] = useState<RecurringRule[]>([]);
  const [settings, setSettingsState] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [customExpenseCats, setCustomExpenseCats] = useState<string[]>([]);
  const [customIncomeCats, setCustomIncomeCats] = useState<string[]>([]);

  const resolvedTheme: 'light' | 'dark' =
    settings.theme === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : settings.theme;

  const isDark = resolvedTheme === 'dark';
  const colors = isDark ? darkColors : lightColors;

  const expenseCategoryOptions = useMemo(
    () => mergeCategoryOptions(CATEGORIES, customExpenseCats),
    [customExpenseCats]
  );
  const incomeCategoryOptions = useMemo(
    () => mergeCategoryOptions(INCOME_CATEGORIES, customIncomeCats),
    [customIncomeCats]
  );

  const refresh = useCallback(async () => {
    if (!db) return;
    const [ex, inc, bud, gl, rec, s, ce, ci] = await Promise.all([
      database.fetchAllExpenses(db),
      database.fetchAllIncomes(db),
      database.fetchAllBudgets(db),
      database.fetchAllGoals(db),
      database.fetchAllRecurringRules(db),
      database.loadAppSettings(db),
      database.fetchCustomCategories(db, 'expense'),
      database.fetchCustomCategories(db, 'income'),
    ]);
    setExpenses(ex);
    setIncomes(inc);
    setBudgets(bud);
    setGoals(gl);
    setRecurringRules(rec);
    setSettingsState(s);
    setCustomExpenseCats(ce);
    setCustomIncomeCats(ci);
  }, [db]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sqlite = await database.openDb();
      if (cancelled) return;
      setDb(sqlite);
      const [ex, inc, bud, gl, rec, s, ce, ci] = await Promise.all([
        database.fetchAllExpenses(sqlite),
        database.fetchAllIncomes(sqlite),
        database.fetchAllBudgets(sqlite),
        database.fetchAllGoals(sqlite),
        database.fetchAllRecurringRules(sqlite),
        database.loadAppSettings(sqlite),
        database.fetchCustomCategories(sqlite, 'expense'),
        database.fetchCustomCategories(sqlite, 'income'),
      ]);
      if (cancelled) return;
      setExpenses(ex);
      setIncomes(inc);
      setBudgets(bud);
      setGoals(gl);
      setRecurringRules(rec);
      setSettingsState(s);
      setCustomExpenseCats(ce);
      setCustomIncomeCats(ci);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setSettings = useCallback(
    async (s: AppSettings) => {
      if (!db) return;
      const theme: ThemePreference =
        s.theme === 'light' || s.theme === 'dark' || s.theme === 'system' ? s.theme : 'system';
      const next: AppSettings = { currency: s.currency, theme };
      await database.saveAppSettings(db, next);
      setSettingsState(next);
    },
    [db]
  );

  const addExpense = useCallback(
    async (input: NewExpenseInput) => {
      if (!db) return;
      await database.insertExpense(db, input);
      await refresh();
    },
    [db, refresh]
  );

  const addSplitExpense = useCallback(
    async (input: NewSplitExpenseInput) => {
      if (!db) return;
      await database.insertSplitExpense(db, input);
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

  const addIncome = useCallback(
    async (input: NewIncomeInput) => {
      if (!db) return;
      await database.insertIncome(db, input);
      await refresh();
    },
    [db, refresh]
  );

  const removeIncome = useCallback(
    async (id: number) => {
      if (!db) return;
      await database.deleteIncome(db, id);
      await refresh();
    },
    [db, refresh]
  );

  const upsertBudget = useCallback(
    async (category: string, monthlyLimit: number) => {
      if (!db) return;
      await database.upsertBudget(db, category, monthlyLimit);
      await refresh();
    },
    [db, refresh]
  );

  const removeBudget = useCallback(
    async (id: number) => {
      if (!db) return;
      await database.deleteBudget(db, id);
      await refresh();
    },
    [db, refresh]
  );

  const addCustomCategory = useCallback(
    async (name: string, kind: 'expense' | 'income') => {
      if (!db) return;
      await database.insertCustomCategory(db, name, kind);
      await refresh();
    },
    [db, refresh]
  );

  const deleteCustomCategory = useCallback(
    async (name: string, kind: 'expense' | 'income') => {
      if (!db) return;
      await database.deleteCustomCategory(db, name, kind);
      await refresh();
    },
    [db, refresh]
  );

  const addGoal = useCallback(
    async (input: NewGoalInput) => {
      if (!db) return;
      await database.insertGoal(db, input);
      await refresh();
    },
    [db, refresh]
  );

  const updateGoalSaved = useCallback(
    async (id: number, savedAmount: number) => {
      if (!db) return;
      await database.updateGoalSavedAmount(db, id, savedAmount);
      await refresh();
    },
    [db, refresh]
  );

  const removeGoal = useCallback(
    async (id: number) => {
      if (!db) return;
      await database.deleteGoal(db, id);
      await refresh();
    },
    [db, refresh]
  );

  const addRecurringRule = useCallback(
    async (input: NewRecurringRuleInput) => {
      if (!db) return;
      await database.insertRecurringRule(db, input);
      await refresh();
    },
    [db, refresh]
  );

  const removeRecurringRule = useCallback(
    async (id: number) => {
      if (!db) return;
      await database.deleteRecurringRule(db, id);
      await refresh();
    },
    [db, refresh]
  );

  const postRecurringRule = useCallback(
    async (id: number, entryDate: string) => {
      if (!db) return;
      await database.materializeRecurringRule(db, id, entryDate);
      await refresh();
    },
    [db, refresh]
  );

  const exportBackup = useCallback(async () => {
    if (!db) throw new Error('Database not ready');
    return database.exportDatabaseSnapshot(db);
  }, [db]);

  const importBackup = useCallback(
    async (data: BackupPayload) => {
      if (!db) return;
      await database.importDatabaseSnapshot(db, data);
      await refresh();
    },
    [db, refresh]
  );

  const value = useMemo(
    () => ({
      ready,
      colors,
      isDark,
      settings,
      setSettings,
      expenses,
      incomes,
      budgets,
      goals,
      recurringRules,
      expenseCategoryOptions,
      incomeCategoryOptions,
      refresh,
      addExpense,
      addSplitExpense,
      removeExpense,
      addIncome,
      removeIncome,
      upsertBudget,
      removeBudget,
      addCustomCategory,
      deleteCustomCategory,
      addGoal,
      updateGoalSaved,
      removeGoal,
      addRecurringRule,
      removeRecurringRule,
      postRecurringRule,
      exportBackup,
      importBackup,
    }),
    [
      ready,
      colors,
      isDark,
      settings,
      setSettings,
      expenses,
      incomes,
      budgets,
      goals,
      recurringRules,
      expenseCategoryOptions,
      incomeCategoryOptions,
      refresh,
      addExpense,
      addSplitExpense,
      removeExpense,
      addIncome,
      removeIncome,
      upsertBudget,
      removeBudget,
      addCustomCategory,
      deleteCustomCategory,
      addGoal,
      updateGoalSaved,
      removeGoal,
      addRecurringRule,
      removeRecurringRule,
      postRecurringRule,
      exportBackup,
      importBackup,
    ]
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error('useFinance must be used within FinanceProvider');
  return ctx;
}

/** @deprecated use useFinance */
export function useExpenses() {
  const f = useFinance();
  return {
    ready: f.ready,
    expenses: f.expenses,
    refresh: f.refresh,
    addExpense: f.addExpense,
    removeExpense: f.removeExpense,
  };
}
