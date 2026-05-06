import * as SQLite from 'expo-sqlite';
import type { BackupPayload, BackupPayloadV3 } from '../lib/backup';
import { BACKUP_VERSION, normalizeBackupPayload } from '../lib/backup';
import { advanceRecurringDue } from '../lib/recurringDates';
import type { Budget } from '../types/budget';
import type { SavingsGoal } from '../types/goal';
import type { AppSettings, ThemePreference } from '../types/settings';
import { DEFAULT_SETTINGS } from '../types/settings';
import type { Expense } from '../types/expense';
import type { Income } from '../types/income';
import type { NewRecurringRuleInput, RecurringRule } from '../types/recurring';

let dbInstance: SQLite.SQLiteDatabase | null = null;

function newSplitGroupId(): string {
  return `sg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

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
    v = 2;
  }

  if (v < 3) {
    await db.execAsync(`
      ALTER TABLE expenses ADD COLUMN split_group_id TEXT;
      ALTER TABLE expenses ADD COLUMN receipt_uri TEXT;
    `);
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS recurring_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kind TEXT NOT NULL CHECK(kind IN ('expense', 'income')),
        amount REAL NOT NULL,
        category TEXT NOT NULL,
        tag TEXT,
        note TEXT,
        frequency TEXT NOT NULL CHECK(frequency IN ('weekly', 'monthly')),
        day_of_month INTEGER,
        weekday INTEGER,
        next_due TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
    await db.execAsync('PRAGMA user_version = 3');
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
  split_group_id: string | null;
  receipt_uri: string | null;
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
    splitGroupId: r.split_group_id,
    receiptUri: r.receipt_uri,
  };
}

export async function fetchAllExpenses(db: SQLite.SQLiteDatabase): Promise<Expense[]> {
  const rows = await db.getAllAsync<ExpenseRow>(
    'SELECT id, amount, category, tag, note, date, created_at, split_group_id, receipt_uri FROM expenses ORDER BY date DESC, id DESC'
  );
  return rows.map(mapExpenseRow);
}

export type NewExpenseInput = {
  amount: number;
  category: string;
  tag?: string | null;
  note?: string | null;
  date: string;
  receiptUri?: string | null;
};

export async function insertExpense(db: SQLite.SQLiteDatabase, input: NewExpenseInput): Promise<void> {
  const created = new Date().toISOString();
  await db.runAsync(
    'INSERT INTO expenses (amount, category, tag, note, date, created_at, split_group_id, receipt_uri) VALUES (?, ?, ?, ?, ?, ?, NULL, ?)',
    input.amount,
    input.category,
    input.tag ?? null,
    input.note ?? null,
    input.date,
    created,
    input.receiptUri ?? null
  );
}

export type SplitLineInput = { amount: number; category: string };

export type NewSplitExpenseInput = {
  lines: SplitLineInput[];
  tag?: string | null;
  note?: string | null;
  date: string;
  receiptUri?: string | null;
};

export async function insertSplitExpense(db: SQLite.SQLiteDatabase, input: NewSplitExpenseInput): Promise<void> {
  if (input.lines.length < 2) throw new Error('Split requires at least two lines');
  const created = new Date().toISOString();
  const groupId = newSplitGroupId();
  await db.withTransactionAsync(async () => {
    for (let i = 0; i < input.lines.length; i++) {
      const line = input.lines[i]!;
      await db.runAsync(
        'INSERT INTO expenses (amount, category, tag, note, date, created_at, split_group_id, receipt_uri) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        line.amount,
        line.category,
        input.tag ?? null,
        input.note ?? null,
        input.date,
        created,
        groupId,
        i === 0 ? (input.receiptUri ?? null) : null
      );
    }
  });
}

export async function deleteExpense(db: SQLite.SQLiteDatabase, id: number): Promise<void> {
  const row = await db.getFirstAsync<{ split_group_id: string | null }>(
    'SELECT split_group_id FROM expenses WHERE id = ?',
    id
  );
  if (row?.split_group_id) {
    await db.runAsync('DELETE FROM expenses WHERE split_group_id = ?', row.split_group_id);
  } else {
    await db.runAsync('DELETE FROM expenses WHERE id = ?', id);
  }
}

type RecurringRow = {
  id: number;
  kind: string;
  amount: number;
  category: string;
  tag: string | null;
  note: string | null;
  frequency: string;
  day_of_month: number | null;
  weekday: number | null;
  next_due: string;
  created_at: string;
};

function mapRecurringRow(r: RecurringRow): RecurringRule {
  return {
    id: r.id,
    kind: r.kind === 'income' ? 'income' : 'expense',
    amount: r.amount,
    category: r.category,
    tag: r.tag,
    note: r.note,
    frequency: r.frequency === 'weekly' ? 'weekly' : 'monthly',
    dayOfMonth: r.day_of_month,
    weekday: r.weekday,
    nextDue: r.next_due,
    createdAt: r.created_at,
  };
}

export async function fetchAllRecurringRules(db: SQLite.SQLiteDatabase): Promise<RecurringRule[]> {
  const rows = await db.getAllAsync<RecurringRow>(
    'SELECT id, kind, amount, category, tag, note, frequency, day_of_month, weekday, next_due, created_at FROM recurring_rules ORDER BY next_due ASC, id ASC'
  );
  return rows.map(mapRecurringRow);
}

export async function insertRecurringRule(db: SQLite.SQLiteDatabase, input: NewRecurringRuleInput): Promise<void> {
  const created = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO recurring_rules (kind, amount, category, tag, note, frequency, day_of_month, weekday, next_due, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    input.kind,
    input.amount,
    input.category,
    input.tag ?? null,
    input.note ?? null,
    input.frequency,
    input.dayOfMonth ?? null,
    input.weekday ?? null,
    input.nextDue,
    created
  );
}

export async function deleteRecurringRule(db: SQLite.SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM recurring_rules WHERE id = ?', id);
}

export async function updateRecurringNextDue(
  db: SQLite.SQLiteDatabase,
  id: number,
  nextDue: string
): Promise<void> {
  await db.runAsync('UPDATE recurring_rules SET next_due = ? WHERE id = ?', nextDue, id);
}

/** Insert transaction for rule date and advance `next_due`. */
export async function materializeRecurringRule(
  db: SQLite.SQLiteDatabase,
  ruleId: number,
  entryDate: string
): Promise<void> {
  const row = await db.getFirstAsync<RecurringRow>(
    'SELECT id, kind, amount, category, tag, note, frequency, day_of_month, weekday, next_due, created_at FROM recurring_rules WHERE id = ?',
    ruleId
  );
  if (!row) throw new Error('Rule not found');
  const rule = mapRecurringRow(row);
  const created = new Date().toISOString();
  const payload = {
    amount: rule.amount,
    category: rule.category,
    tag: rule.tag,
    note: rule.note,
    date: entryDate,
  };
  await db.withTransactionAsync(async () => {
    if (rule.kind === 'expense') {
      await db.runAsync(
        'INSERT INTO expenses (amount, category, tag, note, date, created_at, split_group_id, receipt_uri) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL)',
        payload.amount,
        payload.category,
        payload.tag,
        payload.note,
        payload.date,
        created
      );
    } else {
      await db.runAsync(
        'INSERT INTO incomes (amount, category, tag, note, date, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        payload.amount,
        payload.category,
        payload.tag,
        payload.note,
        payload.date,
        created
      );
    }
    const anchor = rule.nextDue <= entryDate ? entryDate : rule.nextDue;
    const next = advanceRecurringDue(rule.frequency, anchor, rule.dayOfMonth, rule.weekday);
    await updateRecurringNextDue(db, ruleId, next);
  });
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

export type NewIncomeInput = {
  amount: number;
  category: string;
  tag?: string | null;
  note?: string | null;
  date: string;
};

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

export async function exportDatabaseSnapshot(db: SQLite.SQLiteDatabase): Promise<BackupPayloadV3> {
  const [expenses, incomes, budgets, goals, settings, ce, ci, recurring] = await Promise.all([
    fetchAllExpenses(db),
    fetchAllIncomes(db),
    fetchAllBudgets(db),
    fetchAllGoals(db),
    loadAppSettings(db),
    fetchCustomCategories(db, 'expense'),
    fetchCustomCategories(db, 'income'),
    fetchAllRecurringRules(db),
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
    recurringRules: recurring.map(({ id: _id, ...r }) => r),
  };
}

export async function importDatabaseSnapshot(db: SQLite.SQLiteDatabase, data: BackupPayload): Promise<void> {
  const normalized = normalizeBackupPayload(data);
  if (normalized.version !== BACKUP_VERSION) throw new Error(`Unsupported backup version: ${normalized.version}`);
  await db.withTransactionAsync(async () => {
    await db.execAsync('DELETE FROM recurring_rules');
    await db.execAsync('DELETE FROM savings_goals');
    await db.execAsync('DELETE FROM budgets');
    await db.execAsync('DELETE FROM expenses');
    await db.execAsync('DELETE FROM incomes');
    await db.execAsync('DELETE FROM custom_categories');
    await db.execAsync('DELETE FROM app_settings');
    await saveAppSettings(db, normalized.settings);
    for (const c of normalized.customCategories) {
      await insertCustomCategory(db, c.name, c.kind);
    }
    for (const b of normalized.budgets) {
      await upsertBudget(db, b.category, b.monthlyLimit);
    }
    for (const g of normalized.savingsGoals) {
      await db.runAsync(
        'INSERT INTO savings_goals (name, target_amount, saved_amount, deadline, created_at) VALUES (?, ?, ?, ?, ?)',
        g.name,
        g.targetAmount,
        g.savedAmount,
        g.deadline ?? null,
        g.createdAt
      );
    }
    for (const r of normalized.recurringRules) {
      await db.runAsync(
        `INSERT INTO recurring_rules (kind, amount, category, tag, note, frequency, day_of_month, weekday, next_due, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        r.kind,
        r.amount,
        r.category,
        r.tag ?? null,
        r.note ?? null,
        r.frequency,
        r.dayOfMonth ?? null,
        r.weekday ?? null,
        r.nextDue,
        r.createdAt
      );
    }
    for (const e of normalized.expenses) {
      await db.runAsync(
        'INSERT INTO expenses (amount, category, tag, note, date, created_at, split_group_id, receipt_uri) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        e.amount,
        e.category,
        e.tag ?? null,
        e.note ?? null,
        e.date,
        e.createdAt,
        e.splitGroupId ?? null,
        e.receiptUri ?? null
      );
    }
    for (const i of normalized.incomes) {
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
