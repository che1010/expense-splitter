import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { AppState, Person, Expense, Payment } from '../types';
import { computeBalances, computeBilateralSettlements } from '../utils/balanceCalculations';

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

  const addExpense = useCallback((expense: Omit<Expense, 'id'>) => {
    update(s => ({
      ...s,
      expenses: [
        { ...expense, id: uuidv4() },
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

  const updateExpense = useCallback((id: string, expense: Omit<Expense, 'id'>) => {
    update(s => ({
      ...s,
      expenses: s.expenses.map(e => e.id === id ? { ...expense, id } : e),
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

  // Compute net balance for each person: positive = others owe them, negative = they owe others
  const getBalances = useCallback(
    () => computeBalances(state.people, state.expenses, state.payments),
    [state],
  );

  // Bilateral settlements: one entry per pair showing exact who-owes-whom
  const getSettlements = useCallback(
    () => computeBilateralSettlements(state.people, state.expenses, state.payments),
    [state],
  );

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
