import { useState, useEffect, useCallback, useMemo } from 'react';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../firebase';
import type { AppState, Person, Expense, Payment } from '../types';

const COLORS = [
  '#3B82F6', '#EF4444', '#F59E0B', '#8B5CF6',
  '#EC4899', '#14B8A6', '#F97316', '#6366F1',
];

const EMPTY_STATE: AppState = { people: [], expenses: [], payments: [] };

export async function createGroup(code: string): Promise<void> {
  await setDoc(doc(db, 'groups', code), EMPTY_STATE);
}

export async function groupExists(code: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'groups', code));
  return snap.exists();
}

export function generateGroupCode(): string {
  // Avoid visually ambiguous characters (0/O, 1/I/L)
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export function useFirebaseStore(groupCode: string) {
  const [state, setState] = useState<AppState>(EMPTY_STATE);
  const [syncing, setSyncing] = useState(false);

  const docRef = useMemo(() => doc(db, 'groups', groupCode), [groupCode]);

  // Subscribe to real-time Firestore updates
  useEffect(() => {
    const unsubscribe = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        setState(snap.data() as AppState);
      }
    });
    return unsubscribe;
  }, [docRef]);

  // Write the full state back to Firestore
  const persist = useCallback(async (nextState: AppState) => {
    setSyncing(true);
    try {
      await setDoc(docRef, nextState);
    } finally {
      setSyncing(false);
    }
  }, [docRef]);

  // Optimistic update: apply locally immediately, then sync to Firestore
  const update = useCallback((updater: (s: AppState) => AppState) => {
    setState(prev => {
      const next = updater(prev);
      persist(next);
      return next;
    });
  }, [persist]);

  // ── People ──────────────────────────────────────────────────────
  const addPerson = useCallback((name: string) => {
    update(s => ({
      ...s,
      people: [
        ...s.people,
        { id: uuidv4(), name: name.trim(), color: COLORS[s.people.length % COLORS.length] },
      ],
    }));
  }, [update]);

  const removePerson = useCallback((id: string) => {
    update(s => ({ ...s, people: s.people.filter(p => p.id !== id) }));
  }, [update]);

  // ── Expenses ────────────────────────────────────────────────────
  const addExpense = useCallback((expense: Omit<Expense, 'id' | 'date'>) => {
    update(s => ({
      ...s,
      expenses: [{ ...expense, id: uuidv4(), date: new Date().toISOString() }, ...s.expenses],
    }));
  }, [update]);

  const removeExpense = useCallback((id: string) => {
    update(s => ({ ...s, expenses: s.expenses.filter(e => e.id !== id) }));
  }, [update]);

  const updateExpense = useCallback((id: string, expense: Omit<Expense, 'id' | 'date'>) => {
    update(s => ({
      ...s,
      expenses: s.expenses.map(e => e.id === id ? { ...expense, id, date: e.date } : e),
    }));
  }, [update]);

  // ── Payments ────────────────────────────────────────────────────
  const addPayment = useCallback((payment: Omit<Payment, 'id' | 'date'>) => {
    update(s => ({
      ...s,
      payments: [{ ...payment, id: uuidv4(), date: new Date().toISOString() }, ...s.payments],
    }));
  }, [update]);

  const removePayment = useCallback((id: string) => {
    update(s => ({ ...s, payments: s.payments.filter(p => p.id !== id) }));
  }, [update]);

  // ── Balance calculations ────────────────────────────────────────
  const getBalances = useCallback(() => {
    const balances: Record<string, number> = {};
    state.people.forEach(p => { balances[p.id] = 0; });

    state.expenses.forEach(expense => {
      balances[expense.paidBy] = (balances[expense.paidBy] ?? 0) + expense.total;
      expense.splits.forEach(split => {
        balances[split.personId] = (balances[split.personId] ?? 0) - split.amount;
      });
    });

    state.payments.forEach(payment => {
      balances[payment.fromPersonId] = (balances[payment.fromPersonId] ?? 0) + payment.amount;
      balances[payment.toPersonId] = (balances[payment.toPersonId] ?? 0) - payment.amount;
    });

    return balances;
  }, [state]);

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
      const amount = Math.round(Math.min(credit.amount, debt.amount) * 100) / 100;
      settlements.push({ from: debt.id, to: credit.id, amount });
      credit.amount -= amount;
      debt.amount -= amount;
      if (credit.amount < 0.005) ci++;
      if (debt.amount < 0.005) di++;
    }
    return settlements;
  }, [getBalances]);

  return {
    state,
    syncing,
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
