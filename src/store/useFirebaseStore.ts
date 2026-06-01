import { useState, useEffect, useCallback, useMemo } from 'react';
import { doc, onSnapshot, setDoc, getDoc, collection, getDocs } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../firebase';
import type { AppState, Person, Expense, Payment, GroupSearchResult } from '../types';
import { computeBalances, computeBilateralSettlements } from '../utils/balanceCalculations';

const COLORS = [
  '#3B82F6', '#EF4444', '#F59E0B', '#8B5CF6',
  '#EC4899', '#14B8A6', '#F97316', '#6366F1',
];

const EMPTY_STATE: AppState = { people: [], expenses: [], payments: [] };

export async function createGroup(code: string, name?: string): Promise<void> {
  const groupName = name?.trim() || `Group_${code}`;
  await setDoc(doc(db, 'groups', code), {
    ...EMPTY_STATE,
    groupName,
    groupNameLower: groupName.toLowerCase(),
  });
}

export async function searchGroupsByName(input: string): Promise<GroupSearchResult[]> {
  const lower = input.trim().toLowerCase();
  // Fetch all groups and filter client-side for case-insensitive contains match.
  // Appropriate for this app's scale (small number of groups per user).
  const snap = await getDocs(collection(db, 'groups'));
  return snap.docs
    .filter(d => {
      const data = d.data() as AppState;
      // Use stored lowercase field if available; fall back to lowercasing on the fly
      const nameLower = data.groupNameLower ?? data.groupName?.toLowerCase() ?? '';
      return nameLower.includes(lower);
    })
    .map(d => ({
      code: d.id,
      groupName: (d.data() as AppState).groupName ?? `Group_${d.id}`,
    }));
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
      // JSON round-trip strips `undefined` fields; Firestore rejects them and
      // would silently fail, reverting the optimistic update via onSnapshot.
      const clean = JSON.parse(JSON.stringify(nextState)) as AppState;
      await setDoc(docRef, clean);
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
  const addExpense = useCallback((expense: Omit<Expense, 'id'>) => {
    update(s => ({
      ...s,
      expenses: [{ ...expense, id: uuidv4() }, ...s.expenses],
    }));
  }, [update]);

  const removeExpense = useCallback((id: string) => {
    update(s => ({ ...s, expenses: s.expenses.filter(e => e.id !== id) }));
  }, [update]);

  const updateExpense = useCallback((id: string, expense: Omit<Expense, 'id'>) => {
    update(s => ({
      ...s,
      expenses: s.expenses.map(e => e.id === id ? { ...expense, id } : e),
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

  const replaceState = useCallback((newState: AppState) => {
    update(() => newState);
  }, [update]);

  const updateGroupName = useCallback((name: string) => {
    const trimmed = name.trim() || `Group_${groupCode}`;
    update(s => ({
      ...s,
      groupName: trimmed,
      groupNameLower: trimmed.toLowerCase(),
    }));
  }, [update, groupCode]);

  // ── Balance calculations ────────────────────────────────────────
  const getBalances = useCallback(
    () => computeBalances(state.people, state.expenses, state.payments),
    [state],
  );

  const getSettlements = useCallback(
    () => computeBilateralSettlements(state.people, state.expenses, state.payments),
    [state],
  );

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
    replaceState,
    updateGroupName,
    getBalances,
    getSettlements,
  };
}
