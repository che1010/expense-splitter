import { useState } from 'react';
import type { Person, Payment } from '../types';

interface Props {
  people: Person[];
  suggestedFrom?: string;
  suggestedTo?: string;
  suggestedAmount?: number;
  onSave: (payment: Omit<Payment, 'id' | 'date'>) => void;
  onCancel: () => void;
}

export default function PaymentForm({ people, suggestedFrom, suggestedTo, suggestedAmount, onSave, onCancel }: Props) {
  const [fromId, setFromId] = useState(suggestedFrom ?? people[0]?.id ?? '');
  const [toId, setToId] = useState(suggestedTo ?? (people[1]?.id ?? people[0]?.id ?? ''));
  const [amount, setAmount] = useState(suggestedAmount ? suggestedAmount.toFixed(2) : '');
  const [note, setNote] = useState('');

  const isValid = fromId && toId && fromId !== toId && parseFloat(amount) > 0;

  const handleSave = () => {
    if (!isValid) return;
    onSave({ fromPersonId: fromId, toPersonId: toId, amount: parseFloat(amount), note: note.trim() });
  };

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-gray-800">Record Payment</h2>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">From (payer)</label>
          <select className="input" value={fromId} onChange={e => setFromId(e.target.value)}>
            {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">To (receiver)</label>
          <select className="input" value={toId} onChange={e => setToId(e.target.value)}>
            {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      {fromId === toId && (
        <p className="text-xs text-red-500">Payer and receiver must be different.</p>
      )}

      <div>
        <label className="label">Amount</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
          <input
            className="input pl-7"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={e => setAmount(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="label">Note (optional)</label>
        <input
          className="input"
          placeholder="e.g. Venmo transfer"
          value={note}
          onChange={e => setNote(e.target.value)}
        />
      </div>

      <div className="flex gap-3">
        <button className="btn-secondary flex-1" onClick={onCancel}>Cancel</button>
        <button className="btn-primary flex-1" onClick={handleSave} disabled={!isValid}>
          Record Payment
        </button>
      </div>
    </div>
  );
}
