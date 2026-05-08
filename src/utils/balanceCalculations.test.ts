import { describe, it, expect } from 'vitest';
import { computeBalances, computeSettlements, computeBilateralSettlements } from './balanceCalculations';
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

// ── computeBilateralSettlements ───────────────────────────────────────────────

describe('computeBilateralSettlements', () => {
  it('returns empty array when there are no expenses', () => {
    const s = computeBilateralSettlements(people, [], []);
    expect(s).toHaveLength(0);
  });

  it('shows one entry when only one person owes another', () => {
    // Alice pays $90 for everyone; Bob and Carol each owe Alice $30
    const expense = makeExpense('e1', 'alice', 90, [
      { personId: 'alice', amount: 30 },
      { personId: 'bob',   amount: 30 },
      { personId: 'carol', amount: 30 },
    ]);
    const s = computeBilateralSettlements(people, [expense], []);

    expect(s).toHaveLength(2);
    const bobToAlice   = s.find(t => t.from === 'bob'   && t.to === 'alice');
    const carolToAlice = s.find(t => t.from === 'carol' && t.to === 'alice');
    expect(bobToAlice?.amount).toBeCloseTo(30);
    expect(carolToAlice?.amount).toBeCloseTo(30);
  });

  it('nets bilateral debts when two people owe each other across different expenses', () => {
    // Alice pays $90 (Bob owes Alice $30, Carol owes Alice $30)
    // Bob pays $60 (Alice owes Bob $20, Carol owes Bob $20)
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
    ];
    const s = computeBilateralSettlements(people, expenses, []);

    // Alice↔Bob: Bob owes Alice $30, Alice owes Bob $20 → net Bob→Alice $10
    const bobToAlice = s.find(t => t.from === 'bob' && t.to === 'alice');
    expect(bobToAlice?.amount).toBeCloseTo(10);

    // No entry where Alice owes Bob
    expect(s.find(t => t.from === 'alice' && t.to === 'bob')).toBeUndefined();
  });

  it('real-world Hampton scenario: net creditor (Che) still owes net creditor (Guani) bilaterally', () => {
    // Reproduces the exact user scenario from the exported XLS.
    // Guani, Oca, Che  — abbreviated to alice=Guani, bob=Oca, carol=Che for reuse
    // Pre-Hampton expenses result in: Guani owes Che $118.64
    // Hampton (Guani pays, 3-way even split) means Che owes Guani $171.16
    // Net bilateral Che→Guani: 171.16 − 118.64 = $52.52

    const guani = makePerson('guani', 'Guani');
    const oca   = makePerson('oca',   'Oca');
    const che   = makePerson('che',   'Che');
    const trio  = [guani, oca, che];

    const expenses = [
      // HAMPTON – Guani pays, 3-way even split
      makeExpense('hampton', 'guani', 513.48, [
        { personId: 'guani', amount: 171.16 },
        { personId: 'oca',   amount: 171.16 },
        { personId: 'che',   amount: 171.16 },
      ]),
      // Noodles Asia – Che pays, 3-way split
      makeExpense('noodles', 'che', 225.84, [
        { personId: 'guani', amount: 75.28 },
        { personId: 'oca',   amount: 75.28 },
        { personId: 'che',   amount: 75.28 },
      ]),
      // YARD HOUSE DRINKS Stella – Che pays, Guani+Oca only (50/50)
      makeExpense('stella', 'che', 40.22, [
        { personId: 'guani', amount: 20.11 },
        { personId: 'oca',   amount: 20.11 },
      ]),
      // YARD HOUSE food – Che pays, 3-way split
      makeExpense('yard', 'che', 69.77, [
        { personId: 'guani', amount: 23.25 },
        { personId: 'oca',   amount: 23.26 },
        { personId: 'che',   amount: 23.26 },
      ]),
    ];

    const s = computeBilateralSettlements(trio, expenses, []);

    // Guani↔Che bilateral
    //   Guani owes Che:  75.28 + 20.11 + 23.25 = 118.64  (from Noodles, Stella, Yard House)
    //   Che owes Guani:  171.16                           (from Hampton)
    //   Net → Che owes Guani: 171.16 − 118.64 = 52.52
    const cheToGuani = s.find(t => t.from === 'che' && t.to === 'guani');
    expect(cheToGuani).toBeDefined();
    expect(cheToGuani?.amount).toBeCloseTo(52.52);

    // Guani should NOT appear as owing Che anything
    expect(s.find(t => t.from === 'guani' && t.to === 'che')).toBeUndefined();

    // Oca↔Guani: Oca owes Guani $171.16 (Hampton only, Guani not in Oca-paid expenses)
    const ocaToGuani = s.find(t => t.from === 'oca' && t.to === 'guani');
    expect(ocaToGuani?.amount).toBeCloseTo(171.16);

    // Oca↔Che: Oca owes Che for Noodles+Stella+Yard = 75.28+20.11+23.26 = 118.65
    const ocaToChe = s.find(t => t.from === 'oca' && t.to === 'che');
    expect(ocaToChe?.amount).toBeCloseTo(118.65);
  });

  it('reduces bilateral amounts when a payment is recorded between that pair', () => {
    const expense = makeExpense('e1', 'alice', 90, [
      { personId: 'alice', amount: 30 },
      { personId: 'bob',   amount: 30 },
      { personId: 'carol', amount: 30 },
    ]);
    const payment = makePayment('p1', 'bob', 'alice', 10);
    const s = computeBilateralSettlements(people, [expense], [payment]);

    const bobToAlice = s.find(t => t.from === 'bob' && t.to === 'alice');
    expect(bobToAlice?.amount).toBeCloseTo(20); // 30 − 10 payment
  });

  it('removes a pair entry entirely once fully paid', () => {
    const expense = makeExpense('e1', 'alice', 90, [
      { personId: 'alice', amount: 30 },
      { personId: 'bob',   amount: 30 },
      { personId: 'carol', amount: 30 },
    ]);
    const payments = [
      makePayment('p1', 'bob',   'alice', 30),
      makePayment('p2', 'carol', 'alice', 30),
    ];
    const s = computeBilateralSettlements(people, [expense], payments);
    expect(s).toHaveLength(0);
  });

  it('applying all bilateral settlements zeros every balance', () => {
    // After all bilateral payments are recorded, computeBalances should return all zeros.
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

    const settlements = computeBilateralSettlements(people, expenses, []);
    const asPayments: Payment[] = settlements.map((s, i) =>
      makePayment(`p${i}`, s.from, s.to, s.amount),
    );

    const finalBalances = computeBalances(people, expenses, asPayments);
    expect(finalBalances.alice).toBeCloseTo(0);
    expect(finalBalances.bob).toBeCloseTo(0);
    expect(finalBalances.carol).toBeCloseTo(0);
  });
});
