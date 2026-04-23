import { useState } from 'react';
import { useAppStore } from './store/useAppStore';
import PeopleManager from './components/PeopleManager';
import ExpenseForm from './components/ExpenseForm';
import ExpenseList from './components/ExpenseList';
import PaymentForm from './components/PaymentForm';
import BalanceSummary from './components/BalanceSummary';
import type { Expense, Payment } from './types';

type Tab = 'expenses' | 'balances';
type Modal = null | 'expense' | 'payment';

interface PaymentPrefill {
  from?: string;
  to?: string;
  amount?: number;
}

export default function App() {
  const store = useAppStore();
  const [tab, setTab] = useState<Tab>('expenses');
  const [modal, setModal] = useState<Modal>(null);
  const [paymentPrefill, setPaymentPrefill] = useState<PaymentPrefill>({});

  const balances = store.getBalances();
  const settlements = store.getSettlements();

  const handleAddExpense = (expense: Omit<Expense, 'id' | 'date'>) => {
    store.addExpense(expense);
    setModal(null);
  };

  const handleAddPayment = (payment: Omit<Payment, 'id' | 'date'>) => {
    store.addPayment(payment);
    setModal(null);
    setPaymentPrefill({});
  };

  const handleSettle = (from: string, to: string, amount: number) => {
    setPaymentPrefill({ from, to, amount });
    setModal('payment');
    setTab('expenses'); // bring to front
  };

  const openPaymentModal = () => {
    setPaymentPrefill({});
    setModal('payment');
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
              <p className="text-xs text-gray-400 hidden sm:block">Expense splitter</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="btn-secondary text-xs py-1.5 px-3"
              onClick={openPaymentModal}
              disabled={store.state.people.length < 2}
              title="Record a payment"
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

          {/* Left column: People */}
          <div className="lg:col-span-1 space-y-4">
            <PeopleManager
              people={store.state.people}
              onAdd={store.addPerson}
              onRemove={store.removePerson}
            />

            {/* Stats */}
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
          </div>

          {/* Right column: Tabs */}
          <div className="lg:col-span-2 space-y-4">
            {/* Tabs */}
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

            {/* Modals (inline) */}
            {modal === 'expense' && (
              <ExpenseForm
                people={store.state.people}
                onSave={handleAddExpense}
                onCancel={() => setModal(null)}
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
