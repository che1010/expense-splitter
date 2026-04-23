import { useState, useEffect } from 'react';
import type { Person, SplitType, Split, Expense } from '../types';

interface Props {
  people: Person[];
  initialValues?: Expense;
  onSave: (expense: Omit<Expense, 'id' | 'date'>) => void;
  onCancel: () => void;
}

const TAX_PRESETS = [
  { label: 'None', value: 0 },
  { label: '10.25%', value: 10.25 },
  { label: 'Custom', value: -1 },
];

const TIP_PRESETS = [
  { label: 'None', value: 0 },
  { label: '15%', value: 15 },
  { label: '18%', value: 18 },
  { label: '20%', value: 20 },
  { label: '25%', value: 25 },
  { label: 'Custom', value: -1 },
];

function getInitialTaxPreset(taxRate: number): number {
  if (taxRate === 0) return 0;
  if (taxRate === 10.25) return 10.25;
  return -1;
}

function getInitialTipPreset(tipRate: number): number {
  return [0, 15, 18, 20, 25].includes(tipRate) ? tipRate : -1;
}

function cleanNum(n: number): string {
  return String(parseFloat(n.toFixed(4)));
}

export default function ExpenseForm({ people, initialValues, onSave, onCancel }: Props) {
  const isEditing = !!initialValues;

  // ── Basic fields ──────────────────────────────────────────────────
  const [title, setTitle] = useState(initialValues?.title ?? '');
  const [note, setNote] = useState(initialValues?.note ?? '');
  const [paidBy, setPaidBy] = useState(initialValues?.paidBy ?? people[0]?.id ?? '');
  const [subtotal, setSubtotal] = useState(initialValues ? String(initialValues.subtotal) : '');

  // ── Tax ───────────────────────────────────────────────────────────
  const [taxPreset, setTaxPreset] = useState<number>(() =>
    initialValues ? getInitialTaxPreset(initialValues.taxRate) : -1
  );
  const [customTaxPct, setCustomTaxPct] = useState<string>(() => {
    if (!initialValues) return '';
    return getInitialTaxPreset(initialValues.taxRate) === -1 ? cleanNum(initialValues.taxRate) : '';
  });
  const [customTaxAmt, setCustomTaxAmt] = useState<string>(() => {
    if (!initialValues) return '';
    return getInitialTaxPreset(initialValues.taxRate) === -1 ? String(initialValues.taxAmount) : '';
  });

  // ── Tip ───────────────────────────────────────────────────────────
  const [tipPreset, setTipPreset] = useState<number>(() =>
    initialValues ? getInitialTipPreset(initialValues.tipRate) : 0
  );
  const [customTip, setCustomTip] = useState<string>(() => {
    if (!initialValues) return '';
    return getInitialTipPreset(initialValues.tipRate) === -1 ? String(initialValues.tipRate) : '';
  });

  // ── Split ─────────────────────────────────────────────────────────
  const [splitType, setSplitType] = useState<SplitType>(initialValues?.splitType ?? 'even');
  const [selectedPeople, setSelectedPeople] = useState<string[]>(() => {
    if (!initialValues) return people.map(p => p.id);
    if (initialValues.splitType === 'full') return people.map(p => p.id);
    return initialValues.splits.map(s => s.personId);
  });
  const [customSplits, setCustomSplits] = useState<Record<string, string>>(() => {
    if (!initialValues || initialValues.splitType !== 'custom') return {};
    return Object.fromEntries(initialValues.splits.map(s => [s.personId, s.amount.toFixed(2)]));
  });
  const [pctSplits, setPctSplits] = useState<Record<string, string>>(() => {
    if (initialValues?.splitType === 'percentage') {
      return Object.fromEntries(initialValues.splits.map(s => [s.personId, s.percentage.toFixed(2)]));
    }
    const ids = initialValues && initialValues.splitType !== 'full'
      ? initialValues.splits.map(s => s.personId)
      : people.map(p => p.id);
    const evenPct = ids.length > 0 ? (100 / ids.length).toFixed(2) : '0';
    return Object.fromEntries(ids.map(id => [id, evenPct]));
  });
  const [fullOwerId, setFullOwerId] = useState<string>(() => {
    if (initialValues?.splitType === 'full') return initialValues.splits[0]?.personId ?? people[0]?.id ?? '';
    return people[0]?.id ?? '';
  });

  // ── Derived values ────────────────────────────────────────────────
  const subtotalNum = parseFloat(subtotal) || 0;
  const taxRate = taxPreset === -1 ? (parseFloat(customTaxPct) || 0) : taxPreset;
  const taxAmount = Math.round(subtotalNum * (taxRate / 100) * 100) / 100;
  const tipRate = tipPreset === -1 ? (parseFloat(customTip) || 0) : tipPreset;
  const tipAmount = Math.round(subtotalNum * (tipRate / 100) * 100) / 100;
  const total = Math.round((subtotalNum + taxAmount + tipAmount) * 100) / 100;

  // Keep tax dollar display in sync when subtotal changes (pct is canonical)
  useEffect(() => {
    if (taxPreset === -1 && customTaxPct && subtotalNum > 0) {
      const pct = parseFloat(customTaxPct) || 0;
      setCustomTaxAmt(String(parseFloat((subtotalNum * pct / 100).toFixed(2))));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotalNum]);

  // ── Tax handlers ──────────────────────────────────────────────────
  const handleTaxPctChange = (val: string) => {
    setCustomTaxPct(val);
    const pct = parseFloat(val);
    if (isFinite(pct) && subtotalNum > 0) {
      setCustomTaxAmt(String(parseFloat((subtotalNum * pct / 100).toFixed(2))));
    }
  };

  const handleTaxAmtChange = (val: string) => {
    setCustomTaxAmt(val);
    const amt = parseFloat(val);
    if (isFinite(amt) && subtotalNum > 0) {
      setCustomTaxPct(cleanNum((amt / subtotalNum) * 100));
    }
  };

  const handleTaxPreset = (value: number) => {
    setTaxPreset(value);
    if (value !== -1) { setCustomTaxPct(''); setCustomTaxAmt(''); }
  };

  // ── Split handlers ────────────────────────────────────────────────
  const handleSplitTypeChange = (type: SplitType) => {
    setSplitType(type);
    if (type === 'percentage') {
      const evenPct = selectedPeople.length > 0 ? (100 / selectedPeople.length).toFixed(2) : '0';
      setPctSplits(prev => Object.fromEntries(selectedPeople.map(id => [id, prev[id] ?? evenPct])));
    }
  };

  const togglePerson = (id: string) => {
    const isRemoving = selectedPeople.includes(id);
    const next = isRemoving ? selectedPeople.filter(x => x !== id) : [...selectedPeople, id];
    setSelectedPeople(next);
    if (!isRemoving) {
      setCustomSplits(cs => ({ ...cs, [id]: '' }));
      const evenPct = next.length > 0 ? (100 / next.length).toFixed(2) : '0';
      setPctSplits(ps => Object.fromEntries(next.map(nid => [nid, ps[nid] ?? evenPct])));
    }
  };

  // ── Compute splits ────────────────────────────────────────────────
  const computeSplits = (): Split[] => {
    if (splitType === 'full') {
      return fullOwerId ? [{ personId: fullOwerId, amount: total, percentage: 100 }] : [];
    }
    if (selectedPeople.length === 0) return [];

    if (splitType === 'even') {
      const share = Math.round((total / selectedPeople.length) * 100) / 100;
      const remainder = Math.round((total - share * selectedPeople.length) * 100) / 100;
      const pct = Math.round((100 / selectedPeople.length) * 100) / 100;
      return selectedPeople.map((id, i) => ({
        personId: id,
        amount: i === 0 ? share + remainder : share,
        percentage: pct,
      }));
    }

    if (splitType === 'percentage') {
      return selectedPeople.map(id => {
        const pct = parseFloat(pctSplits[id]) || 0;
        return { personId: id, amount: Math.round(total * (pct / 100) * 100) / 100, percentage: pct };
      });
    }

    return selectedPeople.map(id => {
      const amt = parseFloat(customSplits[id]) || 0;
      return { personId: id, amount: amt, percentage: total > 0 ? Math.round((amt / total) * 10000) / 100 : 0 };
    });
  };

  const splits = computeSplits();
  const splitTotal = splits.reduce((s, x) => s + x.amount, 0);
  const pctTotal = splits.reduce((s, x) => s + x.percentage, 0);
  const splitDiff = Math.abs(splitTotal - total);
  const pctDiff = Math.abs(pctTotal - 100);

  const isValid =
    !!title.trim() &&
    !!paidBy &&
    subtotalNum > 0 &&
    (splitType === 'full'
      ? !!fullOwerId
      : selectedPeople.length > 0 &&
        (splitType === 'even' ||
          (splitType === 'percentage' ? pctDiff < 0.1 : splitDiff < 0.01)));

  const handleSave = () => {
    if (!isValid) return;
    onSave({
      title: title.trim(), note: note.trim(), paidBy,
      subtotal: subtotalNum, taxRate, taxAmount, tipRate, tipAmount, total,
      splitType, splits,
    });
  };

  return (
    <div className="card space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-gray-800">{isEditing ? 'Edit Expense' : 'New Expense'}</h2>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
      </div>

      {/* Title & Note */}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="label">Title *</label>
          <input className="input" placeholder="e.g. Dinner at Luigi's" value={title} onChange={e => setTitle(e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="label">Note</label>
          <input className="input" placeholder="Optional note" value={note} onChange={e => setNote(e.target.value)} />
        </div>
      </div>

      {/* Paid By & Subtotal */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Paid by *</label>
          <select className="input" value={paidBy} onChange={e => setPaidBy(e.target.value)}>
            {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Subtotal (before tax) *</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
            <input className="input pl-7" type="number" min="0" step="0.01" placeholder="0.00"
              value={subtotal} onChange={e => setSubtotal(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Tax */}
      <div>
        <label className="label">Tax</label>
        <div className="flex flex-wrap gap-2 mb-3">
          {TAX_PRESETS.map(p => (
            <button key={p.label} onClick={() => handleTaxPreset(p.value)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                taxPreset === p.value
                  ? 'bg-green-600 text-white border-green-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-green-400'
              }`}>
              {p.label}
            </button>
          ))}
        </div>

        {taxPreset === -1 && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Tax %</label>
              <div className="relative">
                <input className="input pr-7" type="number" min="0" max="100" step="0.01"
                  placeholder="0.00" value={customTaxPct}
                  onChange={e => handleTaxPctChange(e.target.value)} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
              </div>
            </div>
            <div>
              <label className="label">Tax Amount ($)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input className="input pl-7" type="number" min="0" step="0.01"
                  placeholder="0.00" value={customTaxAmt}
                  onChange={e => handleTaxAmtChange(e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {taxRate > 0 && (
          <p className="text-xs text-gray-500 mt-2">
            Tax: <strong>${taxAmount.toFixed(2)}</strong> ({taxRate}% of ${subtotalNum.toFixed(2)})
          </p>
        )}
      </div>

      {/* Tip */}
      <div>
        <label className="label">Tip</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {TIP_PRESETS.map(p => (
            <button key={p.label} onClick={() => setTipPreset(p.value)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                tipPreset === p.value
                  ? 'bg-green-600 text-white border-green-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-green-400'
              }`}>
              {p.label}
            </button>
          ))}
        </div>
        {tipPreset === -1 && (
          <div className="flex items-center gap-2">
            <input className="input w-32" type="number" min="0" max="100" step="0.1"
              placeholder="0.00" value={customTip} onChange={e => setCustomTip(e.target.value)} />
            <span className="text-sm text-gray-500">%</span>
          </div>
        )}
        {tipRate > 0 && (
          <p className="text-xs text-gray-500 mt-1">
            Tip: <strong>${tipAmount.toFixed(2)}</strong> ({tipRate}% of ${subtotalNum.toFixed(2)})
          </p>
        )}
      </div>

      {/* Total summary */}
      {subtotalNum > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm space-y-1">
          <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>${subtotalNum.toFixed(2)}</span></div>
          {taxAmount > 0 && <div className="flex justify-between text-gray-600"><span>Tax ({taxRate}%)</span><span>${taxAmount.toFixed(2)}</span></div>}
          {tipAmount > 0 && <div className="flex justify-between text-gray-600"><span>Tip ({tipRate}%)</span><span>${tipAmount.toFixed(2)}</span></div>}
          <div className="flex justify-between font-bold text-gray-800 border-t border-green-200 pt-1 mt-1">
            <span>Total</span><span>${total.toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Split method */}
      <div>
        <label className="label">Split method</label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(['even', 'percentage', 'custom', 'full'] as SplitType[]).map(type => (
            <button key={type} onClick={() => handleSplitTypeChange(type)}
              className={`py-2 rounded-lg text-xs font-medium border transition-colors ${
                splitType === type
                  ? 'bg-green-600 text-white border-green-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-green-400'
              }`}>
              {type === 'even' ? 'Even' : type === 'percentage' ? 'By %' : type === 'custom' ? 'Custom $' : 'Owed Full Amt'}
            </button>
          ))}
        </div>
      </div>

      {/* Full amount: single person selector */}
      {splitType === 'full' && (
        <div>
          <label className="label">Who owes the full amount?</label>
          <div className="flex flex-wrap gap-2">
            {people.map(p => (
              <button key={p.id} onClick={() => setFullOwerId(p.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  fullOwerId === p.id ? 'text-white border-transparent' : 'bg-white text-gray-500 border-gray-300 hover:border-gray-400'
                }`}
                style={fullOwerId === p.id ? { backgroundColor: p.color, borderColor: p.color } : {}}>
                {p.name}
              </button>
            ))}
          </div>
          {fullOwerId && total > 0 && (
            <p className="text-xs text-gray-500 mt-2">
              <strong>{people.find(p => p.id === fullOwerId)?.name}</strong> owes the full <strong>${total.toFixed(2)}</strong>
            </p>
          )}
        </div>
      )}

      {/* Even / Percentage / Custom: who's included */}
      {splitType !== 'full' && (
        <div>
          <label className="label">Split between</label>
          <div className="flex flex-wrap gap-2">
            {people.map(p => (
              <button key={p.id} onClick={() => togglePerson(p.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  selectedPeople.includes(p.id) ? 'text-white border-transparent' : 'bg-white text-gray-500 border-gray-300 hover:border-gray-400'
                }`}
                style={selectedPeople.includes(p.id) ? { backgroundColor: p.color, borderColor: p.color } : {}}>
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Percentage / Custom inputs */}
      {splitType !== 'even' && splitType !== 'full' && selectedPeople.length > 0 && (
        <div className="space-y-2">
          <label className="label">
            {splitType === 'percentage' ? 'Percentages' : 'Amounts'}
            {splitType === 'percentage' && (
              <span className={`ml-2 normal-case font-normal ${pctDiff < 0.1 ? 'text-green-600' : 'text-red-500'}`}>
                ({pctTotal.toFixed(1)}% / 100%)
              </span>
            )}
            {splitType === 'custom' && total > 0 && (
              <span className={`ml-2 normal-case font-normal ${splitDiff < 0.01 ? 'text-green-600' : 'text-red-500'}`}>
                (${splitTotal.toFixed(2)} / ${total.toFixed(2)})
              </span>
            )}
          </label>
          {selectedPeople.map(id => {
            const person = people.find(p => p.id === id)!;
            return (
              <div key={id} className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                  style={{ backgroundColor: person.color }}>{person.name[0]}</span>
                <span className="text-sm w-24 truncate">{person.name}</span>
                <div className="relative flex-1">
                  {splitType === 'custom' && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>}
                  <input className={`input ${splitType === 'custom' ? 'pl-7' : ''}`}
                    type="number" min="0" step={splitType === 'percentage' ? '0.1' : '0.01'}
                    placeholder="0"
                    value={splitType === 'percentage' ? (pctSplits[id] ?? '') : (customSplits[id] ?? '')}
                    onChange={e => {
                      if (splitType === 'percentage') setPctSplits(prev => ({ ...prev, [id]: e.target.value }));
                      else setCustomSplits(prev => ({ ...prev, [id]: e.target.value }));
                    }} />
                  {splitType === 'percentage' && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Even split preview */}
      {splitType === 'even' && selectedPeople.length > 0 && total > 0 && (
        <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
          Each person pays: <strong>${(total / selectedPeople.length).toFixed(2)}</strong>
        </p>
      )}

      <div className="flex gap-3 pt-1">
        <button className="btn-secondary flex-1" onClick={onCancel}>Cancel</button>
        <button className="btn-primary flex-1" onClick={handleSave} disabled={!isValid}>
          {isEditing ? 'Save Changes' : 'Add Expense'}
        </button>
      </div>
    </div>
  );
}
