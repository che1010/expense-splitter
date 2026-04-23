import type { Expense, Person } from '../types';

interface Props {
  expenses: Expense[];
  people: Person[];
  onRemove: (id: string) => void;
  onEdit: (id: string) => void;
}

function personName(people: Person[], id: string) {
  return people.find(p => p.id === id)?.name ?? 'Unknown';
}

function personColor(people: Person[], id: string) {
  return people.find(p => p.id === id)?.color ?? '#999';
}

export default function ExpenseList({ expenses, people, onRemove, onEdit }: Props) {
  if (expenses.length === 0) {
    return (
      <div className="card text-center py-8">
        <div className="text-4xl mb-2">🧾</div>
        <p className="text-sm text-gray-400">No expenses yet. Add one above!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {expenses.map(expense => (
        <div key={expense.id} className="card">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-800 truncate">{expense.title}</h3>
              {expense.note && <p className="text-xs text-gray-400 mt-0.5">{expense.note}</p>}
              <p className="text-xs text-gray-400 mt-1">
                {new Date(expense.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => onEdit(expense.id)}
                className="text-gray-400 hover:text-blue-500 transition-colors px-1.5 py-0.5 text-xs rounded hover:bg-blue-50"
                title="Edit expense"
              >
                Edit
              </button>
              <button
                onClick={() => onRemove(expense.id)}
                className="text-gray-300 hover:text-red-400 transition-colors text-xl leading-none"
                title="Remove expense"
              >
                ×
              </button>
            </div>
          </div>

          {/* Amount breakdown */}
          <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs space-y-1 mb-3">
            <div className="flex justify-between text-gray-500">
              <span>Subtotal</span><span>${expense.subtotal.toFixed(2)}</span>
            </div>
            {expense.taxAmount > 0 && (
              <div className="flex justify-between text-gray-500">
                <span>Tax ({expense.taxRate}%)</span><span>${expense.taxAmount.toFixed(2)}</span>
              </div>
            )}
            {expense.tipAmount > 0 && (
              <div className="flex justify-between text-gray-500">
                <span>Tip ({expense.tipRate}%)</span><span>${expense.tipAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-gray-800 border-t border-gray-200 pt-1">
              <span>Total</span><span>${expense.total.toFixed(2)}</span>
            </div>
          </div>

          {/* Paid by */}
          <div className="flex items-center gap-1.5 mb-3">
            <span className="text-xs text-gray-500">Paid by</span>
            <span
              className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold"
              style={{ backgroundColor: personColor(people, expense.paidBy) }}
            >
              {personName(people, expense.paidBy)[0]}
            </span>
            <span className="text-xs font-medium text-gray-700">{personName(people, expense.paidBy)}</span>
          </div>

          {/* Splits */}
          <div>
            <p className="text-xs text-gray-400 mb-1.5">
              {expense.splitType === 'even' ? 'Split evenly'
                : expense.splitType === 'percentage' ? 'Split by percentage'
                : expense.splitType === 'full' ? 'Owed full amount'
                : 'Custom split'}
            </p>
            <div className="space-y-1">
              {expense.splits.map(split => (
                <div key={split.personId} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center text-white font-bold shrink-0"
                      style={{ backgroundColor: personColor(people, split.personId) }}
                    >
                      {personName(people, split.personId)[0]}
                    </span>
                    <span className="text-gray-600">{personName(people, split.personId)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">{split.percentage.toFixed(1)}%</span>
                    <span className="font-medium text-gray-800">${split.amount.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
