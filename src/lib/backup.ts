import type { AccountKind } from '../types/account';
import type { Budget } from '../types/budget';
import type { SavingsGoal } from '../types/goal';
import type { AppSettings } from '../types/settings';

export const BACKUP_VERSION = 3 as const;

/** Portable expense row (account by name, not id). */
export type ExpenseBackupRow = {
  amount: number;
  category: string;
  tag: string | null;
  note: string | null;
  date: string;
  createdAt: string;
  accountName?: string | null;
  splitGroupId?: string | null;
  receiptUri?: string | null;
};

export type IncomeBackupRow = {
  amount: number;
  category: string;
  tag: string | null;
  note: string | null;
  date: string;
  createdAt: string;
  accountName?: string | null;
};

export type AccountBackupRow = {
  name: string;
  kind: AccountKind | string;
  sortOrder: number;
};

export type RecurringBackupRow = {
  title: string;
  amount: number;
  category: string;
  kind: 'expense' | 'income';
  dayOfMonth: number;
  note: string | null;
  active: boolean;
  lastPostedYm: string | null;
  createdAt: string;
  accountName?: string | null;
};

export type BackupPayload = {
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  settings: AppSettings;
  expenses: ExpenseBackupRow[];
  incomes: IncomeBackupRow[];
  budgets: Omit<Budget, 'id'>[];
  customCategories: { name: string; kind: 'expense' | 'income' }[];
  savingsGoals: Omit<SavingsGoal, 'id'>[];
  accounts: AccountBackupRow[];
  recurringItems: RecurringBackupRow[];
};

const DEFAULT_ACCOUNTS: AccountBackupRow[] = [
  { name: 'Cash', kind: 'cash', sortOrder: 0 },
  { name: 'Card', kind: 'card', sortOrder: 1 },
  { name: 'Bank', kind: 'bank', sortOrder: 2 },
];

function mapV2Expense(e: Record<string, unknown>): ExpenseBackupRow {
  return {
    amount: Number(e.amount),
    category: String(e.category),
    tag: (e.tag as string | null) ?? null,
    note: (e.note as string | null) ?? null,
    date: String(e.date),
    createdAt: String(e.createdAt),
    accountName: null,
    splitGroupId: null,
    receiptUri: null,
  };
}

function mapV2Income(i: Record<string, unknown>): IncomeBackupRow {
  return {
    amount: Number(i.amount),
    category: String(i.category),
    tag: (i.tag as string | null) ?? null,
    note: (i.note as string | null) ?? null,
    date: String(i.date),
    createdAt: String(i.createdAt),
    accountName: null,
  };
}

export function parseBackupJson(raw: string): BackupPayload {
  const data = JSON.parse(raw) as unknown;
  if (!data || typeof data !== 'object') throw new Error('Invalid backup file');
  const o = data as Record<string, unknown>;
  const ver = o.version;
  if (ver !== 2 && ver !== 3) throw new Error(`Unsupported backup version: ${String(ver)}`);
  if (!Array.isArray(o.expenses) || !Array.isArray(o.incomes)) throw new Error('Missing transaction arrays');

  if (ver === 2) {
    return {
      version: BACKUP_VERSION,
      exportedAt: String(o.exportedAt ?? new Date().toISOString()),
      settings: o.settings as AppSettings,
      expenses: (o.expenses as Record<string, unknown>[]).map(mapV2Expense),
      incomes: (o.incomes as Record<string, unknown>[]).map(mapV2Income),
      budgets: o.budgets as BackupPayload['budgets'],
      customCategories: o.customCategories as BackupPayload['customCategories'],
      savingsGoals: o.savingsGoals as BackupPayload['savingsGoals'],
      accounts: [],
      recurringItems: [],
    };
  }

  const accounts = Array.isArray(o.accounts) ? (o.accounts as AccountBackupRow[]) : [];
  const recurringItems = Array.isArray(o.recurringItems)
    ? (o.recurringItems as RecurringBackupRow[])
    : [];

  return {
    version: BACKUP_VERSION,
    exportedAt: String(o.exportedAt ?? new Date().toISOString()),
    settings: o.settings as AppSettings,
    expenses: (o.expenses as ExpenseBackupRow[]).map((e) => ({
      ...e,
      accountName: e.accountName ?? null,
      splitGroupId: e.splitGroupId ?? null,
      receiptUri: e.receiptUri ?? null,
    })),
    incomes: (o.incomes as IncomeBackupRow[]).map((i) => ({
      ...i,
      accountName: i.accountName ?? null,
    })),
    budgets: o.budgets as BackupPayload['budgets'],
    customCategories: o.customCategories as BackupPayload['customCategories'],
    savingsGoals: o.savingsGoals as BackupPayload['savingsGoals'],
    accounts,
    recurringItems,
  };
}

export type BackupImportSummary = {
  version: number;
  exportedAt: string;
  expenses: number;
  incomes: number;
  budgets: number;
  customCategories: number;
  savingsGoals: number;
  accounts: number;
  recurringItems: number;
  splitPayments: number;
};

/** Counts per table for import preview (dry run). */
export function summarizeBackupPayload(data: BackupPayload): BackupImportSummary {
  const accountCount = data.accounts.length > 0 ? data.accounts.length : DEFAULT_ACCOUNTS.length;
  const splitIds = new Set<string>();
  for (const e of data.expenses) {
    if (e.splitGroupId) splitIds.add(e.splitGroupId);
  }
  return {
    version: data.version,
    exportedAt: data.exportedAt,
    expenses: data.expenses.length,
    incomes: data.incomes.length,
    budgets: data.budgets.length,
    customCategories: data.customCategories.length,
    savingsGoals: data.savingsGoals.length,
    accounts: accountCount,
    recurringItems: data.recurringItems.length,
    splitPayments: splitIds.size,
  };
}

export function formatBackupImportPreview(summary: BackupImportSummary): string {
  const lines = [
    `Backup from ${summary.exportedAt} (format v${summary.version})`,
    '',
    'This will replace your data with:',
    `- Expenses: ${summary.expenses} (${summary.splitPayments} split payments)`,
    `- Income: ${summary.incomes}`,
    `- Budgets: ${summary.budgets}`,
    `- Savings goals: ${summary.savingsGoals}`,
    `- Custom categories: ${summary.customCategories}`,
    `- Accounts: ${summary.accounts} (default list if backup has none)`,
    `- Recurring / bills: ${summary.recurringItems}`,
    '- App settings: replaced',
    '',
    'Current data cannot be recovered after import unless you exported a backup first.',
  ];
  return lines.join('\n');
}

export { DEFAULT_ACCOUNTS };
