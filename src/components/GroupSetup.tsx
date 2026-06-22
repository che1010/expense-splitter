import { useState } from 'react';
import { createGroup, groupExists, generateGroupCode, searchGroupsByName } from '../store/useFirebaseStore';
import type { GroupSearchResult } from '../types';

interface Props {
  onJoin: (code: string) => void;
}

const CODE_PATTERN = /^[A-Z0-9]{6}$/;

export default function GroupSetup({ onJoin }: Props) {
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose');
  const [newGroupName, setNewGroupName] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<GroupSearchResult[] | null>(null);

  const handleCreate = async () => {
    setLoading(true);
    setError('');
    try {
      let code = generateGroupCode();
      while (await groupExists(code)) {
        code = generateGroupCode();
      }
      const name = newGroupName.trim() || `Group_${code}`;
      await createGroup(code, name);
      onJoin(code);
    } catch {
      setError('Failed to create group. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    const input = query.trim().toUpperCase();
    if (!input) { setError('Enter a group code or group name.'); return; }
    setLoading(true);
    setError('');
    setResults(null);
    try {
      // Looks like a code — try exact code lookup first
      if (CODE_PATTERN.test(input)) {
        const exists = await groupExists(input);
        if (exists) { onJoin(input); return; }
        setError('Group not found. Double-check the code.');
        return;
      }
      // Otherwise treat as group name search (case-insensitive contains)
      const found = await searchGroupsByName(query.trim());
      if (found.length === 0) {
        setError(`No groups found matching "${query.trim()}".`);
      } else if (found.length === 1) {
        onJoin(found[0].code);
      } else {
        setResults(found);
      }
    } catch {
      setError('Failed to connect. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetToChoose = () => {
    setMode('choose');
    setError('');
    setQuery('');
    setNewGroupName('');
    setResults(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">

        {/* Logo */}
        <div className="text-center">
          <div className="text-5xl mb-3">💸</div>
          <h1 className="text-2xl font-bold text-gray-900">SplitEase</h1>
          <p className="text-sm text-gray-500 mt-1">Expense splitter — synced across all your devices</p>
        </div>

        {/* ── Choose mode ── */}
        {mode === 'choose' && (
          <div className="card space-y-3">
            <h2 className="text-base font-bold text-gray-800">Get started</h2>
            <p className="text-sm text-gray-500">
              Create a new group and share the code with friends, or join an existing one.
            </p>
            <button
              className="btn-primary w-full"
              onClick={() => setMode('create')}
              disabled={loading}
            >
              ✦ Create a new group
            </button>
            <button
              className="btn-secondary w-full"
              onClick={() => setMode('join')}
              disabled={loading}
            >
              Enter a group code or name
            </button>
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
        )}

        {/* ── Create mode ── */}
        {mode === 'create' && (
          <div className="card space-y-4">
            <div className="flex items-center gap-2">
              <button onClick={resetToChoose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">←</button>
              <h2 className="text-base font-bold text-gray-800">Create a new group</h2>
            </div>
            <div>
              <label className="label">Group name <span className="text-gray-400 font-normal">(optional)</span></label>
              <input
                className="input"
                placeholder="e.g. Bali Trip, Roommates, Family"
                value={newGroupName}
                onChange={e => { setNewGroupName(e.target.value); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                autoFocus
                maxLength={60}
              />
              <p className="text-xs text-gray-400 mt-1">Leave blank to use a default name — you can rename it later.</p>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button
              className="btn-primary w-full"
              onClick={handleCreate}
              disabled={loading}
            >
              {loading ? 'Creating…' : 'Create group'}
            </button>
          </div>
        )}

        {/* ── Join mode ── */}
        {mode === 'join' && !results && (
          <div className="card space-y-4">
            <div className="flex items-center gap-2">
              <button onClick={resetToChoose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">←</button>
              <h2 className="text-base font-bold text-gray-800">Join a group</h2>
            </div>
            <div>
              <label className="label">Group code or name</label>
              <input
                className="input"
                placeholder="ABC123 or My Trip"
                value={query}
                onChange={e => { setQuery(e.target.value); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                autoFocus
              />
              <p className="text-xs text-gray-400 mt-1">Enter the 6-character code or the group name.</p>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button
              className="btn-primary w-full"
              onClick={handleSearch}
              disabled={loading || !query.trim()}
            >
              {loading ? 'Searching…' : 'Find group'}
            </button>
          </div>
        )}

        {/* ── Multiple results picker ── */}
        {mode === 'join' && results && (
          <div className="card space-y-4">
            <div className="flex items-center gap-2">
              <button onClick={() => setResults(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">←</button>
              <h2 className="text-base font-bold text-gray-800">Multiple groups found</h2>
            </div>
            <p className="text-sm text-gray-500">Select the group you want to join.</p>
            <div className="space-y-2">
              {results.map(r => (
                <button
                  key={r.code}
                  className="w-full text-left border border-gray-200 rounded-lg px-4 py-3 hover:bg-green-50 hover:border-green-400 transition-colors"
                  onClick={() => onJoin(r.code)}
                >
                  <p className="font-semibold text-gray-800 text-sm">{r.groupName}</p>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">{r.code}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-xs text-gray-400">
          Your group code lets anyone on any device access the same data in real time.
        </p>
      </div>
    </div>
  );
}
