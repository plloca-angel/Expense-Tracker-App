import { describe, expect, it } from 'vitest';
import {
  BACKUP_VERSION,
  BACKUP_VERSION_LEGACY,
  dryRunImport,
  normalizeBackupPayload,
  parseBackupJson,
  validateBackupPayload,
  type BackupPayloadV2,
  type BackupPayloadV3,
} from './backup';
import { DEFAULT_SETTINGS } from '../types/settings';

function minimalV3(over: Partial<BackupPayloadV3> = {}): BackupPayloadV3 {
  return {
    version: BACKUP_VERSION,
    exportedAt: '2026-05-06T00:00:00.000Z',
    settings: DEFAULT_SETTINGS,
    expenses: [],
    incomes: [],
    budgets: [],
    savingsGoals: [],
    customCategories: [],
    recurringRules: [],
    ...over,
  };
}

describe('backup', () => {
  it('normalizes v2 to v3 with split and recurring defaults', () => {
    const v2: BackupPayloadV2 = {
      version: BACKUP_VERSION_LEGACY,
      exportedAt: '2026-01-01T00:00:00.000Z',
      settings: DEFAULT_SETTINGS,
      expenses: [
        {
          amount: 12.5,
          category: 'Food',
          tag: null,
          note: null,
          date: '2026-05-01',
          createdAt: '2026-05-01T00:00:00.000Z',
        },
      ],
      incomes: [],
      budgets: [],
      savingsGoals: [],
      customCategories: [],
    };
    const n = normalizeBackupPayload(v2);
    expect(n.version).toBe(BACKUP_VERSION);
    expect(n.expenses[0]!.splitGroupId).toBeNull();
    expect(n.expenses[0]!.receiptUri).toBeNull();
    expect(n.recurringRules).toEqual([]);
  });

  it('dryRunImport counts split groups', () => {
    const data = minimalV3({
      expenses: [
        {
          amount: 10,
          category: 'A',
          tag: null,
          note: null,
          date: '2026-05-01',
          createdAt: '2026-05-01T00:00:00.000Z',
          splitGroupId: 'g1',
          receiptUri: null,
        },
        {
          amount: 20,
          category: 'B',
          tag: null,
          note: null,
          date: '2026-05-01',
          createdAt: '2026-05-01T00:00:00.000Z',
          splitGroupId: 'g1',
          receiptUri: null,
        },
        {
          amount: 5,
          category: 'C',
          tag: null,
          note: null,
          date: '2026-05-02',
          createdAt: '2026-05-02T00:00:00.000Z',
          splitGroupId: null,
          receiptUri: 'file:///x.jpg',
        },
      ],
      recurringRules: [
        {
          kind: 'expense',
          amount: 100,
          category: 'Bills',
          tag: null,
          note: null,
          frequency: 'monthly',
          dayOfMonth: 1,
          weekday: null,
          nextDue: '2026-06-01',
          createdAt: '2026-05-01T00:00:00.000Z',
        },
      ],
    });
    const plan = dryRunImport(data);
    expect(plan.expenses).toBe(3);
    expect(plan.splitGroups).toBe(1);
    expect(plan.recurringRules).toBe(1);
  });

  it('parseBackupJson round-trips', () => {
    const data = minimalV3();
    const raw = JSON.stringify(data);
    const parsed = parseBackupJson(raw);
    expect(normalizeBackupPayload(parsed)).toEqual(data);
  });

  it('validateBackupPayload accepts good v3', () => {
    const errs = validateBackupPayload(minimalV3());
    expect(errs).toEqual([]);
  });

  it('parseBackupJson rejects bad version', () => {
    const raw = JSON.stringify({ ...minimalV3(), version: 1 });
    expect(() => parseBackupJson(raw)).toThrow();
  });
});
