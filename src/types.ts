export interface Person {
  id: string;
  name: string;
  color: string;
}

export type SplitType = 'even' | 'percentage' | 'custom';

export interface Split {
  personId: string;
  amount: number;
  percentage: number;
}

export interface Expense {
  id: string;
  title: string;
  paidBy: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  tipRate: number;
  tipAmount: number;
  total: number;
  splitType: SplitType;
  splits: Split[];
  date: string;
  note: string;
}

export interface Payment {
  id: string;
  fromPersonId: string;
  toPersonId: string;
  amount: number;
  date: string;
  note: string;
  expenseId?: string;
}

export interface AppState {
  people: Person[];
  expenses: Expense[];
  payments: Payment[];
}
