export type RecurringKind = 'expense' | 'income';

export type RecurringItem = {
  id: number;
  title: string;
  amount: number;
  category: string;
  kind: RecurringKind;
  dayOfMonth: number;
  accountId: number | null;
  note: string | null;
  active: boolean;
  lastPostedYm: string | null;
  createdAt: string;
};
