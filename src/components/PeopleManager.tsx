import { useState } from 'react';
import type { Person } from '../types';

interface Props {
  people: Person[];
  onAdd: (name: string) => void;
  onRemove: (id: string) => void;
}

export default function PeopleManager({ people, onAdd, onRemove }: Props) {
  const [name, setName] = useState('');
  const [collapsed, setCollapsed] = useState(false);

  const handleAdd = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (people.some(p => p.name.toLowerCase() === trimmed.toLowerCase())) return;
    onAdd(trimmed);
    setName('');
  };

  return (
    <div className="card">
      {/* Header — always visible, toggles collapse */}
      <button
        className="w-full flex items-center justify-between"
        onClick={() => setCollapsed(c => !c)}
        aria-expanded={!collapsed}
      >
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-gray-800">People</h2>
          <span className="bg-gray-100 text-gray-500 text-xs font-semibold rounded-full px-2 py-0.5">
            {people.length}
          </span>
        </div>
        <span
          className={`text-gray-400 text-xs transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`}
          aria-hidden="true"
        >
          ▼
        </span>
      </button>

      {/* Collapsible body */}
      {!collapsed && (
        <div className="mt-4">
          <div className="flex gap-2 mb-4">
            <input
              className="input"
              placeholder="Add person (e.g. Alice)"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
            <button className="btn-primary whitespace-nowrap" onClick={handleAdd}>
              + Add
            </button>
          </div>

          {people.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-3">
              Add at least 2 people to start splitting.
            </p>
          )}

          <ul className="space-y-2">
            {people.map(person => (
              <li
                key={person.id}
                className="flex items-center justify-between rounded-lg px-3 py-2.5 bg-gray-50 border border-gray-100"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ backgroundColor: person.color }}
                  >
                    {person.name[0].toUpperCase()}
                  </span>
                  <span className="text-sm font-medium">{person.name}</span>
                </div>
                <button
                  onClick={() => onRemove(person.id)}
                  className="text-gray-400 hover:text-red-500 transition-colors text-xl leading-none p-1"
                  title="Remove"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
