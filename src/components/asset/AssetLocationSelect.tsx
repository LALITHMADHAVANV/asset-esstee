'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/services/cmmsService';

export function AssetLocationSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [locations, setLocations] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    apiFetch('/api/asset-locations').then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load locations.');
      if (active) setLocations(data.locations);
    }).catch(error => { if (active) setError(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function addLocation() {
    if (!name.trim() || busy) return;
    setBusy(true); setError('');
    try {
      const response = await apiFetch('/api/asset-locations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim() }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to add location.');
      setLocations(previous => [...new Set([...previous, data.name])].sort());
      onChange(data.name); setName(''); setAdding(false);
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to add location.'); }
    finally { setBusy(false); }
  }

  return <div className="sm:col-span-2">
    <div className="flex items-center justify-between mb-1">
      <label htmlFor="asset-location" className="text-xs font-semibold text-slate-700">Location</label>
      <button type="button" onClick={() => { setAdding(true); setError(''); }} className="text-xs font-bold text-teal-600">+ New Location</button>
    </div>
    <select id="asset-location" value={value} onChange={event => onChange(event.target.value)} disabled={loading} className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none">
      <option value="">{loading ? 'Loading locations...' : '-- Select Location --'}</option>
      {locations.map(location => <option key={location} value={location}>{location}</option>)}
    </select>
    {adding && <div className="mt-2 flex flex-wrap gap-2">
      <input aria-label="New location name" autoFocus maxLength={100} value={name} onChange={event => setName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void addLocation(); } }} placeholder="Enter new location" className="min-w-0 flex-1 px-3 py-2 text-sm border border-slate-300 rounded-xl" />
      <button type="button" disabled={busy || !name.trim()} onClick={() => void addLocation()} className="px-3 py-2 text-xs font-semibold rounded-xl bg-teal-600 text-white disabled:opacity-50">{busy ? 'Adding...' : 'Add Location'}</button>
      <button type="button" disabled={busy} onClick={() => { setAdding(false); setName(''); }} className="px-3 py-2 text-xs text-slate-600">Cancel</button>
    </div>}
    {error && <p role="alert" className="mt-1 text-xs text-red-600">{error}</p>}
  </div>;
}
