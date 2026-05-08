import type { Person, Expense, Payment } from '../types';

export type Balances = Record<string, number>;

export interface Settlement {
  from: string;
  to: string;
  amount: number;
}

export function computeBalances(
  people: Person[],
  expenses: Expense[],
  payments: Payment[],
): Balances {
  const balances: Balances = {};
  people.forEach(p => { balances[p.id] = 0; });

  expenses.forEach(expense => {
    balances[expense.paidBy] = (balances[expense.paidBy] ?? 0) + expense.total;
    expense.splits.forEach(split => {
      balances[split.personId] = (balances[split.personId] ?? 0) - split.amount;
    });
  });

  // fromPersonId is the payer (debtor): paying reduces their debt → balance increases
  // toPersonId is the receiver (creditor): receiving reduces what's owed to them → balance decreases
  payments.forEach(payment => {
    balances[payment.fromPersonId] = (balances[payment.fromPersonId] ?? 0) + payment.amount;
    balances[payment.toPersonId] = (balances[payment.toPersonId] ?? 0) - payment.amount;
  });

  return balances;
}

export function computeSettlements(balances: Balances): Settlement[] {
  const creditors: { id: string; amount: number }[] = [];
  const debtors: { id: string; amount: number }[] = [];

  Object.entries(balances).forEach(([id, amount]) => {
    if (amount > 0.005) creditors.push({ id, amount });
    else if (amount < -0.005) debtors.push({ id, amount: -amount });
  });

  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const settlements: Settlement[] = [];
  let ci = 0, di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const credit = creditors[ci];
    const debt = debtors[di];
    const amount = Math.min(credit.amount, debt.amount);

    settlements.push({ from: debt.id, to: credit.id, amount: Math.round(amount * 100) / 100 });

    credit.amount -= amount;
    debt.amount -= amount;

    if (credit.amount < 0.005) ci++;
    if (debt.amount < 0.005) di++;
  }

  return settlements;
}
