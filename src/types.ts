export interface Person {
  id: string;
  name: string;
  color: string;
}

export type SplitType = 'even' | 'percentage' | 'custom' | 'full';

export interface Split {
  personId: string;
  amount: number;
  percentage: number;
}

export interface LineItem {
  id: string;
  description: string;
  price: number;
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
  items?: LineItem[];
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
  groupName?: string;
  groupNameLower?: string;   // lowercase copy used for case-insensitive search
  people: Person[];
  expenses: Expense[];
  payments: Payment[];
}

export interface GroupSearchResult {
  code: string;
  groupName: string;
}
