import * as XLSX from 'xlsx';
import type { AppState, Person, Expense, Payment } from '../types';

type Row = (string | number)[];

// ── Export ────────────────────────────────────────────────────────────

function buildPeopleSheet(people: Person[]) {
  const rows: Row[] = [
    ['ID', 'Name', 'Color'],
    ...people.map(p => [p.id, p.name, p.color]),
  ];
  return XLSX.utils.aoa_to_sheet(rows);
}

function buildExpensesSheet(expenses: Expense[], people: Person[]) {
  const nameMap = Object.fromEntries(people.map(p => [p.id, p.name]));
  const rows: Row[] = [
    [
      'ID', 'Date', 'Title', 'Paid By', 'Subtotal', 'Tax Rate (%)',
      'Tax Amount', 'Tip Rate (%)', 'Tip Amount', 'Total',
      'Split Type', 'Note',
    ],
    ...expenses.map(e => [
      e.id,
      e.date,
      e.title,
      nameMap[e.paidBy] ?? e.paidBy,
      e.subtotal,
      e.taxRate,
      e.taxAmount,
      e.tipRate,
      e.tipAmount,
      e.total,
      e.splitType,
      e.note,
    ]),
  ];
  return XLSX.utils.aoa_to_sheet(rows);
}

function buildSplitsSheet(expenses: Expense[], people: Person[]) {
  const nameMap = Object.fromEntries(people.map(p => [p.id, p.name]));
  const rows: Row[] = [
    ['Expense ID', 'Expense Title', 'Person', 'Amount', 'Percentage'],
  ];
  expenses.forEach(e => {
    e.splits.forEach(s => {
      rows.push([
        e.id,
        e.title,
        nameMap[s.personId] ?? s.personId,
        s.amount,
        s.percentage,
      ]);
    });
  });
  return XLSX.utils.aoa_to_sheet(rows);
}

function buildPaymentsSheet(payments: Payment[], people: Person[]) {
  const nameMap = Object.fromEntries(people.map(p => [p.id, p.name]));
  const rows: Row[] = [
    ['ID', 'Date', 'From', 'To', 'Amount', 'Note'],
    ...payments.map(p => [
      p.id,
      p.date,
      nameMap[p.fromPersonId] ?? p.fromPersonId,
      nameMap[p.toPersonId] ?? p.toPersonId,
      p.amount,
      p.note,
    ]),
  ];
  return XLSX.utils.aoa_to_sheet(rows);
}

function buildBalancesSheet(
  state: AppState,
  balances: Record<string, number>,
  settlements: { from: string; to: string; amount: number }[],
) {
  const nameMap = Object.fromEntries(state.people.map(p => [p.id, p.name]));

  const rows: Row[] = [
    ['Person', 'Net Balance'],
    ...state.people.map(p => [p.name, balances[p.id] ?? 0]),
    [],
    ['Suggested Settlements'],
    ['From', 'To', 'Amount'],
    ...settlements.map(s => [
      nameMap[s.from] ?? s.from,
      nameMap[s.to] ?? s.to,
      s.amount,
    ]),
  ];

  return XLSX.utils.aoa_to_sheet(rows);
}

export function exportToSpreadsheet(
  state: AppState,
  balances: Record<string, number>,
  settlements: { from: string; to: string; amount: number }[],
  groupCode: string,
) {
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, buildPeopleSheet(state.people), 'People');
  XLSX.utils.book_append_sheet(wb, buildExpensesSheet(state.expenses, state.people), 'Expenses');
  XLSX.utils.book_append_sheet(wb, buildSplitsSheet(state.expenses, state.people), 'Splits');
  XLSX.utils.book_append_sheet(wb, buildPaymentsSheet(state.payments, state.people), 'Payments');
  XLSX.utils.book_append_sheet(wb, buildBalancesSheet(state, balances, settlements), 'Balances');

  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `splitease-${groupCode}-${date}.xlsx`);
}

// ── Import ────────────────────────────────────────────────────────────

export type ImportResult =
  | { ok: true; state: AppState; warnings: string[] }
  | { ok: false; error: string };

type SheetRow = Record<string, unknown>;

export function importFromSpreadsheet(file: File): Promise<ImportResult> {
  return new Promise(resolve => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const warnings: string[] = [];

        // ── People sheet ──────────────────────────────────────────────
        const peopleSheet = wb.Sheets['People'];
        if (!peopleSheet) {
          resolve({ ok: false, error: 'Missing "People" sheet. Is this a SplitEase export?' });
          return;
        }
        const peopleRaw: SheetRow[] = XLSX.utils.sheet_to_json(peopleSheet);
        const people: Person[] = peopleRaw
          .map((row: SheetRow) => ({
            id: String(row['ID'] ?? ''),
            name: String(row['Name'] ?? ''),
            color: String(row['Color'] ?? '#6366F1'),
          }))
          .filter((p: Person) => p.id && p.name);

        if (people.length === 0) {
          warnings.push('No people rows found — group will be empty.');
        }

        const nameToId = Object.fromEntries(people.map(p => [p.name, p.id]));

        // ── Expenses sheet ────────────────────────────────────────────
        const expenseSheet = wb.Sheets['Expenses'];
        const splitsSheet = wb.Sheets['Splits'];

        const expensesRaw: SheetRow[] = expenseSheet
          ? XLSX.utils.sheet_to_json(expenseSheet)
          : [];

        // Build splits map: expenseId → splits[]
        const splitsMap: Record<string, { personId: string; amount: number; percentage: number }[]> = {};
        if (splitsSheet) {
          const splitsRaw: SheetRow[] = XLSX.utils.sheet_to_json(splitsSheet);
          splitsRaw.forEach((row: SheetRow) => {
            const eid = String(row['Expense ID'] ?? '');
            const personName = String(row['Person'] ?? '');
            const personId = nameToId[personName] ?? personName;
            if (!eid) return;
            if (!splitsMap[eid]) splitsMap[eid] = [];
            splitsMap[eid].push({
              personId,
              amount: Number(row['Amount'] ?? 0),
              percentage: Number(row['Percentage'] ?? 0),
            });
          });
        }

        const expenses: Expense[] = expensesRaw
          .map((row: SheetRow) => {
            const id = String(row['ID'] ?? '');
            const paidByName = String(row['Paid By'] ?? '');
            return {
              id,
              date: String(row['Date'] ?? new Date().toISOString()),
              title: String(row['Title'] ?? 'Untitled'),
              paidBy: nameToId[paidByName] ?? paidByName,
              subtotal: Number(row['Subtotal'] ?? 0),
              taxRate: Number(row['Tax Rate (%)'] ?? 0),
              taxAmount: Number(row['Tax Amount'] ?? 0),
              tipRate: Number(row['Tip Rate (%)'] ?? 0),
              tipAmount: Number(row['Tip Amount'] ?? 0),
              total: Number(row['Total'] ?? 0),
              splitType: String(row['Split Type'] ?? 'even') as Expense['splitType'],
              splits: splitsMap[id] ?? [],
              note: String(row['Note'] ?? ''),
            };
          })
          .filter((e: Expense) => e.id);

        // ── Payments sheet ────────────────────────────────────────────
        const paymentsSheet = wb.Sheets['Payments'];
        const paymentsRaw: SheetRow[] = paymentsSheet
          ? XLSX.utils.sheet_to_json(paymentsSheet)
          : [];

        const payments: Payment[] = paymentsRaw
          .map((row: SheetRow) => ({
            id: String(row['ID'] ?? ''),
            date: String(row['Date'] ?? new Date().toISOString()),
            fromPersonId: nameToId[String(row['From'] ?? '')] ?? String(row['From'] ?? ''),
            toPersonId: nameToId[String(row['To'] ?? '')] ?? String(row['To'] ?? ''),
            amount: Number(row['Amount'] ?? 0),
            note: String(row['Note'] ?? ''),
          }))
          .filter((p: Payment) => p.id);

        resolve({
          ok: true,
          state: { people, expenses, payments },
          warnings,
        });
      } catch (err) {
        resolve({ ok: false, error: `Failed to parse file: ${(err as Error).message}` });
      }
    };

    reader.onerror = () => resolve({ ok: false, error: 'Could not read the file.' });
    reader.readAsArrayBuffer(file);
  });
}
