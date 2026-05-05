import * as SQLite from 'expo-sqlite';
import type { Budget } from '../types/budget';
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
