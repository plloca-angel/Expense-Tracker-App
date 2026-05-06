import {
  BACKUP_VERSION,
  formatBackupImportPreview,
  parseBackupJson,
  summarizeBackupPayload,
  type BackupPayload,
} from '../backup';
import { DEFAULT_SETTINGS } from '../../types/settings';

function minimalBackup(overrides: Partial<BackupPayload> = {}): BackupPayload {
  return {
    version: BACKUP_VERSION,
    exportedAt: '2026-05-01T12:00:00.000Z',
    settings: DEFAULT_SETTINGS,
    expenses: [],
    incomes: [],
    budgets: [],
    customCategories: [],
    savingsGoals: [],
    accounts: [],
    recurringItems: [],
    ...overrides,
  };
}

describe('parseBackupJson', () => {
  it('accepts valid backup JSON', () => {
    const payload = minimalBackup({
      expenses: [
        {
          amount: 10,
          category: 'Food',
          date: '2026-05-01',
          note: null,
          tag: null,
          createdAt: '2026-05-01T00:00:00.000Z',
        },
      ],
      incomes: [
        {
          amount: 100,
          category: 'Salary',
          date: '2026-05-01',
          note: null,
          tag: null,
          createdAt: '2026-05-01T00:00:00.000Z',
        },
      ],
    });
    const parsed = parseBackupJson(JSON.stringify(payload));
    expect(parsed.version).toBe(BACKUP_VERSION);
    expect(parsed.expenses).toHaveLength(1);
    expect(parsed.incomes).toHaveLength(1);
  });

  it('rejects wrong version', () => {
    const bad = { ...minimalBackup(), version: 99 };
    expect(() => parseBackupJson(JSON.stringify(bad))).toThrow(/version/);
  });

  it('rejects missing arrays', () => {
    const o = { version: BACKUP_VERSION, exportedAt: '', settings: DEFAULT_SETTINGS };
    expect(() => parseBackupJson(JSON.stringify(o))).toThrow(/Missing transaction/);
  });
});

describe('summarizeBackupPayload', () => {
  it('returns counts per section', () => {
    const s = summarizeBackupPayload(
      minimalBackup({
        expenses: [
          { amount: 1, category: 'A', date: '2026-05-01', note: null, tag: null, createdAt: '2026-05-01T00:00:00.000Z' },
        ],
        budgets: [{ category: 'Food', monthlyLimit: 100 }],
        customCategories: [{ name: 'X', kind: 'expense' }],
        savingsGoals: [
          {
            name: 'Trip',
            targetAmount: 500,
            savedAmount: 0,
            deadline: null,
            createdAt: '2026-05-01T00:00:00.000Z',
          },
        ],
      })
    );
    expect(s.expenses).toBe(1);
    expect(s.incomes).toBe(0);
    expect(s.budgets).toBe(1);
    expect(s.customCategories).toBe(1);
    expect(s.savingsGoals).toBe(1);
    expect(s.accounts).toBe(3);
    expect(s.recurringItems).toBe(0);
  });
});

describe('formatBackupImportPreview', () => {
  it('includes counts in message', () => {
    const text = formatBackupImportPreview(
      summarizeBackupPayload(
        minimalBackup({
          expenses: new Array(3).fill(null).map((_, i) => ({
            amount: i,
            category: 'C',
            date: '2026-05-01',
            note: null,
            tag: null,
            createdAt: '2026-05-01T00:00:00.000Z',
          })),
        })
      )
    );
    expect(text).toContain('Expenses: 3');
    expect(text).toContain('format v3');
  });
});

describe('parseBackupJson v2 compatibility', () => {
  it('upgrades version 2 backups', () => {
    const v2 = {
      version: 2,
      exportedAt: '2026-01-01T00:00:00.000Z',
      settings: DEFAULT_SETTINGS,
      expenses: [
        {
          amount: 5,
          category: 'Food',
          date: '2026-01-02',
          note: null,
          tag: null,
          createdAt: '2026-01-02T00:00:00.000Z',
        },
      ],
      incomes: [],
      budgets: [],
      customCategories: [],
      savingsGoals: [],
    };
    const p = parseBackupJson(JSON.stringify(v2));
    expect(p.version).toBe(3);
    expect(p.accounts).toEqual([]);
    expect(p.recurringItems).toEqual([]);
    expect(p.expenses[0].accountName).toBeNull();
  });
});
