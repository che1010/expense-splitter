import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { AppState, Person, Expense, Payment } from '../types';

const COLORS = [
  '#3B82F6', '#EF4444', '#F59E0B', '#8B5CF6',
  '#EC4899', '#14B8A6', '#F97316', '#6366F1',
];

const STORAGE_KEY = 'splitease_data';

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { people: [], expenses: [], payments: [] };
}

function saveState(state: AppState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function useAppStore() {
  const [state, setState] = useState<AppState>(loadState);

  const update = useCallback((updater: (s: AppState) => AppState) => {
    setState(prev => {
      const next = updater(prev);
      saveState(next);
      return next;
    });
  }, []);

  const addPerson = useCallback((name: string) => {
    update(s => ({
      ...s,
      people: [
        ...s.people,
        {
          id: uuidv4(),
          name: name.trim(),
          color: COLORS[s.people.length % COLORS.length],
        },
      ],
    }));
  }, [update]);

  const removePerson = useCallback((id: string) => {
    update(s => ({
      ...s,
      people: s.people.filter(p => p.id !== id),
    }));
  }, [update]);

  const addExpense = useCallback((expense: Omit<Expense, 'id' | 'date'>) => {
    update(s => ({
      ...s,
      expenses: [
        { ...expense, id: uuidv4(), date: new Date().toISOString() },
        ...s.expenses,
      ],
    }));
  }, [update]);

  const removeExpense = useCallback((id: string) => {
    update(s => ({
      ...s,
      expenses: s.expenses.filter(e => e.id !== id),
    }));
  }, [update]);

  const updateExpense = useCallback((id: string, expense: Omit<Expense, 'id' | 'date'>) => {
    update(s => ({
      ...s,
      expenses: s.expenses.map(e => e.id === id ? { ...expense, id, date: e.date } : e),
    }));
  }, [update]);

  const addPayment = useCallback((payment: Omit<Payment, 'id' | 'date'>) => {
    update(s => ({
      ...s,
      payments: [
        { ...payment, id: uuidv4(), date: new Date().toISOString() },
        ...s.payments,
      ],
    }));
  }, [update]);

  const removePayment = useCallback((id: string) => {
    update(s => ({
      ...s,
      payments: s.payments.filter(p => p.id !== id),
    }));
  }, [update]);

  // Compute net balance for each person:
  // positive = others owe them, negative = they owe others
  const getBalances = useCallback(() => {
    const balances: Record<string, number> = {};
    state.people.forEach(p => { balances[p.id] = 0; });

    state.expenses.forEach(expense => {
      // Payer paid the full total
      balances[expense.paidBy] = (balances[expense.paidBy] ?? 0) + expense.total;
      // Each person owes their split amount
      expense.splits.forEach(split => {
        balances[split.personId] = (balances[split.personId] ?? 0) - split.amount;
      });
    });

    // Payments settle balances: payer's debt reduces, receiver's credit reduces
    state.payments.forEach(payment => {
      balances[payment.fromPersonId] = (balances[payment.fromPersonId] ?? 0) + payment.amount;
      balances[payment.toPersonId] = (balances[payment.toPersonId] ?? 0) - payment.amount;
    });

    return balances;
  }, [state]);

  // Minimal set of transactions to settle all debts
  const getSettlements = useCallback(() => {
    const balances = getBalances();
    const creditors: { id: string; amount: number }[] = [];
    const debtors: { id: string; amount: number }[] = [];

    Object.entries(balances).forEach(([id, amount]) => {
      if (amount > 0.005) creditors.push({ id, amount });
      else if (amount < -0.005) debtors.push({ id, amount: -amount });
    });

    creditors.sort((a, b) => b.amount - a.amount);
    debtors.sort((a, b) => b.amount - a.amount);

    const settlements: { from: string; to: string; amount: number }[] = [];
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
  }, [getBalances]);

  return {
    state,
    addPerson,
    removePerson,
    addExpense,
    removeExpense,
    updateExpense,
    addPayment,
    removePayment,
    getBalances,
    getSettlements,
  };
}
