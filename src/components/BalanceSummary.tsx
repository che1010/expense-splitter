import type { Person, Payment } from '../types';

interface Settlement {
  from: string;
  to: string;
  amount: number;
}

interface Props {
  people: Person[];
  balances: Record<string, number>;
  settlements: Settlement[];
  payments: Payment[];
  onRecordPayment: (from: string, to: string, amount: number) => void;
  onRemovePayment: (id: string) => void;
}

function personById(people: Person[], id: string) {
  return people.find(p => p.id === id);
}

function Avatar({ person }: { person: Person | undefined }) {
  if (!person) return null;
  return (
    <span
      className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
      style={{ backgroundColor: person.color }}
    >
      {person.name[0]}
    </span>
  );
}

export default function BalanceSummary({ people, balances, settlements, payments, onRecordPayment, onRemovePayment }: Props) {
  if (people.length === 0) {
    return (
      <div className="card text-center py-6">
        <p className="text-sm text-gray-400">Add people and expenses to see balances.</p>
      </div>
    );
  }

  const allSettled = settlements.length === 0;

  return (
    <div className="space-y-4">
      {/* Individual balances */}
      <div className="card">
        <h2 className="text-base font-bold text-gray-800 mb-4">Balances</h2>
        <div className="space-y-2">
          {people.map(person => {
            const balance = balances[person.id] ?? 0;
            const isPositive = balance > 0.005;
            const isNegative = balance < -0.005;
            return (
              <div key={person.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Avatar person={person} />
                  <span className="text-sm font-medium text-gray-700">{person.name}</span>
                </div>
                <span className={`text-sm font-semibold ${isPositive ? 'text-green-600' : isNegative ? 'text-red-500' : 'text-gray-400'}`}>
                  {isPositive ? '+' : ''}{balance.toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Positive = owed money · Negative = owes money
        </p>
      </div>

      {/* Settlement suggestions */}
      <div className="card">
        <h2 className="text-base font-bold text-gray-800 mb-1">Who Pays Whom</h2>
        {allSettled ? (
          <div className="flex items-center gap-2 py-3">
            <span className="text-green-500 text-lg">✓</span>
            <p className="text-sm text-green-600 font-medium">All settled up!</p>
          </div>
        ) : (
          <div className="space-y-2 mt-3">
            {settlements.map((s, i) => {
              const from = personById(people, s.from);
              const to = personById(people, s.to);
              return (
                <div key={i} className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Avatar person={from} />
                    <span className="text-gray-600">{from?.name}</span>
                    <span className="text-gray-400">→</span>
                    <Avatar person={to} />
                    <span className="text-gray-600">{to?.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-amber-700">${s.amount.toFixed(2)}</span>
                    <button
                      className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 transition-colors"
                      onClick={() => onRecordPayment(s.from, s.to, s.amount)}
                    >
                      Settle
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Payment history */}
      {payments.length > 0 && (
        <div className="card">
          <h2 className="text-base font-bold text-gray-800 mb-3">Payment History</h2>
          <div className="space-y-2">
            {payments.map(payment => {
              const from = personById(people, payment.fromPersonId);
              const to = personById(people, payment.toPersonId);
              return (
                <div key={payment.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1.5">
                    <Avatar person={from} />
                    <span className="text-gray-600">{from?.name}</span>
                    <span className="text-gray-400 mx-0.5">paid</span>
                    <Avatar person={to} />
                    <span className="text-gray-600">{to?.name}</span>
                    {payment.note && <span className="text-gray-400 text-xs">({payment.note})</span>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-medium text-green-600">${payment.amount.toFixed(2)}</span>
                    <button
                      onClick={() => onRemovePayment(payment.id)}
                      className="text-gray-300 hover:text-red-400 transition-colors text-lg leading-none"
                      title="Remove payment"
                    >
                      ×
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
