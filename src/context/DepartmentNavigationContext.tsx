'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { apiFetch } from '@/lib/services/cmmsService';
import { DepartmentConfiguration, departmentSelection, NavigationHref } from '@/lib/departmentNavigation';

interface DepartmentState {
  departments: DepartmentConfiguration[] | null;
  ready: boolean;
  saving: boolean;
  error: string;
  selection: NavigationHref[] | null;
  save: (items: DepartmentConfiguration[]) => Promise<void>;
}
const Context = createContext<DepartmentState | null>(null);
export function DepartmentNavigationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const identity = user ? `${user.companySlug}:${user.uid}` : '';
  const activeIdentity = useRef(identity);
  activeIdentity.current = identity;
  const [snapshot, setSnapshot] = useState<{ identity: string; departments: DepartmentConfiguration[] | null; version: number }>({ identity: '', departments: null, version: 0 });
  const [ready, setReady] = useState(false), [saving, setSaving] = useState(false), [error, setError] = useState('');
  const busy = useRef(false);
  const load = useCallback(async (signal?: AbortSignal) => {
    if (!identity || busy.current) return;
    try {
      const response = await apiFetch('/api/departments', { cache: 'no-store', signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not load department menus.');
      if (signal?.aborted || activeIdentity.current !== identity || busy.current) return;
      setSnapshot({ identity, departments: result.departments, version: result.version });
      setReady(true); setError('');
    } catch (error) {
      if (signal?.aborted || activeIdentity.current !== identity) return;
      setError(error instanceof Error ? error.message : 'Could not load department menus.');
    }
  }, [identity]);
  useEffect(() => {
    setReady(false); setError('');
    const controller = new AbortController();
    void load(controller.signal);
    const refresh = () => { void load(controller.signal); };
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    return () => { controller.abort(); window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [load]);
  const save = async (items: DepartmentConfiguration[]) => {
    if (!ready || snapshot.identity !== identity || busy.current) throw new Error('Wait for department settings to finish loading.');
    busy.current = true; setSaving(true);
    try {
      const response = await apiFetch('/api/departments', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ departments: items, version: snapshot.version }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not save department settings.');
      if (activeIdentity.current !== identity) return;
      setSnapshot({ identity, departments: result.departments, version: result.version }); setError('');
    } finally { busy.current = false; setSaving(false); }
  };
  const departments = snapshot.identity === identity ? snapshot.departments : null;
  return <Context.Provider value={{ departments, ready: ready && snapshot.identity === identity, saving, error, save, selection: departmentSelection(departments || [], user) }}>{children}</Context.Provider>;
}
export function useDepartmentNavigation() {
  const value = useContext(Context);
  if (!value) throw new Error('DepartmentNavigationProvider is required.');
  return value;
}
