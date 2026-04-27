import { useState } from 'react';
import { useFirebaseStore } from './store/useFirebaseStore';
import GroupSetup from './components/GroupSetup';
import PeopleManager from './components/PeopleManager';
import ExpenseForm from './components/ExpenseForm';
import ExpenseList from './components/ExpenseList';
import PaymentForm from './components/PaymentForm';
import BalanceSummary from './components/BalanceSummary';
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
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
              <span className="text-xs text-gray-400 hidden sm:block">Saving…</span>
            )}
            <button
              className="btn-secondary text-xs py-1.5 px-3"
              onClick={() => { store.state.people.length >= 2 && setModal('payment'); }}
              disabled={store.state.people.length < 2}
            >
              Record Payment
            </button>
            <button
              className="btn-primary text-xs py-1.5 px-3"
              onClick={() => setModal('expense')}
              disabled={!canAddExpense}
              title={canAddExpense ? 'Add expense' : 'Add at least 2 people first'}
            >
              + Add Expense
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left column: People + Summary + Leave */}
          <div className="lg:col-span-1 space-y-4">
            <PeopleManager
              people={store.state.people}
              onAdd={store.addPerson}
              onRemove={store.removePerson}
            />

            {store.state.expenses.length > 0 && (
              <div className="card">
                <h2 className="text-base font-bold text-gray-800 mb-3">Summary</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-lg px-3 py-2 text-center">
                    <p className="text-xl font-bold text-gray-800">{store.state.expenses.length}</p>
                    <p className="text-xs text-gray-500">Expenses</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg px-3 py-2 text-center">
                    <p className="text-xl font-bold text-green-600">
                      ${store.state.expenses.reduce((s, e) => s + e.total, 0).toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500">Total spent</p>
                  </div>
                </div>
              </div>
            )}

            {/* Group code card */}
            <div className="card">
              <h2 className="text-base font-bold text-gray-800 mb-2">Share this group</h2>
              <p className="text-xs text-gray-500 mb-3">
                Anyone with this code can access and edit this group's data on any device.
              </p>
              <button
                onClick={copyCode}
                className="w-full flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 hover:border-green-400 transition-colors group"
              >
                <span className="font-mono text-xl font-bold tracking-widest text-gray-800 group-hover:text-green-600">
                  {groupCode}
                </span>
                <span className="text-xs text-gray-400 group-hover:text-green-600">
                  {copied ? '✓ Copied!' : 'Copy'}
                </span>
              </button>
              <button
                onClick={onLeave}
                className="mt-3 text-xs text-gray-400 hover:text-red-500 transition-colors w-full text-center"
              >
                Leave / switch group
              </button>
            </div>
          </div>

          {/* Right column: Tabs */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex border-b border-gray-200">
              {(['expenses', 'balances'] as Tab[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-5 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                    tab === t
                      ? 'border-green-600 text-green-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
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
        </div>
      </main>
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
