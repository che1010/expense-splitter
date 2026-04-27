import { useState } from 'react';
import { useFirebaseStore } from './store/useFirebaseStore';
import GroupSetup from './components/GroupSetup';
import PeopleManager from './components/PeopleManager';
import ExpenseForm from './components/ExpenseForm';
import ExpenseList from './components/ExpenseList';
import PaymentForm from './components/PaymentForm';
import BalanceSummary from './components/BalanceSummary';
import ExportImport from './components/ExportImport';
import type { Expense, Payment } from './types';

const GROUP_CODE_KEY = 'splitease_group_code';

type Tab = 'expenses' | 'balances';
type Modal = null | 'expense' | 'payment';

interface PaymentPrefill {
  from?: string;
  to?: string;
  amount?: number;
}

// ── Inner app (requires a group code) ──────────────────────────────
function MainApp({ groupCode, onLeave }: { groupCode: string; onLeave: () => void }) {
  const store = useFirebaseStore(groupCode);
  const [tab, setTab] = useState<Tab>('expenses');
  const [modal, setModal] = useState<Modal>(null);
  const [paymentPrefill, setPaymentPrefill] = useState<PaymentPrefill>({});
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [copied, setCopied] = useState(false);

  const balances = store.getBalances();
  const settlements = store.getSettlements();

  const handleSaveExpense = (expense: Omit<Expense, 'id' | 'date'>) => {
    if (editingExpense) {
      store.updateExpense(editingExpense.id, expense);
    } else {
      store.addExpense(expense);
    }
    setModal(null);
    setEditingExpense(null);
  };

  const handleEditExpense = (id: string) => {
    const expense = store.state.expenses.find(e => e.id === id);
    if (expense) { setEditingExpense(expense); setModal('expense'); }
  };

  const handleAddPayment = (payment: Omit<Payment, 'id' | 'date'>) => {
    store.addPayment(payment);
    setModal(null);
    setPaymentPrefill({});
  };

  const handleSettle = (from: string, to: string, amount: number) => {
    setPaymentPrefill({ from, to, amount });
    setModal('payment');
  };

  const copyCode = () => {
    navigator.clipboard.writeText(groupCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const canAddExpense = store.state.people.length >= 2;
  const canRecordPayment = store.state.people.length >= 2;
  const totalSpent = store.state.expenses.reduce((s, e) => s + e.total, 0);

  return (
    // pb-28 on mobile makes room for the sticky bottom action bar
    <div className="min-h-screen bg-gray-50 pb-28 lg:pb-6">

      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">💸</span>
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">SplitEase</h1>
              <button
                onClick={copyCode}
                className="text-xs text-gray-400 hover:text-green-600 transition-colors font-mono"
                title="Click to copy group code"
              >
                {copied ? '✓ Copied!' : `Group: ${groupCode}`}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {store.syncing && (
              <span className="text-xs text-gray-400">Saving…</span>
            )}
            {/* Desktop-only buttons (bottom bar handles mobile) */}
            <button
              className="hidden lg:inline-flex btn-secondary text-xs py-1.5 px-3"
              onClick={() => { canRecordPayment && setModal('payment'); }}
              disabled={!canRecordPayment}
            >
              Record Payment
            </button>
            <button
              className="hidden lg:inline-flex btn-primary text-xs py-1.5 px-3"
              onClick={() => setModal('expense')}
              disabled={!canAddExpense}
              title={canAddExpense ? 'Add expense' : 'Add at least 2 people first'}
            >
              + Add Expense
            </button>
          </div>
        </div>
      </header>

      {/* ── Main content ─────────────────────────────────────────── */}
      <main className="max-w-4xl mx-auto px-4 py-5">
        {/*
          Mobile  → flex-col, DOM order: [summary+people] [tabs] [share+export+leave]
          Desktop → 3-col grid: left col = summary+people (row1) + share+export (row2)
                                right col = tabs spanning both rows
        */}
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-3 lg:items-start">

          {/* ── SECTION 1: Summary + People ──────────────────────── */}
          <div className="order-1 lg:col-start-1 lg:col-span-1 lg:row-start-1 space-y-4">

            {/* Summary card */}
            {store.state.expenses.length > 0 && (
              <div className="card">
                <h2 className="text-base font-bold text-gray-800 mb-3">Summary</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-lg px-3 py-3 text-center">
                    <p className="text-2xl font-bold text-gray-800">{store.state.expenses.length}</p>
                    <p className="text-xs text-gray-500">Expenses</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg px-3 py-3 text-center">
                    <p className="text-2xl font-bold text-green-600">${totalSpent.toFixed(2)}</p>
                    <p className="text-xs text-gray-500">Total spent</p>
                  </div>
                </div>
              </div>
            )}

            {/* People (collapsible) */}
            <PeopleManager
              people={store.state.people}
              onAdd={store.addPerson}
              onRemove={store.removePerson}
            />
          </div>

          {/* ── SECTION 2: Tabs + content ──────────────────────────
               On desktop this spans both rows of the right 2 columns */}
          <div className="order-2 lg:col-start-2 lg:col-span-2 lg:row-start-1 lg:row-span-2 space-y-4">

            {/* Tab bar */}
            <div className="flex border-b border-gray-200 bg-white rounded-t-xl px-1 pt-1 shadow-sm border border-gray-200">
              {(['expenses', 'balances'] as Tab[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 py-3 text-sm font-medium capitalize transition-colors rounded-t-lg ${
                    tab === t
                      ? 'bg-green-50 text-green-700 font-semibold'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {t}
                  {t === 'balances' && settlements.length > 0 && (
                    <span className="ml-1.5 bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5">
                      {settlements.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Inline modals */}
            {modal === 'expense' && (
              <ExpenseForm
                people={store.state.people}
                initialValues={editingExpense ?? undefined}
                onSave={handleSaveExpense}
                onCancel={() => { setModal(null); setEditingExpense(null); }}
              />
            )}

            {modal === 'payment' && (
              <PaymentForm
                people={store.state.people}
                suggestedFrom={paymentPrefill.from}
                suggestedTo={paymentPrefill.to}
                suggestedAmount={paymentPrefill.amount}
                onSave={handleAddPayment}
                onCancel={() => { setModal(null); setPaymentPrefill({}); }}
              />
            )}

            {/* Tab content */}
            {tab === 'expenses' && (
              <ExpenseList
                expenses={store.state.expenses}
                people={store.state.people}
                onRemove={store.removeExpense}
                onEdit={handleEditExpense}
              />
            )}

            {tab === 'balances' && (
              <BalanceSummary
                people={store.state.people}
                balances={balances}
                settlements={settlements}
                payments={store.state.payments}
                onRecordPayment={handleSettle}
                onRemovePayment={store.removePayment}
              />
            )}
          </div>

          {/* ── SECTION 3: Share + Export + Leave ──────────────────
               On desktop this sits below Section 1 in the left column */}
          <div className="order-3 lg:col-start-1 lg:col-span-1 lg:row-start-2 space-y-4">

            {/* Share this group */}
            <div className="card">
              <h2 className="text-base font-bold text-gray-800 mb-2">Share this group</h2>
              <p className="text-xs text-gray-500 mb-3">
                Anyone with this code can join on any device — no sign-in needed.
              </p>
              <button
                onClick={copyCode}
                className="w-full flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 hover:border-green-400 transition-colors group"
              >
                <span className="font-mono text-xl font-bold tracking-widest text-gray-800 group-hover:text-green-600">
                  {groupCode}
                </span>
                <span className="text-xs text-gray-400 group-hover:text-green-600">
                  {copied ? '✓ Copied!' : '⎘ Copy'}
                </span>
              </button>
            </div>

            {/* Backup & Restore */}
            <ExportImport
              state={store.state}
              balances={balances}
              settlements={settlements}
              groupCode={groupCode}
              onImport={store.replaceState}
            />

            {/* Leave group — visible danger button */}
            <button
              onClick={onLeave}
              className="btn-danger w-full py-3 text-sm"
            >
              🚪 Leave / Switch Group
            </button>
          </div>
        </div>
      </main>

      {/* ── Mobile sticky bottom action bar ─────────────────────────
           Hidden on lg screens where header buttons are used instead */}
      <div
        className="fixed bottom-0 inset-x-0 z-20 lg:hidden bg-white border-t border-gray-200 flex gap-3 px-4 pt-3"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <button
          className="btn-secondary flex-1 py-3 text-sm min-h-[48px]"
          onClick={() => { canRecordPayment && setModal('payment'); }}
          disabled={!canRecordPayment}
        >
          Record Payment
        </button>
        <button
          className="btn-primary flex-1 py-3 text-sm min-h-[48px]"
          onClick={() => setModal('expense')}
          disabled={!canAddExpense}
          title={canAddExpense ? 'Add expense' : 'Add at least 2 people first'}
        >
          + Add Expense
        </button>
      </div>
    </div>
  );
}

// ── Root: show GroupSetup if no code, else MainApp ─────────────────
export default function App() {
  const [groupCode, setGroupCode] = useState<string | null>(() =>
    localStorage.getItem(GROUP_CODE_KEY)
  );

  const handleJoin = (code: string) => {
    localStorage.setItem(GROUP_CODE_KEY, code);
    setGroupCode(code);
  };

  const handleLeave = () => {
    localStorage.removeItem(GROUP_CODE_KEY);
    setGroupCode(null);
  };

  if (!groupCode) {
    return <GroupSetup onJoin={handleJoin} />;
  }

  return <MainApp groupCode={groupCode} onLeave={handleLeave} />;
}
