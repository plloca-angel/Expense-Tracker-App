import type { Expense } from '../types/expense';
import type { Income } from '../types/income';

function esc(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildFinanceCsv(expenses: Expense[], incomes: Income[]): string {
  const lines: string[] = ['type,date,amount,category,tag,note,created_at'];

  for (const e of expenses) {
    lines.push(
      [
        'expense',
        e.date,
        String(e.amount),
        esc(e.category),
        esc(e.tag ?? ''),
        esc(e.note ?? ''),
        e.createdAt,
      ].join(',')
    );
  }
  for (const i of incomes) {
    lines.push(
      [
        'income',
        i.date,
        String(i.amount),
        esc(i.category),
        esc(i.tag ?? ''),
        esc(i.note ?? ''),
        i.createdAt,
      ].join(',')
    );
  }

  return lines.join('\n');
}
