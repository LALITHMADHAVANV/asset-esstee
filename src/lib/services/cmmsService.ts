import { textValue } from '@/lib/textValue';
import {
  Machine,
  MachineStatus,
  SparePart,
  RepairTicket,
  RepairUrgency,
  PPMSchedule,
  FloorLine,
  PartRequisition,
  RequisitionStatus,
  AppNotification,
} from '@/types/cmms';
import plantAssetsSeed from '@/data/plantAssetsSeed.json';
import factorySparesSeed from '@/data/factorySparesSeed.json';
import { hasAssetId } from '@/lib/assetIdentity';

// Local storage keys for offline/immediate UI responsiveness
const STORAGE_KEYS = {
  MACHINES: 'cmms_machines',
  PARTS: 'cmms_parts',
  REPAIRS: 'cmms_repairs',
  PPM: 'cmms_ppm',
  REQUISITIONS: 'cmms_requisitions',
  NOTIFICATIONS: 'cmms_notifications',
  SEEDED: 'cmms_seeded',
};

// In-memory subscriber registry for reactive updates
type Listener<T> = (data: T) => void;
const listeners = {
  machines: new Set<Listener<Machine[]>>(),
  parts: new Set<Listener<SparePart[]>>(),
  repairs: new Set<Listener<RepairTicket[]>>(),
  ppm: new Set<Listener<PPMSchedule[]>>(),
  requisitions: new Set<Listener<PartRequisition[]>>(),
  notifications: new Set<Listener<AppNotification[]>>(),
};

function getActiveTenant(): string {
  if (typeof window === 'undefined') return 'esstee';
  try {
    const active = localStorage.getItem('cmms_active_company') || localStorage.getItem('cmms_active_tenant');
    if (active) {
      return active.toLowerCase().trim();
    }
    const stored = localStorage.getItem('cmms_current_user');
    if (stored) {
      const u = JSON.parse(stored);
      if (u?.companySlug) return textValue(u.companySlug).toLowerCase().trim();
    }
  } catch { }
  return 'esstee';
}

function getLocal<T>(key: string, defaultVal: T): T {
  if (typeof window === 'undefined') return defaultVal;
  try {
    const tenant = getActiveTenant();
    const tenantKey = `${tenant}_${key}`;
    const scopedRaw = localStorage.getItem(tenantKey);
    if (scopedRaw) return JSON.parse(scopedRaw);

    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultVal;
    return defaultVal;
  } catch {
    return defaultVal;
  }
}

function setLocal<T>(key: string, val: T): void {
  if (typeof window === 'undefined') return;
  try {
    const tenant = getActiveTenant();
    const tenantKey = `${tenant}_${key}`;
    localStorage.setItem(tenantKey, JSON.stringify(val));
    localStorage.setItem(key, JSON.stringify(val));
  } catch (err) {
    console.warn('LocalStorage error:', err);
  }
}

function notifyLocal<T>(channel: keyof typeof listeners, data: T) {
  listeners[channel].forEach((listener) => {
    try {
      (listener as Listener<T>)(data);
    } catch (e) {
      console.error(`Listener error on ${channel}:`, e);
    }
  });
}

export function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const target = url;
  const headers = new Headers(init?.headers);

  if (typeof window !== 'undefined') {
    try {
      const activeTenant = getActiveTenant();
      if (activeTenant) {
        headers.set('x-company-slug', activeTenant);
        headers.set('x-tenant-id', activeTenant);
      }
    } catch { }
  }

  return fetch(target, { credentials: 'include', ...init, headers });
}

/**
 * Initialize local storage state with plantAssetsSeed when cache is empty
 */
export function initLocalSeedData(): void {
  if (typeof window === 'undefined') return;
  const current = getLocal<Machine[]>(STORAGE_KEYS.MACHINES, []);
  if (!current || current.length === 0) {
    if (plantAssetsSeed && Array.isArray(plantAssetsSeed) && plantAssetsSeed.length > 0) {
      setLocal(STORAGE_KEYS.MACHINES, plantAssetsSeed as unknown as Machine[]);
    }
  }
}

/**
 * Clear all demo work orders & repair tickets from MongoDB and local storage
 */
export async function clearAllRepairs(): Promise<void> {
  if (typeof window !== 'undefined') {
    setLocal(STORAGE_KEYS.REPAIRS, []);
    setLocal(STORAGE_KEYS.NOTIFICATIONS, []);
    localStorage.removeItem(STORAGE_KEYS.REPAIRS);
    notifyLocal('repairs', []);
    notifyLocal('notifications', []);
  }
  try {
    await apiFetch('/api/repairs?all=true', { method: 'DELETE' });
  } catch (err) {
    console.error('Failed to clear repairs from MongoDB:', err);
  }
}

/**
 * Reset local database to empty/initial
 */
export async function resetToSeedData(): Promise<void> {
  if (typeof window !== 'undefined') {
    setLocal(STORAGE_KEYS.MACHINES, []);
    setLocal(STORAGE_KEYS.PARTS, []);
    setLocal(STORAGE_KEYS.REPAIRS, []);
    setLocal(STORAGE_KEYS.PPM, []);
    setLocal(STORAGE_KEYS.REQUISITIONS, []);
    localStorage.removeItem(STORAGE_KEYS.SEEDED);

    notifyLocal('machines', []);
    notifyLocal('parts', []);
    notifyLocal('repairs', []);
    notifyLocal('ppm', []);
    notifyLocal('requisitions', []);
  }
}

/* ======================================================================
   MACHINES SERVICE (MongoDB via /api/machines)
   ====================================================================== */

let lastFetchMachinesTime = 0;
let inFlightMachines: Promise<void> | null = null;

export async function fetchMachinesOnce(force = false): Promise<void> {
  const now = Date.now();
  if (!force && now - lastFetchMachinesTime < 3000) {
    if (inFlightMachines) return inFlightMachines;
    return;
  }
  lastFetchMachinesTime = now;
  inFlightMachines = (async () => {
    try {
      const res = await apiFetch('/api/machines');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setLocal(STORAGE_KEYS.MACHINES, json.data);
        notifyLocal('machines', json.data);
      }
    } catch (err) {
      console.warn('MongoDB fetch machines fallback:', err);
    } finally {
      inFlightMachines = null;
    }
  })();
  return inFlightMachines;
}

export function subscribeMachines(callback: (machines: Machine[]) => void): () => void {
  initLocalSeedData();
  // Check both cached records and every later update, including optimistic writes.
  const deliver = (records: Machine[]) => {
    const valid = Array.isArray(records) ? records.filter(hasAssetId) : [];
    if (Array.isArray(records) && valid.length !== records.length) {
      console.warn(`Skipped ${records.length - valid.length} machine record(s) without a valid id. Correct the imported machines collection.`);
    }
    callback(valid);
  };
  const current = getLocal<Machine[]>(STORAGE_KEYS.MACHINES, []);
  deliver(current);
  listeners.machines.add(deliver);

  fetchMachinesOnce();

  return () => {
    listeners.machines.delete(deliver);
  };
}

export async function createMachine(machine: Machine): Promise<void> {
  const current = getLocal<Machine[]>(STORAGE_KEYS.MACHINES, []);
  const existsIndex = current.findIndex((m) => textValue(m.id).toLowerCase() === textValue(machine.id).toLowerCase());
  let updated: Machine[];

  if (existsIndex >= 0) {
    updated = [...current];
    updated[existsIndex] = machine;
  } else {
    updated = [machine, ...current];
  }
  setLocal(STORAGE_KEYS.MACHINES, updated);
  notifyLocal('machines', updated);

  try {
    await apiFetch('/api/machines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(machine),
    });
  } catch (e) {
    console.error('MongoDB createMachine error:', e);
  }
}

export async function relocateMachine(
  machineId: string,
  targetLine: FloorLine,
  stationNo: string,
  reason: string = 'Line rebalancing',
  mechanicName: string = 'Ramesh Kumar'
): Promise<void> {
  const currentMachines = getLocal<Machine[]>(STORAGE_KEYS.MACHINES, []);
  const machine = currentMachines.find((m) => m.id === machineId);
  if (!machine) return;

  const oldLine = machine.currentLine;
  const oldStation = machine.stationNo || 'Station 01';
  const newStation = stationNo || 'Station 01';
  const newStatus = targetLine === 'Buffer Workshop' ? 'BUFFER' : targetLine === 'Scrap Bay' ? 'SCRAP' : 'ACTIVE';
  const movedAt = new Date().toISOString();

  const moveRecord = {
    fromLine: oldLine,
    fromStation: oldStation,
    toLine: targetLine,
    toStation: newStation,
    movedAt,
    movedBy: mechanicName,
    reason,
  };

  const updatedMachines = currentMachines.map((m) =>
    m.id === machineId
      ? {
        ...m,
        currentLine: targetLine,
        area: targetLine,
        department: targetLine.includes('Line') ? 'Sewing Floor' : (targetLine as any),
        stationNo: newStation,
        status: newStatus,
        previousLine: oldLine,
        previousStation: oldStation,
        lastMovedAt: movedAt,
        lastMovedReason: reason,
        lastMovedBy: mechanicName,
        relocationHistory: [moveRecord, ...(m.relocationHistory || [])],
      }
      : m
  );
  setLocal(STORAGE_KEYS.MACHINES, updatedMachines);
  notifyLocal('machines', updatedMachines);

  // Log relocation event in repairs history ledger
  const relocationRecord: RepairTicket = {
    id: `HIST-${Date.now().toString().slice(-4)}`,
    machineId,
    machineType: machine.typeName || machine.type,
    line: targetLine,
    reportedAt: movedAt,
    reportedBy: mechanicName,
    faultCategory: 'Line Rebalancing',
    faultDetails: `Relocated from ${oldLine} (${oldStation}) to ${targetLine} (${newStation}). Reason: ${reason}`,
    urgency: 'WARNING',
    status: 'COMPLETED',
    attendedBy: mechanicName,
    resolvedAt: movedAt,
    downtimeMinutes: 15,
    actionTaken: `Transferred machine from ${oldLine} (${oldStation}) to ${targetLine} (${newStation}). Re-leveled on floor, connected pneumatics, and tested sewing tension.`,
    partsUsed: [],
  };

  const currentRepairs = getLocal<RepairTicket[]>(STORAGE_KEYS.REPAIRS, []);
  const updatedRepairs = [relocationRecord, ...currentRepairs];
  setLocal(STORAGE_KEYS.REPAIRS, updatedRepairs);
  notifyLocal('repairs', updatedRepairs);

  try {
    await apiFetch('/api/machines', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: machineId,
        updates: {
          currentLine: targetLine,
          area: targetLine,
          department: targetLine.includes('Line') ? 'Sewing Floor' : (targetLine as any),
          stationNo: newStation,
          status: newStatus,
          previousLine: oldLine,
          previousStation: oldStation,
          lastMovedAt: movedAt,
          lastMovedReason: reason,
          lastMovedBy: mechanicName,
          relocationHistory: [moveRecord, ...(machine.relocationHistory || [])],
        },
      }),
    });

    await apiFetch('/api/repairs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(relocationRecord),
    });
  } catch (e) {
    console.error('MongoDB relocateMachine error:', e);
  }
}

export async function updateMachineStatus(
  machineId: string,
  status: MachineStatus
): Promise<void> {
  const currentMachines = getLocal<Machine[]>(STORAGE_KEYS.MACHINES, []);
  const updatedMachines = currentMachines.map((m) =>
    m.id === machineId ? { ...m, status } : m
  );
  setLocal(STORAGE_KEYS.MACHINES, updatedMachines);
  notifyLocal('machines', updatedMachines);

  try {
    await apiFetch('/api/machines', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: machineId, updates: { status } }),
    });
  } catch (e) {
    console.error('MongoDB updateMachineStatus error:', e);
  }
}

export async function updateMachine(
  machineId: string,
  updates: Partial<Machine>
): Promise<void> {
  const currentMachines = getLocal<Machine[]>(STORAGE_KEYS.MACHINES, []);
  const updatedMachines = currentMachines.map((m) =>
    m.id === machineId ? { ...m, ...updates } : m
  );
  setLocal(STORAGE_KEYS.MACHINES, updatedMachines);
  notifyLocal('machines', updatedMachines);

  try {
    await apiFetch('/api/machines', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: machineId, updates }),
    });
  } catch (e) {
    console.error('MongoDB updateMachine error:', e);
  }
}

export async function deleteMachine(machineId: string): Promise<void> {
  const currentMachines = getLocal<Machine[]>(STORAGE_KEYS.MACHINES, []);
  const updatedMachines = currentMachines.filter((m) => m.id !== machineId);
  setLocal(STORAGE_KEYS.MACHINES, updatedMachines);
  notifyLocal('machines', updatedMachines);

  try {
    await apiFetch('/api/machines', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: machineId }),
    });
  } catch (e) {
    console.error('MongoDB deleteMachine error:', e);
  }
}

/* ======================================================================
   SPARE PARTS SERVICE (MongoDB via /api/parts)
   ====================================================================== */

let lastFetchPartsTime = 0;
let inFlightParts: Promise<void> | null = null;

export async function fetchPartsOnce(force = false): Promise<void> {
  const now = Date.now();
  if (!force && now - lastFetchPartsTime < 3000) {
    if (inFlightParts) return inFlightParts;
    return;
  }
  lastFetchPartsTime = now;
  inFlightParts = (async () => {
    try {
      const res = await apiFetch('/api/parts');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setLocal(STORAGE_KEYS.PARTS, json.data);
        notifyLocal('parts', json.data);
      }
    } catch (err) {
      console.warn('MongoDB fetch parts fallback:', err);
    } finally {
      inFlightParts = null;
    }
  })();
  return inFlightParts;
}

export function subscribeParts(callback: (parts: SparePart[]) => void): () => void {
  initLocalSeedData();
  const current = getLocal<SparePart[]>(STORAGE_KEYS.PARTS, []);
  callback(current);
  listeners.parts.add(callback);

  fetchPartsOnce();

  return () => {
    listeners.parts.delete(callback);
  };
}

export async function adjustPartStock(partId: string, delta: number): Promise<void> {
  const currentParts = getLocal<SparePart[]>(STORAGE_KEYS.PARTS, []);
  const target = currentParts.find((p) => p.partId === partId);
  if (!target) return;

  const newStock = Math.max(0, target.stock + delta);
  const updatedParts = currentParts.map((p) =>
    p.partId === partId ? { ...p, stock: newStock } : p
  );
  setLocal(STORAGE_KEYS.PARTS, updatedParts);
  notifyLocal('parts', updatedParts);

  try {
    await apiFetch('/api/parts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ partId, updates: { stock: newStock } }),
    });
  } catch (e) {
    console.error('MongoDB adjustPartStock error:', e);
  }
}

export async function restockPart(partId: string, quantity: number, poRef?: string): Promise<void> {
  if (quantity <= 0) return;
  const currentParts = getLocal<SparePart[]>(STORAGE_KEYS.PARTS, []);
  const target = currentParts.find((p) => p.partId === partId);
  if (!target) return;

  const newStock = target.stock + quantity;
  const updatedParts = currentParts.map((p) =>
    p.partId === partId ? { ...p, stock: newStock } : p
  );
  setLocal(STORAGE_KEYS.PARTS, updatedParts);
  notifyLocal('parts', updatedParts);

  try {
    await apiFetch('/api/parts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ partId, updates: { stock: newStock } }),
    });
  } catch (e) {
    console.error('MongoDB restockPart error:', e);
  }
}

/* ======================================================================
   REPAIRS & WORK ORDERS SERVICE (MongoDB via /api/repairs)
   ====================================================================== */

let lastFetchRepairsTime = 0;
let inFlightRepairs: Promise<void> | null = null;

export async function fetchRepairsOnce(force = false): Promise<void> {
  const now = Date.now();
  if (!force && now - lastFetchRepairsTime < 3000) {
    if (inFlightRepairs) return inFlightRepairs;
    return;
  }
  lastFetchRepairsTime = now;
  inFlightRepairs = (async () => {
    try {
      const res = await apiFetch('/api/repairs');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setLocal(STORAGE_KEYS.REPAIRS, json.data);
        notifyLocal('repairs', json.data);
      }
    } catch (err) {
      console.warn('MongoDB fetch repairs fallback:', err);
    } finally {
      inFlightRepairs = null;
    }
  })();
  return inFlightRepairs;
}

export function subscribeRepairs(callback: (repairs: RepairTicket[]) => void): () => void {
  initLocalSeedData();
  const current = getLocal<RepairTicket[]>(STORAGE_KEYS.REPAIRS, []);
  callback(current);
  listeners.repairs.add(callback);

  fetchRepairsOnce();

  return () => {
    listeners.repairs.delete(callback);
  };
}

if (typeof window !== 'undefined') {
  window.addEventListener('cmms_tenant_changed', () => {
    initLocalSeedData();
    fetchMachinesOnce(true);
    fetchPartsOnce(true);
    fetchRepairsOnce(true);
  });
}


export async function createBreakdownTicket(
  ticketData: Omit<
    RepairTicket,
    'id' | 'status' | 'resolvedAt' | 'downtimeMinutes' | 'actionTaken' | 'partsUsed' | 'attendedBy'
  > & { attendedBy?: string | null; assignedBy?: string }
): Promise<string> {
  const ticketId = `WO-${Math.floor(1000 + Math.random() * 9000)}`;
  const newTicket: RepairTicket = {
    ...ticketData,
    id: ticketId,
    status: ticketData.attendedBy ? 'ASSIGNED' : 'PENDING',
    attendedBy: ticketData.attendedBy ?? null,
    assignedBy: ticketData.assignedBy || (ticketData.attendedBy ? 'Floor Dispatch' : undefined),
    resolvedAt: null,
    downtimeMinutes: 0,
    actionTaken: '',
    partsUsed: [],
  };

  // 1. Update repairs list
  const currentRepairs = getLocal<RepairTicket[]>(STORAGE_KEYS.REPAIRS, []);
  const updatedRepairs = [newTicket, ...currentRepairs];
  setLocal(STORAGE_KEYS.REPAIRS, updatedRepairs);
  notifyLocal('repairs', updatedRepairs);

  // 2. Set machine status to BREAKDOWN
  const currentMachines = getLocal<Machine[]>(STORAGE_KEYS.MACHINES, []);
  const updatedMachines = currentMachines.map((m) =>
    m.id === ticketData.machineId ? { ...m, status: 'BREAKDOWN' as const } : m
  );
  setLocal(STORAGE_KEYS.MACHINES, updatedMachines);
  notifyLocal('machines', updatedMachines);

  try {
    await apiFetch('/api/repairs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTicket),
    });
    await apiFetch('/api/machines', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: ticketData.machineId, updates: { status: 'BREAKDOWN' } }),
    });
  } catch (e) {
    console.error('MongoDB createBreakdownTicket error:', e);
  }

  return ticketId;
}

export async function startRepairTicket(
  ticketId: string,
  attendedBy?: string,
  partsUsedInputs: Array<{ partId: string; quantity: number }> = []
): Promise<void> {
  const currentRepairs = getLocal<RepairTicket[]>(STORAGE_KEYS.REPAIRS, []);
  const existing = currentRepairs.find((ticket) => ticket.id === ticketId || (ticket as any).ticketId === ticketId);
  if (!existing) throw new Error('Work order not found. Refresh and try again.');
  if (existing.status === 'COMPLETED' || existing.status === 'REJECTED') throw new Error('This work order is already closed.');
  if (existing.status === 'IN_PROGRESS' && existing.startedAt) return;
  const currentParts = getLocal<SparePart[]>(STORAGE_KEYS.PARTS, []);
  const startedAt = new Date().toISOString();

  const resolvedPartsUsed = partsUsedInputs
    .filter((pu) => pu.partId && pu.quantity > 0)
    .map((pu) => {
      const part = currentParts.find((p) => p.partId === pu.partId);
      return {
        partId: pu.partId,
        sku: part?.sku || pu.partId,
        name: part?.name || 'Standard Spare Part',
        quantity: pu.quantity,
      };
    });

  let foundTicket = false;
  const updatedRepairs = currentRepairs.map((t) => {
    if (t.id === ticketId || (t as any).ticketId === ticketId) {
      foundTicket = true;
      return {
        ...t,
        status: 'IN_PROGRESS' as const,
        startedAt: t.startedAt || startedAt,
        attendedBy: attendedBy || t.attendedBy,
        partsUsed: resolvedPartsUsed.length > 0 ? resolvedPartsUsed : t.partsUsed,
      };
    }
    return t;
  });

  if (!foundTicket) {
    updatedRepairs.unshift({
      id: ticketId,
      machineId: '',
      machineType: '',
      faultCategory: 'Mechanical Fault',
      urgency: 'HIGH',
      status: 'IN_PROGRESS',
      reportedAt: startedAt,
      startedAt,
      attendedBy,
      partsUsed: resolvedPartsUsed,
    } as unknown as RepairTicket);
  }

  try {
    const response = await apiFetch('/api/repairs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: ticketId,
        updates: {
          status: 'IN_PROGRESS',
          startedAt,
          attendedBy: attendedBy || undefined,
          partsUsed: resolvedPartsUsed.length > 0 ? resolvedPartsUsed : undefined,
        },
      }),
    });
    if (!response.ok) throw new Error('Could not save the work start.');
    setLocal(STORAGE_KEYS.REPAIRS, updatedRepairs);
    notifyLocal('repairs', updatedRepairs);
    if (resolvedPartsUsed.length > 0) {
      const updatedParts = currentParts.map((part) => {
        const used = resolvedPartsUsed.find((u) => u.partId === part.partId);
        return used ? { ...part, stock: Math.max(0, part.stock - used.quantity) } : part;
      });
      setLocal(STORAGE_KEYS.PARTS, updatedParts);
      notifyLocal('parts', updatedParts);
    }
  } catch (e) {
    console.error('MongoDB startRepairTicket error:', e);
    throw e;
  }
}

export async function stopRepairTicket(ticketId: string, notes?: string): Promise<void> {
  const currentRepairs = getLocal<RepairTicket[]>(STORAGE_KEYS.REPAIRS, []);
  const ticket = currentRepairs.find((t) => t.id === ticketId);
  if (!ticket) throw new Error('Work order not found. Refresh and try again.');
  if (ticket.status !== 'IN_PROGRESS' || !ticket.startedAt) return;

  const now = Date.now();
  let addedMinutes = 0;
  if (ticket.startedAt) {
    const startMs = new Date(ticket.startedAt).getTime();
    if (!isNaN(startMs) && startMs < now) {
      addedMinutes = Math.max(1, Math.round((now - startMs) / 60000));
    }
  }

  const newDowntime = (ticket.downtimeMinutes || 0) + addedMinutes;
  const newActionTaken = notes
    ? `${ticket.actionTaken ? ticket.actionTaken + ' | ' : ''}Work paused: ${notes}`
    : ticket.actionTaken;

  const updatedRepairs = currentRepairs.map((t) =>
    t.id === ticketId
      ? {
        ...t,
        status: 'ASSIGNED' as const,
        startedAt: null,
        downtimeMinutes: newDowntime,
        actionTaken: newActionTaken,
      }
      : t
  );
  try {
    const response = await apiFetch('/api/repairs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: ticketId,
        updates: {
          status: 'ASSIGNED',
          startedAt: null,
          downtimeMinutes: newDowntime,
          actionTaken: newActionTaken,
        },
      }),
    });
    if (!response.ok) throw new Error('Could not save the work stop.');
    setLocal(STORAGE_KEYS.REPAIRS, updatedRepairs);
    notifyLocal('repairs', updatedRepairs);
  } catch (e) {
    console.error('MongoDB stopRepairTicket error:', e);
    throw e;
  }
}

export async function rejectRepairTicket(
  ticketId: string,
  rejectedBy: string = 'Supervisor',
  reason: string = 'False report / operator error'
): Promise<void> {
  const currentRepairs = getLocal<RepairTicket[]>(STORAGE_KEYS.REPAIRS, []);
  const currentMachines = getLocal<Machine[]>(STORAGE_KEYS.MACHINES, []);

  const ticket = currentRepairs.find((t) => t.id === ticketId);
  if (!ticket) return;

  const nowIso = new Date().toISOString();
  const rejectionNote = reason.trim()
    ? `Rejected by ${rejectedBy}: ${reason.trim()}`
    : `Rejected by ${rejectedBy}`;

  // 1. Update ticket status to REJECTED and record who declined it
  const updatedRepairs = currentRepairs.map((t) =>
    t.id === ticketId
      ? {
        ...t,
        status: 'REJECTED' as const,
        resolvedAt: nowIso,
        completedAt: nowIso,
        actionTaken: rejectionNote,
        attendedBy: rejectedBy,
      }
      : t
  );

  // 2. Restore machine status to ACTIVE immediately
  const updatedMachines = currentMachines.map((m) =>
    m.id === ticket.machineId ? { ...m, status: 'ACTIVE' as const } : m
  );

  setLocal(STORAGE_KEYS.REPAIRS, updatedRepairs);
  setLocal(STORAGE_KEYS.MACHINES, updatedMachines);
  notifyLocal('repairs', updatedRepairs);
  notifyLocal('machines', updatedMachines);

  try {
    await apiFetch('/api/repairs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: ticketId,
        updates: {
          status: 'REJECTED',
          resolvedAt: nowIso,
          completedAt: nowIso,
          actionTaken: rejectionNote,
          attendedBy: rejectedBy,
          rejectedBy,
          rejectionReason: reason,
        },
      }),
    });

    await apiFetch('/api/machines', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: ticket.machineId,
        updates: { status: 'ACTIVE' },
      }),
    });
  } catch (e) {
    console.error('MongoDB rejectRepairTicket error:', e);
  }
}

export async function resolveRepairTicket(
  ticketId: string,
  downtimeMinutes: number,
  actionTaken: string,
  attendedBy: string,
  partsUsedInputs: Array<{ partId: string; quantity: number }> = [],
  details?: {
    repairCost?: number;
    laborCost?: number;
    partsCost?: number;
    issuesIdentified?: string;
    proofImage?: string;
    completedAt?: string;
  }
): Promise<void> {
  const currentRepairs = getLocal<RepairTicket[]>(STORAGE_KEYS.REPAIRS, []);
  const currentParts = getLocal<SparePart[]>(STORAGE_KEYS.PARTS, []);
  const currentMachines = getLocal<Machine[]>(STORAGE_KEYS.MACHINES, []);

  let ticket = currentRepairs.find((t) => t.id === ticketId || (t as any).ticketId === ticketId);
  if (!ticket) {
    // If ticket was not yet stored in localStorage, construct a fallback ticket so resolving never crashes!
    ticket = {
      id: ticketId,
      machineId: '',
      machineType: '',
      faultCategory: 'Mechanical Fault',
      urgency: 'HIGH',
      status: 'IN_PROGRESS',
      reportedAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      attendedBy,
    } as unknown as RepairTicket;
  }

  // If partsUsedInputs was provided, use it; otherwise, use parts already reserved on the ticket from the start step!
  const effectivePartsInputs = (partsUsedInputs && partsUsedInputs.length > 0)
    ? partsUsedInputs
    : (ticket.partsUsed || []).map((p) => ({ partId: p.partId, quantity: p.quantity }));

  const resolvedPartsUsed = effectivePartsInputs
    .filter((pu) => pu.partId && pu.quantity > 0)
    .map((pu) => {
      const part = currentParts.find((p) => p.partId === pu.partId);
      return {
        partId: pu.partId,
        sku: part?.sku || pu.partId,
        name: part?.name || 'Standard Spare Part',
        quantity: pu.quantity,
      };
    });

  // Calculate default parts cost if not passed
  const calculatedPartsCost = resolvedPartsUsed.reduce((sum, pu) => {
    const part = currentParts.find((p) => p.partId === pu.partId);
    return sum + (part ? part.unitCost * pu.quantity : pu.quantity * 250);
  }, 0);
  const calculatedLaborCost = Math.round(((downtimeMinutes || 30) / 60) * 350);
  const finalRepairCost = typeof details?.repairCost === 'number' && details.repairCost >= 0
    ? details.repairCost
    : calculatedPartsCost + calculatedLaborCost;

  const nowIso = details?.completedAt || new Date().toISOString();

  let calculatedTimeSpent = downtimeMinutes;
  if (ticket.startedAt) {
    const startMs = new Date(ticket.startedAt).getTime();
    if (!isNaN(startMs)) {
      calculatedTimeSpent = (ticket.downtimeMinutes || 0) + Math.max(1, Math.round((Date.now() - startMs) / 60000));
    }
  }

  // 1. Update repairs document
  let ticketUpdated = false;
  const updatedRepairs = currentRepairs.map((t) => {
    if (t.id === ticketId || (t as any).ticketId === ticketId) {
      ticketUpdated = true;
      return {
        ...t,
        status: 'COMPLETED' as const,
        resolvedAt: nowIso,
        completedAt: nowIso,
        downtimeMinutes,
        actionTaken,
        attendedBy,
        partsUsed: resolvedPartsUsed,
        repairCost: finalRepairCost,
        laborCost: details?.laborCost ?? calculatedLaborCost,
        partsCost: details?.partsCost ?? calculatedPartsCost,
        issuesIdentified: details?.issuesIdentified || t.faultDetails || '',
        completionProofImage: details?.proofImage || t.completionProofImage,
      };
    }
    return t;
  });

  if (!ticketUpdated) {
    updatedRepairs.unshift({
      ...ticket,
      status: 'COMPLETED' as const,
      resolvedAt: nowIso,
      completedAt: nowIso,
      downtimeMinutes,
      actionTaken,
      attendedBy,
      partsUsed: resolvedPartsUsed,
      repairCost: finalRepairCost,
      laborCost: details?.laborCost ?? calculatedLaborCost,
      partsCost: details?.partsCost ?? calculatedPartsCost,
      issuesIdentified: details?.issuesIdentified || '',
      completionProofImage: details?.proofImage,
    });
  }

  // 2. Decrement parts stock
  const updatedParts = currentParts.map((part) => {
    const used = resolvedPartsUsed.find((u) => u.partId === part.partId);
    if (!used) return part;
    return {
      ...part,
      stock: Math.max(0, part.stock - used.quantity),
    };
  });

  // 3. Set machine status to ACTIVE and increment totalDowntimeMinutes
  const updatedMachines = currentMachines.map((m) => {
    if (m.id !== ticket.machineId) return m;
    return {
      ...m,
      status: 'ACTIVE' as const,
      totalDowntimeMinutes: (m.totalDowntimeMinutes || 0) + downtimeMinutes,
    };
  });

  setLocal(STORAGE_KEYS.REPAIRS, updatedRepairs);
  setLocal(STORAGE_KEYS.PARTS, updatedParts);
  setLocal(STORAGE_KEYS.MACHINES, updatedMachines);

  notifyLocal('repairs', updatedRepairs);
  notifyLocal('parts', updatedParts);
  notifyLocal('machines', updatedMachines);

  try {
    const res = await apiFetch('/api/repairs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: ticketId,
        updates: {
          status: 'COMPLETED',
          resolvedAt: nowIso,
          completedAt: nowIso,
          startedAt: ticket.startedAt,
          downtimeMinutes,
          timeSpentMinutes: calculatedTimeSpent,
          actionTaken,
          attendedBy,
          partsUsed: resolvedPartsUsed,
          repairCost: finalRepairCost,
          issuesIdentified: details?.issuesIdentified,
          completionProofImage: details?.proofImage,
        },
      }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      console.warn(`apiFetch PATCH /api/repairs status ${res.status}:`, errJson);
    }

    for (const p of resolvedPartsUsed) {
      const partDoc = currentParts.find((cp) => cp.partId === p.partId);
      if (partDoc) {
        await apiFetch('/api/parts', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            partId: p.partId,
            updates: { stock: Math.max(0, partDoc.stock - p.quantity) },
          }),
        }).catch((e) => console.warn('parts stock patch warning:', e));
      }
    }

    if (ticket.machineId) {
      const machineDoc = currentMachines.find((m) => m.id === ticket.machineId);
      await apiFetch('/api/machines', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: ticket.machineId,
          updates: {
            status: 'ACTIVE',
            totalDowntimeMinutes: (machineDoc?.totalDowntimeMinutes || 0) + downtimeMinutes,
          },
        }),
      }).catch((e) => console.warn('machines patch warning:', e));
    }
  } catch (err) {
    console.error('MongoDB resolveRepairTicket error:', err);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATIONS SERVICE
// ─────────────────────────────────────────────────────────────────────────────

export function subscribeNotifications(callback: (notifications: AppNotification[]) => void): () => void {
  initLocalSeedData();
  const current = getLocal<AppNotification[]>(STORAGE_KEYS.NOTIFICATIONS, [
    {
      id: 'NOTIF-INIT-01',
      type: 'GENERAL',
      title: 'Factory CMMS Online',
      message: 'System operational with real-time sync across maintenance & store terminals.',
      senderName: 'System Core',
      createdAt: new Date().toISOString(),
      acknowledged: true,
    },
  ]);
  callback(current);
  listeners.notifications.add(callback);
  return () => {
    listeners.notifications.delete(callback);
  };
}

export function sendAppNotification(
  notif: Omit<AppNotification, 'id' | 'createdAt' | 'acknowledged'>
): AppNotification {
  const newNotif: AppNotification = {
    ...notif,
    id: `NOTIF-${Date.now().toString().slice(-6)}`,
    createdAt: new Date().toISOString(),
    acknowledged: false,
  };
  const current = getLocal<AppNotification[]>(STORAGE_KEYS.NOTIFICATIONS, []);
  const updated = [newNotif, ...current].slice(0, 50);
  setLocal(STORAGE_KEYS.NOTIFICATIONS, updated);
  notifyLocal('notifications', updated);
  return newNotif;
}

export function acknowledgeAppNotification(id: string): void {
  const current = getLocal<AppNotification[]>(STORAGE_KEYS.NOTIFICATIONS, []);
  const updated = current.map((n) =>
    n.id === id ? { ...n, acknowledged: true, acknowledgedAt: new Date().toISOString() } : n
  );
  setLocal(STORAGE_KEYS.NOTIFICATIONS, updated);
  notifyLocal('notifications', updated);
}

export async function assignRepairTicket(
  ticketId: string,
  mechanicName: string,
  assignedBy?: string
): Promise<void> {
  const currentRepairs = getLocal<RepairTicket[]>(STORAGE_KEYS.REPAIRS, []);
  const updatedRepairs = currentRepairs.map((r) =>
    r.id === ticketId
      ? {
        ...r,
        attendedBy: mechanicName,
        assignedBy: assignedBy || r.assignedBy || 'Senior Mechanic',
        status: (r.status === 'COMPLETED' ? 'COMPLETED' : 'ASSIGNED') as RepairTicket['status'],
      }
      : r
  );
  setLocal(STORAGE_KEYS.REPAIRS, updatedRepairs);
  notifyLocal('repairs', updatedRepairs);

  try {
    await apiFetch('/api/repairs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: ticketId,
        updates: {
          attendedBy: mechanicName,
          assignedBy: assignedBy || 'Senior Mechanic',
          status: 'ASSIGNED',
        },
      }),
    });
  } catch (e) {
    console.error('MongoDB assignRepairTicket error:', e);
  }
}

export interface AssignMechanicTaskInput {
  machineId: string;
  machineType?: string;
  line?: string;
  taskTitle: string;
  faultDetails: string;
  urgency: RepairUrgency;
  assignedTo: string;
  assignedBy: string;
  scheduledDate: string; // 'YYYY-MM-DD'
  shift?: string;
  taskCategory?: string;
}

export async function assignMechanicTask(input: AssignMechanicTaskInput): Promise<string> {
  const currentMachines = getLocal<Machine[]>(STORAGE_KEYS.MACHINES, []);
  const targetMachine = currentMachines.find(
    (m) => textValue(m.id).toLowerCase() === textValue(input.machineId).toLowerCase()
  );

  const machineType =
    input.machineType || targetMachine?.typeName || targetMachine?.type || 'Sewing Machine';
  const line = input.line || targetMachine?.currentLine || 'Line 01';

  const ticketId = `WO-${Math.floor(1000 + Math.random() * 9000)}`;
  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0];
  const isoTimestamp = `${input.scheduledDate}T${timeStr}.000Z`;

  const newTicket: RepairTicket = {
    id: ticketId,
    machineId: input.machineId,
    machineType,
    line,
    reportedAt: isoTimestamp,
    reportedBy: input.assignedBy || 'Senior Mechanic Dispatch',
    faultCategory: input.taskTitle,
    faultDetails: input.shift ? `[${input.shift}] ${input.faultDetails}` : input.faultDetails,
    urgency: input.urgency,
    status: 'ASSIGNED',
    attendedBy: input.assignedTo,
    assignedBy: input.assignedBy,
    resolvedAt: null,
    downtimeMinutes: 0,
    actionTaken: `Assigned by ${input.assignedBy} to ${input.assignedTo}`,
    partsUsed: [],
  };

  const currentRepairs = getLocal<RepairTicket[]>(STORAGE_KEYS.REPAIRS, []);
  const updatedRepairs = [newTicket, ...currentRepairs];
  setLocal(STORAGE_KEYS.REPAIRS, updatedRepairs);
  notifyLocal('repairs', updatedRepairs);

  if (targetMachine) {
    const newStatus: MachineStatus =
      input.urgency === 'CRITICAL' ? 'BREAKDOWN' : 'UNDER_MAINTENANCE';
    const updatedMachines = currentMachines.map((m) =>
      textValue(m.id).toLowerCase() === textValue(input.machineId).toLowerCase() ? { ...m, status: newStatus } : m
    );
    setLocal(STORAGE_KEYS.MACHINES, updatedMachines);
    notifyLocal('machines', updatedMachines);

    try {
      await apiFetch('/api/machines', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: targetMachine.id, updates: { status: newStatus } }),
      });
    } catch (e) {
      console.error('MongoDB assignMechanicTask machine update error:', e);
    }
  }

  try {
    await apiFetch('/api/repairs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTicket),
    });
  } catch (e) {
    console.error('MongoDB assignMechanicTask ticket insert error:', e);
  }

  if (input.taskCategory === 'PPM') {
    const newPPM: PPMSchedule = {
      id: `PPM-${Math.floor(1000 + Math.random() * 9000)}`,
      machineId: input.machineId,
      task: input.taskTitle,
      intervalDays: 14,
      frequency: 'Weekly',
      lastServiced: new Date().toISOString().slice(0, 10),
      nextDue: input.scheduledDate,
      status: 'PENDING',
    };
    const currentPpm = getLocal<PPMSchedule[]>(STORAGE_KEYS.PPM, []);
    const updatedPpm = [newPPM, ...currentPpm];
    setLocal(STORAGE_KEYS.PPM, updatedPpm);
    notifyLocal('ppm', updatedPpm);

    try {
      await apiFetch('/api/ppm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPPM),
      });
    } catch (e) {
      console.error('MongoDB assignMechanicTask PPM insert error:', e);
    }
  }

  return ticketId;
}

/* ======================================================================
   PREVENTIVE MAINTENANCE (PPM) SERVICE (MongoDB via /api/ppm)
   ====================================================================== */

let lastFetchPPMTime = 0;
let inFlightPPM: Promise<void> | null = null;

export async function fetchPPMSchedulesOnce(force = false): Promise<void> {
  const now = Date.now();
  if (!force && now - lastFetchPPMTime < 3000) {
    if (inFlightPPM) return inFlightPPM;
    return;
  }
  lastFetchPPMTime = now;
  inFlightPPM = (async () => {
    try {
      const res = await apiFetch('/api/ppm');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setLocal(STORAGE_KEYS.PPM, json.data);
        notifyLocal('ppm', json.data);
      }
    } catch (err) {
      console.warn('MongoDB fetch ppm fallback:', err);
    } finally {
      inFlightPPM = null;
    }
  })();
  return inFlightPPM;
}

export function subscribePPMSchedules(callback: (schedules: PPMSchedule[]) => void): () => void {
  initLocalSeedData();
  const current = getLocal<PPMSchedule[]>(STORAGE_KEYS.PPM, []);
  callback(current);
  listeners.ppm.add(callback);

  fetchPPMSchedulesOnce();

  return () => {
    listeners.ppm.delete(callback);
  };
}

export async function startPPMTask(
  scheduleId: string,
  mechanicName: string = 'Technician'
): Promise<void> {
  const currentSchedules = getLocal<PPMSchedule[]>(STORAGE_KEYS.PPM, []);
  const now = new Date().toISOString();

  const updatedSchedules = currentSchedules.map((s) =>
    s.id === scheduleId
      ? {
        ...s,
        startedAt: s.startedAt || now,
        assignedTo: s.assignedTo || mechanicName,
        status: 'IN_PROGRESS' as const,
      }
      : s
  );
  setLocal(STORAGE_KEYS.PPM, updatedSchedules);
  notifyLocal('ppm', updatedSchedules);

  try {
    await apiFetch('/api/ppm', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: scheduleId,
        updates: {
          startedAt: now,
          assignedTo: mechanicName,
          status: 'IN_PROGRESS',
        },
      }),
    });
  } catch (err) {
    console.warn('MongoDB startPPMTask fallback:', err);
  }
}

export async function stopPPMTask(scheduleId: string): Promise<void> {
  const currentSchedules = getLocal<PPMSchedule[]>(STORAGE_KEYS.PPM, []);
  const updatedSchedules = currentSchedules.map((s) =>
    s.id === scheduleId
      ? {
        ...s,
        startedAt: undefined,
        status: 'SCHEDULED' as const,
      }
      : s
  );
  setLocal(STORAGE_KEYS.PPM, updatedSchedules);
  notifyLocal('ppm', updatedSchedules);

  try {
    await apiFetch('/api/ppm', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: scheduleId,
        updates: {
          startedAt: null,
          status: 'SCHEDULED',
        },
      }),
    });
  } catch (err) {
    console.warn('MongoDB stopPPMTask fallback:', err);
  }
}

export async function completePPMTask(
  scheduleId: string,
  mechanicName: string = 'Ramesh Kumar',
  proofImage?: string,
  durationMinutes?: number,
  notes?: string
): Promise<void> {
  const currentSchedules = getLocal<PPMSchedule[]>(STORAGE_KEYS.PPM, []);
  const target = currentSchedules.find((s) => s.id === scheduleId);
  if (!target) return;

  const today = new Date();
  const nextDueDate = new Date(today);
  nextDueDate.setDate(nextDueDate.getDate() + (target.intervalDays || 14));

  // Calculate actual elapsed minutes between startedAt and completion for MTTR
  let calculatedDuration = durationMinutes;
  if (!calculatedDuration && target.startedAt) {
    const startMs = new Date(target.startedAt).getTime();
    const elapsedMins = Math.round((today.getTime() - startMs) / 60000);
    calculatedDuration = Math.max(1, elapsedMins);
  }
  const finalDuration = calculatedDuration || 20;

  const updatedSchedules = currentSchedules.map((s) =>
    s.id === scheduleId
      ? {
        ...s,
        lastServiced: today.toISOString().slice(0, 10),
        nextDue: nextDueDate.toISOString().slice(0, 10),
        status: 'COMPLETED' as const,
        completedAt: today.toISOString(),
        completionProofImage: proofImage,
        actualDurationMinutes: finalDuration,
        technicianNotes: notes,
      }
      : s
  );
  setLocal(STORAGE_KEYS.PPM, updatedSchedules);
  notifyLocal('ppm', updatedSchedules);

  const ppmHistoryEntry: RepairTicket = {
    id: `HIST-${Math.floor(1000 + Math.random() * 9000)}`,
    machineId: target.machineId,
    machineType: 'Sewing Machinery',
    line: 'Floor Maintenance',
    reportedAt: target.startedAt || today.toISOString(),
    reportedBy: target.assignedBy || 'System Routine PPM',
    faultCategory: 'Preventive Overhaul',
    faultDetails: target.task,
    urgency: 'WARNING',
    status: 'COMPLETED',
    attendedBy: mechanicName,
    resolvedAt: today.toISOString(),
    downtimeMinutes: finalDuration,
    actionTaken:
      notes ||
      `Executed scheduled PPM overhaul: ${target.task}. Verified calibration, cleaned lint, lubricated mechanism. Inspection proof archived.`,
    partsUsed: [],
  };

  const currentRepairs = getLocal<RepairTicket[]>(STORAGE_KEYS.REPAIRS, []);
  const updatedRepairs = [ppmHistoryEntry, ...currentRepairs];
  setLocal(STORAGE_KEYS.REPAIRS, updatedRepairs);
  notifyLocal('repairs', updatedRepairs);

  try {
    await apiFetch('/api/ppm', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: scheduleId,
        updates: {
          lastServiced: today.toISOString().slice(0, 10),
          nextDue: nextDueDate.toISOString().slice(0, 10),
          status: 'COMPLETED',
          completedAt: today.toISOString(),
          actualDurationMinutes: finalDuration,
          completionProofImage: proofImage,
        },
      }),
    });

    await apiFetch('/api/repairs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ppmHistoryEntry),
    });
  } catch (e) {
    console.error('MongoDB completePPMTask error:', e);
  }
}

export async function createPPMSchedule(schedule: PPMSchedule): Promise<void> {
  const currentSchedules = getLocal<PPMSchedule[]>(STORAGE_KEYS.PPM, []);
  const updatedSchedules = [schedule, ...currentSchedules];
  setLocal(STORAGE_KEYS.PPM, updatedSchedules);
  notifyLocal('ppm', updatedSchedules);

  try {
    await apiFetch('/api/ppm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(schedule),
    });
  } catch (e) {
    console.error('MongoDB createPPMSchedule error:', e);
  }
}

/* ======================================================================
   MONTHLY INDENTS & CRITICAL CEO REQUISITIONS (MongoDB via /api/requisitions)
   ====================================================================== */

let lastFetchRequisitionsTime = 0;
let inFlightRequisitions: Promise<void> | null = null;

export async function fetchRequisitionsOnce(force = false): Promise<void> {
  const now = Date.now();
  if (!force && now - lastFetchRequisitionsTime < 3000) {
    if (inFlightRequisitions) return inFlightRequisitions;
    return;
  }
  lastFetchRequisitionsTime = now;
  inFlightRequisitions = (async () => {
    try {
      const res = await apiFetch('/api/requisitions');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setLocal(STORAGE_KEYS.REQUISITIONS, json.data);
        notifyLocal('requisitions', json.data);
      }
    } catch (err) {
      console.warn('MongoDB fetch requisitions fallback:', err);
    } finally {
      inFlightRequisitions = null;
    }
  })();
  return inFlightRequisitions;
}

export function subscribeRequisitions(
  callback: (requisitions: PartRequisition[]) => void
): () => void {
  initLocalSeedData();
  const current = getLocal<PartRequisition[]>(STORAGE_KEYS.REQUISITIONS, []);
  callback(current);
  listeners.requisitions.add(callback);

  fetchRequisitionsOnce();

  return () => {
    listeners.requisitions.delete(callback);
  };
}

export async function createRequisition(
  reqData: Omit<PartRequisition, 'id' | 'createdAt' | 'status'> & {
    status?: PartRequisition['status'];
  }
): Promise<string> {
  const reqId = `REQ-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
  const defaultStatus =
    reqData.status ||
    (reqData.type === 'CRITICAL_CEO'
      ? 'PENDING_CEO_APPROVAL'
      : reqData.type === 'URGENT_NEED'
        ? 'PENDING_MANAGER_APPROVAL'
        : 'PENDING_REVIEW');

  const newReq: PartRequisition = {
    ...reqData,
    id: reqId,
    status: defaultStatus,
    createdAt: new Date().toISOString(),
  };

  const currentReqs = getLocal<PartRequisition[]>(STORAGE_KEYS.REQUISITIONS, []);
  const updated = [newReq, ...currentReqs];
  setLocal(STORAGE_KEYS.REQUISITIONS, updated);
  notifyLocal('requisitions', updated);

  try {
    await apiFetch('/api/requisitions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newReq),
    });
  } catch (err) {
    console.error('MongoDB createRequisition error:', err);
  }

  return reqId;
}

export async function updateRequisitionStatus(
  reqId: string,
  status: RequisitionStatus,
  reviewerNotes?: string
): Promise<void> {
  const currentReqs = getLocal<PartRequisition[]>(STORAGE_KEYS.REQUISITIONS, []);
  const updated = currentReqs.map((r) =>
    r.id === reqId ? { ...r, status, reviewNotes: reviewerNotes || r.reviewNotes } : r
  );
  setLocal(STORAGE_KEYS.REQUISITIONS, updated);
  notifyLocal('requisitions', updated);

  try {
    await apiFetch('/api/requisitions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: reqId,
        updates: {
          status,
          reviewNotes: reviewerNotes || undefined,
        },
      }),
    });
  } catch (err) {
    console.error('MongoDB updateRequisitionStatus error:', err);
  }
}

export async function approveRequisition(
  reqId: string,
  reviewerName: string,
  notes: string,
  status: RequisitionStatus
): Promise<void> {
  const finalNotes = 'Approved by ' + reviewerName + ': ' + notes;
  await updateRequisitionStatus(reqId, status, finalNotes);
}

export async function rejectRequisition(
  reqId: string,
  reviewerName: string,
  notes: string
): Promise<void> {
  const finalNotes = 'Rejected by ' + reviewerName + ': ' + notes;
  await updateRequisitionStatus(reqId, 'REJECTED', finalNotes);
}

export async function fulfillMonthlyIndent(
  id: string,
  storePersonName: string = 'M. Arumugam (Stores In-Charge)',
  storeNotes: string = 'Inward shipment received into crib and verified against QC pass',
  actionType: 'RECEIVE_INTO_CRIB' | 'DISPATCH_TO_LINE' = 'RECEIVE_INTO_CRIB'
): Promise<void> {
  const currentReqs = getLocal<PartRequisition[]>(STORAGE_KEYS.REQUISITIONS, []);
  const targetReq = currentReqs.find((r) => r.id === id);
  if (!targetReq) return;

  const newStatus = actionType === 'DISPATCH_TO_LINE' ? 'FULFILLED' : 'ORDERED';

  const updatedReqs = currentReqs.map((r) =>
    r.id === id
      ? {
        ...r,
        status: newStatus as RequisitionStatus,
        assignedStorePerson: storePersonName,
        fulfilledAt: new Date().toISOString(),
        storeNotes,
      }
      : r
  );

  setLocal(STORAGE_KEYS.REQUISITIONS, updatedReqs);
  notifyLocal('requisitions', updatedReqs);

  if (actionType === 'RECEIVE_INTO_CRIB' && targetReq.items && targetReq.items.length > 0) {
    const currentParts = getLocal<SparePart[]>(STORAGE_KEYS.PARTS, []);
    const updatedParts = currentParts.map((p) => {
      const match = targetReq.items?.find((item) => item.partId === p.partId);
      if (match) {
        return { ...p, stock: p.stock + match.quantity };
      }
      return p;
    });
    setLocal(STORAGE_KEYS.PARTS, updatedParts);
    notifyLocal('parts', updatedParts);

    try {
      for (const item of targetReq.items) {
        const partDoc = currentParts.find((p) => p.partId === item.partId);
        if (partDoc) {
          await apiFetch('/api/parts', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              partId: item.partId,
              updates: { stock: partDoc.stock + item.quantity },
            }),
          });
        }
      }
    } catch (err) {
      console.warn('MongoDB stock intake warning:', err);
    }
  }

  try {
    await apiFetch('/api/requisitions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        updates: {
          status: newStatus,
          assignedStorePerson: storePersonName,
          fulfilledAt: new Date().toISOString(),
          storeNotes,
        },
      }),
    });
  } catch (err) {
    console.error('MongoDB fulfillMonthlyIndent error:', err);
  }
}

export async function fulfillMechanicIndent(
  id: string,
  storePersonName: string = 'Store In-Charge',
  storeNotes: string = 'Part verified, scrap returned, and handed over to mechanic at crib window',
  issuedQty?: number
): Promise<void> {
  const currentReqs = getLocal<PartRequisition[]>(STORAGE_KEYS.REQUISITIONS, []);
  const targetReq = currentReqs.find((r) => r.id === id);
  if (!targetReq) return;

  const updatedReqs = currentReqs.map((r) =>
    r.id === id
      ? {
        ...r,
        status: 'FULFILLED' as RequisitionStatus,
        assignedStorePerson: storePersonName,
        fulfilledAt: new Date().toISOString(),
        storeNotes,
      }
      : r
  );

  setLocal(STORAGE_KEYS.REQUISITIONS, updatedReqs);
  notifyLocal('requisitions', updatedReqs);

  // Deduct stock from parts
  const partId = targetReq.partId;
  const qtyToDeduct = issuedQty || targetReq.quantity || 1;
  if (partId) {
    await adjustPartStock(partId, -qtyToDeduct);
  }

  try {
    await apiFetch('/api/requisitions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        updates: {
          status: 'FULFILLED',
          assignedStorePerson: storePersonName,
          fulfilledAt: new Date().toISOString(),
          storeNotes,
        },
      }),
    });
  } catch (err) {
    console.error('MongoDB fulfillMechanicIndent error:', err);
  }
}

