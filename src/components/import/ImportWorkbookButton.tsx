'use client';

import { useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, FileSpreadsheet, Loader2, Upload, X } from 'lucide-react';
import { apiFetch, fetchMachinesOnce, fetchPartsOnce } from '@/lib/services/cmmsService';
import { useToast } from '@/context/ToastContext';

type Kind = 'assets' | 'spares';
type PreviewRow = { row: number; action: string; id?: string; partId?: string; name: string; quantity?: number; unitCost?: number; resultingStock?: number; cost?: number };
type Preview = { total: number; errors: Array<{ row: number; message: string }>; rows: PreviewRow[] };
const requestKey = () => globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2);

export function ImportWorkbookButton({ kind }: { kind: Kind }) {
  const id = useId();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [requestId, setRequestId] = useState('');
  const assetImport = kind === 'assets';
  const title = assetImport ? 'Import Asset Entry' : 'Import Spare Inward';

  function start() {
    setFile(null); setPreview(null); setError(''); setRequestId(requestKey()); setOpen(true);
  }
  async function template(format: 'xlsx' | 'csv') {
    setError(''); setBusy(true);
    try {
      const response = await apiFetch(`/api/imports?kind=${kind}&format=${format}`);
      if (!response.ok) { const result = await response.json(); throw new Error(result.error || 'Template could not be downloaded.'); }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url; link.download = `${kind}-import-template.${format}`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Template could not be downloaded.'); }
    finally { setBusy(false); }
  }
  async function submit(action: 'preview' | 'commit') {
    if (!file || busy) return;
    setBusy(true); setError('');
    try {
      const body = new FormData();
      body.set('kind', kind); body.set('file', file); body.set('action', action); body.set('requestId', requestId);
      const response = await apiFetch('/api/imports', { method: 'POST', body });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Import failed.');
      if (action === 'preview') setPreview(result);
      else {
        await (assetImport ? fetchMachinesOnce(true) : fetchPartsOnce(true));
        showToast(`${result.count} ${assetImport ? 'assets imported' : 'spare inward rows received'} successfully.`, 'success');
        setOpen(false);
      }
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Import failed. Please try again.'); }
    finally { setBusy(false); }
  }
  return <>
    <button type="button" onClick={start} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-bold hover:bg-indigo-100 transition cursor-pointer">
      <Upload className="w-4 h-4" />{assetImport ? 'Import Assets' : 'Import Spare Inward'}
    </button>
    {open && createPortal(<div className="fixed inset-0 z-[200] bg-slate-950/60 flex items-center justify-center p-3 sm:p-6" onKeyDown={event => { if (event.key === 'Escape' && !busy) setOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby={id} className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col">
        <header className="p-5 border-b border-slate-200 flex items-center justify-between gap-3">
          <div><h2 id={id} className="font-bold text-lg text-slate-900 flex gap-2 items-center"><FileSpreadsheet className="w-5 h-5 text-indigo-600" />{title}</h2>
            <p className="text-xs text-slate-500 mt-1">Excel (.xlsx) or CSV · Up to 500 rows · Maximum 5 MB</p></div>
          <button type="button" autoFocus disabled={busy} aria-label="Close import" onClick={() => setOpen(false)} className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-40"><X className="w-5 h-5" /></button>
        </header>
        <div className="p-5 overflow-y-auto space-y-4">
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-3">
            <p className="text-sm text-slate-700">{assetImport ? 'Add new assets without overwriting existing IDs or serial numbers.' : 'Receive stock into existing spare IDs, or add new spares with SKU, name and unit cost. Quantities are added to current stock.'}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={busy} onClick={() => template('xlsx')} className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 border rounded-lg px-3 py-2 bg-white disabled:opacity-50"><Download className="w-3.5 h-3.5" />Excel template</button>
              <button type="button" disabled={busy} onClick={() => template('csv')} className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 border rounded-lg px-3 py-2 bg-white disabled:opacity-50"><Download className="w-3.5 h-3.5" />CSV template</button>
            </div>
            <p className="text-xs text-slate-500">Replace the example row with your records. Keep the column headers. Use values instead of formulas.</p>
          </div>
          <div><label htmlFor={id + '-file'} className="block text-sm font-semibold text-slate-700 mb-2">Choose import file</label>
            <input id={id + '-file'} type="file" accept=".xlsx,.csv" disabled={busy} className="block w-full text-sm border border-slate-200 rounded-xl p-3 file:mr-3 file:border-0 file:bg-indigo-50 file:text-indigo-700 file:rounded-lg file:px-3 file:py-1.5" onChange={event => {
              const selected = event.target.files?.[0] || null;
              setPreview(null); setError(''); setRequestId(requestKey());
              if (selected && (!/\.(xlsx|csv)$/i.test(selected.name) || selected.size > 5 * 1024 * 1024)) { setFile(null); setError('Choose an Excel (.xlsx) or CSV file up to 5 MB.'); return; }
              setFile(selected);
            }} /></div>
          {error && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 p-3 rounded-xl">{error}</p>}
          {preview && <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-800">{preview.total} rows · {preview.rows.length} valid · {preview.errors.length} errors</p>
            {preview.errors.length > 0 && <div role="alert" className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900 max-h-40 overflow-y-auto">
              <p className="font-semibold mb-1">Correct these rows and upload the file again. Nothing has been imported.</p>
              {preview.errors.map(item => <p key={item.row}>Row {item.row}: {item.message}</p>)}
            </div>}
            {preview.rows.length > 0 && <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600"><tr><th className="p-3">Row</th><th className="p-3">ID / Name</th><th className="p-3">Action</th><th className="p-3">{assetImport ? 'Asset cost' : 'Received / New stock'}</th></tr></thead>
              <tbody>{preview.rows.slice(0, 50).map(item => <tr key={item.row} className="border-t border-slate-100"><td className="p-3">{item.row}</td><td className="p-3"><strong>{item.id || item.partId}</strong><p className="text-slate-500 mt-0.5">{item.name}</p></td><td className="p-3">{item.action === 'create' ? 'Add new' : 'Receive stock'}</td><td className="p-3">{assetImport ? `₹${item.cost}` : `+${item.quantity} / ${item.resultingStock}`}</td></tr>)}</tbody>
            </table></div>}
            {preview.rows.length > 50 && <p className="text-xs text-slate-500">Showing the first 50 rows. All {preview.total} rows will be imported.</p>}
          </div>}
        </div>
        <footer className="p-4 border-t border-slate-200 flex flex-wrap justify-end gap-2">
          <button type="button" disabled={busy} onClick={() => setOpen(false)} className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 disabled:opacity-50">Cancel</button>
          <button type="button" disabled={!file || busy} onClick={() => submit('preview')} className="px-4 py-2 rounded-xl text-sm font-semibold border border-indigo-200 text-indigo-700 disabled:opacity-50">Preview file</button>
          <button type="button" disabled={busy || !preview || preview.errors.length > 0 || !preview.rows.length} onClick={() => submit('commit')} className="px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white disabled:opacity-40 inline-flex items-center gap-2">{busy && <Loader2 className="w-4 h-4 animate-spin" />}Import {preview?.total || ''} rows</button>
        </footer>
      </section>
    </div>, document.body)}
  </>;
}
