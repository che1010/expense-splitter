import { useRef, useState } from 'react';
import { exportToSpreadsheet, importFromSpreadsheet } from '../utils/spreadsheet';
import type { AppState } from '../types';

interface Props {
  state: AppState;
  balances: Record<string, number>;
  settlements: { from: string; to: string; amount: number }[];
  groupCode: string;
  onImport: (newState: AppState) => void;
}

export default function ExportImport({ state, balances, settlements, groupCode, onImport }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [confirmState, setConfirmState] = useState<AppState | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [importError, setImportError] = useState('');
  const [exported, setExported] = useState(false);

  const handleExport = () => {
    exportToSpreadsheet(state, balances, settlements, groupCode);
    setExported(true);
    setTimeout(() => setExported(false), 2000);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!fileInputRef.current) return;
    fileInputRef.current.value = '';          // reset so same file can be re-selected
    if (!file) return;

    setImporting(true);
    setImportError('');
    setWarnings([]);
    const result = await importFromSpreadsheet(file);
    setImporting(false);

    if (!result.ok) {
      setImportError(result.error);
      return;
    }

    setWarnings(result.warnings);
    setConfirmState(result.state);
  };

  const handleConfirmImport = () => {
    if (!confirmState) return;
    onImport(confirmState);
    setConfirmState(null);
    setWarnings([]);
  };

  const summary = confirmState
    ? `${confirmState.people.length} people · ${confirmState.expenses.length} expenses · ${confirmState.payments.length} payments`
    : '';

  return (
    <div className="card space-y-3">
      <h2 className="text-base font-bold text-gray-800">Backup &amp; Restore</h2>
      <p className="text-xs text-gray-500">
        Export your data as an Excel spreadsheet, or import a previous backup to restore it.
      </p>

      {/* Export */}
      <button
        onClick={handleExport}
        className="btn-secondary w-full flex items-center justify-center gap-2 text-sm"
      >
        <span>⬇</span>
        {exported ? 'Downloaded!' : 'Export to Excel (.xlsx)'}
      </button>

      {/* Import */}
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={handleFileChange}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          className="btn-secondary w-full flex items-center justify-center gap-2 text-sm"
        >
          <span>⬆</span>
          {importing ? 'Reading file…' : 'Import from Excel (.xlsx)'}
        </button>
      </div>

      {importError && (
        <p className="text-xs text-red-500">{importError}</p>
      )}

      {/* Confirmation dialog */}
      {confirmState && (
        <div className="border border-amber-300 bg-amber-50 rounded-lg p-3 space-y-2">
          <p className="text-sm font-semibold text-amber-800">Replace current group data?</p>
          <p className="text-xs text-amber-700">
            This will overwrite all current people, expenses and payments with the imported data:
          </p>
          <p className="text-xs font-mono text-amber-900">{summary}</p>
          {warnings.length > 0 && (
            <ul className="text-xs text-amber-700 list-disc list-inside">
              {warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          )}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleConfirmImport}
              className="btn-primary text-xs py-1.5 px-3 flex-1"
            >
              Yes, replace
            </button>
            <button
              onClick={() => { setConfirmState(null); setWarnings([]); }}
              className="btn-secondary text-xs py-1.5 px-3 flex-1"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
