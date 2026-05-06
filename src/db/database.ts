import * as SQLite from 'expo-sqlite';
import type { BackupPayload } from '../lib/backup';
import { BACKUP_VERSION, DEFAULT_ACCOUNTS } from '../lib/backup';
import type { Budget } from '../types/budget';
import type { SavingsGoal } from '../types/goal';
import type { AppSettings, ThemePreference } from '../types/settings';
import { DEFAULT_SETTINGS } from '../types/settings';
import type { Account } from '../types/account';
import type { Expense } from '../types/expense';
import type { Income } from '../types/income';
import type { RecurringItem } from '../types/recurring';

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
      CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        kind TEXT NOT NULL DEFAULT 'other',
        sort_order INTEGER NOT NULL DEFAULT 0
      );
      INSERT INTO accounts (name, kind, sort_order) VALUES
        ('Cash', 'cash', 0),
        ('Card', 'card', 1),
        ('Bank', 'bank', 2);
    `);
    await db.execAsync('ALTER TABLE expenses ADD COLUMN account_id INTEGER REFERENCES accounts(id)');
    await db.execAsync('ALTER TABLE incomes ADD COLUMN account_id INTEGER REFERENCES accounts(id)');
    await db.execAsync('PRAGMA user_version = 3');
    v = 3;
  }

  if (v < 4) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS recurring_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        amount REAL NOT NULL,
        category TEXT NOT NULL,
        kind TEXT NOT NULL CHECK(kind IN ('expense','income')),
        day_of_month INTEGER NOT NULL DEFAULT 1,
        account_id INTEGER REFERENCES accounts(id),
        note TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        last_posted_ym TEXT,
        created_at TEXT NOT NULL
      );
    `);
    await db.execAsync('PRAGMA user_version = 4');
  }

  if (v < 5) {
    await db.execAsync('ALTER TABLE expenses ADD COLUMN split_group_id TEXT;');
    await db.execAsync('ALTER TABLE expenses ADD COLUMN receipt_uri TEXT;');
    await db.execAsync('PRAGMA user_version = 5');
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
  account_id: number | null;
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
    accountId: r.account_id ?? null,
    splitGroupId: r.split_group_id,
    receiptUri: r.receipt_uri,
  };
}

export async function fetchAllExpenses(db: SQLite.SQLiteDatabase): Promise<Expense[]> {
  const rows = await db.getAllAsync<ExpenseRow>(
    'SELECT id, amount, category, tag, note, date, created_at, account_id, split_group_id, receipt_uri FROM expenses ORDER BY date DESC, id DESC'
  );
  return rows.map(mapExpenseRow);
}

export type NewExpenseInput = {
  amount: number;
  category: string;
  tag?: string | null;
  note?: string | null;
  date: string;
  accountId?: number | null;
  splitGroupId?: string | null;
  receiptUri?: string | null;
};

export async function insertExpense(db: SQLite.SQLiteDatabase, input: NewExpenseInput): Promise<void> {
  const created = new Date().toISOString();
  await db.runAsync(
    'INSERT INTO expenses (amount, category, tag, note, date, created_at, account_id, split_group_id, receipt_uri) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    input.amount,
    input.category,
    input.tag ?? null,
    input.note ?? null,
    input.date,
    created,
    input.accountId ?? null,
    input.splitGroupId ?? null,
    input.receiptUri ?? null
  );
}

export async function updateExpense(db: SQLite.SQLiteDatabase, id: number, input: NewExpenseInput): Promise<void> {
  await db.runAsync(
    'UPDATE expenses SET amount = ?, category = ?, tag = ?, note = ?, date = ?, account_id = ?, split_group_id = ?, receipt_uri = ? WHERE id = ?',
    input.amount,
    input.category,
    input.tag ?? null,
    input.note ?? null,
    input.date,
    input.accountId ?? null,
    input.splitGroupId ?? null,
    input.receiptUri ?? null,
    id
  );
}

export type SplitLineInput = { amount: number; category: string };

export type NewSplitExpenseInput = {
  lines: SplitLineInput[];
  tag?: string | null;
  note?: string | null;
  date: string;
  accountId?: number | null;
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
        'INSERT INTO expenses (amount, category, tag, note, date, created_at, account_id, split_group_id, receipt_uri) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        line.amount,
        line.category,
        input.tag ?? null,
        input.note ?? null,
        input.date,
        created,
        input.accountId ?? null,
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

type IncomeRow = {
  id: number;
  amount: number;
  category: string;
  tag: string | null;
  note: string | null;
  date: string;
  created_at: string;
  account_id: number | null;
};

function mapIncomeRow(r: IncomeRow): Income {
  return {
    id: r.id,
    amount: r.amount,
    category: r.category,
    tag: r.tag,
    note: r.note,
    date: r.date,
    createdAt: r.created_at,
    accountId: r.account_id ?? null,
  };
}

export async function fetchAllIncomes(db: SQLite.SQLiteDatabase): Promise<Income[]> {
  const rows = await db.getAllAsync<IncomeRow>(
    'SELECT id, amount, category, tag, note, date, created_at, account_id FROM incomes ORDER BY date DESC, id DESC'
  );
  return rows.map(mapIncomeRow);
}

export type NewIncomeInput = NewExpenseInput;

export async function insertIncome(db: SQLite.SQLiteDatabase, input: NewIncomeInput): Promise<void> {
  const created = new Date().toISOString();
  await db.runAsync(
    'INSERT INTO incomes (amount, category, tag, note, date, created_at, account_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    input.amount,
    input.category,
    input.tag ?? null,
    input.note ?? null,
    input.date,
    created,
    input.accountId ?? null
  );
}

export async function updateIncome(db: SQLite.SQLiteDatabase, id: number, input: NewIncomeInput): Promise<void> {
  await db.runAsync(
    'UPDATE incomes SET amount = ?, category = ?, tag = ?, note = ?, date = ?, account_id = ? WHERE id = ?',
    input.amount,
    input.category,
    input.tag ?? null,
    input.note ?? null,
    input.date,
    input.accountId ?? null,
    id
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

export async function getOnboardingSeen(db: SQLite.SQLiteDatabase): Promise<boolean> {
  return (await getSetting(db, 'onboarding_seen')) === '1';
}

export async function setOnboardingSeen(db: SQLite.SQLiteDatabase): Promise<void> {
  await setSetting(db, 'onboarding_seen', '1');
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
  if (kind === 'expense') {
    await db.runAsync('DELETE FROM budgets WHERE category = ?', name);
  }
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

type AccountRow = { id: number; name: string; kind: string; sort_order: number };

function mapAccountRow(r: AccountRow): Account {
  return {
    id: r.id,
    name: r.name,
    kind: r.kind as Account['kind'],
    sortOrder: r.sort_order,
  };
}

export async function fetchAllAccounts(db: SQLite.SQLiteDatabase): Promise<Account[]> {
  const rows = await db.getAllAsync<AccountRow>(
    'SELECT id, name, kind, sort_order FROM accounts ORDER BY sort_order ASC, id ASC'
  );
  return rows.map(mapAccountRow);
}

export async function insertAccount(db: SQLite.SQLiteDatabase, name: string, kind: string): Promise<void> {
  const row = await db.getFirstAsync<{ m: number }>('SELECT COALESCE(MAX(sort_order), -1) AS m FROM accounts');
  const next = (row?.m ?? -1) + 1;
  await db.runAsync('INSERT INTO accounts (name, kind, sort_order) VALUES (?, ?, ?)', name.trim(), kind, next);
}

export async function deleteAccount(db: SQLite.SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('UPDATE expenses SET account_id = NULL WHERE account_id = ?', id);
  await db.runAsync('UPDATE incomes SET account_id = NULL WHERE account_id = ?', id);
  await db.runAsync('UPDATE recurring_items SET account_id = NULL WHERE account_id = ?', id);
  await db.runAsync('DELETE FROM accounts WHERE id = ?', id);
}

type RecRow = {
  id: number;
  title: string;
  amount: number;
  category: string;
  kind: string;
  day_of_month: number;
  account_id: number | null;
  note: string | null;
  active: number;
  last_posted_ym: string | null;
  created_at: string;
};

function mapRecurringRow(r: RecRow): RecurringItem {
  return {
    id: r.id,
    title: r.title,
    amount: r.amount,
    category: r.category,
    kind: r.kind as RecurringItem['kind'],
    dayOfMonth: r.day_of_month,
    accountId: r.account_id,
    note: r.note,
    active: r.active !== 0,
    lastPostedYm: r.last_posted_ym,
    createdAt: r.created_at,
  };
}

export async function fetchAllRecurring(db: SQLite.SQLiteDatabase): Promise<RecurringItem[]> {
  const rows = await db.getAllAsync<RecRow>(
    'SELECT id, title, amount, category, kind, day_of_month, account_id, note, active, last_posted_ym, created_at FROM recurring_items ORDER BY active DESC, title ASC'
  );
  return rows.map(mapRecurringRow);
}

export type NewRecurringInput = {
  title: string;
  amount: number;
  category: string;
  kind: RecurringItem['kind'];
  dayOfMonth: number;
  accountId?: number | null;
  note?: string | null;
};

export async function insertRecurring(db: SQLite.SQLiteDatabase, input: NewRecurringInput): Promise<void> {
  const created = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO recurring_items (title, amount, category, kind, day_of_month, account_id, note, active, last_posted_ym, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, NULL, ?)`,
    input.title.trim(),
    input.amount,
    input.category,
    input.kind,
    Math.min(28, Math.max(1, Math.floor(input.dayOfMonth))),
    input.accountId ?? null,
    input.note?.trim() || null,
    created
  );
}

export async function deleteRecurring(db: SQLite.SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM recurring_items WHERE id = ?', id);
}

async function updateRecurringLastPosted(db: SQLite.SQLiteDatabase, id: number, ym: string): Promise<void> {
  await db.runAsync('UPDATE recurring_items SET last_posted_ym = ? WHERE id = ?', ym, id);
}

/** Insert transactions for active recurring items not yet posted for `ym` (YYYY-MM). Returns count posted. */
export async function postRecurringForMonth(db: SQLite.SQLiteDatabase, ym: string): Promise<number> {
  const items = await fetchAllRecurring(db);
  const [y, mo] = ym.split('-').map(Number);
  const lastDay = new Date(y, mo, 0).getDate();
  let n = 0;
  for (const r of items) {
    if (!r.active) continue;
    if (r.lastPostedYm === ym) continue;
    const day = Math.min(Math.max(1, r.dayOfMonth), lastDay);
    const dateStr = `${ym}-${String(day).padStart(2, '0')}`;
    const note = r.note ? `[Recurring] ${r.title}: ${r.note}` : `[Recurring] ${r.title}`;
    if (r.kind === 'expense') {
      await insertExpense(db, {
        amount: r.amount,
        category: r.category,
        tag: 'Recurring',
        note,
        date: dateStr,
        accountId: r.accountId,
      });
    } else {
      await insertIncome(db, {
        amount: r.amount,
        category: r.category,
        tag: 'Recurring',
        note,
        date: dateStr,
        accountId: r.accountId,
      });
    }
    await updateRecurringLastPosted(db, r.id, ym);
    n += 1;
  }
  return n;
}

export async function exportDatabaseSnapshot(db: SQLite.SQLiteDatabase): Promise<BackupPayload> {
  const [expenses, incomes, budgets, goals, settings, ce, ci, accounts, recurring] = await Promise.all([
    fetchAllExpenses(db),
    fetchAllIncomes(db),
    fetchAllBudgets(db),
    fetchAllGoals(db),
    loadAppSettings(db),
    fetchCustomCategories(db, 'expense'),
    fetchCustomCategories(db, 'income'),
    fetchAllAccounts(db),
    fetchAllRecurring(db),
  ]);
  const customCategories = [
    ...ce.map((name) => ({ name, kind: 'expense' as const })),
    ...ci.map((name) => ({ name, kind: 'income' as const })),
  ];
  const idToName = new Map(accounts.map((a) => [a.id, a.name] as const));
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    settings,
    expenses: expenses.map((e) => ({
      amount: e.amount,
      category: e.category,
      tag: e.tag,
      note: e.note,
      date: e.date,
      createdAt: e.createdAt,
      accountName: e.accountId != null ? (idToName.get(e.accountId) ?? null) : null,
      splitGroupId: e.splitGroupId ?? null,
      receiptUri: e.receiptUri ?? null,
    })),
    incomes: incomes.map((i) => ({
      amount: i.amount,
      category: i.category,
      tag: i.tag,
      note: i.note,
      date: i.date,
      createdAt: i.createdAt,
      accountName: i.accountId != null ? (idToName.get(i.accountId) ?? null) : null,
    })),
    budgets: budgets.map(({ id: _id, ...b }) => b),
    savingsGoals: goals.map(({ id: _id, ...g }) => g),
    customCategories,
    accounts: accounts.map(({ id: _id, name, kind, sortOrder }) => ({ name, kind, sortOrder })),
    recurringItems: recurring.map((r) => ({
      title: r.title,
      amount: r.amount,
      category: r.category,
      kind: r.kind,
      dayOfMonth: r.dayOfMonth,
      note: r.note,
      active: r.active,
      lastPostedYm: r.lastPostedYm,
      createdAt: r.createdAt,
      accountName: r.accountId != null ? (idToName.get(r.accountId) ?? null) : null,
    })),
  };
}

export async function importDatabaseSnapshot(db: SQLite.SQLiteDatabase, data: BackupPayload): Promise<void> {
  if (data.version !== BACKUP_VERSION) throw new Error(`Unsupported backup version: ${data.version}`);
  await db.withTransactionAsync(async () => {
    await db.execAsync('DELETE FROM recurring_items');
    await db.execAsync('DELETE FROM savings_goals');
    await db.execAsync('DELETE FROM budgets');
    await db.execAsync('DELETE FROM expenses');
    await db.execAsync('DELETE FROM incomes');
    await db.execAsync('DELETE FROM custom_categories');
    await db.execAsync('DELETE FROM app_settings');
    await db.execAsync('DELETE FROM accounts');

    const accountSeeds = data.accounts.length > 0 ? data.accounts : DEFAULT_ACCOUNTS;
    for (const a of accountSeeds) {
      await db.runAsync('INSERT INTO accounts (name, kind, sort_order) VALUES (?, ?, ?)', a.name, a.kind, a.sortOrder);
    }
    const importedAccounts = await fetchAllAccounts(db);
    const nameToId = new Map(importedAccounts.map((x) => [x.name.trim().toLowerCase(), x.id] as const));
    const resolveAid = (name: string | null | undefined): number | null => {
      if (name == null || !String(name).trim()) return null;
      return nameToId.get(String(name).trim().toLowerCase()) ?? null;
    };

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
    for (const r of data.recurringItems) {
      await db.runAsync(
        `INSERT INTO recurring_items (title, amount, category, kind, day_of_month, account_id, note, active, last_posted_ym, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        r.title,
        r.amount,
        r.category,
        r.kind,
        Math.min(28, Math.max(1, Math.floor(r.dayOfMonth))),
        resolveAid(r.accountName),
        r.note ?? null,
        r.active ? 1 : 0,
        r.lastPostedYm ?? null,
        r.createdAt
      );
    }
    for (const e of data.expenses) {
      await db.runAsync(
        'INSERT INTO expenses (amount, category, tag, note, date, created_at, account_id, split_group_id, receipt_uri) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        e.amount,
        e.category,
        e.tag ?? null,
        e.note ?? null,
        e.date,
        e.createdAt,
        resolveAid(e.accountName),
        e.splitGroupId ?? null,
        e.receiptUri ?? null
      );
    }
    for (const i of data.incomes) {
      await db.runAsync(
        'INSERT INTO incomes (amount, category, tag, note, date, created_at, account_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        i.amount,
        i.category,
        i.tag ?? null,
        i.note ?? null,
        i.date,
        i.createdAt,
        resolveAid(i.accountName)
      );
    }
  });
}
