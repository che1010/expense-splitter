import { useState } from 'react';
import type { Person } from '../types';

interface Props {
  people: Person[];
  onAdd: (name: string) => void;
  onRemove: (id: string) => void;
}

export default function PeopleManager({ people, onAdd, onRemove }: Props) {
  const [name, setName] = useState('');

  const handleAdd = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (people.some(p => p.name.toLowerCase() === trimmed.toLowerCase())) return;
    onAdd(trimmed);
    setName('');
  };

  return (
    <div className="card">
      <h2 className="text-base font-bold text-gray-800 mb-4">People</h2>

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
          Add people to start splitting expenses.
        </p>
      )}

      <ul className="space-y-2">
        {people.map(person => (
          <li key={person.id} className="flex items-center justify-between rounded-lg px-3 py-2 bg-gray-50 border border-gray-100">
            <div className="flex items-center gap-2">
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                style={{ backgroundColor: person.color }}
              >
                {person.name[0].toUpperCase()}
              </span>
              <span className="text-sm font-medium">{person.name}</span>
            </div>
            <button
              onClick={() => onRemove(person.id)}
              className="text-gray-400 hover:text-red-500 transition-colors text-lg leading-none"
              title="Remove"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
