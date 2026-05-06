import type { Budget } from '../types/budget';
import type { Expense } from '../types/expense';
import type { SavingsGoal } from '../types/goal';
import type { Income } from '../types/income';
import type { RecurringRule } from '../types/recurring';
import type { AppSettings } from '../types/settings';

export const BACKUP_VERSION = 3 as const;
export const BACKUP_VERSION_LEGACY = 2 as const;

export type BackupExpense = Omit<Expense, 'id'>;
export type BackupRecurringRule = Omit<RecurringRule, 'id'>;

export type BackupPayloadV3 = {
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  settings: AppSettings;
  expenses: BackupExpense[];
  incomes: Omit<Income, 'id'>[];
  budgets: Omit<Budget, 'id'>[];
  customCategories: { name: string; kind: 'expense' | 'income' }[];
  savingsGoals: Omit<SavingsGoal, 'id'>[];
  recurringRules: BackupRecurringRule[];
};

/** Legacy v2 export shape (before splits, receipts, recurring). */
export type BackupPayloadV2 = {
  version: typeof BACKUP_VERSION_LEGACY;
  exportedAt: string;
  settings: AppSettings;
  expenses: Array<Omit<Expense, 'id' | 'splitGroupId' | 'receiptUri'>>;
  incomes: Omit<Income, 'id'>[];
  budgets: Omit<Budget, 'id'>[];
  customCategories: { name: string; kind: 'expense' | 'income' }[];
  savingsGoals: Omit<SavingsGoal, 'id'>[];
};

export type BackupPayload = BackupPayloadV3 | BackupPayloadV2;

export type ImportDryRun = {
  version: number;
  expenses: number;
  incomes: number;
  budgets: number;
  savingsGoals: number;
  customCategories: number;
  recurringRules: number;
  splitGroups: number;
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === 'object' && !Array.isArray(x);
}

export function normalizeBackupPayload(data: BackupPayload): BackupPayloadV3 {
  if (data.version === BACKUP_VERSION) {
    const d = data as BackupPayloadV3;
    return {
      ...d,
      recurringRules: d.recurringRules ?? [],
    };
  }
  const v2 = data as BackupPayloadV2;
  return {
    version: BACKUP_VERSION,
    exportedAt: v2.exportedAt,
    settings: v2.settings,
    expenses: v2.expenses.map((e) => ({
      ...e,
      splitGroupId: null,
      receiptUri: null,
    })),
    incomes: v2.incomes,
    budgets: v2.budgets,
    customCategories: v2.customCategories,
    savingsGoals: v2.savingsGoals,
    recurringRules: [],
  };
}

export function parseBackupJson(raw: string): BackupPayload {
  const data = JSON.parse(raw) as unknown;
  if (!isRecord(data)) throw new Error('Invalid backup file');
  const ver = data.version;
  if (ver !== BACKUP_VERSION && ver !== BACKUP_VERSION_LEGACY) {
    throw new Error(`Expected backup version ${BACKUP_VERSION_LEGACY} or ${BACKUP_VERSION}`);
  }
  if (typeof data.exportedAt !== 'string') throw new Error('Missing exportedAt');
  if (!isRecord(data.settings)) throw new Error('Missing settings');
  if (!Array.isArray(data.expenses) || !Array.isArray(data.incomes)) throw new Error('Missing transaction arrays');
  if (!Array.isArray(data.budgets) || !Array.isArray(data.savingsGoals)) {
    throw new Error('Missing budgets or savingsGoals arrays');
  }
  if (!Array.isArray(data.customCategories)) throw new Error('Missing customCategories array');
  return data as BackupPayload;
}

export function dryRunImport(data: BackupPayload): ImportDryRun {
  const n = normalizeBackupPayload(data);
  const groupIds = new Set<string>();
  for (const e of n.expenses) {
    if (e.splitGroupId) groupIds.add(e.splitGroupId);
  }
  return {
    version: n.version,
    expenses: n.expenses.length,
    incomes: n.incomes.length,
    budgets: n.budgets.length,
    savingsGoals: n.savingsGoals.length,
    customCategories: n.customCategories.length,
    recurringRules: n.recurringRules.length,
    splitGroups: groupIds.size,
  };
}

export function validateBackupPayload(data: BackupPayload): string[] {
  const errs: string[] = [];
  const n = normalizeBackupPayload(data);
  if (!n.settings.currency || typeof n.settings.currency !== 'string') errs.push('settings.currency missing');
  if (!n.settings.theme) errs.push('settings.theme missing');
  for (let i = 0; i < n.expenses.length; i++) {
    const e = n.expenses[i]!;
    if (typeof e.amount !== 'number' || e.amount <= 0) errs.push(`expenses[${i}].amount invalid`);
    if (!e.category) errs.push(`expenses[${i}].category missing`);
    if (!e.date || !/^\d{4}-\d{2}-\d{2}$/.test(e.date)) errs.push(`expenses[${i}].date invalid`);
  }
  for (let i = 0; i < n.incomes.length; i++) {
    const row = n.incomes[i]!;
    if (typeof row.amount !== 'number' || row.amount <= 0) errs.push(`incomes[${i}].amount invalid`);
  }
  for (const r of n.recurringRules) {
    if (r.frequency !== 'weekly' && r.frequency !== 'monthly') errs.push(`recurring invalid frequency`);
    if (!r.nextDue || !/^\d{4}-\d{2}-\d{2}$/.test(r.nextDue)) errs.push(`recurring nextDue invalid`);
  }
  return errs;
}
