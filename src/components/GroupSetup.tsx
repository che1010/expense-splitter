import { useState } from 'react';
import { createGroup, groupExists, generateGroupCode } from '../store/useFirebaseStore';

interface Props {
  onJoin: (code: string) => void;
}

export default function GroupSetup({ onJoin }: Props) {
  const [mode, setMode] = useState<'choose' | 'join'>('choose');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    setLoading(true);
    setError('');
    try {
      let code = generateGroupCode();
      // Avoid (unlikely) collisions
      while (await groupExists(code)) {
        code = generateGroupCode();
      }
      await createGroup(code);
      onJoin(code);
    } catch {
      setError('Failed to create group. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) { setError('Enter a valid 6-character code.'); return; }
    setLoading(true);
    setError('');
    try {
      const exists = await groupExists(code);
      if (!exists) { setError('Group not found. Double-check the code.'); return; }
      onJoin(code);
    } catch {
      setError('Failed to connect. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
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

        {mode === 'choose' && (
          <div className="card space-y-3">
            <h2 className="text-base font-bold text-gray-800">Get started</h2>
            <p className="text-sm text-gray-500">
              Create a new group and share the code with friends, or join an existing one.
            </p>
            <button
              className="btn-primary w-full"
              onClick={handleCreate}
              disabled={loading}
            >
              {loading ? 'Creating…' : '✦ Create a new group'}
            </button>
            <button
              className="btn-secondary w-full"
              onClick={() => setMode('join')}
              disabled={loading}
            >
              Enter a group code
            </button>
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
        )}

        {mode === 'join' && (
          <div className="card space-y-4">
            <div className="flex items-center gap-2">
              <button onClick={() => { setMode('choose'); setError(''); }} className="text-gray-400 hover:text-gray-600 text-lg leading-none">←</button>
              <h2 className="text-base font-bold text-gray-800">Join a group</h2>
            </div>
            <div>
              <label className="label">Group code</label>
              <input
                className="input uppercase tracking-widest text-center text-lg font-bold"
                placeholder="ABC123"
                maxLength={6}
                value={joinCode}
                onChange={e => { setJoinCode(e.target.value.toUpperCase()); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleJoin()}
                autoFocus
              />
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button
              className="btn-primary w-full"
              onClick={handleJoin}
              disabled={loading || joinCode.length !== 6}
            >
              {loading ? 'Joining…' : 'Join group'}
            </button>
          </div>
        )}

        <p className="text-center text-xs text-gray-400">
          Your group code lets anyone on any device access the same data in real time.
        </p>
      </div>
    </div>
  );
}
