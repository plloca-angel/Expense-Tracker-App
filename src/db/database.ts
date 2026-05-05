import * as SQLite from 'expo-sqlite';
import type { BackupPayload } from '../lib/backup';
import { BACKUP_VERSION } from '../lib/backup';
import type { Budget } from '../types/budget';
import type { SavingsGoal } from '../types/goal';
import type { AppSettings, ThemePreference } from '../types/settings';
import { DEFAULT_SETTINGS } from '../types/settings';
import type { Expense } from '../types/expense';
import type { Income } from '../types/income';

let dbInstance: SQLite.SQLiteDatabase | null = null;

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let v = row?.user_version ?? 0;

  if (v < 1) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS incomes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        amount REAL NOT NULL,
        category TEXT NOT NULL,
        tag TEXT,
        note TEXT,
        date TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS budgets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL UNIQUE,
        monthly_limit REAL NOT NULL
      );
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS custom_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL COLLATE NOCASE,
        kind TEXT NOT NULL CHECK(kind IN ('expense', 'income')),
        UNIQUE(name, kind)
      );
    `);
    await db.execAsync('PRAGMA user_version = 1');
    v = 1;
  }

  if (v < 2) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS savings_goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        target_amount REAL NOT NULL,
        saved_amount REAL NOT NULL DEFAULT 0,
        deadline TEXT,
        created_at TEXT NOT NULL
      );
    `);
    await db.execAsync('PRAGMA user_version = 2');
  }
}

export async function openDb(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;
  const db = await SQLite.openDatabaseAsync('expenses.db');
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      tag TEXT,
      note TEXT,
      date TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  await migrate(db);
  dbInstance = db;
  return db;
}

type ExpenseRow = {
  id: number;
  amount: number;
  category: string;
  tag: string | null;
  note: string | null;
  date: string;
  created_at: string;
};

function mapExpenseRow(r: ExpenseRow): Expense {
  return {
    id: r.id,
    amount: r.amount,
    category: r.category,
    tag: r.tag,
    note: r.note,
    date: r.date,
    createdAt: r.created_at,
  };
}

export async function fetchAllExpenses(db: SQLite.SQLiteDatabase): Promise<Expense[]> {
  const rows = await db.getAllAsync<ExpenseRow>(
    'SELECT id, amount, category, tag, note, date, created_at FROM expenses ORDER BY date DESC, id DESC'
  );
  return rows.map(mapExpenseRow);
}

export type NewExpenseInput = {
  amount: number;
  category: string;
  tag?: string | null;
  note?: string | null;
  date: string;
};

export async function insertExpense(db: SQLite.SQLiteDatabase, input: NewExpenseInput): Promise<void> {
  const created = new Date().toISOString();
  await db.runAsync(
    'INSERT INTO expenses (amount, category, tag, note, date, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    input.amount,
    input.category,
    input.tag ?? null,
    input.note ?? null,
    input.date,
    created
  );
}

export async function deleteExpense(db: SQLite.SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM expenses WHERE id = ?', id);
}

function mapIncomeRow(r: ExpenseRow): Income {
  return {
    id: r.id,
    amount: r.amount,
    category: r.category,
    tag: r.tag,
    note: r.note,
    date: r.date,
    createdAt: r.created_at,
  };
}

export async function fetchAllIncomes(db: SQLite.SQLiteDatabase): Promise<Income[]> {
  const rows = await db.getAllAsync<ExpenseRow>(
    'SELECT id, amount, category, tag, note, date, created_at FROM incomes ORDER BY date DESC, id DESC'
  );
  return rows.map(mapIncomeRow);
}

export type NewIncomeInput = NewExpenseInput;

export async function insertIncome(db: SQLite.SQLiteDatabase, input: NewIncomeInput): Promise<void> {
  const created = new Date().toISOString();
  await db.runAsync(
    'INSERT INTO incomes (amount, category, tag, note, date, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    input.amount,
    input.category,
    input.tag ?? null,
    input.note ?? null,
    input.date,
    created
  );
}

export async function deleteIncome(db: SQLite.SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM incomes WHERE id = ?', id);
}

type BudgetRow = { id: number; category: string; monthly_limit: number };

function mapBudgetRow(r: BudgetRow): Budget {
  return { id: r.id, category: r.category, monthlyLimit: r.monthly_limit };
}

export async function fetchAllBudgets(db: SQLite.SQLiteDatabase): Promise<Budget[]> {
  const rows = await db.getAllAsync<BudgetRow>(
    'SELECT id, category, monthly_limit FROM budgets ORDER BY category ASC'
  );
  return rows.map(mapBudgetRow);
}

export async function upsertBudget(
  db: SQLite.SQLiteDatabase,
  category: string,
  monthlyLimit: number
): Promise<void> {
  await db.runAsync(
    `INSERT INTO budgets (category, monthly_limit) VALUES (?, ?)
     ON CONFLICT(category) DO UPDATE SET monthly_limit = excluded.monthly_limit`,
    category,
    monthlyLimit
  );
}

export async function deleteBudget(db: SQLite.SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM budgets WHERE id = ?', id);
}

export async function getSetting(db: SQLite.SQLiteDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', key);
  return row?.value ?? null;
}

export async function setSetting(db: SQLite.SQLiteDatabase, key: string, value: string): Promise<void> {
  await db.runAsync(
    'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value
  );
}

export async function loadAppSettings(db: SQLite.SQLiteDatabase): Promise<AppSettings> {
  const currency = (await getSetting(db, 'currency')) ?? DEFAULT_SETTINGS.currency;
  const themeRaw = (await getSetting(db, 'theme')) ?? DEFAULT_SETTINGS.theme;
  const theme: ThemePreference =
    themeRaw === 'light' || themeRaw === 'dark' || themeRaw === 'system' ? themeRaw : 'system';
  return { currency, theme };
}

export async function saveAppSettings(db: SQLite.SQLiteDatabase, settings: AppSettings): Promise<void> {
  await setSetting(db, 'currency', settings.currency);
  await setSetting(db, 'theme', settings.theme);
}

type CatRow = { name: string; kind: string };

export async function fetchCustomCategories(
  db: SQLite.SQLiteDatabase,
  kind: 'expense' | 'income'
): Promise<string[]> {
  const rows = await db.getAllAsync<CatRow>(
    'SELECT name, kind FROM custom_categories WHERE kind = ? ORDER BY name ASC',
    kind
  );
  return rows.map((r) => r.name);
}

export async function insertCustomCategory(
  db: SQLite.SQLiteDatabase,
  name: string,
  kind: 'expense' | 'income'
): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  await db.runAsync(
    'INSERT OR IGNORE INTO custom_categories (name, kind) VALUES (?, ?)',
    trimmed,
    kind
  );
}

export async function deleteCustomCategory(
  db: SQLite.SQLiteDatabase,
  name: string,
  kind: 'expense' | 'income'
): Promise<void> {
  await db.runAsync('DELETE FROM custom_categories WHERE name = ? AND kind = ?', name, kind);
}

type GoalRow = {
  id: number;
  name: string;
  target_amount: number;
  saved_amount: number;
  deadline: string | null;
  created_at: string;
};

function mapGoalRow(r: GoalRow): SavingsGoal {
  return {
    id: r.id,
    name: r.name,
    targetAmount: r.target_amount,
    savedAmount: r.saved_amount,
    deadline: r.deadline,
    createdAt: r.created_at,
  };
}

export async function fetchAllGoals(db: SQLite.SQLiteDatabase): Promise<SavingsGoal[]> {
  const rows = await db.getAllAsync<GoalRow>(
    'SELECT id, name, target_amount, saved_amount, deadline, created_at FROM savings_goals ORDER BY created_at DESC'
  );
  return rows.map(mapGoalRow);
}

export type NewGoalInput = {
  name: string;
  targetAmount: number;
  savedAmount?: number;
  deadline?: string | null;
};

export async function insertGoal(db: SQLite.SQLiteDatabase, input: NewGoalInput): Promise<void> {
  const created = new Date().toISOString();
  await db.runAsync(
    'INSERT INTO savings_goals (name, target_amount, saved_amount, deadline, created_at) VALUES (?, ?, ?, ?, ?)',
    input.name,
    input.targetAmount,
    input.savedAmount ?? 0,
    input.deadline ?? null,
    created
  );
}

export async function updateGoalSavedAmount(db: SQLite.SQLiteDatabase, id: number, savedAmount: number): Promise<void> {
  await db.runAsync('UPDATE savings_goals SET saved_amount = ? WHERE id = ?', savedAmount, id);
}

export async function deleteGoal(db: SQLite.SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM savings_goals WHERE id = ?', id);
}

export async function exportDatabaseSnapshot(db: SQLite.SQLiteDatabase): Promise<BackupPayload> {
  const [expenses, incomes, budgets, goals, settings, ce, ci] = await Promise.all([
    fetchAllExpenses(db),
    fetchAllIncomes(db),
    fetchAllBudgets(db),
    fetchAllGoals(db),
    loadAppSettings(db),
    fetchCustomCategories(db, 'expense'),
    fetchCustomCategories(db, 'income'),
  ]);
  const customCategories = [
    ...ce.map((name) => ({ name, kind: 'expense' as const })),
    ...ci.map((name) => ({ name, kind: 'income' as const })),
  ];
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    settings,
    expenses: expenses.map(({ id: _id, ...e }) => e),
    incomes: incomes.map(({ id: _id, ...i }) => i),
    budgets: budgets.map(({ id: _id, ...b }) => b),
    savingsGoals: goals.map(({ id: _id, ...g }) => g),
    customCategories,
  };
}

export async function importDatabaseSnapshot(db: SQLite.SQLiteDatabase, data: BackupPayload): Promise<void> {
  if (data.version !== BACKUP_VERSION) throw new Error(`Unsupported backup version: ${data.version}`);
  await db.withTransactionAsync(async () => {
    await db.execAsync('DELETE FROM savings_goals');
    await db.execAsync('DELETE FROM budgets');
    await db.execAsync('DELETE FROM expenses');
    await db.execAsync('DELETE FROM incomes');
    await db.execAsync('DELETE FROM custom_categories');
    await db.execAsync('DELETE FROM app_settings');
    await saveAppSettings(db, data.settings);
    for (const c of data.customCategories) {
      await insertCustomCategory(db, c.name, c.kind);
    }
    for (const b of data.budgets) {
      await upsertBudget(db, b.category, b.monthlyLimit);
    }
    for (const g of data.savingsGoals) {
      await db.runAsync(
        'INSERT INTO savings_goals (name, target_amount, saved_amount, deadline, created_at) VALUES (?, ?, ?, ?, ?)',
        g.name,
        g.targetAmount,
        g.savedAmount,
        g.deadline ?? null,
        g.createdAt
      );
    }
    for (const e of data.expenses) {
      await db.runAsync(
        'INSERT INTO expenses (amount, category, tag, note, date, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        e.amount,
        e.category,
        e.tag ?? null,
        e.note ?? null,
        e.date,
        e.createdAt
      );
    }
    for (const i of data.incomes) {
      await db.runAsync(
        'INSERT INTO incomes (amount, category, tag, note, date, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        i.amount,
        i.category,
        i.tag ?? null,
        i.note ?? null,
        i.date,
        i.createdAt
      );
    }
  });
}
