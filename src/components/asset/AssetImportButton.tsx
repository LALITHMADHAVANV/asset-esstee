'use client';

import { useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Loader2, Upload, X } from 'lucide-react';
import { apiFetch, fetchMachinesOnce } from '@/lib/services/cmmsService';
import { useToast } from '@/context/ToastContext';

type Preview = { total: number; errors: Array<{ row: number; message: string }>; rows: Array<{ row: number; exists: boolean; asset: { id: string; name?: string; brand: string; unit?: string; cost: number } }> };
type ImportResult = { imported: number; skipped: number; errors: Array<{ row: number; message: string }> };

export function AssetImportButton() {
  const id = useId(), { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const newCount = preview?.rows.filter(row => !row.exists).length || 0;
  function start() { setFile(null); setPreview(null); setResult(null); setError(''); setOpen(true); }
  async function template(format: string) {
    setBusy(true); setError('');
    try {
      const response = await apiFetch('/api/machines/import?format=' + format);
      if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || 'Template could not be downloaded.'); }
      const url = URL.createObjectURL(await response.blob()), link = document.createElement('a');
      link.href = url; link.download = 'asset-import-template.' + format;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Template download failed.'); }
    finally { setBusy(false); }
  }
  async function upload(action: 'preview' | 'import') {
    if (!file || busy) return;
    setBusy(true); setError(''); setResult(null);
    try {
      const body = new FormData(); body.set('file', file); body.set('action', action);
      const response = await apiFetch('/api/machines/import', { method: 'POST', body });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.error || 'The file could not be processed.');
      if (action === 'preview') setPreview(data);
      else {
        setResult(data);
        await fetchMachinesOnce(true);
        showToast(data.imported + ' assets imported; ' + data.skipped + ' existing IDs skipped.', data.errors.length ? 'warning' : 'success');
      }
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Import failed. Please try again.'); }
    finally { setBusy(false); }
  }
  return <>
    <button type="button" onClick={start} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition cursor-pointer"><Upload className="w-3.5 h-3.5" />Import Assets</button>
    {open && createPortal(<div className="fixed inset-0 z-[200] bg-slate-950/60 flex items-center justify-center p-3 sm:p-6" onKeyDown={event => { if (event.key === 'Escape' && !busy) setOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby={id} className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[92vh]">
        <header className="p-5 border-b border-slate-200 flex justify-between items-center gap-3">
          <div><h2 id={id} className="text-lg font-bold text-slate-900">Import assets</h2><p className="text-xs text-slate-500 mt-1">Excel (.xlsx) or CSV ? Up to 500 rows ? Maximum 5 MB</p></div>
          <button type="button" autoFocus disabled={busy} aria-label="Close import" onClick={() => setOpen(false)} className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-40"><X className="w-5 h-5" /></button>
        </header>
        <div className="p-5 overflow-y-auto space-y-4">
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-3">
            <p className="text-sm text-slate-700">Download a template and replace the example row with your assets. Existing asset IDs will be skipped.</p>
            <div className="flex flex-wrap gap-2">{['xlsx', 'csv'].map(format => <button key={format} type="button" disabled={busy} onClick={() => template(format)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 bg-white border border-slate-200 px-3 py-2 rounded-lg disabled:opacity-50"><Download className="w-3.5 h-3.5" />{format === 'xlsx' ? 'Excel template' : 'CSV template'}</button>)}</div>
            <p className="text-xs text-slate-500">Required: id, brand, serialNo, type, purchaseDate and unit. Keep IDs as text and replace formulas with values.</p>
          </div>
          <div><label htmlFor={id + '-file'} className="block mb-2 text-sm font-semibold text-slate-700">Choose a file</label>
            <input id={id + '-file'} type="file" accept=".xlsx,.csv" disabled={busy} className="block w-full rounded-xl border border-slate-200 p-3 text-sm file:mr-3 file:border-0 file:bg-indigo-50 file:text-indigo-700 file:rounded-lg file:px-3 file:py-1.5" onChange={event => {
              const selected = event.target.files?.[0] || null;
              setPreview(null); setResult(null); setError('');
              if (selected && (!/\.(xlsx|csv)$/i.test(selected.name) || selected.size > 5 * 1024 * 1024)) { setFile(null); setError('Choose an Excel (.xlsx) or CSV file up to 5 MB.'); return; }
              setFile(selected);
            }} /></div>
          {error && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 p-3 rounded-xl">{error}</p>}
          {preview && <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-800">{preview.total} rows ? {newCount} new ? {preview.rows.length - newCount} existing ? {preview.errors.length} errors</p>
            {preview.errors.length > 0 && <div role="alert" className="max-h-40 overflow-auto bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-900"><p className="font-semibold mb-1">Correct these rows and upload again. Nothing has been imported.</p>{preview.errors.map(item => <p key={item.row}>Row {item.row}: {item.message}</p>)}</div>}
            {!!preview.rows.length && <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full text-left text-xs"><thead className="bg-slate-50 text-slate-600"><tr><th className="p-3">Row</th><th className="p-3">Asset ID / Name</th><th className="p-3">Unit</th><th className="p-3">Action</th></tr></thead><tbody>{preview.rows.slice(0, 50).map(item => <tr key={item.row} className="border-t border-slate-100"><td className="p-3">{item.row}</td><td className="p-3"><strong>{item.asset.id}</strong><p className="mt-0.5 text-slate-500">{item.asset.name || item.asset.brand}</p></td><td className="p-3">{item.asset.unit}</td><td className="p-3">{item.exists ? 'Skip existing' : 'Add new'}</td></tr>)}</tbody></table></div>}
            {preview.rows.length > 50 && <p className="text-xs text-slate-500">Showing the first 50 rows.</p>}
          </div>}
          {result && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"><p className="font-semibold">{result.imported} imported ? {result.skipped} skipped ? {result.errors.length} need retry</p>{result.errors.map(item => <p key={item.row} className="mt-1">Row {item.row}: {item.message}</p>)}</div>}
        </div>
        <footer className="p-4 border-t border-slate-200 flex flex-wrap justify-end gap-2">
          <button type="button" disabled={busy} onClick={() => setOpen(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 disabled:opacity-50">{result && !result.errors.length ? 'Done' : 'Cancel'}</button>
          <button type="button" disabled={busy || !file} onClick={() => upload('preview')} className="px-4 py-2 rounded-xl text-sm font-semibold border border-indigo-200 text-indigo-700 disabled:opacity-40">Preview file</button>
          <button type="button" disabled={busy || !preview || !!preview.errors.length || !newCount || (!!result && !result.errors.length)} onClick={() => upload('import')} className="px-4 py-2 rounded-xl text-sm font-bold bg-indigo-600 text-white disabled:opacity-40 flex items-center gap-2">{busy && <Loader2 className="w-4 h-4 animate-spin" />}Import assets</button>
        </footer>
      </section>
    </div>, document.body)}
  </>;
}
