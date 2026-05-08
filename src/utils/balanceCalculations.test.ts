import { describe, it, expect } from 'vitest';
import { computeBalances, computeSettlements } from './balanceCalculations';
import type { Person, Expense, Payment } from '../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePerson(id: string, name: string): Person {
  return { id, name, color: '#000' };
}

function makeExpense(
  id: string,
  paidBy: string,
  total: number,
  splits: { personId: string; amount: number }[],
): Expense {
  return {
    id,
    title: id,
    note: '',
    paidBy,
    subtotal: total,
    taxRate: 0,
    taxAmount: 0,
    tipRate: 0,
    tipAmount: 0,
    total,
    splitType: 'custom',
    splits: splits.map(s => ({ ...s, percentage: 0 })),
    date: new Date().toISOString(),
  };
}

function makePayment(id: string, from: string, to: string, amount: number): Payment {
  return { id, fromPersonId: from, toPersonId: to, amount, date: new Date().toISOString(), note: '' };
}

const alice = makePerson('alice', 'Alice');
const bob   = makePerson('bob',   'Bob');
const carol = makePerson('carol', 'Carol');
const people = [alice, bob, carol];

// ── computeBalances ───────────────────────────────────────────────────────────

describe('computeBalances', () => {
  it('returns all-zero balances when there are no expenses or payments', () => {
    const b = computeBalances(people, [], []);
    expect(b.alice).toBe(0);
    expect(b.bob).toBe(0);
    expect(b.carol).toBe(0);
  });

  it('correctly credits the payer and debits all participants for a single even-split expense', () => {
    // Alice pays $90, split evenly: each owes $30
    const expense = makeExpense('e1', 'alice', 90, [
      { personId: 'alice', amount: 30 },
      { personId: 'bob',   amount: 30 },
      { personId: 'carol', amount: 30 },
    ]);
    const b = computeBalances(people, [expense], []);

    expect(b.alice).toBeCloseTo(60);   // paid $90, owes $30 → net +$60
    expect(b.bob).toBeCloseTo(-30);    // owes $30
    expect(b.carol).toBeCloseTo(-30);  // owes $30
    expect(b.alice + b.bob + b.carol).toBeCloseTo(0); // sum always zero
  });

  it('handles 3 people each paying a different expense (even splits)', () => {
    // Alice pays $90  ($30 each)
    // Bob   pays $60  ($20 each)
    // Carol pays $30  ($10 each)
    const expenses = [
      makeExpense('e1', 'alice', 90, [
        { personId: 'alice', amount: 30 },
        { personId: 'bob',   amount: 30 },
        { personId: 'carol', amount: 30 },
      ]),
      makeExpense('e2', 'bob', 60, [
        { personId: 'alice', amount: 20 },
        { personId: 'bob',   amount: 20 },
        { personId: 'carol', amount: 20 },
      ]),
      makeExpense('e3', 'carol', 30, [
        { personId: 'alice', amount: 10 },
        { personId: 'bob',   amount: 10 },
        { personId: 'carol', amount: 10 },
      ]),
    ];
    const b = computeBalances(people, expenses, []);

    // Alice: +90 -30 -20 -10 = +30
    // Bob:   +60 -30 -20 -10 =   0
    // Carol: +30 -30 -20 -10 = -30
    expect(b.alice).toBeCloseTo(30);
    expect(b.bob).toBeCloseTo(0);
    expect(b.carol).toBeCloseTo(-30);
    expect(b.alice + b.bob + b.carol).toBeCloseTo(0);
  });

  it('handles 3 people paying unequal amounts with unequal splits', () => {
    // Alice pays $120 (Alice $60, Bob $40, Carol $20)
    // Bob   pays $30  (Alice $15, Bob $10, Carol $5)
    // Carol pays $50  (Alice $25, Bob $15, Carol $10)
    const expenses = [
      makeExpense('e1', 'alice', 120, [
        { personId: 'alice', amount: 60 },
        { personId: 'bob',   amount: 40 },
        { personId: 'carol', amount: 20 },
      ]),
      makeExpense('e2', 'bob', 30, [
        { personId: 'alice', amount: 15 },
        { personId: 'bob',   amount: 10 },
        { personId: 'carol', amount: 5 },
      ]),
      makeExpense('e3', 'carol', 50, [
        { personId: 'alice', amount: 25 },
        { personId: 'bob',   amount: 15 },
        { personId: 'carol', amount: 10 },
      ]),
    ];
    const b = computeBalances(people, expenses, []);

    // Alice: +120 -60 -15 -25 = +20
    // Bob:    +30 -40 -10 -15 = -35
    // Carol:  +50 -20  -5 -10 = +15
    expect(b.alice).toBeCloseTo(20);
    expect(b.bob).toBeCloseTo(-35);
    expect(b.carol).toBeCloseTo(15);
    expect(b.alice + b.bob + b.carol).toBeCloseTo(0);
  });

  it('reduces debt correctly when the debtor records a payment', () => {
    const expense = makeExpense('e1', 'alice', 90, [
      { personId: 'alice', amount: 30 },
      { personId: 'bob',   amount: 30 },
      { personId: 'carol', amount: 30 },
    ]);
    // Bob pays Alice $30 to settle
    const payment = makePayment('p1', 'bob', 'alice', 30);
    const b = computeBalances(people, [expense], [payment]);

    expect(b.alice).toBeCloseTo(30);  // was +60, received 30 → +30
    expect(b.bob).toBeCloseTo(0);     // was -30, paid 30 → 0
    expect(b.carol).toBeCloseTo(-30); // unchanged
    expect(b.alice + b.bob + b.carol).toBeCloseTo(0);
  });

  it('fully settles all debts when both debtors pay the correct amounts', () => {
    const expense = makeExpense('e1', 'alice', 90, [
      { personId: 'alice', amount: 30 },
      { personId: 'bob',   amount: 30 },
      { personId: 'carol', amount: 30 },
    ]);
    const payments = [
      makePayment('p1', 'bob',   'alice', 30),
      makePayment('p2', 'carol', 'alice', 30),
    ];
    const b = computeBalances(people, [expense], payments);

    expect(b.alice).toBeCloseTo(0);
    expect(b.bob).toBeCloseTo(0);
    expect(b.carol).toBeCloseTo(0);
  });

  it('does NOT worsen balances when a payment is recorded (regression guard)', () => {
    // With the old inverted-sign bug, Bob paying Alice would make Bob's balance
    // MORE negative (-60) and Alice's MORE positive (+90) instead of settling.
    const expense = makeExpense('e1', 'alice', 90, [
      { personId: 'alice', amount: 30 },
      { personId: 'bob',   amount: 30 },
      { personId: 'carol', amount: 30 },
    ]);
    const payment = makePayment('p1', 'bob', 'alice', 30);
    const b = computeBalances(people, [expense], [payment]);

    expect(b.bob).not.toBeCloseTo(-60);
    expect(b.bob).toBeCloseTo(0);
    expect(b.alice).toBeCloseTo(30);  // not +90
  });
});

// ── computeSettlements ────────────────────────────────────────────────────────

describe('computeSettlements', () => {
  it('returns empty array when all balances are zero', () => {
    const s = computeSettlements({ alice: 0, bob: 0, carol: 0 });
    expect(s).toHaveLength(0);
  });

  it('produces settlements covering the full credit when one debtor owes one creditor', () => {
    const s = computeSettlements({ alice: 60, bob: -30, carol: -30 });
    expect(s).toHaveLength(2);
    const total = s.reduce((sum, t) => sum + t.amount, 0);
    expect(total).toBeCloseTo(60);
    s.forEach(t => expect(t.to).toBe('alice'));
  });

  it('correctly settles 3-person scenario where Carol owes Alice', () => {
    // From the 3-different-expenses test: alice=+30, bob=0, carol=-30
    const b = computeBalances(
      people,
      [
        makeExpense('e1', 'alice', 90, [
          { personId: 'alice', amount: 30 },
          { personId: 'bob',   amount: 30 },
          { personId: 'carol', amount: 30 },
        ]),
        makeExpense('e2', 'bob', 60, [
          { personId: 'alice', amount: 20 },
          { personId: 'bob',   amount: 20 },
          { personId: 'carol', amount: 20 },
        ]),
        makeExpense('e3', 'carol', 30, [
          { personId: 'alice', amount: 10 },
          { personId: 'bob',   amount: 10 },
          { personId: 'carol', amount: 10 },
        ]),
      ],
      [],
    );
    const s = computeSettlements(b);

    expect(s).toHaveLength(1);
    expect(s[0].from).toBe('carol');
    expect(s[0].to).toBe('alice');
    expect(s[0].amount).toBeCloseTo(30);
  });

  it('settles with minimum transactions when one debtor owes multiple creditors', () => {
    // Alice=+40, Bob=+10, Carol=-50
    const s = computeSettlements({ alice: 40, bob: 10, carol: -50 });
    expect(s).toHaveLength(2);
    const toAlice = s.find(t => t.to === 'alice');
    const toBob   = s.find(t => t.to === 'bob');
    expect(toAlice?.from).toBe('carol');
    expect(toAlice?.amount).toBeCloseTo(40);
    expect(toBob?.from).toBe('carol');
    expect(toBob?.amount).toBeCloseTo(10);
  });

  it('settles correctly after a partial payment reduces one debt', () => {
    const expense = makeExpense('e1', 'alice', 90, [
      { personId: 'alice', amount: 30 },
      { personId: 'bob',   amount: 30 },
      { personId: 'carol', amount: 30 },
    ]);
    // Bob partially pays $10; alice=+50, bob=-20, carol=-30
    const payment = makePayment('p1', 'bob', 'alice', 10);
    const b = computeBalances(people, [expense], [payment]);
    const s = computeSettlements(b);

    const fromBob   = s.find(t => t.from === 'bob');
    const fromCarol = s.find(t => t.from === 'carol');
    expect(fromBob?.amount).toBeCloseTo(20);
    expect(fromCarol?.amount).toBeCloseTo(30);
  });
});
