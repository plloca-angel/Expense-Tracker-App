export type SavingsGoal = {
  id: number;
  name: string;
  targetAmount: number;
  savedAmount: number;
  deadline: string | null;
  createdAt: string;
};
