import type { Person, Expense, Payment } from '../types';

export type Balances = Record<string, number>;

export interface Settlement {
  from: string;
  to: string;
  amount: number;
}

/**
 * Compute per-pair bilateral settlements.
 * For every (A, B) pair, net what A owes B against what B owes A across all
 * expenses and payments. The result shows exactly who owes whom — even when
 * both parties are net creditors overall.
 */
export function computeBilateralSettlements(
  people: Person[],
  expenses: Expense[],
  payments: Payment[],
): Settlement[] {
  // gross[a][b] = total amount a owes b before netting
  const gross: Record<string, Record<string, number>> = {};
  people.forEach(p => { gross[p.id] = {}; });

  // Each non-payer split member owes the payer their share
  expenses.forEach(expense => {
    expense.splits.forEach(split => {
      if (split.personId === expense.paidBy) return;
      const from = split.personId;
      const to   = expense.paidBy;
      gross[from][to] = (gross[from][to] ?? 0) + split.amount;
    });
  });

  // Recorded payments reduce the gross bilateral debt
  payments.forEach(payment => {
    const { fromPersonId: from, toPersonId: to, amount } = payment;
    gross[from][to] = (gross[from][to] ?? 0) - amount;
  });

  // Net each pair — only the larger side survives
  const settlements: Settlement[] = [];
  const seen = new Set<string>();

  people.forEach(a => {
    people.forEach(b => {
      if (a.id === b.id) return;
      const key = [a.id, b.id].sort().join('|');
      if (seen.has(key)) return;
      seen.add(key);

      const aOwesB = gross[a.id]?.[b.id] ?? 0;
      const bOwesA = gross[b.id]?.[a.id] ?? 0;
      const net = aOwesB - bOwesA;

      if (net > 0.005) {
        settlements.push({ from: a.id, to: b.id, amount: Math.round(net * 100) / 100 });
      } else if (net < -0.005) {
        settlements.push({ from: b.id, to: a.id, amount: Math.round(-net * 100) / 100 });
      }
    });
  });

  return settlements;
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
