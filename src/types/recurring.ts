export type RecurringFrequency = 'weekly' | 'monthly';

export type RecurringRule = {
  id: number;
  kind: 'expense' | 'income';
  amount: number;
  category: string;
  tag: string | null;
  note: string | null;
  frequency: RecurringFrequency;
  /** 1–31 for monthly; used with next due month */
  dayOfMonth: number | null;
  /** 0 = Sunday … 6 = Saturday for weekly */
  weekday: number | null;
  nextDue: string;
  createdAt: string;
};

export type NewRecurringRuleInput = {
  kind: 'expense' | 'income';
  amount: number;
  category: string;
  tag?: string | null;
  note?: string | null;
  frequency: RecurringFrequency;
  dayOfMonth?: number | null;
  weekday?: number | null;
  nextDue: string;
};
