import type { Expense } from '../types/expense';
import type { Income } from '../types/income';

/** Include whole split group if any line matches `match`. */
export function filterExpensesGroupAware(expenses: Expense[], match: (e: Expense) => boolean): Expense[] {
  const byG = new Map<string, Expense[]>();
  const singles: Expense[] = [];
  for (const e of expenses) {
    if (e.splitGroupId) {
      const a = byG.get(e.splitGroupId) ?? [];
      a.push(e);
      byG.set(e.splitGroupId, a);
    } else singles.push(e);
  }
  const out: Expense[] = [];
  for (const e of singles) {
    if (match(e)) out.push(e);
  }
  for (const arr of byG.values()) {
    if (arr.some(match)) out.push(...arr);
  }
  return out;
}

export function filterExpensesForActivitySearch(expenses: Expense[], q: string): Expense[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return expenses;
  const groupHit = new Set<string>();
  for (const e of expenses) {
    if (e.splitGroupId) {
      const t = `${e.note ?? ''} ${e.tag ?? ''} ${e.category}`.toLowerCase();
      if (t.includes(needle)) groupHit.add(e.splitGroupId);
    }
  }
  return expenses.filter((e) => {
    const t = `${e.note ?? ''} ${e.tag ?? ''} ${e.category}`.toLowerCase();
    if (t.includes(needle)) return true;
    return !!(e.splitGroupId && groupHit.has(e.splitGroupId));
  });
}

export type ActivityExpenseRow =
  | { shape: 'single'; expense: Expense }
  | { shape: 'split'; expenses: Expense[] };

export type ActivityUnifiedRow =
  | { kind: 'expense'; expenseRow: ActivityExpenseRow }
  | { kind: 'income'; income: Income };

function sortKeyDateId(a: { date: string; id: number }): string {
  return `${a.date}\0${String(a.id).padStart(10, '0')}`;
}

/** Group split expenses; leave incomes flat. Sorted newest first. */
export function buildActivityRows(expenses: Expense[], incomes: Income[]): ActivityUnifiedRow[] {
  const byGroup = new Map<string, Expense[]>();
  const singles: Expense[] = [];

  for (const e of expenses) {
    if (e.splitGroupId) {
      const arr = byGroup.get(e.splitGroupId) ?? [];
      arr.push(e);
      byGroup.set(e.splitGroupId, arr);
    } else {
      singles.push(e);
    }
  }

  const expenseRows: ActivityUnifiedRow[] = [];

  for (const e of singles) {
    expenseRows.push({ kind: 'expense', expenseRow: { shape: 'single', expense: e } });
  }

  for (const group of byGroup.values()) {
    group.sort((a, b) => a.id - b.id);
    expenseRows.push({ kind: 'expense', expenseRow: { shape: 'split', expenses: group } });
  }

  const incomeRows: ActivityUnifiedRow[] = incomes.map((income) => ({ kind: 'income', income }));

  const combined = [...expenseRows, ...incomeRows];
  combined.sort((a, b) => {
    if (a.kind === 'expense' && b.kind === 'expense') {
      const da =
        a.expenseRow.shape === 'single'
          ? a.expenseRow.expense
          : a.expenseRow.expenses[a.expenseRow.expenses.length - 1]!;
      const db =
        b.expenseRow.shape === 'single'
          ? b.expenseRow.expense
          : b.expenseRow.expenses[b.expenseRow.expenses.length - 1]!;
      return sortKeyDateId(db).localeCompare(sortKeyDateId(da));
    }
    if (a.kind === 'expense' && b.kind === 'income') {
      const da =
        a.expenseRow.shape === 'single'
          ? a.expenseRow.expense
          : a.expenseRow.expenses[a.expenseRow.expenses.length - 1]!;
      return sortKeyDateId(b.income).localeCompare(sortKeyDateId(da));
    }
    if (a.kind === 'income' && b.kind === 'expense') {
      const db =
        b.expenseRow.shape === 'single'
          ? b.expenseRow.expense
          : b.expenseRow.expenses[b.expenseRow.expenses.length - 1]!;
      return sortKeyDateId(db).localeCompare(sortKeyDateId(a.income));
    }
    if (a.kind === 'income' && b.kind === 'income') {
      return sortKeyDateId(b.income).localeCompare(sortKeyDateId(a.income));
    }
    return 0;
  });

  return combined;
}

export function splitGroupTotal(expenses: Expense[]): number {
  return expenses.reduce((s, e) => s + e.amount, 0);
}
