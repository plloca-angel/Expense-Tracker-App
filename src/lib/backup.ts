import type { Budget } from '../types/budget';
import type { Expense } from '../types/expense';
import type { SavingsGoal } from '../types/goal';
import type { Income } from '../types/income';
import type { AppSettings } from '../types/settings';

export const BACKUP_VERSION = 2 as const;

export type BackupPayload = {
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  settings: AppSettings;
  expenses: Omit<Expense, 'id'>[];
  incomes: Omit<Income, 'id'>[];
  budgets: Omit<Budget, 'id'>[];
  customCategories: { name: string; kind: 'expense' | 'income' }[];
  savingsGoals: Omit<SavingsGoal, 'id'>[];
};

export function parseBackupJson(raw: string): BackupPayload {
  const data = JSON.parse(raw) as unknown;
  if (!data || typeof data !== 'object') throw new Error('Invalid backup file');
  const o = data as Record<string, unknown>;
  if (o.version !== BACKUP_VERSION) throw new Error(`Expected backup version ${BACKUP_VERSION}`);
  if (!Array.isArray(o.expenses) || !Array.isArray(o.incomes)) throw new Error('Missing transaction arrays');
  return o as unknown as BackupPayload;
}
