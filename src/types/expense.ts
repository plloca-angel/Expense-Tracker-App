export type Expense = {
  id: number;
  amount: number;
  category: string;
  tag: string | null;
  note: string | null;
  date: string;
  createdAt: string;
  accountId: number | null;
};
