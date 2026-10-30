'use client';

import { textValue } from '@/lib/textValue';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Wrench,
  Users,
  Search,
  Plus,
  Flame,
  AlertTriangle,
  UserCheck,
  X,
  Phone,
  ExternalLink,
  CheckCircle2,
  Check,
  XCircle,
} from 'lucide-react';
import { Machine, RepairTicket, RepairUrgency, PPMSchedule } from '@/types/cmms';
import { FACTORY_MECHANICS_ROSTER, MechanicDuty, userToMechanicDuty } from '@/lib/constants/mechanics';
import {
  createBreakdownTicket,
  assignRepairTicket,
  rejectRepairTicket,
} from '@/lib/services/cmmsService';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';

interface SupervisorFloorWorkspaceProps {
  machines: Machine[];
  repairs: RepairTicket[];
  ppmSchedules?: PPMSchedule[];
  userName?: string;
  role?: string;
  onRefresh: () => void;
  isExternalNewTicketOpen?: boolean;
  onCloseExternalNewTicket?: () => void;
}

export function SupervisorFloorWorkspace({
  machines,
  repairs,
  userName,
  role,
  onRefresh,
  isExternalNewTicketOpen = false,
  onCloseExternalNewTicket,
}: SupervisorFloorWorkspaceProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();

  const isElectricianRole = role === 'SENIOR_ELECTRICIAN';

  // Filter & Search state
  const [ticketSearch, setTicketSearch] = useState('');
  const [ticketFilter, setTicketFilter] = useState<'ALL' | 'CRITICAL' | 'IN_PROGRESS' | 'UNASSIGNED' | 'COMPLETED'>('ALL');
  const [lineFilter, setLineFilter] = useState<string>('ALL');
  const [rosterTradeFilter, setRosterTradeFilter] = useState<'ALL' | 'MECHANIC' | 'ELECTRICIAN'>(
    isElectricianRole ? 'ELECTRICIAN' : 'ALL'
  );

  // Modals state
  const [isNewTicketModalOpen, setIsNewTicketModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedTicketForAssign, setSelectedTicketForAssign] = useState<RepairTicket | null>(null);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [selectedTicketForReject, setSelectedTicketForReject] = useState<RepairTicket | null>(null);
  const [rejectReason, setRejectReason] = useState('False alarm / No defect found on inspection');
  const [isSubmittingReject, setIsSubmittingReject] = useState(false);

  // Sync external modal trigger if provided
  useEffect(() => {
    if (isExternalNewTicketOpen) {
      setIsNewTicketModalOpen(true);
    }
  }, [isExternalNewTicketOpen]);

  // Form state for New Breakdown Ticket
  const [newMachineId, setNewMachineId] = useState('');
  const [newFaultCategory, setNewFaultCategory] = useState('Skipping Stitches');
  const [newFaultDetails, setNewFaultDetails] = useState('');
  const [newUrgency, setNewUrgency] = useState<RepairUrgency>('CRITICAL');
  const [newAssignee, setNewAssignee] = useState('');
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);

  // Form state for Second Problem on Same Machine
  const [hasSecondProblem, setHasSecondProblem] = useState(false);
  const [secondFaultCategory, setSecondFaultCategory] = useState('Motor Electrical Noise');
  const [secondFaultDetails, setSecondFaultDetails] = useState('');
  const [secondUrgency, setSecondUrgency] = useState<RepairUrgency>('WARNING');
  const [secondAssignee, setSecondAssignee] = useState('');

  // Form state for Quick Assign
  const [assigneeName, setAssigneeName] = useState('');
  const [isSubmittingAssign, setIsSubmittingAssign] = useState(false);

  // Registered Techs from MongoDB User Collection
  const [registeredTechs, setRegisteredTechs] = useState<MechanicDuty[]>([]);

  useEffect(() => {
    fetch('/api/users')
      .then((r) => r.json())
      .then((data) => {
        if (data.users && Array.isArray(data.users)) {
          // Strictly select floor mechanics & plant electricians (exclude admin / senior roles)
          const techs = data.users.filter((u: { role: string }) =>
            u.role === 'MECHANIC' || u.role === 'ELECTRICIAN'
          );
          if (techs.length > 0) {
            setRegisteredTechs(techs.map(userToMechanicDuty));
          }
        }
      })
      .catch(() => {});
  }, []);

  // Filter fallback roster to floor personnel (exclude seniors/supervisors)
  const fallbackFloorRoster = useMemo(() => {
    return FACTORY_MECHANICS_ROSTER.filter((m) => {
      const lower = textValue(m.role).toLowerCase();
      return !lower.includes('senior') && !lower.includes('supervisor') && !lower.includes('admin');
    });
  }, []);

  // Floor technicians available for task dispatch (NEVER includes self or admin/senior supervisor)
  const assignableTechnicians = useMemo(() => {
    const base = registeredTechs.length > 0 ? registeredTechs : fallbackFloorRoster;
    const currentName = textValue((userName || user?.name || '')).trim().toLowerCase();
    return base.filter((m) => {
      const mName = textValue(m.name).trim().toLowerCase();
      const isSelf = currentName && (mName === currentName || mName.includes(currentName) || currentName.includes(mName));
      const isSenior = textValue(m.role).toLowerCase().includes('senior') || textValue(m.role).toLowerCase().includes('admin');
      return !isSelf && !isSenior;
    });
  }, [registeredTechs, fallbackFloorRoster, userName, user?.name]);

  const activeStaffRoster = assignableTechnicians;

  // Filtered Roster for attendance display
  const roster = useMemo(() => {
    return activeStaffRoster.filter((m) => {
      if (rosterTradeFilter === 'ALL') return true;
      return m.trade === rosterTradeFilter;
    });
  }, [activeStaffRoster, rosterTradeFilter]);

  // Derived Ticket Metrics
  const ticketMetrics = useMemo(() => {
    const openTickets = repairs.filter((r) => r.status !== 'COMPLETED');
    const criticalCount = openTickets.filter((r) => r.urgency === 'CRITICAL').length;
    const inProgressCount = openTickets.filter((r) => r.status === 'IN_PROGRESS').length;
    const unassignedCount = openTickets.filter((r) => !r.attendedBy).length;
    return { criticalCount, inProgressCount, unassignedCount };
  }, [repairs]);

  // Available unique lines
  const availableLines = useMemo(() => {
    const set = new Set<string>();
    repairs.forEach((r) => {
      if (r.line) set.add(r.line);
    });
    machines.forEach((m) => {
      if (m.currentLine) set.add(m.currentLine);
    });
    return Array.from(set).sort();
  }, [repairs, machines]);

  // Filtered Tickets
  const filteredTickets = useMemo(() => {
    return repairs.filter((r) => {
      // Line filter
      if (lineFilter !== 'ALL' && r.line !== lineFilter) return false;

      // Status / category filter
      if (ticketFilter === 'CRITICAL' && r.urgency !== 'CRITICAL') return false;
      if (ticketFilter === 'IN_PROGRESS' && r.status !== 'IN_PROGRESS') return false;
      if (ticketFilter === 'UNASSIGNED' && (r.attendedBy || r.status === 'COMPLETED')) return false;
      if (ticketFilter === 'COMPLETED' && r.status !== 'COMPLETED') return false;

      // Search query filter
      if (ticketSearch.trim()) {
        const q = ticketSearch.toLowerCase();
        const mchId = textValue((r.machineId || '')).toLowerCase();
        const fault = textValue((r.faultCategory || '')).toLowerCase();
        const details = textValue((r.faultDetails || '')).toLowerCase();
        const mech = textValue((r.attendedBy || '')).toLowerCase();
        const id = textValue((r.id || '')).toLowerCase();
        return (
          mchId.includes(q) ||
          fault.includes(q) ||
          details.includes(q) ||
          mech.includes(q) ||
          id.includes(q)
        );
      }

      return true;
    });
  }, [repairs, ticketSearch, ticketFilter, lineFilter]);

  // Handle Create Breakdown Ticket
  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMachineId.trim()) {
      showToast('Please select or enter a Machine ID', 'warning');
      return;
    }

    const machine = machines.find((m) => m.id === newMachineId.trim());
    const line = machine?.currentLine || 'Line 01';
    const machineType = machine?.type || 'OVERLOCK_4_THREAD';

    setIsSubmittingTicket(true);
    try {
      const ticketId = await createBreakdownTicket({
        machineId: newMachineId.trim(),
        machineType,
        line,
        reportedAt: new Date().toISOString(),
        reportedBy: userName || user?.name || 'Senior Maintenance Supervisor',
        faultCategory: newFaultCategory,
        faultDetails: newFaultDetails || `Urgent floor breakdown reported by supervisor`,
        urgency: newUrgency,
        attendedBy: newAssignee || null,
        assignedBy: userName || user?.name || 'Senior Maintenance Supervisor',
      });

      let secondTicketId = '';
      if (hasSecondProblem) {
        secondTicketId = await createBreakdownTicket({
          machineId: newMachineId.trim(),
          machineType,
          line,
          reportedAt: new Date().toISOString(),
          reportedBy: userName || user?.name || 'Senior Maintenance Supervisor',
          faultCategory: secondFaultCategory,
          faultDetails: secondFaultDetails || `Secondary issue detected simultaneously on ${newMachineId.trim()}`,
          urgency: secondUrgency,
          attendedBy: secondAssignee || null,
          assignedBy: userName || user?.name || 'Senior Maintenance Supervisor',
        });
      }

      if (hasSecondProblem && secondTicketId) {
        showToast(
          `2 distinct tickets logged for ${newMachineId.trim()}: #${ticketId} (${newAssignee || 'Unassigned'}) & #${secondTicketId} (${secondAssignee || 'Unassigned'})!`,
          'success'
        );
      } else {
        showToast(`Breakdown Work Order ${ticketId} created! Machine set to BREAKDOWN.`, 'success');
      }

      setIsNewTicketModalOpen(false);
      if (onCloseExternalNewTicket) onCloseExternalNewTicket();
      setNewMachineId('');
      setNewFaultDetails('');
      setNewAssignee('');
      setHasSecondProblem(false);
      setSecondFaultDetails('');
      setSecondAssignee('');
      onRefresh();
    } catch {
      showToast('Failed to create ticket', 'error');
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  // Handle Assign Mechanic
  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicketForAssign || !assigneeName) {
      showToast('Please select a mechanic to assign', 'warning');
      return;
    }

    setIsSubmittingAssign(true);
    try {
      await assignRepairTicket(selectedTicketForAssign.id, assigneeName);
      showToast(`Work order ${selectedTicketForAssign.id} assigned to ${assigneeName}!`, 'success');
      setIsAssignModalOpen(false);
      setSelectedTicketForAssign(null);
      setAssigneeName('');
      onRefresh();
    } catch {
      showToast('Failed to assign ticket', 'error');
    } finally {
      setIsSubmittingAssign(false);
    }
  };

  // Handle Reject / Decline Issue
  const handleOpenReject = (ticket: RepairTicket) => {
    setSelectedTicketForReject(ticket);
    setRejectReason('False alarm / No defect found on floor inspection');
    setIsRejectModalOpen(true);
  };

  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicketForReject) return;

    setIsSubmittingReject(true);
    try {
      const reviewer = userName || user?.name || 'Floor Supervisor';
      await rejectRepairTicket(selectedTicketForReject.id, reviewer, rejectReason);
      showToast(
        `Work order ${selectedTicketForReject.id} on ${selectedTicketForReject.machineId} rejected! Machine restored to ACTIVE service.`,
        'info'
      );
      setIsRejectModalOpen(false);
      setSelectedTicketForReject(null);
      if (isAssignModalOpen) {
        setIsAssignModalOpen(false);
        setSelectedTicketForAssign(null);
      }
      onRefresh();
    } catch (err) {
      console.error('Error rejecting ticket:', err);
      showToast('Failed to reject ticket', 'error');
    } finally {
      setIsSubmittingReject(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* ─── MAIN WORKSPACE GRID: TICKETS & ROSTER (65% / 35%) ──────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Team Work Orders (8 cols = ~66%) */}
        <div className="lg:col-span-8 space-y-4">
          <div id="floor-tickets-queue" className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-sm max-h-[520px] flex flex-col transition-all">
            {/* Header & Filter Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-indigo-600" />
                  <span>Floor Work Orders & Ticket Queue</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Manage active repairs, assign mechanics, and review floor tickets ({filteredTickets.length} tickets).
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                {/* Line Filter */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-500 font-medium">Line:</span>
                  <select
                    value={lineFilter}
                    onChange={(e) => setLineFilter(e.target.value)}
                    className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="ALL">All Floor Lines</option>
                    {availableLines.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>

                {/* + New Ticket Button */}
                <button
                  onClick={() => setIsNewTicketModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Log Breakdown</span>
                </button>
              </div>
            </div>

            {/* Search and Tabs */}
            <div className="py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
              {/* Tab Pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { key: 'ALL', label: 'All Tickets', count: repairs.length },
                  { key: 'CRITICAL', label: 'Critical', count: ticketMetrics.criticalCount },
                  { key: 'IN_PROGRESS', label: 'In Progress', count: ticketMetrics.inProgressCount },
                  { key: 'UNASSIGNED', label: 'Unassigned', count: ticketMetrics.unassignedCount },
                  {
                    key: 'COMPLETED',
                    label: 'Resolved',
                    count: repairs.filter((r) => r.status === 'COMPLETED').length,
                  },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setTicketFilter(tab.key as typeof ticketFilter)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                      ticketFilter === tab.key
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                        ticketFilter === tab.key ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Search box */}
              <div className="relative min-w-[200px]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search ticket, machine, fault..."
                  value={ticketSearch}
                  onChange={(e) => setTicketSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Tickets Table / List */}
            <div className="mt-2 flex-1 min-h-0 overflow-y-auto overflow-x-auto border border-slate-300 rounded-lg shadow-2xs">
              {filteredTickets.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs bg-white">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                  No tickets found matching current filters.
                </div>
              ) : (
                <table className="w-full text-left border-collapse border border-slate-300 text-xs">
                  <thead className="sticky top-0 bg-slate-100 z-10 border-b border-slate-300 shadow-xs select-none">
                    <tr className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                      <th className="py-2.5 px-3 bg-slate-100 border-r border-b border-slate-300 font-mono">Ticket</th>
                      <th className="py-2.5 px-3 bg-slate-100 border-r border-b border-slate-300">Machine &amp; Line</th>
                      <th className="py-2.5 px-3 bg-slate-100 border-r border-b border-slate-300 min-w-[180px]">Fault Details</th>
                      <th className="py-2.5 px-3 bg-slate-100 border-r border-b border-slate-300">Assigned Mechanic</th>
                      <th className="py-2.5 px-3 text-center bg-slate-100 border-r border-b border-slate-300">Status</th>
                      <th className="py-2.5 px-3 text-right bg-slate-100 border-b border-slate-300">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs bg-white font-medium">
                    {filteredTickets.map((t) => {
                      const isCritical = t.urgency === 'CRITICAL';
                      const isUnassigned = !t.attendedBy;
                      const isCompleted = t.status === 'COMPLETED';

                      return (
                        <tr key={t.id} className="hover:bg-blue-50/60 even:bg-slate-50/40 transition group">
                          {/* Ticket ID & Urgency */}
                          <td
                            className="py-2 px-3 cursor-pointer border-r border-b border-slate-200 group-hover:bg-blue-50/70"
                            onClick={() => {
                              setSelectedTicketForAssign(t);
                              setIsAssignModalOpen(true);
                            }}
                            title="Click to view & manage ticket"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  isCritical ? 'bg-rose-500 animate-pulse' : 'bg-amber-400'
                                }`}
                              />
                              <span className="font-extrabold text-indigo-700 hover:text-indigo-900 underline underline-offset-2 font-mono">{t.id}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {t.reportedAt ? new Date(t.reportedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today'}
                            </div>
                          </td>

                          {/* Machine & Line */}
                          <td className="py-2 px-3 border-r border-b border-slate-200">
                            <div className="font-bold text-slate-900 font-mono">{t.machineId}</div>
                            <div className="text-[11px] text-slate-500">{t.line || 'Line 01'}</div>
                          </td>

                          {/* Fault Category */}
                          <td className="py-2 px-3 max-w-[200px] border-r border-b border-slate-200">
                            <div className="font-semibold text-slate-800 truncate">{t.faultCategory}</div>
                            <div className="text-[11px] text-slate-500 truncate">{t.faultDetails}</div>
                          </td>

                          {/* Assigned Mechanic */}
                          <td className="py-2 px-3 border-r border-b border-slate-200">
                            {t.attendedBy ? (
                              <div className="flex items-center gap-1.5">
                                <span className="w-5 h-5 rounded bg-indigo-100 text-indigo-700 font-bold text-[10px] flex items-center justify-center">
                                  {t.attendedBy.slice(0, 2).toUpperCase()}
                                </span>
                                <span className="font-semibold text-slate-800">{t.attendedBy}</span>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                ⚠️ Unassigned
                              </span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-2 px-3 text-center border-r border-b border-slate-200">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                t.status === 'REJECTED'
                                  ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                  : isCompleted
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : t.status === 'IN_PROGRESS'
                                  ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                  : isUnassigned
                                  ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                  : 'bg-amber-100 text-amber-800 border border-amber-200'
                              }`}
                            >
                              {t.status}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-2 px-3 text-right border-b border-slate-200">
                            <div className="flex items-center justify-end gap-1.5">
                              {!isCompleted && t.status !== 'REJECTED' && (
                                <>
                                  <button
                                    onClick={() => {
                                      setNewMachineId(t.machineId);
                                      setNewFaultCategory('Motor Electrical Noise');
                                      setNewFaultDetails(`Second problem on ${t.machineId} alongside active ticket ${t.id} (${t.faultCategory})`);
                                      setIsNewTicketModalOpen(true);
                                    }}
                                    title="Log another problem for this machine and assign to a different person"
                                    className="px-2 py-1 rounded text-[11px] font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition cursor-pointer flex items-center gap-1"
                                  >
                                    <Plus className="w-3 h-3 text-amber-600" />
                                    <span>+2nd Issue</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSelectedTicketForAssign(t);
                                      setIsAssignModalOpen(true);
                                    }}
                                    className="px-2 py-1 rounded text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition cursor-pointer"
                                  >
                                    {t.attendedBy ? 'Reassign' : 'Assign'}
                                  </button>
                                  <button
                                    onClick={() => handleOpenReject(t)}
                                    title="Reject or decline this false alarm / invalid breakdown report"
                                    className="px-2 py-1 rounded text-[11px] font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition cursor-pointer flex items-center gap-1"
                                  >
                                    <XCircle className="w-3 h-3 text-rose-600" />
                                    <span>Reject</span>
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => {
                                  setSelectedTicketForAssign(t);
                                  setIsAssignModalOpen(true);
                                }}
                                title="Open & Manage Ticket Details"
                                className="px-2 py-1 rounded text-[11px] font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition cursor-pointer flex items-center gap-1"
                              >
                                <Wrench className="w-3 h-3 text-indigo-600" />
                                <span>Details</span>
                              </button>
                              <button
                                onClick={() => router.push(`/scan/${t.machineId}`)}
                                title="View Asset & Ticket Details"
                                className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Shift Duty Roster & Workload (4 cols = ~34%) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-sm max-h-[520px] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-600" />
                  <span>Floor Attendance & Shift Duty</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  {roster.filter((m) => m.status === 'ON_DUTY').length} Present • {roster.filter((m) => repairs.some((r) => r.attendedBy === m.name && r.status !== 'COMPLETED')).length} on job • {roster.filter((m) => m.status === 'ON_DUTY' && !repairs.some((r) => r.attendedBy === m.name && r.status !== 'COMPLETED')).length} available
                </p>
              </div>

              {/* Filter trade */}
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[10px] font-semibold">
                <button
                  onClick={() => setRosterTradeFilter('ALL')}
                  className={`px-2 py-0.5 rounded-md ${
                    rosterTradeFilter === 'ALL' ? 'bg-white shadow text-slate-900' : 'text-slate-500'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setRosterTradeFilter('MECHANIC')}
                  className={`px-2 py-0.5 rounded-md ${
                    rosterTradeFilter === 'MECHANIC' ? 'bg-white shadow text-slate-900' : 'text-slate-500'
                  }`}
                >
                  Mech
                </button>
                <button
                  onClick={() => setRosterTradeFilter('ELECTRICIAN')}
                  className={`px-2 py-0.5 rounded-md ${
                    rosterTradeFilter === 'ELECTRICIAN' ? 'bg-white shadow text-slate-900' : 'text-slate-500'
                  }`}
                >
                  Elec
                </button>
              </div>
            </div>

            {/* Mechanics list with combined attendance & duty info */}
            <div className="divide-y divide-slate-100 mt-2 space-y-1 flex-1 min-h-0 overflow-y-auto pr-1">
              {roster.map((m) => {
                const activeTicket = repairs.find(
                  (r) => r.attendedBy === m.name && r.status !== 'COMPLETED'
                );
                const isBusy = !!activeTicket;
                const isPresent = m.status === 'ON_DUTY';
                const isLeave = m.status === 'ON_LEAVE';

                return (
                  <div key={m.id} className="pt-3 pb-2 flex flex-col gap-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-8 h-8 rounded-xl font-bold text-xs flex items-center justify-center ${m.avatarColor}`}
                        >
                          {m.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                            <span>{m.name}</span>
                            <span className="text-[10px] text-slate-400 font-normal">
                              ({m.assignedLines})
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-medium">
                            {m.role} • {m.shift}
                          </div>
                        </div>
                      </div>

                      {/* Status Badges */}
                      <div className="flex flex-col items-end gap-1">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                            isPresent
                              ? 'bg-emerald-100 text-emerald-800'
                              : isLeave
                              ? 'bg-slate-100 text-slate-500'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {isPresent ? 'PRESENT' : isLeave ? 'ON LEAVE' : 'STANDBY'}
                        </span>

                        {isBusy ? (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            <span>Fixing {activeTicket?.machineId}</span>
                          </span>
                        ) : isPresent ? (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            Available
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {/* Single Combined Attendance & Shift Info Line */}
                    <div className="text-[11px] text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-100 flex items-center justify-between">
                      <span className="font-mono text-[10px] text-slate-600">
                        {isPresent ? 'Checked in 08:00 AM' : isLeave ? 'Approved Leave' : 'On Standby'} • {m.trade}
                      </span>
                      <a
                        href={`tel:${m.phone}`}
                        className="text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 text-[10px]"
                      >
                        <Phone className="w-2.5 h-2.5" />
                        <span>{m.phone}</span>
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ─── MODAL 1: LOG BREAKDOWN WORK ORDER ──────────────────────── */}
      {isNewTicketModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-rose-100 text-rose-700">
                  <Flame className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Log Machine Breakdown</h3>
                  <p className="text-xs text-slate-500">Report machine failure and dispatch maintenance personnel</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsNewTicketModalOpen(false);
                  if (onCloseExternalNewTicket) onCloseExternalNewTicket();
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-4">
              {/* Machine Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Target Machine ID <span className="text-rose-500">*</span>
                </label>
                <select
                  value={newMachineId}
                  onChange={(e) => setNewMachineId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  required
                >
                  <option value="">Select Machine...</option>
                  {machines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.id} — {m.type} ({m.currentLine || 'Line 01'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Fault Category */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Primary Fault Category <span className="text-rose-500">*</span>
                </label>
                <select
                  value={newFaultCategory}
                  onChange={(e) => setNewFaultCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Skipping Stitches">Skipping Stitches / Timing Slip</option>
                  <option value="Needle Breakage">Frequent Needle Breakage</option>
                  <option value="Thread Breakage">Thread Snapping / Looper Burr</option>
                  <option value="Motor Electrical Noise">Motor Overheating / Drive Fault</option>
                  <option value="Oil Leakage / Seal Fail">Oil Leakage / Sump Depletion</option>
                  <option value="Feed Dog Jamming">Fabric Jam / Feed Dog Damage</option>
                  <option value="Pneumatic Valve Loss">Air Pressure / Pneumatic Valve Fault</option>
                  <option value="Emergency Stop Tripped">Safety Guard / E-Stop Fault</option>
                  <option value="Other Breakdown">Other Machine Breakdown</option>
                </select>
              </div>

              {/* Urgency */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Urgency</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewUrgency('CRITICAL')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      newUrgency === 'CRITICAL'
                        ? 'bg-rose-50 border-rose-500 text-rose-700 shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <Flame className="w-3.5 h-3.5" />
                    <span>CRITICAL (Halt Line)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewUrgency('WARNING')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      newUrgency === 'WARNING'
                        ? 'bg-amber-50 border-amber-500 text-amber-800 shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>WARNING (Intermittent)</span>
                  </button>
                </div>
              </div>

              {/* Fault Details */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Symptoms & Observations
                </label>
                <textarea
                  rows={2}
                  value={newFaultDetails}
                  onChange={(e) => setNewFaultDetails(e.target.value)}
                  placeholder="Describe the noise, defect, or symptoms observed on the floor..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Immediate Assignee (Optional) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Dispatch Mechanic (Optional)
                </label>
                <select
                  value={newAssignee}
                  onChange={(e) => setNewAssignee(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Leave Unassigned (Floor Queue)</option>
                  {activeStaffRoster.map((m) => (
                    <option key={m.id} value={m.name}>
                      {m.name} — {m.role} ({m.assignedLines})
                    </option>
                  ))}
                </select>
              </div>

              {/* Secondary Simultaneous Problem Section */}
              <div className="pt-2 border-t border-slate-200/80">
                <button
                  type="button"
                  onClick={() => setHasSecondProblem(!hasSecondProblem)}
                  className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-between border cursor-pointer ${
                    hasSecondProblem
                      ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-2xs'
                      : 'bg-slate-50 hover:bg-slate-100 border-dashed border-slate-300 text-slate-700'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center font-bold">
                      2
                    </span>
                    <span>
                      {hasSecondProblem
                        ? 'Simultaneous 2nd Problem Active'
                        : '+ Same Machine 2nd Problem Detected? (e.g. Electrical + Mechanical)'}
                    </span>
                  </span>
                  <span className="text-[10px] font-mono uppercase font-bold text-amber-700">
                    {hasSecondProblem ? 'Remove 2nd Problem' : 'Add 2nd Problem'}
                  </span>
                </button>

                {hasSecondProblem && (
                  <div className="mt-3 p-3.5 bg-amber-50/50 border border-amber-200 rounded-2xl space-y-3 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold text-amber-900 uppercase tracking-wider flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        <span>Problem #2 on this Machine</span>
                      </span>
                      <span className="text-[10px] text-amber-700 font-medium">Can be assigned to a different person</span>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">Problem #2 Category</label>
                      <select
                        value={secondFaultCategory}
                        onChange={(e) => setSecondFaultCategory(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500"
                      >
                        <option value="Motor Electrical Noise">Motor Overheating / Drive Fault (Electrical)</option>
                        <option value="Needle Breakage">Frequent Needle Breakage (Mechanical)</option>
                        <option value="Skipping Stitches">Skipping Stitches / Timing Slip (Mechanical)</option>
                        <option value="Thread Breakage">Thread Snapping / Tension Fault</option>
                        <option value="Oil Leakage / Seal Fail">Oil Leakage / Lubrication Failure</option>
                        <option value="Pneumatic Valve Loss">Pneumatic Air Leak / Sensor Failure</option>
                        <option value="Emergency Stop Tripped">Safety Interlock / Power Failure</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">Problem #2 Observations</label>
                      <input
                        type="text"
                        value={secondFaultDetails}
                        onChange={(e) => setSecondFaultDetails(e.target.value)}
                        placeholder="e.g. Servo motor smoking while looper is also jammed..."
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">
                        Dispatch to Different Mechanic / Specialist
                      </label>
                      <select
                        value={secondAssignee}
                        onChange={(e) => setSecondAssignee(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 font-semibold"
                      >
                        <option value="">Leave Unassigned (Floor Queue)</option>
                        {activeStaffRoster.map((m) => (
                          <option key={m.id} value={m.name}>
                            {m.name} — {m.role} ({m.trade} • {m.assignedLines})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsNewTicketModalOpen(false);
                    if (onCloseExternalNewTicket) onCloseExternalNewTicket();
                  }}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTicket}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition shadow-lg shadow-rose-600/30 cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingTicket ? 'Logging Breakdown...' : 'Confirm Breakdown & Dispatch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: ASSIGN / REASSIGN MECHANIC ────────────────────────── */}
      {isAssignModalOpen && selectedTicketForAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-indigo-100 text-indigo-700">
                  <UserCheck className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Assign Work Order</h3>
                  <p className="text-xs text-slate-500 font-mono">Ticket {selectedTicketForAssign.id}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsAssignModalOpen(false);
                  setSelectedTicketForAssign(null);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs space-y-1">
              <div>
                <span className="font-bold text-slate-700">Machine: </span>
                <span className="font-mono text-slate-900 font-semibold">{selectedTicketForAssign.machineId}</span>
                <span className="text-slate-500"> ({selectedTicketForAssign.line})</span>
              </div>
              <div>
                <span className="font-bold text-slate-700">Issue: </span>
                <span className="text-slate-800">{selectedTicketForAssign.faultCategory}</span>
              </div>
            </div>

            <form onSubmit={handleAssignSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Select Floor Technician
                </label>
                <select
                  value={assigneeName}
                  onChange={(e) => setAssigneeName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  <option value="">Choose technician...</option>
                  {activeStaffRoster.map((m) => (
                    <option key={m.id} value={m.name}>
                      {m.name} ({m.trade} • {m.assignedLines})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 flex items-center justify-between gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsAssignModalOpen(false);
                    if (selectedTicketForAssign) {
                      handleOpenReject(selectedTicketForAssign);
                    }
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition cursor-pointer flex items-center gap-1.5"
                >
                  <XCircle className="w-3.5 h-3.5 text-rose-600" />
                  <span>Reject Issue</span>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAssignModalOpen(false);
                      setSelectedTicketForAssign(null);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingAssign}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-lg shadow-indigo-600/30 cursor-pointer disabled:opacity-50"
                  >
                    {isSubmittingAssign ? 'Assigning...' : 'Confirm Assignment'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 3: REJECT / DECLINE ISSUE TICKET ─────────────────────── */}
      {isRejectModalOpen && selectedTicketForReject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-rose-100 text-rose-700">
                  <XCircle className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Reject / Cancel Issue</h3>
                  <p className="text-xs text-slate-500 font-mono">Ticket {selectedTicketForReject.id}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsRejectModalOpen(false);
                  setSelectedTicketForReject(null);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-rose-50/60 p-3.5 rounded-2xl border border-rose-200 text-xs space-y-1.5">
              <div>
                <span className="font-bold text-slate-700">Machine: </span>
                <span className="font-mono text-slate-900 font-semibold">{selectedTicketForReject.machineId}</span>
                <span className="text-slate-500"> ({selectedTicketForReject.line})</span>
              </div>
              <div>
                <span className="font-bold text-slate-700">Reported Problem: </span>
                <span className="text-slate-800">{selectedTicketForReject.faultCategory}</span>
              </div>
              <p className="text-[11px] text-rose-700 font-medium pt-1">
                ⚠️ Rejecting will close this ticket, restore machine to <b>ACTIVE</b>, and broadcast an alert to the Telegram group.
              </p>
            </div>

            <form onSubmit={handleConfirmReject} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Select Reason for Rejection
                </label>
                <div className="grid grid-cols-1 gap-1.5">
                  {[
                    'False alarm / No defect found on floor inspection',
                    'Operator error / Cleared by sewing line operator',
                    'Duplicate breakdown ticket already being attended',
                    'Reported for incorrect asset ID',
                  ].map((preset) => (
                    <button
                      type="button"
                      key={preset}
                      onClick={() => setRejectReason(preset)}
                      className={`text-left px-3 py-2 rounded-xl text-xs font-medium border transition cursor-pointer ${
                        rejectReason === preset
                          ? 'bg-rose-50 border-rose-400 text-rose-900 font-bold'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Additional Notes / Explanation
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
                  required
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsRejectModalOpen(false);
                    setSelectedTicketForReject(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReject}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition shadow-lg shadow-rose-600/30 cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingReject ? 'Rejecting & Alerting...' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
