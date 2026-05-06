export type AccountKind = 'cash' | 'card' | 'bank' | 'other';

export type Account = {
  id: number;
  name: string;
  kind: AccountKind;
  sortOrder: number;
};
