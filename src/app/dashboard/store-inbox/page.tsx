'use client';

import { textValue } from '@/lib/textValue';

import React, { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  PackageCheck,
  Wrench,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Plus,
  Search,
  Filter,
  ArrowUpRight,
  Truck,
  User,
  Printer,
  FileText,
  Check,
  X,
  ShieldAlert,
  Layers,
  Boxes,
  Zap,
  ChevronDown,
  Calendar,
  MapPin,
  RotateCcw,
  Sparkles,
  Phone,
  AlertCircle,
  IndianRupee,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { normalizeRole } from '@/lib/constants/roles';
import { PartRequisition, SparePart, RequisitionStatus } from '@/types/cmms';
import {
  subscribeRequisitions,
  subscribeParts,
  fulfillMechanicIndent,
  createRequisition,
  updateRequisitionStatus,
  sendAppNotification,
  adjustPartStock,
} from '@/lib/services/cmmsService';
import { FACTORY_MECHANICS_ROSTER, MechanicDuty, userToMechanicDuty } from '@/lib/constants/mechanics';

// Default initial urgent mechanic indents if database is empty

interface GatePassData {
  slipNo: string;
  indentId: string;
  date: string;
  mechanicName: string;
  mechanicRole: string;
  targetLine: string;
  targetMachineId?: string;
  partName: string;
  sku: string;
  quantity: number;
  unit: string;
  unitCost: number;
  oldPartReturned: boolean;
  storekeeper: string;
  notes?: string;
}

function StoreInboxContent() {
  const { user, role } = useAuth();
  const { showToast } = useToast();
  const searchParams = useSearchParams();

  const [requisitions, setRequisitions] = useState<PartRequisition[]>([]);
  const [parts, setParts] = useState<SparePart[]>([]);
  const [registeredStaff, setRegisteredStaff] = useState<MechanicDuty[]>([]);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'FULFILLED' | 'REJECTED'>('PENDING');
  const [selectedMechanicFilter, setSelectedMechanicFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [lineFilter, setLineFilter] = useState<string>('ALL');

  // Issue Action Modal State
  const [activeIssueReq, setActiveIssueReq] = useState<PartRequisition | null>(null);
  const [issueQty, setIssueQty] = useState<number>(1);
  const [oldPartReturned, setOldPartReturned] = useState<boolean>(true);
  const [issueNotes, setIssueNotes] = useState<string>('');
  const [isSubmittingIssue, setIsSubmittingIssue] = useState<boolean>(false);

  // Reject Modal State
  const [activeRejectReq, setActiveRejectReq] = useState<PartRequisition | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [isSubmittingReject, setIsSubmittingReject] = useState<boolean>(false);

  // Walk-In Urgent Indent Modal State
  const [isWalkInModalOpen, setIsWalkInModalOpen] = useState(false);
  const [walkInMechId, setWalkInMechId] = useState('');
  const [walkInPartId, setWalkInPartId] = useState('');
  const [walkInQty, setWalkInQty] = useState(1);
  const [walkInLine, setWalkInLine] = useState('Line 01');
  const [walkInMachineId, setWalkInMachineId] = useState('');
  const [walkInReason, setWalkInReason] = useState('Shift breakdown replacement part needed immediately.');
  const [walkInOldPartReturned, setWalkInOldPartReturned] = useState(true);
  const [isSubmittingWalkIn, setIsSubmittingWalkIn] = useState(false);

  // Gate Pass / Slip Modal State
  const [isGatePassOpen, setIsGatePassOpen] = useState(false);
  const [gatePassData, setGatePassData] = useState<GatePassData | null>(null);

  // Fetch dynamic users for mechanic roster
  useEffect(() => {
    fetch('/api/users')
      .then((r) => r.json())
      .then((data) => {
        if (data.users && Array.isArray(data.users)) {
          const staff = data.users.filter((u: any) => {
            const nr = normalizeRole(u.role);
            return ['MECHANIC', 'SENIOR_MECHANIC', 'ELECTRICIAN', 'SENIOR_ELECTRICIAN'].includes(nr);
          });
          if (staff.length > 0) {
            setRegisteredStaff(staff.map(userToMechanicDuty));
          }
        }
      })
      .catch(() => {});
  }, []);

  const activeStaffRoster = registeredStaff.length > 0 ? registeredStaff : FACTORY_MECHANICS_ROSTER;

  // Auto-select first mechanic in walk-in modal
  useEffect(() => {
    if (activeStaffRoster.length > 0 && !walkInMechId) {
      setWalkInMechId(activeStaffRoster[0].name);
    }
  }, [activeStaffRoster, walkInMechId]);

  // Subscribe to live CMMS data
  useEffect(() => {
    const unsubReqs = subscribeRequisitions((reqs) => {
      // Exclude monthly indents; keep urgent mechanic floor indents
      const mechanicOnly = reqs.filter((r) => r.type !== 'MONTHLY_INDENT');
      if (mechanicOnly.length === 0) {
        setRequisitions([]);
      } else {
        setRequisitions(mechanicOnly);
      }
    });

    const unsubParts = subscribeParts((allParts) => {
      setParts(allParts);
    });

    return () => {
      unsubReqs();
      unsubParts();
    };
  }, []);

  // Auto-open new indent modal if ?new=true query parameter is given
  useEffect(() => {
    if (searchParams.get('new') === 'true') {
      setIsWalkInModalOpen(true);
    }
  }, [searchParams]);

  // Distinct mechanics who have placed indents
  const requestingMechanics = useMemo(() => {
    const set = new Set<string>();
    requisitions.forEach((r) => {
      if (r.requestedBy) set.add(r.requestedBy);
    });
    return Array.from(set);
  }, [requisitions]);

  // Filtered Indents
  const filteredIndents = useMemo(() => {
    return requisitions.filter((r) => {
      // Status filter
      if (statusFilter === 'PENDING') {
        if (r.status === 'FULFILLED' || r.status === 'REJECTED') return false;
      } else if (statusFilter === 'FULFILLED') {
        if (r.status !== 'FULFILLED') return false;
      } else if (statusFilter === 'REJECTED') {
        if (r.status !== 'REJECTED') return false;
      }

      // Mechanic filter
      if (selectedMechanicFilter !== 'ALL') {
        if (textValue(r.requestedBy)?.toLowerCase() !== selectedMechanicFilter.toLowerCase()) return false;
      }

      // Line filter
      if (lineFilter !== 'ALL') {
        if (!textValue(r.targetLine)?.toLowerCase().includes(lineFilter.toLowerCase())) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const combined = `${r.id} ${r.requestedBy} ${r.partName} ${r.sku} ${r.targetMachineId || ''} ${r.targetLine || ''} ${r.justification || ''}`.toLowerCase();
        if (!combined.includes(q)) return false;
      }

      return true;
    });
  }, [requisitions, statusFilter, selectedMechanicFilter, lineFilter, searchQuery]);

  // Summary counts
  const pendingCount = useMemo(
    () => requisitions.filter((r) => r.status !== 'FULFILLED' && r.status !== 'REJECTED').length,
    [requisitions]
  );
  const fulfilledCount = useMemo(
    () => requisitions.filter((r) => r.status === 'FULFILLED').length,
    [requisitions]
  );
  const rejectedCount = useMemo(
    () => requisitions.filter((r) => r.status === 'REJECTED').length,
    [requisitions]
  );

  // Open Issue Confirmation Modal
  const handleOpenIssueModal = (req: PartRequisition) => {
    setActiveIssueReq(req);
    setIssueQty(req.quantity || 1);
    setOldPartReturned(true);
    setIssueNotes(`Verified scrap return and issued ${req.quantity || 1} ${req.unit || 'pcs'} to ${req.requestedBy} for ${req.targetLine || 'Floor Lines'}.`);
  };

  // Execute Issue & Dispatch
  const handleConfirmIssue = async () => {
    if (!activeIssueReq) return;
    setIsSubmittingIssue(true);

    try {
      const storePersonName = user?.name ? `${user.name} (Store In-Charge)` : 'Store In-Charge';
      await fulfillMechanicIndent(activeIssueReq.id, storePersonName, issueNotes, issueQty);

      // Create Gate Pass Data
      const targetPart = parts.find((p) => p.partId === activeIssueReq.partId || p.sku === activeIssueReq.sku);
      const slipData: GatePassData = {
        slipNo: `SLIP-${Math.floor(1000 + Math.random() * 9000)}`,
        indentId: activeIssueReq.id,
        date: new Date().toISOString(),
        mechanicName: activeIssueReq.requestedBy || 'Mechanic',
        mechanicRole: activeIssueReq.requestedByRole || 'MECHANIC',
        targetLine: activeIssueReq.targetLine || 'Line 01',
        targetMachineId: activeIssueReq.targetMachineId || activeIssueReq.machineId,
        partName: activeIssueReq.partName || targetPart?.name || 'Spare Part',
        sku: activeIssueReq.sku || targetPart?.sku || 'SKU-GEN',
        quantity: issueQty,
        unit: activeIssueReq.unit || targetPart?.unit || 'pcs',
        unitCost: targetPart?.unitCost || 0,
        oldPartReturned,
        storekeeper: storePersonName,
        notes: issueNotes,
      };

      setGatePassData(slipData);
      setIsGatePassOpen(true);

      // Notify Mechanic
      sendAppNotification({
        type: 'SPARE_ISSUE_RECEIPT',
        title: `Part Issued: ${activeIssueReq.partName}`,
        message: `${issueQty} ${activeIssueReq.unit || 'pcs'} dispatched by Store to ${activeIssueReq.requestedBy} (${activeIssueReq.targetLine || 'Floor'}).`,
        targetRole: 'MECHANIC',
        senderName: storePersonName,
      });

      showToast(`Part "${activeIssueReq.partName}" issued successfully! Stock deducted.`, 'success');
      setActiveIssueReq(null);
    } catch (err) {
      console.error('Error issuing indent part:', err);
      showToast('Failed to issue part from store', 'error');
    } finally {
      setIsSubmittingIssue(false);
    }
  };

  // Open Reject Modal
  const handleOpenRejectModal = (req: PartRequisition) => {
    setActiveRejectReq(req);
    setRejectReason('Insufficient crib stock / duplicate request for same line stoppage.');
  };

  // Confirm Reject
  const handleConfirmReject = async () => {
    if (!activeRejectReq) return;
    setIsSubmittingReject(true);

    try {
      const reviewer = user?.name ? `${user.name} (Store)` : 'Store In-Charge';
      await updateRequisitionStatus(activeRejectReq.id, 'REJECTED', `Rejected by ${reviewer}: ${rejectReason}`);

      sendAppNotification({
        type: 'GENERAL',
        title: `Indent Rejected: ${activeRejectReq.partName}`,
        message: `Order #${activeRejectReq.id} was rejected by store. Reason: ${rejectReason}`,
        targetRole: 'MECHANIC',
        senderName: reviewer,
      });

      showToast(`Indent #${activeRejectReq.id} marked as rejected.`, 'info');
      setActiveRejectReq(null);
    } catch (err) {
      console.error('Error rejecting indent:', err);
      showToast('Failed to reject indent', 'error');
    } finally {
      setIsSubmittingReject(false);
    }
  };

  // Submit Walk-In Urgent Indent & Immediate Issue
  const handleCreateWalkInIndent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walkInPartId) {
      showToast('Please select a spare part from the catalog', 'error');
      return;
    }

    const selectedPart = parts.find((p) => p.partId === walkInPartId);
    if (!selectedPart) {
      showToast('Selected part not found in stock catalog', 'error');
      return;
    }

    setIsSubmittingWalkIn(true);
    try {
      const storePersonName = user?.name ? `${user.name} (Store In-Charge)` : 'Store In-Charge';
      const reqId = await createRequisition({
        type: 'URGENT_NEED',
        partId: selectedPart.partId,
        partName: selectedPart.name,
        sku: selectedPart.sku,
        quantity: Number(walkInQty) || 1,
        unit: selectedPart.unit || 'pcs',
        itemCount: Number(walkInQty) || 1,
        estimatedCost: (Number(walkInQty) || 1) * (selectedPart.unitCost || 0),
        urgency: 'URGENT_MANAGER',
        requiresCeoApproval: false,
        requestedBy: walkInMechId || 'Walk-In Mechanic',
        requestedByRole: 'MECHANIC',
        monthYear: new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' }),
        targetLine: walkInLine,
        targetMachineId: walkInMachineId.trim() || undefined,
        machineId: walkInMachineId.trim() || undefined,
        justification: walkInReason.trim() || 'Floor emergency part issue at crib counter.',
      });

      // Immediately fulfill & deduct stock
      await fulfillMechanicIndent(
        reqId,
        storePersonName,
        `Walk-in counter issue: Old part returned = ${walkInOldPartReturned ? 'YES' : 'NO'}. Stock issued immediately.`,
        Number(walkInQty) || 1
      );

      // Gate Pass
      const slipData: GatePassData = {
        slipNo: `SLIP-${Math.floor(1000 + Math.random() * 9000)}`,
        indentId: reqId,
        date: new Date().toISOString(),
        mechanicName: walkInMechId || 'Walk-In Mechanic',
        mechanicRole: 'MECHANIC',
        targetLine: walkInLine,
        targetMachineId: walkInMachineId.trim() || undefined,
        partName: selectedPart.name,
        sku: selectedPart.sku,
        quantity: Number(walkInQty) || 1,
        unit: selectedPart.unit || 'pcs',
        unitCost: selectedPart.unitCost || 0,
        oldPartReturned: walkInOldPartReturned,
        storekeeper: storePersonName,
        notes: walkInReason,
      };

      setGatePassData(slipData);
      setIsGatePassOpen(true);

      showToast(`Urgent indent ${reqId} created and dispatched to ${walkInMechId}!`, 'success');
      setIsWalkInModalOpen(false);
      setWalkInPartId('');
      setWalkInQty(1);
    } catch (err) {
      console.error('Walk-in indent error:', err);
      showToast('Failed to process walk-in indent', 'error');
    } finally {
      setIsSubmittingWalkIn(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── 1. TOP HERO HEADER ─────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                  Mechanic Indent Receiving Desk
                </h1>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 animate-pulse flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  <span>Urgent Floor Indents</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Live queue of urgent spare part orders placed by floor mechanics. Verify crib stock, validate scrap returns, and issue replacement parts directly.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setIsWalkInModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#059669] hover:bg-[#047857] rounded-xl shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Walk-In Issue / Urgent Indent</span>
          </button>
        </div>
      </div>

      {/* ─── 2. KPI METRICS STRIP ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
              Pending Issue
            </span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{pendingCount}</span>
            <span className="text-xs text-rose-600 font-semibold">Awaiting Store</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
              Issued &amp; Dispatched
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-[#059669] flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{fulfilledCount}</span>
            <span className="text-xs text-[#059669] font-semibold">Completed Orders</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
              Requesting Mechanics
            </span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Wrench className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{requestingMechanics.length}</span>
            <span className="text-xs text-indigo-600 font-semibold">Active Floor Staff</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
              Crib Catalog Parts
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{parts.length}</span>
            <span className="text-xs text-slate-500 font-semibold">SKUs in Stock List</span>
          </div>
        </div>
      </div>

      {/* ─── 3. MECHANIC-WISE QUICK FILTER TABS ─────────────────────────────────── */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
            <User className="w-4 h-4 text-[#059669]" />
            <span>Filter Indents By Requesting Mechanic</span>
          </div>
          {selectedMechanicFilter !== 'ALL' && (
            <button
              type="button"
              onClick={() => setSelectedMechanicFilter('ALL')}
              className="text-xs text-[#059669] hover:underline cursor-pointer font-semibold"
            >
              Show All Mechanics
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button
            type="button"
            onClick={() => setSelectedMechanicFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
              selectedMechanicFilter === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            All Mechanics ({requisitions.length})
          </button>

          {requestingMechanics.map((mechName) => {
            const count = requisitions.filter(
              (r) => textValue(r.requestedBy)?.toLowerCase() === mechName.toLowerCase()
            ).length;
            const pendingMechCount = requisitions.filter(
              (r) =>
                textValue(r.requestedBy)?.toLowerCase() === mechName.toLowerCase() &&
                r.status !== 'FULFILLED' &&
                r.status !== 'REJECTED'
            ).length;

            return (
              <button
                key={mechName}
                type="button"
                onClick={() => setSelectedMechanicFilter(mechName)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  selectedMechanicFilter.toLowerCase() === mechName.toLowerCase()
                    ? 'bg-[#059669] text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <span>{mechName}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                    selectedMechanicFilter.toLowerCase() === mechName.toLowerCase()
                      ? 'bg-white/20 text-white'
                      : pendingMechCount > 0
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── 4. SEARCH & STATUS CONTROLS BAR ───────────────────────────────────── */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl w-full md:w-auto">
          <button
            type="button"
            onClick={() => setStatusFilter('PENDING')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer flex-1 md:flex-initial justify-center ${
              statusFilter === 'PENDING'
                ? 'bg-white text-rose-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-rose-600" />
            <span>Pending Issue</span>
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-600 text-white font-black">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('FULFILLED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer flex-1 md:flex-initial justify-center ${
              statusFilter === 'FULFILLED'
                ? 'bg-white text-[#059669] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-[#059669]" />
            <span>Issued / Dispatched</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-700 font-bold">
              {fulfilledCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('REJECTED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer flex-1 md:flex-initial justify-center ${
              statusFilter === 'REJECTED'
                ? 'bg-white text-slate-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <XCircle className="w-3.5 h-3.5 text-slate-500" />
            <span>Rejected</span>
            {rejectedCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-700 font-bold">
                {rejectedCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer flex-1 md:flex-initial justify-center ${
              statusFilter === 'ALL'
                ? 'bg-white text-slate-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>All ({requisitions.length})</span>
          </button>
        </div>

        {/* Search input & Line filter */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-grow md:w-72">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search part, mechanic, machine..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-[#059669] transition"
            />
          </div>

          <select
            value={lineFilter}
            onChange={(e) => setLineFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 outline-none font-bold text-slate-700 cursor-pointer shrink-0"
          >
            <option value="ALL">All Floor Lines</option>
            <option value="Line 01">Line 01</option>
            <option value="Line 02">Line 02</option>
            <option value="Line 03">Line 03</option>
            <option value="Line 04">Line 04</option>
            <option value="Buffer Workshop">Buffer Workshop</option>
          </select>
        </div>
      </div>

      {/* ─── 5. URGENT INDENT QUEUE CARDS ───────────────────────────────────────── */}
      {filteredIndents.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <PackageCheck className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">No Mechanic Indents Found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {statusFilter === 'PENDING'
              ? 'No pending urgent indents awaiting store issuance at this time.'
              : 'No indents match your active filters or search criteria.'}
          </p>
          <button
            type="button"
            onClick={() => setIsWalkInModalOpen(true)}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#059669] hover:bg-[#047857] rounded-xl transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Walk-In Urgent Indent</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredIndents.map((indent) => {
            const isFulfilled = indent.status === 'FULFILLED';
            const isRejected = indent.status === 'REJECTED';
            const isPending = !isFulfilled && !isRejected;

            // Find stock level in store
            const matchedPart = parts.find(
              (p) => p.partId === indent.partId || p.sku === indent.sku
            );
            const stockQty = matchedPart?.stock ?? 15;
            const hasSufficientStock = stockQty >= (indent.quantity || 1);

            return (
              <div
                key={indent.id}
                className={`bg-white border rounded-2xl p-5 shadow-2xs hover:shadow-md transition flex flex-col justify-between space-y-4 ${
                  isPending
                    ? 'border-rose-200/90 ring-1 ring-rose-500/10'
                    : isFulfilled
                    ? 'border-emerald-200/80'
                    : 'border-slate-200 opacity-80'
                }`}
              >
                <div className="space-y-3.5">
                  {/* Card Header: Indent ID, Urgency, Timestamp */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-black text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {indent.id}
                      </span>
                      {isPending ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
                          <Zap className="w-3 h-3" />
                          <span>URGENT ORDER</span>
                        </span>
                      ) : isFulfilled ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <Check className="w-3 h-3 text-[#059669]" />
                          <span>ISSUED &amp; DISPATCHED</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          <X className="w-3 h-3 text-slate-500" />
                          <span>REJECTED</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 text-[11px] text-slate-400 shrink-0">
                      <Clock className="w-3 h-3" />
                      <span>
                        {indent.createdAt
                          ? new Date(indent.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Recent'}
                      </span>
                    </div>
                  </div>

                  {/* Mechanic & Location Strip */}
                  <div className="bg-slate-50/80 border border-slate-100 rounded-xl p-3 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 text-[#059669] flex items-center justify-center font-bold text-xs shrink-0">
                        {indent.requestedBy ? indent.requestedBy.charAt(0) : 'M'}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 truncate">
                          {indent.requestedBy || 'Mechanic'}
                        </div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-1 truncate">
                          <MapPin className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                          <span>{indent.targetLine || 'Floor Line'}</span>
                          {indent.targetMachineId && (
                            <>
                              <span>•</span>
                              <span className="font-mono text-slate-700 font-semibold">
                                {indent.targetMachineId}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                        Role
                      </span>
                      <span className="text-[11px] font-bold text-slate-700">
                        {indent.requestedByRole || 'Mechanic'}
                      </span>
                    </div>
                  </div>

                  {/* Spare Part Details & Stock Health */}
                  <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                          Requested Spare Part
                        </span>
                        <div className="font-bold text-sm text-slate-900 truncate" title={indent.partName}>
                          {indent.partName}
                        </div>
                        {indent.sku && (
                          <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                            SKU: {indent.sku}
                          </div>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                          Quantity
                        </span>
                        <span className="font-mono text-base font-black text-slate-900">
                          {indent.quantity || 1}{' '}
                          <span className="text-xs font-normal text-slate-500">
                            {indent.unit || 'pcs'}
                          </span>
                        </span>
                      </div>
                    </div>

                    {/* Stock Status Indicator */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <Boxes className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-[11px] text-slate-500">Crib Stock:</span>
                        <span
                          className={`font-bold text-[11px] ${
                            hasSufficientStock ? 'text-[#059669]' : 'text-rose-600'
                          }`}
                        >
                          {stockQty} {indent.unit || 'pcs'} available
                        </span>
                      </div>

                      {hasSufficientStock ? (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-50 text-[#059669] border border-emerald-200">
                          Ready to Issue
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          Low Stock Buffer
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Justification & Breakdown reason */}
                  {indent.justification && (
                    <div className="text-xs text-slate-600 bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                      <span className="font-bold text-slate-700 block text-[10px] uppercase tracking-wider mb-0.5">
                        Breakdown Justification:
                      </span>
                      <p className="line-clamp-2 leading-relaxed">{indent.justification}</p>
                    </div>
                  )}

                  {/* Fulfilled Notes or Review Notes if completed */}
                  {isFulfilled && indent.fulfilledAt && (
                    <div className="text-[11px] text-emerald-800 bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-200/60 flex items-start gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#059669] shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold">
                          Issued by {indent.assignedStorePerson || 'Store'}
                        </div>
                        <div className="text-[10px] text-emerald-700 mt-0.5">
                          {indent.storeNotes || 'Stock balance updated.'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Footer Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  {isPending ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleOpenRejectModal(indent)}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                      >
                        Reject
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenIssueModal(indent)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#059669] hover:bg-[#047857] rounded-xl shadow-xs transition cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                        <span>Issue &amp; Dispatch Part</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="text-[11px] text-slate-400">
                        {isFulfilled ? 'Completed & Logged' : 'Declined Order'}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const targetPart = parts.find(
                            (p) => p.partId === indent.partId || p.sku === indent.sku
                          );
                          const slipData: GatePassData = {
                            slipNo: `SLIP-${Math.floor(1000 + Math.random() * 9000)}`,
                            indentId: indent.id,
                            date: indent.fulfilledAt || indent.createdAt,
                            mechanicName: indent.requestedBy || 'Mechanic',
                            mechanicRole: indent.requestedByRole || 'MECHANIC',
                            targetLine: indent.targetLine || 'Line 01',
                            targetMachineId: indent.targetMachineId || indent.machineId,
                            partName: indent.partName || targetPart?.name || 'Spare Part',
                            sku: indent.sku || targetPart?.sku || 'SKU-GEN',
                            quantity: indent.quantity || 1,
                            unit: indent.unit || 'pcs',
                            unitCost: targetPart?.unitCost || 0,
                            oldPartReturned: true,
                            storekeeper: indent.assignedStorePerson || 'Store In-Charge',
                            notes: indent.storeNotes || indent.justification,
                          };
                          setGatePassData(slipData);
                          setIsGatePassOpen(true);
                        }}
                        className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>View / Print Gate Slip</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── 6. ISSUE CONFIRMATION MODAL ───────────────────────────────────────── */}
      {activeIssueReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#059669] flex items-center justify-center">
                  <Check className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    Confirm Part Issue &amp; Dispatch
                  </h3>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Indent #{activeIssueReq.id}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveIssueReq(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Part & Mechanic Summary */}
              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Spare Part:</span>
                  <span className="font-bold text-slate-900">{activeIssueReq.partName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-[10px] uppercase font-bold">SKU &amp; Code:</span>
                  <span className="font-mono text-slate-700">{activeIssueReq.sku || 'SKU-GEN'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Requesting Mechanic:</span>
                  <span className="font-semibold text-slate-800">
                    {activeIssueReq.requestedBy} ({activeIssueReq.targetLine})
                  </span>
                </div>
              </div>

              {/* Quantity to Issue */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Quantity to Issue ({activeIssueReq.unit || 'pcs'}):
                </label>
                <input
                  type="number"
                  min="1"
                  value={issueQty}
                  onChange={(e) => setIssueQty(Number(e.target.value) || 1)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-[#059669]"
                />
              </div>

              {/* Scrap Return Verification */}
              <div className="flex items-center gap-2 p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl">
                <input
                  type="checkbox"
                  id="scrapReturnCheck"
                  checked={oldPartReturned}
                  onChange={(e) => setOldPartReturned(e.target.checked)}
                  className="rounded text-[#059669] focus:ring-[#059669] w-4 h-4"
                />
                <label htmlFor="scrapReturnCheck" className="text-xs font-semibold text-amber-900 cursor-pointer">
                  Defective / broken part received back into scrap bin
                </label>
              </div>

              {/* Storekeeper remarks */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Storekeeper Notes / Gate Pass Remarks:
                </label>
                <textarea
                  rows={2}
                  value={issueNotes}
                  onChange={(e) => setIssueNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-[#059669]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveIssueReq(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingIssue}
                onClick={handleConfirmIssue}
                className="px-4 py-2 text-xs font-bold text-white bg-[#059669] hover:bg-[#047857] rounded-xl shadow-xs transition flex items-center gap-1.5"
              >
                {isSubmittingIssue ? (
                  <span>Processing...</span>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Confirm &amp; Deduct Stock</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 7. REJECT MODAL ───────────────────────────────────────────────────── */}
      {activeRejectReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                  <XCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Reject Indent Order</h3>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Indent #{activeRejectReq.id}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveRejectReq(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-600">
                Please state the reason for rejecting {activeRejectReq.requestedBy}&apos;s indent for{' '}
                <span className="font-bold text-slate-900">{activeRejectReq.partName}</span>.
              </p>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Rejection Reason:
                </label>
                <textarea
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveRejectReq(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingReject}
                onClick={handleConfirmReject}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition"
              >
                {isSubmittingReject ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 8. WALK-IN URGENT INDENT MODAL ─────────────────────────────────────── */}
      {isWalkInModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#059669] flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    Walk-In Urgent Part Issue
                  </h3>
                  <p className="text-[10px] text-slate-500">
                    Record &amp; dispatch an urgent part order directly to a mechanic at the crib window.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsWalkInModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateWalkInIndent} className="space-y-4 text-xs">
              {/* Select Mechanic */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Requesting Floor Mechanic:
                </label>
                <select
                  value={walkInMechId}
                  onChange={(e) => setWalkInMechId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl outline-none font-semibold text-slate-800"
                >
                  {activeStaffRoster.map((m) => (
                    <option key={m.id} value={m.name}>
                      {m.name} ({m.id}) • {m.assignedLines || 'Floor Line'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Target Line & Machine */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Production Floor Line:
                  </label>
                  <select
                    value={walkInLine}
                    onChange={(e) => setWalkInLine(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl outline-none font-semibold text-slate-800"
                  >
                    <option value="Line 01">Line 01</option>
                    <option value="Line 02">Line 02</option>
                    <option value="Line 03">Line 03</option>
                    <option value="Line 04">Line 04</option>
                    <option value="Buffer Workshop">Buffer Workshop</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Machine ID (Optional):
                  </label>
                  <input
                    type="text"
                    value={walkInMachineId}
                    onChange={(e) => setWalkInMachineId(e.target.value)}
                    placeholder="e.g. MC-OVK-204"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl outline-none"
                  />
                </div>
              </div>

              {/* Select Spare Part */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Select Spare Part from Catalog ({parts.length} available):
                </label>
                <select
                  value={walkInPartId}
                  onChange={(e) => setWalkInPartId(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl outline-none font-bold text-slate-800"
                >
                  <option value="">-- Choose Spare Part --</option>
                  {parts.map((p) => (
                    <option key={p.partId} value={p.partId}>
                      {p.name} ({p.sku}) • Stock: {p.stock} {p.unit} [₹{p.unitCost}]
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Quantity to Issue:
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={walkInQty}
                    onChange={(e) => setWalkInQty(Number(e.target.value) || 1)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl outline-none font-semibold"
                  />
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={walkInOldPartReturned}
                      onChange={(e) => setWalkInOldPartReturned(e.target.checked)}
                      className="rounded text-[#059669] focus:ring-[#059669] w-4 h-4"
                    />
                    <span>Old scrap part returned</span>
                  </label>
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Breakdown / Shift Urgency Reason:
                </label>
                <textarea
                  rows={2}
                  value={walkInReason}
                  onChange={(e) => setWalkInReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsWalkInModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingWalkIn}
                  className="px-4 py-2 text-xs font-bold text-white bg-[#059669] hover:bg-[#047857] rounded-xl shadow-xs transition"
                >
                  {isSubmittingWalkIn ? 'Issuing...' : 'Create & Issue Immediately'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── 9. GATE PASS / STORE ISSUE SLIP PRINT MODAL ───────────────────────── */}
      {isGatePassOpen && gatePassData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#059669]" />
                <h3 className="font-bold text-sm text-slate-900">Store Gate Pass / Issue Slip</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsGatePassOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Printable Slip Preview */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 font-mono text-xs text-slate-800">
              <div className="text-center pb-2 border-b border-slate-200">
                <div className="font-bold text-sm text-slate-900">ESSTEE PLANT &amp; APPAREL</div>
                <div className="text-[10px] text-slate-500">CENTRAL SPARE PARTS CRIB • TIRUPUR</div>
                <div className="text-[10px] font-bold text-[#059669] mt-0.5">
                  GATE PASS SLIP: {gatePassData.slipNo}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-400 block text-[9px]">INDENT NO:</span>
                  <span className="font-bold">{gatePassData.indentId}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block text-[9px]">DATE &amp; TIME:</span>
                  <span>{new Date(gatePassData.date).toLocaleDateString()} {new Date(gatePassData.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-2 text-[11px] space-y-1">
                <div>
                  <span className="text-slate-400 block text-[9px]">MECHANIC:</span>
                  <span className="font-bold">{gatePassData.mechanicName} ({gatePassData.targetLine})</span>
                </div>
                {gatePassData.targetMachineId && (
                  <div>
                    <span className="text-slate-400 block text-[9px]">MACHINE:</span>
                    <span>{gatePassData.targetMachineId}</span>
                  </div>
                )}
                <div>
                  <span className="text-slate-400 block text-[9px]">PART ISSUED:</span>
                  <span className="font-bold text-slate-900">{gatePassData.partName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>SKU: {gatePassData.sku}</span>
                  <span className="font-bold">QTY: {gatePassData.quantity} {gatePassData.unit}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9px]">OLD SCRAP PART:</span>
                  <span className={gatePassData.oldPartReturned ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
                    {gatePassData.oldPartReturned ? '✓ RECEIVED IN SCRAP CRIB' : '⚠ PENDING SUBMISSION'}
                  </span>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-2 text-[10px] flex items-center justify-between text-slate-500">
                <div>ISSUED BY: {gatePassData.storekeeper}</div>
                <div>STORE SEAL: VERIFIED</div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsGatePassOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 text-xs font-bold text-white bg-[#059669] hover:bg-[#047857] rounded-xl shadow-xs transition flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Gate Pass</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StoreInboxPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
          <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span>Loading mechanic indents queue...</span>
        </div>
      }
    >
      <StoreInboxContent />
    </Suspense>
  );
}
