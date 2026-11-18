'use client';

import { textValue } from '@/lib/textValue';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  Boxes,
  PackageOpen,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle,
  Plus,
  Minus,
  Truck,
  X,
  FileSpreadsheet,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  IndianRupee,
  AlertOctagon,
  Clock,
  User,
  Users,
  ArrowRight,
  Send,
  Building,
  Zap,
  Trash2,
  ListPlus,
  Layers,
  Lock,
  ChevronDown,
  Wrench,
  Gauge,
  Printer,
  Download,
  QrCode,
  RefreshCw,
  MapPin,
  RotateCcw,
  FileText,
  ScanBarcode,
  Check,
  ArrowUpRight,
  Package,
  PackageCheck,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import {
  SparePart,
  PartRequisition,
  RequisitionType,
  RequisitionUrgency,
  RequisitionItem,
} from '@/types/cmms';
import {
  subscribeParts,
  adjustPartStock,
  restockPart,
  subscribeRequisitions,
  createRequisition,
  approveRequisition,
  rejectRequisition,
  sendAppNotification,
} from '@/lib/services/cmmsService';
import { FACTORY_MECHANICS_ROSTER, MechanicDuty, userToMechanicDuty } from '@/lib/constants/mechanics';
import { MechanicCustodyModal } from '@/components/mechanic/MechanicCustodyModal';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { normalizeRole } from '@/lib/constants/roles';
import { FACTORY_MACHINE_CATEGORIES, detectMachineCategory, isSpareCompatibleWithMachine } from '@/lib/utils/spareMapping';

export default function InventoryPage() {
  const { showToast } = useToast();
  const { user, role } = useAuth();
  const currentRole = normalizeRole(user?.role || role);

  const isStorePersonOrAdmin = currentRole === 'STORE_PERSON' || currentRole === 'ADMIN' || currentRole === 'ASSET_MANAGER';
  const isMechanicOrAdmin = currentRole === 'MECHANIC' || currentRole === 'SENIOR_MECHANIC' || currentRole === 'ELECTRICIAN' || currentRole === 'SENIOR_ELECTRICIAN' || currentRole === 'ADMIN' || currentRole === 'ASSET_MANAGER';

  // Strict authorization matrix: only authorized executives/admin can approve critical needs
  const isAuthorizedToApproveCritical = currentRole === 'CEO' || currentRole === 'ADMIN' || currentRole === 'ASSET_MANAGER';
  const isAuthorizedToApproveGeneral = currentRole === 'STORE_PERSON' || currentRole === 'ADMIN' || currentRole === 'ASSET_MANAGER' || currentRole === 'CEO';

  const [parts, setParts] = useState<SparePart[]>([]);
  const [requisitions, setRequisitions] = useState<PartRequisition[]>([]);

  // Mechanic Custody details state
  const [selectedMechanic, setSelectedMechanic] = useState<MechanicDuty | null>(null);
  const [isMechCustodyOpen, setIsMechCustodyOpen] = useState(false);
  const [activeMechanicId, setActiveMechanicId] = useState<string>('ELEC-02');
  const [showFullPartsTable, setShowFullPartsTable] = useState(true);

  // Dynamic staff roster from registered users
  const [registeredStaff, setRegisteredStaff] = useState<MechanicDuty[]>([]);

  useEffect(() => {
    fetch('/api/users')
      .then((r) => r.json())
      .then((data) => {
        if (data.users && Array.isArray(data.users)) {
          const staff = data.users.filter((u: any) => {
            const r = String(u.role || '').toUpperCase();
            return (
              r.includes('MECHANIC') ||
              r.includes('ELECTRICIAN') ||
              r.includes('STORE') ||
              r.includes('ADMIN') ||
              r.includes('TECH')
            );
          });
          if (staff.length > 0) {
            setRegisteredStaff(staff.map(userToMechanicDuty));
          }
        }
      })
      .catch(() => {});
  }, []);

  const activeStaffRoster = registeredStaff.length > 0 ? registeredStaff : FACTORY_MECHANICS_ROSTER;

  // Fast Floor Issue Modal state
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [activeIssuePart, setActiveIssuePart] = useState<SparePart | null>(null);
  const [issueQty, setIssueQty] = useState<number>(1);
  const [selectedIssueMechanicId, setSelectedIssueMechanicId] = useState<string>('');
  const [issueTargetLine, setIssueTargetLine] = useState<string>('Line 02');
  const [issueTargetMachine, setIssueTargetMachine] = useState<string>('');
  const [oldPartReturned, setOldPartReturned] = useState<boolean>(true);
  const [issueRemarks, setIssueRemarks] = useState<string>('');
  const [issueReceivedByPerson, setIssueReceivedByPerson] = useState<string>('');
  const [issueReceiverEmpId, setIssueReceiverEmpId] = useState<string>('');
  const [isSubmittingIssue, setIsSubmittingIssue] = useState<boolean>(false);

  // Sync default receiver details when mechanic changes
  useEffect(() => {
    if (activeStaffRoster.length > 0 && (!selectedIssueMechanicId || !activeStaffRoster.some((m) => m.id === selectedIssueMechanicId))) {
      setSelectedIssueMechanicId(activeStaffRoster[0].id);
      setIssueReceivedByPerson(activeStaffRoster[0].name);
      setIssueReceiverEmpId(activeStaffRoster[0].id);
    }
  }, [activeStaffRoster, selectedIssueMechanicId]);

  useEffect(() => {
    const m = activeStaffRoster.find((mech) => mech.id === selectedIssueMechanicId);
    if (m) {
      setIssueReceivedByPerson(m.name);
      setIssueReceiverEmpId(m.id);
    }
  }, [selectedIssueMechanicId, activeStaffRoster]);

  // Printable Gate Pass Slip state
  interface GatePassPayload {
    slipNo: string;
    date: string;
    part: SparePart;
    qty: number;
    mechanicName: string;
    mechanicId: string;
    mechanicTrade: string;
    targetLine: string;
    targetMachine?: string;
    oldPartReturned: boolean;
    storekeeper: string;
    remarks?: string;
    receivedByPerson?: string;
    receiverEmpId?: string;
  }
  const [isGatePassOpen, setIsGatePassOpen] = useState(false);
  const [gatePassData, setGatePassData] = useState<GatePassPayload | null>(null);

  // Inward Goods (GRN) Intake Modal state
  const [grnVendor, setGrnVendor] = useState<string>('');
  const [grnChallanNo, setGrnChallanNo] = useState<string>('');
  const [grnQcPassed, setGrnQcPassed] = useState<boolean>(true);
  const [grnNotes, setGrnNotes] = useState<string>('');

  // Barcode / Scanner Modal state
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // For Senior Electrician, ONLY show junior electricians
  const visibleMechanics = useMemo(() => {
    if (currentRole === 'SENIOR_ELECTRICIAN') {
      return activeStaffRoster.filter(
        (m) => m.trade === 'ELECTRICIAN' && !textValue(m.role).toLowerCase().includes('senior')
      );
    }
    if (currentRole === 'SENIOR_MECHANIC') {
      return activeStaffRoster.filter((m) => m.trade === 'MECHANIC');
    }
    return activeStaffRoster;
  }, [currentRole, activeStaffRoster]);

  // Sync active selected mechanic
  useEffect(() => {
    if (visibleMechanics.length > 0 && !visibleMechanics.some((m) => m.id === activeMechanicId)) {
      setActiveMechanicId(visibleMechanics[0].id);
    }
  }, [visibleMechanics, activeMechanicId]);

  const currentMechanicData = useMemo(
    () => visibleMechanics.find((m) => m.id === activeMechanicId) || visibleMechanics[0] || null,
    [activeMechanicId, visibleMechanics]
  );

  const handleOpenMechanicCustody = (mechIdentifier: string | MechanicDuty) => {
    if (typeof mechIdentifier === 'object' && mechIdentifier !== null) {
      setSelectedMechanic(mechIdentifier);
      setActiveMechanicId(mechIdentifier.id);
      setIsMechCustodyOpen(true);
      return;
    }
    const cleanName = (mechIdentifier || '').toLowerCase();
    const found = activeStaffRoster.find(
      (m) =>
        textValue(m.name).toLowerCase().includes(cleanName) ||
        cleanName.includes(textValue(m.name).toLowerCase()) ||
        textValue(m.id).toLowerCase() === cleanName
    );
    const mech = found || activeStaffRoster[0];
    if (mech) {
      setSelectedMechanic(mech);
      setActiveMechanicId(mech.id);
      setIsMechCustodyOpen(true);
    }
  };

  // Requisition Hub Modal tab: 'MONTHLY_INDENT' | 'URGENT_NEED' | 'CRITICAL_CEO' | 'VIEW_ALL'
  const [reqModalTab, setReqModalTab] = useState<RequisitionType | 'VIEW_ALL'>('MONTHLY_INDENT');

  // Search & filters for inventory
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [machineTypeFilter, setMachineTypeFilter] = useState<string>('ALL');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // Search & filters for requisitions
  const [reqFilter, setReqFilter] = useState<
    'ALL' | 'CRITICAL' | 'URGENT' | 'MONTHLY' | 'PENDING' | 'APPROVED'
  >('ALL');

  // Restock Modal state
  const [isRestockOpen, setIsRestockOpen] = useState(false);
  const [restockPartId, setRestockPartId] = useState('');
  const [restockQty, setRestockQty] = useState<number>(50);
  const [restockPO, setRestockPO] = useState('');

  // Requisition Modal state
  const [isReqModalOpen, setIsReqModalOpen] = useState(false);
  const [reqMode, setReqMode] = useState<RequisitionType>('MONTHLY_INDENT');

  // Single-part fields (for Critical or Urgent)
  const [reqPartId, setReqPartId] = useState<string>('');
  const [reqCustomPartName, setReqCustomPartName] = useState<string>('');
  const [reqQty, setReqQty] = useState<number>(2);
  const [reqCostOverride, setReqCostOverride] = useState<number>(0);
  const [reqMonthYear, setReqMonthYear] = useState<string>('October 2026');
  const [reqTargetLine, setReqTargetLine] = useState<string>('Line 02');
  const [reqTargetMachine, setReqTargetMachine] = useState<string>('');
  const [reqJustification, setReqJustification] = useState<string>('');

  // Multi-part list state (for Monthly Indent)
  const [indentItems, setIndentItems] = useState<RequisitionItem[]>([]);
  const [newIndentPartId, setNewIndentPartId] = useState<string>('');
  const [newIndentQty, setNewIndentQty] = useState<number>(50);

  // Centralized Indent & Requisition Dropdown Menu state
  const [isIndentMenuOpen, setIsIndentMenuOpen] = useState(false);
  const indentMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (indentMenuRef.current && !indentMenuRef.current.contains(event.target as Node)) {
        setIsIndentMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [isSubmittingReq, setIsSubmittingReq] = useState(false);

  useEffect(() => {
    const unsubParts = subscribeParts((data) => {
      setParts(data);
      if (data.length > 0) {
        if (!restockPartId) setRestockPartId(data[0].partId);
        if (!reqPartId) setReqPartId(data[0].partId);
        if (!newIndentPartId) setNewIndentPartId(data[0].partId);
      }
    });

    const unsubReqs = subscribeRequisitions((data) => {
      setRequisitions(data);
    });

    return () => {
      unsubParts();
      unsubReqs();
    };
  }, [restockPartId, reqPartId, newIndentPartId]);

  // Inventory stats
  const totalSkus = parts.length;
  const lowStockItems = useMemo(
    () => parts.filter((p) => p.stock <= p.minStock),
    [parts]
  );
  const totalValuation = useMemo(
    () => parts.reduce((acc, cur) => acc + cur.stock * cur.unitCost, 0),
    [parts]
  );

  // User-scoped requisitions:
  // For Senior Electrician, strictly filter to ONLY junior electricians and their indents
  const displayedRequisitions = useMemo(() => {
    if (role === 'SENIOR_ELECTRICIAN') {
      return requisitions.filter((r) => {
        const reqName = textValue((r.requestedBy || '')).trim().toLowerCase();
        const reqRole = textValue((r.requestedByRole || '')).trim().toLowerCase();
        // Matches junior electricians (Rajesh G., Karthik M., or non-senior electrician)
        return (
          reqName.includes('rajesh') ||
          reqName.includes('karthik') ||
          (reqRole.includes('electrician') && !reqRole.includes('senior') && !reqRole.includes('lead')) ||
          reqRole.includes('junior')
        );
      });
    }

    if (role === 'ELECTRICIAN') {
      const currentUserName = textValue((user?.name || '')).trim().toLowerCase();
      return requisitions.filter((r) => {
        const reqName = textValue((r.requestedBy || '')).trim().toLowerCase();
        if (currentUserName) {
          const userParts = currentUserName.split(' ').filter((p) => p.length > 2);
          const hasMatch = userParts.some((p) => reqName.includes(p));
          if (hasMatch || reqName.includes(currentUserName) || currentUserName.includes(reqName)) {
            return true;
          }
        }
        return reqName.includes('rajesh') || reqName.includes('karthik') || reqName.includes('electrician');
      });
    }

    if (role === 'MECHANIC' || role === 'SENIOR_MECHANIC') {
      const currentUserName = textValue((user?.name || '')).trim().toLowerCase();
      return requisitions.filter((r) => {
        const reqName = textValue((r.requestedBy || '')).trim().toLowerCase();
        if (currentUserName) {
          const userParts = currentUserName.split(' ').filter((p) => p.length > 2);
          const hasMatch = userParts.some((p) => reqName.includes(p));
          if (hasMatch || reqName.includes(currentUserName) || currentUserName.includes(reqName)) {
            return true;
          }
        }
        if (role === 'MECHANIC' && (reqName.includes('suresh') || reqName.includes('mechanic'))) return true;
        if (role === 'SENIOR_MECHANIC' && (reqName.includes('ramesh') || reqName.includes('senior') || reqName.includes('lead'))) return true;
        return false;
      });
    }
    return requisitions;
  }, [requisitions, role, user]);

  // Requisitions stats (scoped to displayed requisitions)
  const pendingCeoApprovals = useMemo(
    () => displayedRequisitions.filter((r) => r.status === 'PENDING_CEO_APPROVAL'),
    [displayedRequisitions]
  );
  const pendingManagerApprovals = useMemo(
    () => displayedRequisitions.filter((r) => r.status === 'PENDING_MANAGER_APPROVAL' || r.status === 'PENDING_REVIEW'),
    [displayedRequisitions]
  );
  const approvedRequisitions = useMemo(
    () => displayedRequisitions.filter((r) => r.status === 'APPROVED_BY_CEO' || r.status === 'APPROVED_BY_MANAGER'),
    [displayedRequisitions]
  );
  const totalReqValue = useMemo(
    () => displayedRequisitions.reduce((acc, r) => acc + (r.estimatedCost || 0), 0),
    [displayedRequisitions]
  );

  // Filtered parts table
  const filteredParts = useMemo(() => {
    return parts.filter((p) => {
      const isLow = p.stock <= p.minStock;
      if (lowStockOnly && !isLow) return false;
      if (categoryFilter !== 'ALL' && p.category !== categoryFilter) return false;
      if (machineTypeFilter !== 'ALL' && (p.machineType || 'GENERAL') !== machineTypeFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = textValue(p.name).toLowerCase().includes(q);
        const matchSku = textValue(p.sku).toLowerCase().includes(q);
        const matchCompat = textValue(p.compat).toLowerCase().includes(q);
        const matchType = textValue((p.machineType || '')).toLowerCase().includes(q);
        if (!matchName && !matchSku && !matchCompat && !matchType) return false;
      }
      return true;
    });
  }, [parts, lowStockOnly, categoryFilter, machineTypeFilter, searchQuery]);

  // Filtered requisitions list (scoped to displayed requisitions)
  const filteredRequisitions = useMemo(() => {
    return displayedRequisitions.filter((r) => {
      if (reqFilter === 'CRITICAL') return r.type === 'CRITICAL_CEO';
      if (reqFilter === 'URGENT') return r.type === 'URGENT_NEED';
      if (reqFilter === 'MONTHLY') return r.type === 'MONTHLY_INDENT';
      if (reqFilter === 'PENDING')
        return (
          r.status === 'PENDING_CEO_APPROVAL' ||
          r.status === 'PENDING_MANAGER_APPROVAL' ||
          r.status === 'PENDING_REVIEW'
        );
      if (reqFilter === 'APPROVED')
        return r.status === 'APPROVED_BY_CEO' || r.status === 'APPROVED_BY_MANAGER';
      return true;
    });
  }, [displayedRequisitions, reqFilter]);

  const handleAdjust = async (part: SparePart, delta: number) => {
    if (part.stock + delta < 0) {
      showToast('Stock cannot fall below zero.', 'warning');
      return;
    }
    await adjustPartStock(part.partId, delta);
    showToast(`${part.sku} updated (${part.stock + delta} ${part.unit})`, 'info');
  };

  const handleOpenIssueModal = (part?: SparePart) => {
    const targetPart = part || parts[0];
    if (!targetPart) {
      showToast('No spare parts available to issue.', 'warning');
      return;
    }
    setActiveIssuePart(targetPart);
    setIssueQty(1);
    setOldPartReturned(true);
    setIssueRemarks('');
    setIsIssueModalOpen(true);
  };

  const handleConfirmIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeIssuePart) return;
    if (issueQty <= 0) {
      showToast('Quantity must be greater than 0', 'warning');
      return;
    }
    if (issueQty > activeIssuePart.stock) {
      showToast(`Insufficient stock! Available: ${activeIssuePart.stock} ${activeIssuePart.unit}`, 'error');
      return;
    }

    setIsSubmittingIssue(true);
    try {
      await adjustPartStock(activeIssuePart.partId, -issueQty);

      const mech =
        activeStaffRoster.find((m) => m.id === selectedIssueMechanicId) ||
        activeStaffRoster[0] || {
          id: issueReceiverEmpId.trim() || 'EMP-01',
          name: issueReceivedByPerson.trim() || 'Maintenance Staff',
          role: 'Maintenance Technician',
        };
      const slipNumber = `GPS-2026-${Math.floor(100000 + Math.random() * 900000)}`;
      const actualReceiver = issueReceivedByPerson.trim() || mech.name;
      const actualEmpId = issueReceiverEmpId.trim() || mech.id;

      const passPayload: GatePassPayload = {
        slipNo: slipNumber,
        date: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
        part: activeIssuePart,
        qty: issueQty,
        mechanicName: mech.name,
        mechanicId: mech.id,
        mechanicTrade: mech.role,
        targetLine: issueTargetLine,
        targetMachine: issueTargetMachine.trim() || undefined,
        oldPartReturned: oldPartReturned,
        storekeeper: user?.name
          ? `${user.name} (${user.title || 'Storekeeper'})`
          : 'Store In-Charge',
        remarks: issueRemarks.trim() || undefined,
        receivedByPerson: actualReceiver,
        receiverEmpId: actualEmpId,
      };

      setGatePassData(passPayload);

      // POINT 7: Send instant notification to the responsible mechanic with receiving person proof
      sendAppNotification({
        type: 'SPARE_ISSUE_RECEIPT',
        title: `Spare Parts Issued — ${activeIssuePart.name}`,
        message: `${issueQty} ${activeIssuePart.unit} handed over to ${actualReceiver} (${actualEmpId}) for ${issueTargetLine}${issueTargetMachine ? ` • Machine ${issueTargetMachine}` : ''}. Please confirm receipt.`,
        targetRole: 'MECHANIC',
        targetUserId: mech.name,
        senderName: user?.name || 'Store In-Charge',
        meta: {
          slipNo: slipNumber,
          partId: activeIssuePart.partId,
          partName: activeIssuePart.name,
          qty: issueQty,
          receivedByPerson: actualReceiver,
          receiverEmpId: actualEmpId,
          mechanicName: mech.name,
          mechanicId: mech.id,
        },
      });

      setIsIssueModalOpen(false);
      setIsGatePassOpen(true);
      showToast(
        `Issued ${issueQty} ${activeIssuePart.unit} to ${actualReceiver}. Acknowledgment request dispatched to ${mech.name}!`,
        'success'
      );
    } catch (err) {
      console.error(err);
      showToast('Failed to issue part', 'error');
    } finally {
      setIsSubmittingIssue(false);
    }
  };

  const handleOpenGrnModal = (part?: SparePart) => {
    const targetPart = part || parts[0];
    if (targetPart) {
      setRestockPartId(targetPart.partId);
      setGrnVendor(
        targetPart.vendor ||
          (targetPart.category === 'Needles' ? 'Organ Needle Co.' : 'Genuine Machine Spares')
      );
      // POINT 8: Auto-calculate replenishment quantity and broadcast notification
      const suggestedQty = Math.max(25, (targetPart.minStock * 2) - (targetPart.stock || 0));
      setRestockQty(suggestedQty);

      sendAppNotification({
        type: 'RESTOCK_ALERT',
        title: `Restock Quantity Auto-Calculated: ${targetPart.name}`,
        message: `System auto-filled ${suggestedQty} ${targetPart.unit} for ${targetPart.name} (${targetPart.sku}) based on safety buffer (Min: ${targetPart.minStock}, Stock: ${targetPart.stock}).`,
        targetRole: 'ALL',
        senderName: user?.name || 'Store In-Charge',
        meta: {
          partId: targetPart.partId,
          partName: targetPart.name,
          sku: targetPart.sku,
          suggestedQty,
          minStock: targetPart.minStock,
          currentStock: targetPart.stock,
        },
      });

      showToast(
        `⚡ Auto-filled ${suggestedQty} ${targetPart.unit} replenishment for ${targetPart.name}! Notification dispatched to Admin & Maintenance.`,
        'info'
      );
    } else {
      setRestockQty(50);
    }
    setGrnChallanNo(`DC-GRN-2026-${Math.floor(1000 + Math.random() * 9000)}`);
    setGrnQcPassed(true);
    setGrnNotes('');
    setIsRestockOpen(true);
  };

  const handleRestockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockPartId || restockQty <= 0) return;
    const target = parts.find((p) => p.partId === restockPartId);
    if (!target) return;

    const poRef = grnChallanNo || restockPO || `GRN-${Date.now().toString().slice(-6)}`;
    await restockPart(restockPartId, restockQty, poRef);

    sendAppNotification({
      type: 'RESTOCK_ALERT',
      title: `Inventory Restocked: ${target.name}`,
      message: `Successfully received and shelved +${restockQty} ${target.unit} under ${poRef}. Bin: ${target.shelfLocation || 'Tool Crib'}.`,
      targetRole: 'ALL',
      senderName: user?.name || 'Store In-Charge',
    });

    showToast(
      `Received ${restockQty} ${target.unit} for ${target.sku} under Challan ${poRef}!`,
      'success'
    );
    setIsRestockOpen(false);
    setRestockPO('');
    setGrnChallanNo('');
  };

  const handleExportReorderList = () => {
    const lowStock = parts.filter((p) => p.stock <= p.minStock);
    if (lowStock.length === 0) {
      showToast('All spare parts have healthy inventory above minimum safety buffers.', 'info');
      return;
    }
    const headers = [
      'Part SKU',
      'Description',
      'Category',
      'Shelf Location',
      'Current Stock',
      'Min Safe Stock',
      'Shortage Units',
      'Unit Cost (INR)',
      'Est Reorder Value (INR)',
      'Vendor / Supplier',
      'Scrap Return Policy',
    ];
    const rows = lowStock.map((p) => [
      p.sku,
      `"${p.name.replace(/"/g, '""')}"`,
      p.category,
      `"${p.shelfLocation || 'Rack A-01 • Bin 01'}"`,
      p.stock,
      p.minStock,
      p.minStock - p.stock > 0 ? p.minStock - p.stock : 0,
      p.unitCost,
      ((p.minStock * 2 - p.stock > 0 ? p.minStock * 2 - p.stock : p.minStock) * p.unitCost),
      `"${p.vendor || 'Direct Purchase'}"`,
      p.oldPartReturnRequired ? '1:1 Scrap Return Required' : 'Standard Consumable',
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `Store_Reorder_List_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Exported ${lowStock.length} low-stock items for purchase reorder!`, 'success');
  };

  const handleOpenReqModal = (mode: RequisitionType | 'VIEW_ALL' = 'MONTHLY_INDENT', initialPartId?: string) => {
    if (mode === 'VIEW_ALL') {
      setReqModalTab('VIEW_ALL');
      setIsReqModalOpen(true);
      return;
    }

    setReqModalTab(mode);
    setReqMode(mode);
    setReqJustification('');
    setReqCostOverride(0);

    if (initialPartId) {
      setReqPartId(initialPartId);
      setNewIndentPartId(initialPartId);
      const targetPart = parts.find((p) => p.partId === initialPartId);
      if (targetPart) {
        setReqCustomPartName(targetPart.name);
      }
    }

    if (mode === 'MONTHLY_INDENT') {
      if (initialPartId) {
        const targetPart = parts.find((p) => p.partId === initialPartId);
        if (targetPart && !indentItems.some((it) => it.partId === initialPartId)) {
          setIndentItems((prev) => [
            ...prev,
            {
              partId: targetPart.partId,
              partName: targetPart.name,
              sku: targetPart.sku,
              quantity: targetPart.minStock * 2 || 50,
              unit: targetPart.unit,
              unitCost: targetPart.unitCost,
              totalCost: Math.round((targetPart.minStock * 2 || 50) * targetPart.unitCost * 100) / 100,
            },
          ]);
        }
      }
    }
    setIsReqModalOpen(true);
  };

  // Add item to Monthly Indent list
  const handleAddIndentItem = () => {
    if (!newIndentPartId || newIndentQty <= 0) return;
    const targetPart = parts.find((p) => p.partId === newIndentPartId);
    if (!targetPart) return;

    // Check if already in list
    const existingIndex = indentItems.findIndex((i) => i.partId === newIndentPartId);
    if (existingIndex >= 0) {
      const updated = [...indentItems];
      const newTotalQty = updated[existingIndex].quantity + newIndentQty;
      updated[existingIndex].quantity = newTotalQty;
      updated[existingIndex].totalCost = Math.round(newTotalQty * targetPart.unitCost * 100) / 100;
      setIndentItems(updated);
    } else {
      const newItem: RequisitionItem = {
        partId: targetPart.partId,
        partName: targetPart.name,
        sku: targetPart.sku,
        quantity: newIndentQty,
        unit: targetPart.unit,
        unitCost: targetPart.unitCost,
        totalCost: Math.round(newIndentQty * targetPart.unitCost * 100) / 100,
      };
      setIndentItems([...indentItems, newItem]);
    }

    showToast(`Added ${newIndentQty} ${targetPart.unit} of ${targetPart.sku} to indent list`, 'info');
    setNewIndentQty(50);
  };

  const handleRemoveIndentItem = (partId: string) => {
    setIndentItems(indentItems.filter((i) => i.partId !== partId));
  };

  // Total calculated budget for monthly indent list
  const indentTotalCost = useMemo(() => {
    return indentItems.reduce((acc, cur) => acc + cur.totalCost, 0);
  }, [indentItems]);

  const handleRequisitionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingReq(true);

    try {
      if (reqMode === 'MONTHLY_INDENT') {
        if (indentItems.length === 0) {
          showToast('Please add at least one spare part to your monthly indent list.', 'warning');
          setIsSubmittingReq(false);
          return;
        }

        const reqId = await createRequisition({
          type: 'MONTHLY_INDENT',
          items: indentItems,
          itemCount: indentItems.length,
          estimatedCost: Math.round(indentTotalCost * 100) / 100,
          urgency: 'ROUTINE',
          requiresCeoApproval: false,
          requestedBy: user?.name || 'Ramesh Kumar',
          requestedByRole: user?.title || 'Lead Sewing Mechanic',
          monthYear: reqMonthYear,
          targetLine: reqTargetLine,
          justification:
            reqJustification.trim() ||
            `Monthly planned spare inventory indent for ${reqMonthYear} (${indentItems.length} line items).`,
          status: 'PENDING_REVIEW',
        });

        showToast(
          `Monthly indent #${reqId} submitted with ${indentItems.length} parts (Total: ₹${indentTotalCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })})!`,
          'success'
        );
      } else if (reqMode === 'CRITICAL_CEO') {
        const selectedPart = parts.find((p) => p.partId === reqPartId);
        const partName = selectedPart ? selectedPart.name : reqCustomPartName.trim() || 'Custom Emergency Part';
        const sku = selectedPart ? selectedPart.sku : 'CUST-CRITICAL';
        const unit = selectedPart ? selectedPart.unit : 'units';
        const unitCost = selectedPart ? selectedPart.unitCost : reqCostOverride || 100;
        const estimatedCost = reqCostOverride > 0 ? reqCostOverride : Math.round(unitCost * reqQty * 100) / 100;

        const reqId = await createRequisition({
          type: 'CRITICAL_CEO',
          partId: reqPartId || 'CUSTOM',
          partName,
          sku,
          quantity: reqQty,
          unit,
          itemCount: 1,
          estimatedCost,
          urgency: 'CRITICAL_CEO_APPROVAL',
          requiresCeoApproval: true,
          requestedBy: user?.name || 'Ramesh Kumar',
          requestedByRole: user?.title || 'Lead Sewing Mechanic',
          monthYear: reqMonthYear,
          targetLine: reqTargetLine,
          targetMachineId: reqTargetMachine,
          justification:
            reqJustification.trim() ||
            'CRITICAL LINE STOP: Emergency machine breakdown halting line. Immediate CEO permission required.',
          status: 'PENDING_CEO_APPROVAL',
        });

        showToast(
          `🚨 Critical requisition #${reqId} dispatched! Flagged for CEO Permission.`,
          'warning'
        );
      } else {
        // URGENT_NEED (Manager Fast-Track)
        const selectedPart = parts.find((p) => p.partId === reqPartId);
        const partName = selectedPart ? selectedPart.name : reqCustomPartName.trim() || 'Urgent Spare Part';
        const sku = selectedPart ? selectedPart.sku : 'CUST-URGENT';
        const unit = selectedPart ? selectedPart.unit : 'units';
        const unitCost = selectedPart ? selectedPart.unitCost : reqCostOverride || 40;
        const estimatedCost = reqCostOverride > 0 ? reqCostOverride : Math.round(unitCost * reqQty * 100) / 100;

        const reqId = await createRequisition({
          type: 'URGENT_NEED',
          partId: reqPartId || 'CUSTOM',
          partName,
          sku,
          quantity: reqQty,
          unit,
          itemCount: 1,
          estimatedCost,
          urgency: 'URGENT_MANAGER',
          requiresCeoApproval: false,
          requestedBy: user?.name || 'Ramesh Kumar',
          requestedByRole: user?.title || 'Lead Sewing Mechanic',
          monthYear: reqMonthYear,
          targetLine: reqTargetLine,
          targetMachineId: reqTargetMachine,
          justification:
            reqJustification.trim() ||
            'URGENT SHIFT NEED: High risk of quality defect or imminent stock-out during peak shift.',
          status: 'PENDING_MANAGER_APPROVAL',
        });

        showToast(
          `⚡ Urgent requisition #${reqId} submitted for Maintenance Manager fast-track approval!`,
          'info'
        );
      }

      setReqModalTab('VIEW_ALL');
      setIsReqModalOpen(true);
    } catch (err) {
      showToast('Failed to submit requisition', 'error');
      console.error(err);
    } finally {
      setIsSubmittingReq(false);
    }
  };

  const handleApprove = async (req: PartRequisition) => {
    const isCritical = req.type === 'CRITICAL_CEO' || req.urgency === 'CRITICAL_CEO_APPROVAL' || req.requiresCeoApproval;

    if (isCritical && !isAuthorizedToApproveCritical) {
      showToast('Access Denied: Only authorized executives (CEO / Plant Admin) can approve critical tool requisitions.', 'error');
      return;
    }

    if (!isCritical && !isAuthorizedToApproveGeneral) {
      showToast('Access Denied: Mechanics cannot approve requisitions. Awaiting authorized store or admin approval.', 'error');
      return;
    }

    try {
      if (isCritical) {
        const approver = role === 'CEO'
          ? `${user?.name || 'Dr. K. Ramanathan'} (CEO)`
          : `${user?.name || 'V. Sundaram'} (Plant Admin)`;
        await approveRequisition(
          req.id,
          approver,
          'CEO / Executive emergency sanction granted for line restoration.',
          'APPROVED_BY_CEO'
        );
        showToast(`Critical Requisition #${req.id} authorized by ${approver}!`, 'success');
      } else {
        const approver = user?.name ? `${user.name} (${user.title})` : 'Store In-Charge';
        await approveRequisition(
          req.id,
          approver,
          'Approved within operational quota and maintenance allocation.',
          'APPROVED_BY_MANAGER'
        );
        showToast(`Requisition #${req.id} approved by ${approver}!`, 'success');
      }
    } catch (err) {
      showToast('Failed to approve requisition', 'error');
      console.error(err);
    }
  };

  const handleReject = async (id: string) => {
    const targetReq = requisitions.find((r) => r.id === id);
    const isCritical = targetReq?.type === 'CRITICAL_CEO' || targetReq?.urgency === 'CRITICAL_CEO_APPROVAL' || targetReq?.requiresCeoApproval;

    if (isCritical && !isAuthorizedToApproveCritical) {
      showToast('Access Denied: Only authorized executives can reject critical requisitions.', 'error');
      return;
    }
    if (!isCritical && !isAuthorizedToApproveGeneral) {
      showToast('Access Denied: Mechanics cannot reject requisitions.', 'error');
      return;
    }

    try {
      await rejectRequisition(
        id,
        user?.name ? `${user.name} (${user.title})` : 'Authorized Approver',
        'Deferred or rejected by authorized management.'
      );
      showToast(`Requisition #${id} marked as rejected.`, 'info');
    } catch (err) {
      showToast('Failed to reject requisition', 'error');
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Spare Parts Stock Maintenance Table</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Live crib stock inventory, buffer levels, machine compatibility mappings, and parts catalog.
            </p>
          </div>
        </div>

        {/* Action Buttons: Stock Maintenance & Mechanic Indents */}
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/dashboard/store-inbox"
            className="text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            title="Go to Mechanic Indent Receiving Desk"
          >
            <PackageCheck className="w-4 h-4 text-[#059669]" />
            <span>Mechanic Indents Desk</span>
          </Link>

          {/* Centralized Action: Indents & Requisitions under a Specific Button */}
          {isMechanicOrAdmin && (
            <div className="relative" ref={indentMenuRef}>
              <button
                type="button"
                onClick={() => setIsIndentMenuOpen(!isIndentMenuOpen)}
                className="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 px-4 py-2 rounded-xl transition flex items-center gap-2 shadow-sm cursor-pointer"
                title="Centralized Indents & Requisitions"
              >
                <ListPlus className="w-4 h-4 text-white" />
                <span>Central Indents &amp; Requisitions</span>
                {pendingCeoApprovals.length > 0 && (
                  <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-rose-500 text-white font-extrabold urgent-pulse">
                    {pendingCeoApprovals.length} CEO
                  </span>
                )}
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    isIndentMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Centralized Dropdown Menu */}
              {isIndentMenuOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3.5 py-2 border-b border-slate-100">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                      Centralized Indent Desk
                    </span>
                    <span className="text-xs font-bold text-slate-800">
                      Select Indent or Requisition Track:
                    </span>
                  </div>

                  <div className="p-1.5 space-y-1">
                    {/* 1. Urgent Floor Indent (Mechanic Need) */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsIndentMenuOpen(false);
                        handleOpenReqModal('URGENT_NEED');
                      }}
                      className="w-full text-left p-2.5 rounded-xl hover:bg-amber-50/70 transition flex items-start gap-2.5 group cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-amber-500 group-hover:text-white transition">
                        <Zap className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900 group-hover:text-amber-800">
                            ⚡ Urgent Floor Indents
                          </span>
                          <span className="text-[9px] font-bold text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded">
                            Mechanic Need
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                          Urgent spare parts requisition for active floor machine breakdowns.
                        </p>
                      </div>
                    </button>

                    {/* 2. Critical Need (CEO Approval) */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsIndentMenuOpen(false);
                        handleOpenReqModal('CRITICAL_CEO');
                      }}
                      className="w-full text-left p-2.5 rounded-xl hover:bg-rose-50/70 transition flex items-start gap-2.5 group cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-rose-600 group-hover:text-white transition">
                        <ShieldAlert className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900 group-hover:text-rose-700">
                            🚨 Critical Parts
                          </span>
                          <span className="text-[9px] font-extrabold text-rose-800 bg-rose-100 px-1.5 py-0.5 rounded urgent-pulse">
                            CEO Sanction
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                          Emergency line stoppage breakdown sanction &amp; budget override.
                        </p>
                      </div>
                    </button>

                    {/* 3. Urgent Need (Manager Fast-Track) */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsIndentMenuOpen(false);
                        handleOpenReqModal('URGENT_NEED');
                      }}
                      className="w-full text-left p-2.5 rounded-xl hover:bg-amber-50/70 transition flex items-start gap-2.5 group cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-amber-500 group-hover:text-white transition">
                        <Zap className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900 group-hover:text-amber-800">
                            ⚡ Urgent Needs
                          </span>
                          <span className="text-[9px] font-bold text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded">
                            Manager Fast-Track
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                          High risk shift defect prevention &amp; rapid floor procurement.
                        </p>
                      </div>
                    </button>

                    {/* 4. Active Requisitions & Approvals */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsIndentMenuOpen(false);
                        handleOpenReqModal('VIEW_ALL');
                      }}
                      className="w-full text-left p-2.5 rounded-xl hover:bg-slate-50 transition flex items-start gap-2.5 group cursor-pointer border-t border-slate-100"
                    >
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-indigo-600 group-hover:text-white transition">
                        <FileSpreadsheet className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900 group-hover:text-indigo-700">
                            📋 Requisitions &amp; Approvals
                          </span>
                          {pendingCeoApprovals.length > 0 ? (
                            <span className="text-[9px] font-extrabold text-rose-800 bg-rose-100 px-1.5 py-0.5 rounded urgent-pulse">
                              {pendingCeoApprovals.length} CEO Needed
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                              {requisitions.length} Items
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                          Audit, sanction pending indents, and inspect track history.
                        </p>
                      </div>
                    </button>
                  </div>

                  <div className="pt-2 pb-1 px-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                    <span>Centralized Requisition Engine</span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsIndentMenuOpen(false);
                        handleOpenReqModal('VIEW_ALL');
                      }}
                      className="font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                    >
                      Open Full Hub ➜
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Store Person & Admin Action: Restock Intake */}
          {isStorePersonOrAdmin && (
            <button
              onClick={() => setIsRestockOpen(true)}
              className="text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <PackageOpen className="w-4 h-4 text-emerald-600" />
              <span>Restock Tool Crib</span>
            </button>
          )}

          {/* CEO View Indicator */}
          {role === 'CEO' && (
            <span className="text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
              👑 Executive Inventory & Valuation Audit
            </span>
          )}
        </div>
      </div>

      {/* INVENTORY CATALOG & CRIB STOCK */}
      <div className="space-y-6 animate-in fade-in duration-150">
          {/* Summary metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Total Catalog Items
              </div>
              <div className="text-2xl font-extrabold text-slate-900 font-mono">{totalSkus}</div>
              <div className="text-[11px] text-emerald-600 font-medium">
                Categorized for 7 Machine Types
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Low Stock Warnings
              </div>
              <div className="text-2xl font-extrabold text-rose-600 font-mono">
                {lowStockItems.length} Items
              </div>
              <div className="text-[11px] text-rose-600 font-medium">
                Below safe buffer threshold
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Pending Approvals
              </div>
              <div className="text-2xl font-extrabold text-amber-600 font-mono">
                {pendingCeoApprovals.length + pendingManagerApprovals.length}
              </div>
              <div className="text-[11px] text-slate-500">
                {pendingCeoApprovals.length} CEO • {pendingManagerApprovals.length} Manager
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Total Inventory Value
              </div>
              <div className="text-2xl font-extrabold text-slate-900 font-mono">
                ₹{Math.round(totalValuation).toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-slate-500">Tool crib stock valuation</div>
            </div>
          </div>

          {/* MECHANIC & ELECTRICIAN TOOL CUSTODY SECTION */}
          {role !== 'MECHANIC' && role !== 'ELECTRICIAN' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    {role === 'SENIOR_ELECTRICIAN' ? (
                      <Zap className="w-4 h-4 text-cyan-600" />
                    ) : (
                      <Wrench className="w-4 h-4 text-indigo-600" />
                    )}
                    <span>
                      {role === 'SENIOR_ELECTRICIAN'
                        ? 'Junior Electricians Tool Custody'
                        : 'Mechanic Tool Custody'}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {role === 'SENIOR_ELECTRICIAN'
                      ? 'Click any junior electrician below to see the calibration tools and electrical components in their custody.'
                      : 'Click any mechanic below to see the tools and spare parts they are currently handling.'}
                  </p>
                </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {visibleMechanics.length} {role === 'SENIOR_ELECTRICIAN' ? 'Junior Electricians' : 'Technicians On Duty'}
                </span>
                <button
                  type="button"
                  onClick={() => setShowFullPartsTable(!showFullPartsTable)}
                  className="text-xs font-semibold px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer"
                >
                  {showFullPartsTable ? 'Hide Stock Catalog' : 'View Stock Catalog'}
                </button>
              </div>
            </div>

            {/* Mechanic Selector Cards */}
            {visibleMechanics.length === 0 ? (
              <div className="p-6 bg-white rounded-2xl border border-dashed border-slate-300 text-center text-slate-400">
                <Wrench className="w-6 h-6 mx-auto text-slate-300 mb-1" />
                <p className="text-xs font-semibold">No mechanics or technicians currently found in roster.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {visibleMechanics.map((mech) => {
                  const isSelected = mech.id === activeMechanicId;
                  const specialToolsCount = mech.checkedOutTools?.length || 0;
                  const drawnSparesCount = mech.activePartsDrawn?.reduce((acc, p) => acc + p.quantity, 0) || 0;

                  return (
                    <button
                      key={mech.id}
                      type="button"
                      onClick={() => {
                        setActiveMechanicId(mech.id);
                      }}
                      className={`text-left p-3.5 rounded-2xl border transition cursor-pointer flex flex-col justify-between gap-3 ${
                        isSelected
                          ? 'border-indigo-600 ring-2 ring-indigo-500 bg-indigo-50/50 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/70 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${mech.avatarColor || 'bg-indigo-600 text-white'}`}
                        >
                          {mech.name?.charAt(0) || 'M'}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-xs text-slate-900 truncate">
                            {mech.name}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {mech.id}
                          </div>
                        </div>
                      </div>

                      <div className="text-[11px] bg-white/80 p-2 rounded-xl border border-slate-200/70 space-y-0.5">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 text-[10px]">Tools:</span>
                          <span className="font-bold text-amber-700 font-mono">
                            {specialToolsCount}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 text-[10px]">Drawn:</span>
                          <span className="font-bold text-emerald-700 font-mono">
                            {drawnSparesCount} pcs
                          </span>
                        </div>
                      </div>

                      <div className="text-[10px] text-indigo-600 font-bold flex items-center justify-between pt-1 border-t border-slate-100">
                        <span>{isSelected ? '✓ Active Table' : 'Click to View'}</span>
                        <span>➜</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* DYNAMIC ITEM TABLE FOR SELECTED MECHANIC */}
            {currentMechanicData ? (
              <div className="bg-slate-50/70 rounded-2xl border border-slate-200 p-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${currentMechanicData.avatarColor || 'bg-indigo-600 text-white'}`}>
                      {currentMechanicData.name?.charAt(0) || 'M'}
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                        {currentMechanicData.name} &mdash; Handled Tools &amp; Parts Register
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        {currentMechanicData.role} • Shift: {currentMechanicData.shift} • {currentMechanicData.assignedLines}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenMechanicCustody(currentMechanicData)}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    <span>Full Custody Dossier</span>
                  </button>
                </div>

                {/* Table 1: Checked-Out Tools */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                    <span>1. Checked-Out Special Tools ({currentMechanicData.checkedOutTools?.length || 0}):</span>
                    <span className="text-[11px] font-normal text-slate-500">From Tool Crib</span>
                  </div>

                  {(!currentMechanicData.checkedOutTools || currentMechanicData.checkedOutTools.length === 0) ? (
                    <div className="p-4 bg-white rounded-xl border border-slate-200 text-xs text-slate-500 text-center">
                      No specialized calibration tools currently logged out.
                    </div>
                  ) : (
                    <div className="bg-white rounded-lg border border-slate-300 overflow-hidden shadow-2xs">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse border border-slate-300 text-xs text-slate-700">
                          <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] border-b border-slate-300 select-none">
                            <tr>
                              <th className="py-2 px-3 bg-slate-100 border-r border-b border-slate-300 text-center w-10 text-slate-500 font-mono">#</th>
                              <th className="py-2 px-3 bg-slate-100 border-r border-b border-slate-300">Tool Name</th>
                              <th className="py-2 px-3 bg-slate-100 border-r border-b border-slate-300">Tool ID &amp; S/N</th>
                              <th className="py-2 px-3 bg-slate-100 border-r border-b border-slate-300">Category</th>
                              <th className="py-2 px-3 bg-slate-100 border-r border-b border-slate-300">Location</th>
                              <th className="py-2 px-3 bg-slate-100 border-r border-b border-slate-300">Return Due</th>
                              <th className="py-2 px-3 bg-slate-100 border-r border-b border-slate-300">Condition</th>
                              <th className="py-2 px-3 bg-slate-100 border-b border-slate-300">Purpose</th>
                            </tr>
                          </thead>
                          <tbody>
                            {currentMechanicData.checkedOutTools.map((tool, idx) => (
                              <tr key={tool.id} className="hover:bg-blue-50/60 even:bg-slate-50/40 transition">
                                <td className="py-1.5 px-3 border-r border-b border-slate-200 text-center text-[10px] font-mono text-slate-400 bg-slate-50/50">{idx + 1}</td>
                                <td className="py-1.5 px-3 border-r border-b border-slate-200 font-bold text-slate-900">{tool.toolName}</td>
                                <td className="py-1.5 px-3 border-r border-b border-slate-200 font-mono text-[11px]">
                                  <span className="font-bold text-indigo-700">{tool.id}</span>
                                  <span className="text-slate-400 block">S/N: {tool.serialNo}</span>
                                </td>
                                <td className="py-1.5 px-3 border-r border-b border-slate-200 text-[11px] text-slate-600">
                                  {tool.category.replace('_', ' ')}
                                </td>
                                <td className="py-1.5 px-3 border-r border-b border-slate-200 text-[11px] text-slate-700 font-medium">{tool.location}</td>
                                <td className="py-1.5 px-3 border-r border-b border-slate-200 font-mono text-amber-700 font-semibold text-[11px]">{tool.returnDue}</td>
                                <td className="py-1.5 px-3 border-r border-b border-slate-200">
                                  <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    {tool.condition.replace('_', ' ')}
                                  </span>
                                </td>
                                <td className="py-1.5 px-3 border-b border-slate-200 text-slate-500 text-[11px] max-w-xs truncate" title={tool.purpose}>
                                  {tool.purpose}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                {/* Table 2: Active Drawn Spare Parts */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                    <span>2. Spare Parts in Active Hand ({currentMechanicData.activePartsDrawn?.length || 0}):</span>
                    <span className="text-[11px] font-normal text-slate-500">Drawn for Active Machine Repairs</span>
                  </div>

                  {(!currentMechanicData.activePartsDrawn || currentMechanicData.activePartsDrawn.length === 0) ? (
                    <div className="p-4 bg-white rounded-xl border border-slate-200 text-xs text-slate-500 text-center">
                      No spare parts currently drawn from crib.
                    </div>
                  ) : (
                    <div className="bg-white rounded-lg border border-slate-300 overflow-hidden shadow-2xs">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse border border-slate-300 text-xs text-slate-700">
                          <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] border-b border-slate-300 select-none">
                            <tr>
                              <th className="py-2 px-3 bg-slate-100 border-r border-b border-slate-300 text-center w-10 text-slate-500 font-mono">#</th>
                              <th className="py-2 px-3 bg-slate-100 border-r border-b border-slate-300">Part Description</th>
                              <th className="py-2 px-3 bg-slate-100 border-r border-b border-slate-300">Part SKU</th>
                              <th className="py-2 px-3 bg-slate-100 border-r border-b border-slate-300">Quantity</th>
                              <th className="py-2 px-3 bg-slate-100 border-r border-b border-slate-300">Target Machine</th>
                              <th className="py-2 px-3 bg-slate-100 border-r border-b border-slate-300">Floor Line</th>
                              <th className="py-2 px-3 bg-slate-100 border-b border-slate-300">Drawn At</th>
                            </tr>
                          </thead>
                          <tbody>
                            {currentMechanicData.activePartsDrawn.map((part, idx) => (
                              <tr key={idx} className="hover:bg-blue-50/60 even:bg-slate-50/40 transition">
                                <td className="py-1.5 px-3 border-r border-b border-slate-200 text-center text-[10px] font-mono text-slate-400 bg-slate-50/50">{idx + 1}</td>
                                <td className="py-1.5 px-3 border-r border-b border-slate-200 font-semibold text-slate-900">{part.partName}</td>
                                <td className="py-1.5 px-3 border-r border-b border-slate-200 font-mono text-indigo-700 text-[11px] font-bold">{part.sku}</td>
                                <td className="py-1.5 px-3 border-r border-b border-slate-200 font-mono font-bold text-slate-900">
                                  {part.quantity} {part.unit}
                                </td>
                                <td className="py-1.5 px-3 border-r border-b border-slate-200 font-mono font-bold text-slate-800">{part.forMachineId}</td>
                                <td className="py-1.5 px-3 border-r border-b border-slate-200 text-emerald-700 font-medium">{part.line}</td>
                                <td className="py-1.5 px-3 border-b border-slate-200 font-mono text-slate-500 text-[11px]">{part.drawnAt}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        )}

          {/* CRIB STOCK CATALOG (Always shown for line mechanics who do not have tool custody, or when toggled) */}
          {(showFullPartsTable || role === 'MECHANIC') && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4 animate-in fade-in duration-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Boxes className="w-4 h-4 text-indigo-600" />
                    <span>Tool Crib &amp; Spare Parts Catalog</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Real-time bin quantities, catalog pricing (₹), and SKU details for monthly indents.
                  </p>
                </div>
                {role !== 'MECHANIC' && (
                  <button
                    type="button"
                    onClick={() => setShowFullPartsTable(false)}
                    className="text-xs font-semibold px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer self-start sm:self-auto"
                  >
                    Hide Catalog
                  </button>
                )}
              </div>
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-grow max-w-xl">
                  <div className="relative flex-grow">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search SKU, name, or rack (e.g. Rack B-03)..."
                      className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsScannerOpen(true)}
                    className="p-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl text-slate-700 transition flex items-center gap-1.5 shrink-0 text-xs font-semibold cursor-pointer"
                    title="Scan Barcode or Quick-Select SKU"
                  >
                    <ScanBarcode className="w-4 h-4 text-indigo-600" />
                    <span className="hidden sm:inline">Scanner</span>
                  </button>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Machine Type Filter */}
                  <select
                    value={machineTypeFilter}
                    onChange={(e) => setMachineTypeFilter(e.target.value)}
                    className="text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 outline-none font-bold text-slate-800 cursor-pointer"
                  >
                    <option value="ALL">All Machine Types ({parts.length})</option>
                    <option value="FLATLOCK">FLATLOCK (50)</option>
                    <option value="OVERLOCK">OVERLOCK (49)</option>
                    <option value="SNLS">SNLS (Single Needle) (65)</option>
                    <option value="KAJA">KAJA (Buttonhole) (7)</option>
                    <option value="BUTTON">BUTTON (Stitch) (3)</option>
                    <option value="BARTACK">BARTACK (4)</option>
                    <option value="RIB CUTTING">RIB CUTTING (2)</option>
                    <option value="PICODING">PICODING (7)</option>
                    <option value="TRIMMER M/C">TRIMMER M/C (3)</option>
                    <option value="CUTTER M/C">CUTTER M/C (9)</option>
                    <option value="BAND KNIFE">BAND KNIFE (1)</option>
                    <option value="PATTERN TAKER">PATTERN TAKER (3)</option>
                    <option value="DOUBLE NEEDLE">DOUBLE NEEDLE (1)</option>
                    <option value="IRONING">IRONING (1)</option>
                    <option value="IOT DEVICE">IOT DEVICE (2)</option>
                    <option value="GENERAL">GENERAL (Universal) (53)</option>
                  </select>

                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 outline-none font-medium cursor-pointer"
                  >
                    <option value="ALL">All Categories</option>
                    <option value="Needles">Needles &amp; Pins</option>
                    <option value="Hooks & Loopers">Rotary Hooks &amp; Loopers</option>
                    <option value="Feed & Plates">Feed Dogs &amp; Plates</option>
                    <option value="Knives & Cutters">Knives &amp; Cutters</option>
                    <option value="Pressure Feet">Pressure Feet</option>
                    <option value="Tension & Guides">Tension &amp; Guides</option>
                    <option value="Mechanical & Fittings">Mechanical &amp; Fittings</option>
                    <option value="Motors & Electrical">Electronics &amp; Motors</option>
                    <option value="Fluids & Consumables">Fluids &amp; Consumables</option>
                    <option value="General">General</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => setLowStockOnly(!lowStockOnly)}
                    className={`text-xs px-3 py-1.5 rounded-xl border font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      lowStockOnly
                        ? 'bg-rose-50 border-rose-300 text-rose-700 shadow-2xs'
                        : 'bg-slate-50 border-slate-300 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <AlertTriangle className={`w-3.5 h-3.5 ${lowStockOnly ? 'text-rose-600' : 'text-slate-400'}`} />
                    <span>Low Stock Only</span>
                    {lowStockItems.length > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[10px] font-black">
                        {lowStockItems.length}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleExportReorderList}
                    className="text-xs px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    title="Export low-stock items as CSV for purchase order"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-600" />
                    <span>Export Reorder List</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenIssueModal()}
                    className="text-xs px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5 text-white" />
                    <span>Fast Floor Issue</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenGrnModal()}
                    className="text-xs px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Truck className="w-3.5 h-3.5 text-white" />
                    <span>Inward GRN</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-300 shadow-2xs">
                <table className="w-full text-left text-xs border-collapse border border-slate-300">
                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-300 select-none">
                    <tr>
                      <th className="py-2.5 px-3 bg-slate-100 border-r border-b border-slate-300">Part SKU &amp; Specs</th>
                      <th className="py-2.5 px-3 bg-slate-100 border-r border-b border-slate-300">Shelf Location</th>
                      <th className="py-2.5 px-3 min-w-[170px] bg-slate-100 border-r border-b border-slate-300">Live Stock Health</th>
                      <th className="py-2.5 px-3 bg-slate-100 border-r border-b border-slate-300">Scrap Return Policy</th>
                      <th className="py-2.5 px-3 bg-slate-100 border-r border-b border-slate-300 font-mono">Unit Cost</th>
                      <th className="py-2.5 px-3 text-right bg-slate-100 border-b border-slate-300">Floor Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-medium bg-white">
                    {filteredParts.map((part) => {
                      const isLow = part.stock <= part.minStock;
                      const isCritical = part.stock <= Math.floor(part.minStock * 0.5);
                      const isModerate = !isLow && part.stock <= part.minStock * 1.5;
                      const maxRef = Math.max(part.minStock * 2, 20);
                      const healthPct = Math.min(100, Math.round((part.stock / maxRef) * 100));

                      const shelf =
                        part.shelfLocation ||
                        `Rack ${part.category.charAt(0)}-0${(parseInt(part.partId.replace(/\D/g, '')) % 5) + 1} • Bin ${((parseInt(part.partId.replace(/\D/g, '')) * 3) % 20) + 1}`;
                      const returnRequired =
                        part.oldPartReturnRequired ??
                        (part.category === 'Hooks & Loopers' ||
                          part.category === 'Motors & Electrical' ||
                          part.unitCost > 400);

                      return (
                        <tr key={part.partId} className="hover:bg-blue-50/60 even:bg-slate-50/40 transition">
                          {/* Part SKU & Specs */}
                          <td className="py-2.5 px-3 border-r border-b border-slate-200">
                            <div className="font-mono font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                              <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200/70 text-[11px]">
                                {part.sku}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold border ${
                                  part.machineType === 'GENERAL'
                                    ? 'bg-slate-100 text-slate-600 border-slate-200'
                                    : 'bg-amber-50 text-amber-800 border-amber-200'
                                }`}
                              >
                                {part.machineType || 'GENERAL'}
                              </span>
                              {part.vendor && (
                                <span
                                  className="text-[10px] text-slate-400 font-normal truncate max-w-[130px]"
                                  title={part.vendor}
                                >
                                  {part.vendor}
                                </span>
                              )}
                            </div>
                            <div className="font-semibold text-slate-800 text-xs mt-0.5">
                              {part.name}
                            </div>
                            <div
                              className="text-[10px] text-slate-400 line-clamp-1 mt-0.5"
                              title={part.compat}
                            >
                              {part.compat}
                            </div>
                          </td>

                          {/* Shelf Location */}
                          <td className="py-2.5 px-3 border-r border-b border-slate-200">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100/90 text-slate-800 border border-slate-200 font-mono text-[11px] font-semibold whitespace-nowrap">
                              <MapPin className="w-3 h-3 text-indigo-600 shrink-0" />
                              <span>{shelf}</span>
                            </div>
                          </td>

                          {/* Live Stock Health Progress Bar */}
                          <td className="py-2.5 px-3 border-r border-b border-slate-200">
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="font-bold font-mono text-slate-900">
                                  {part.stock}{' '}
                                  <span className="font-normal text-slate-500">{part.unit}</span>
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  Min: {part.minStock} {part.unit}
                                </span>
                              </div>

                              {/* Progress bar */}
                              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/60">
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${
                                    isCritical
                                      ? 'bg-rose-600'
                                      : isLow
                                      ? 'bg-rose-500'
                                      : isModerate
                                      ? 'bg-amber-500'
                                      : 'bg-emerald-500'
                                  }`}
                                  style={{ width: `${Math.max(6, healthPct)}%` }}
                                />
                              </div>

                              <div className="flex items-center justify-between">
                                <span
                                  className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider ${
                                    isLow
                                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                      : isModerate
                                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  }`}
                                >
                                  {isCritical
                                    ? '🚨 Critical Shortage'
                                    : isLow
                                    ? '⚠️ Below Min Buffer'
                                    : isModerate
                                    ? '⚡ Moderate Buffer'
                                    : '✓ Stock Healthy'}
                                </span>
                                <span className="text-[9px] font-mono text-slate-400">
                                  {healthPct}%
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Scrap Return Policy */}
                          <td className="py-2.5 px-3 border-r border-b border-slate-200">
                            {returnRequired ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold whitespace-nowrap">
                                <RefreshCw className="w-3 h-3 text-rose-600 shrink-0" />
                                <span>1:1 Scrap Return</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-50 text-slate-600 border border-slate-200 text-[10px] font-medium whitespace-nowrap">
                                <Check className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>Standard Issue</span>
                              </span>
                            )}
                          </td>

                          {/* Unit Cost */}
                          <td className="py-2.5 px-3 border-r border-b border-slate-200">
                            <span className="font-mono font-bold text-slate-900 text-xs">
                              ₹{part.unitCost.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                            </span>
                            <span className="text-[10px] text-slate-400 block font-normal">
                              per {part.unit}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-2.5 px-3 text-right border-b border-slate-200">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              <button
                                type="button"
                                onClick={() => handleOpenIssueModal(part)}
                                disabled={part.stock <= 0}
                                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer"
                                title="Floor Handover & Gate Pass"
                              >
                                <ArrowUpRight className="w-3 h-3" />
                                <span>Issue</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenGrnModal(part)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer"
                                title="Inward Goods GRN Intake"
                              >
                                <Truck className="w-3 h-3" />
                                <span>Receive</span>
                              </button>
                              <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden bg-white shadow-2xs ml-0.5">
                                <button
                                  type="button"
                                  onClick={() => handleAdjust(part, -1)}
                                  disabled={part.stock <= 0}
                                  className="w-6 h-6 hover:bg-slate-100 disabled:opacity-40 text-slate-600 flex items-center justify-center cursor-pointer"
                                  title="Reduce stock by 1"
                                >
                                  <Minus className="w-2.5 h-2.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleAdjust(part, 1)}
                                  className="w-6 h-6 hover:bg-slate-100 text-slate-600 flex items-center justify-center border-l border-slate-200 cursor-pointer"
                                  title="Increase stock by 1"
                                >
                                  <Plus className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

      {/* MODAL 1: RAISE SPARE NEED / MONTHLY INDENT MODAL */}
      {isReqModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`bg-white rounded-3xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col ${reqModalTab === 'VIEW_ALL' ? 'max-w-4xl' : 'max-w-2xl'}`}>
            {/* Modal Header with Mode Switcher */}
            <div
              className={`p-5 text-white flex items-center justify-between shrink-0 ${
                reqModalTab === 'CRITICAL_CEO'
                  ? 'bg-rose-950'
                  : reqModalTab === 'URGENT_NEED'
                  ? 'bg-amber-950'
                  : reqModalTab === 'VIEW_ALL'
                  ? 'bg-slate-900'
                  : 'bg-indigo-950'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white shadow-sm ${
                    reqModalTab === 'CRITICAL_CEO'
                      ? 'bg-rose-600 urgent-pulse'
                      : reqModalTab === 'URGENT_NEED'
                      ? 'bg-amber-500'
                      : reqModalTab === 'VIEW_ALL'
                      ? 'bg-indigo-600'
                      : 'bg-indigo-600'
                  }`}
                >
                  {reqModalTab === 'CRITICAL_CEO' ? (
                    <ShieldAlert className="w-5 h-5" />
                  ) : reqModalTab === 'URGENT_NEED' ? (
                    <Zap className="w-5 h-5 text-amber-950" />
                  ) : reqModalTab === 'VIEW_ALL' ? (
                    <FileSpreadsheet className="w-5 h-5" />
                  ) : (
                    <ListPlus className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-bold tracking-tight">
                    {reqModalTab === 'CRITICAL_CEO'
                      ? 'Critical Spare Need (CEO Permission Required)'
                      : reqModalTab === 'URGENT_NEED'
                      ? 'Urgent Spare Need (Manager Fast-Track)'
                      : reqModalTab === 'VIEW_ALL'
                      ? 'Centralized Requisitions & Approvals Desk'
                      : 'Monthly Spare Inventory Indent (List of Parts)'}
                  </h4>
                  <p className="text-[10px] text-slate-300">
                    {reqModalTab === 'CRITICAL_CEO'
                      ? 'Emergency machine downtime & budget override'
                      : reqModalTab === 'URGENT_NEED'
                      ? 'Urgent shift operational requirement for defect prevention'
                      : reqModalTab === 'VIEW_ALL'
                      ? 'Review active indents, manager approvals, and CEO emergency sanctions'
                      : 'Mechanic planned itemized requirement for upcoming production month'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsReqModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 4 Mode Switcher Tabs */}
            <div className="flex border-b border-slate-200 text-xs font-bold bg-slate-50 shrink-0 overflow-x-auto">
              {/* Tab 1: Monthly Indent (Part List) */}
              <button
                type="button"
                onClick={() => {
                  setReqModalTab('MONTHLY_INDENT');
                  setReqMode('MONTHLY_INDENT');
                }}
                className={`flex-1 min-w-[130px] py-3 text-center border-b-2 transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  reqModalTab === 'MONTHLY_INDENT'
                    ? 'border-indigo-600 text-indigo-600 bg-white'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <ListPlus className="w-3.5 h-3.5" />
                <span>1. Monthly Indent</span>
              </button>

              {/* Tab 2: Urgent Need (Manager) */}
              <button
                type="button"
                onClick={() => {
                  setReqModalTab('URGENT_NEED');
                  setReqMode('URGENT_NEED');
                }}
                className={`flex-1 min-w-[130px] py-3 text-center border-b-2 transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  reqModalTab === 'URGENT_NEED'
                    ? 'border-amber-500 text-amber-800 bg-white font-extrabold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-amber-600" />
                <span>2. ⚡ Urgent Need</span>
              </button>

              {/* Tab 3: Critical Need (CEO) */}
              <button
                type="button"
                onClick={() => {
                  setReqModalTab('CRITICAL_CEO');
                  setReqMode('CRITICAL_CEO');
                }}
                className={`flex-1 min-w-[130px] py-3 text-center border-b-2 transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  reqModalTab === 'CRITICAL_CEO'
                    ? 'border-rose-600 text-rose-600 bg-white font-extrabold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                <span>3. 🚨 Critical (CEO)</span>
              </button>

              {/* Tab 4: All Requisitions & Approvals */}
              <button
                type="button"
                onClick={() => setReqModalTab('VIEW_ALL')}
                className={`flex-1 min-w-[150px] py-3 text-center border-b-2 transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  reqModalTab === 'VIEW_ALL'
                    ? 'border-indigo-600 text-indigo-600 bg-white font-extrabold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>4. 📋 All Requisitions ({requisitions.length})</span>
                {pendingCeoApprovals.length > 0 && (
                  <span className="px-1.5 py-0.2 text-[9px] rounded-full bg-rose-600 text-white font-extrabold urgent-pulse">
                    {pendingCeoApprovals.length} CEO
                  </span>
                )}
              </button>
            </div>

            {/* Modal Body: Either View All Requisitions Desk OR Indent Request Form */}
            {reqModalTab === 'VIEW_ALL' ? (
              <div className="p-6 space-y-6 overflow-y-auto flex-grow max-h-[calc(90vh-140px)]">
                {/* Requisition KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Total Requisitions
              </div>
              <div className="text-2xl font-extrabold text-slate-900 font-mono">{requisitions.length}</div>
              <div className="text-[11px] text-slate-500">Critical + Urgent + Monthly lists</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-rose-200 shadow-sm space-y-1 bg-rose-50/40">
              <div className="text-[11px] font-bold text-rose-700 uppercase tracking-wider flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                <span>Critical (CEO Needed)</span>
              </div>
              <div className="text-2xl font-extrabold text-rose-600 font-mono urgent-pulse">
                {pendingCeoApprovals.length} Urgent
              </div>
              <div className="text-[11px] text-rose-700 font-medium">Requires CEO emergency sign-off</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-sm space-y-1 bg-amber-50/30">
              <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-amber-600" />
                <span>Urgent Needs (Manager)</span>
              </div>
              <div className="text-2xl font-extrabold text-amber-700 font-mono">
                {pendingManagerApprovals.length} Pending
              </div>
              <div className="text-[11px] text-amber-800 font-medium">Fast-track maintenance review</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Total Sanctioned Value
              </div>
              <div className="text-2xl font-extrabold text-slate-900 font-mono">
                ₹{Math.round(totalReqValue).toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-emerald-600 font-medium">
                {approvedRequisitions.length} Approved orders
              </div>
            </div>
          </div>

          {/* Filter Bar with separated Critical, Urgent, and Monthly List */}
          {role === 'SENIOR_ELECTRICIAN' ? (
            <div className="bg-cyan-50 border border-cyan-200 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-cyan-900">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-600 animate-pulse shrink-0" />
                <span className="font-bold">Junior Electrician Indents Filter:</span>
                <span>Showing only requisitions and monthly indents raised by Junior Electricians.</span>
              </div>
              <span className="font-mono font-bold bg-white px-2.5 py-0.5 rounded-lg border border-cyan-200 text-cyan-700 shrink-0 self-start sm:self-auto">
                {displayedRequisitions.length} Indent{displayedRequisitions.length === 1 ? '' : 's'}
              </span>
            </div>
          ) : (role === 'MECHANIC' || role === 'SENIOR_MECHANIC' || role === 'ELECTRICIAN') ? (
            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-indigo-900">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse shrink-0" />
                <span className="font-bold">Personal Indents Filter:</span>
                <span>Showing only requisitions and monthly indents raised by {user?.name || (role === 'SENIOR_MECHANIC' ? 'Ramesh Kumar' : role === 'MECHANIC' ? 'Suresh Babu' : 'Staff')}.</span>
              </div>
              <span className="font-mono font-bold bg-white px-2.5 py-0.5 rounded-lg border border-indigo-200 text-indigo-700 shrink-0 self-start sm:self-auto">
                {displayedRequisitions.length} Indent{displayedRequisitions.length === 1 ? '' : 's'}
              </span>
            </div>
          ) : null}

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setReqFilter('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  reqFilter === 'ALL'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {role === 'SENIOR_ELECTRICIAN'
                  ? 'Junior Electricians Indents'
                  : role === 'MECHANIC' || role === 'SENIOR_MECHANIC' || role === 'ELECTRICIAN'
                  ? 'My Indents'
                  : 'All Requests'}{' '}
                ({displayedRequisitions.length})
              </button>

              {/* Critical (CEO) */}
              <button
                onClick={() => setReqFilter('CRITICAL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  reqFilter === 'CRITICAL'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>🚨 Critical (CEO)</span>
              </button>

              {/* Urgent Need (Manager) */}
              <button
                onClick={() => setReqFilter('URGENT')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  reqFilter === 'URGENT'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>⚡ Urgent Needs</span>
              </button>

              {/* Monthly Indents (Multi-Part List) */}
              <button
                onClick={() => setReqFilter('MONTHLY')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                  reqFilter === 'MONTHLY'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <ListPlus className="w-3.5 h-3.5" />
                <span>📦 Monthly Indents (Lists)</span>
              </button>

              <button
                onClick={() => setReqFilter('PENDING')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  reqFilter === 'PENDING'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Pending
              </button>

              <button
                onClick={() => setReqFilter('APPROVED')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  reqFilter === 'APPROVED'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Approved
              </button>
            </div>

            <div className="flex items-center gap-2.5">
              {isMechanicOrAdmin && (
                <button
                  type="button"
                  onClick={() => handleOpenReqModal('MONTHLY_INDENT')}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Raise Indent / Requisition</span>
                </button>
              )}
              <div className="text-xs text-slate-500 font-medium hidden md:block">
                Signed in as: <span className="font-bold text-slate-800">{user?.title || 'Lead Mechanic'}</span>
              </div>
            </div>
          </div>

          {/* Requisitions List Cards */}
          <div className="space-y-4">
            {filteredRequisitions.length === 0 ? (
              <div className="p-12 bg-white rounded-2xl border border-slate-200 text-center space-y-2">
                <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto" />
                <h4 className="text-sm font-bold text-slate-800">No Requisitions Found</h4>
                <p className="text-xs text-slate-500">
                  Try adjusting your filter or raise a new monthly indent / critical request.
                </p>
              </div>
            ) : (
              filteredRequisitions.map((req) => {
                const isCritical = req.type === 'CRITICAL_CEO';
                const isUrgent = req.type === 'URGENT_NEED';
                const isMonthly = req.type === 'MONTHLY_INDENT';

                const isPendingCeo = req.status === 'PENDING_CEO_APPROVAL';
                const isPendingManager =
                  req.status === 'PENDING_MANAGER_APPROVAL' || req.status === 'PENDING_REVIEW';
                const isApproved =
                  req.status === 'APPROVED_BY_CEO' || req.status === 'APPROVED_BY_MANAGER';
                const isRejected = req.status === 'REJECTED';

                return (
                  <div
                    key={req.id}
                    className={`bg-white rounded-2xl p-5 border shadow-sm space-y-4 transition ${
                      isPendingCeo
                        ? 'border-rose-300 ring-2 ring-rose-200/70 bg-rose-50/20'
                        : isPendingManager
                        ? 'border-amber-300 ring-1 ring-amber-200/60 bg-amber-50/10'
                        : isApproved
                        ? 'border-emerald-200 bg-emerald-50/10'
                        : 'border-slate-200'
                    }`}
                  >
                    {/* Card Top Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-mono font-extrabold text-slate-900 text-sm">{req.id}</span>

                        {/* Distinct Badges for Critical vs Urgent vs Monthly */}
                        {isCritical ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-600 text-white flex items-center gap-1 urgent-pulse">
                            <ShieldAlert className="w-3 h-3" />
                            <span>🚨 CRITICAL NEED • REQUIRES CEO PERMISSION</span>
                          </span>
                        ) : isUrgent ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-amber-950 flex items-center gap-1">
                            <Zap className="w-3 h-3" />
                            <span>⚡ URGENT NEED • MANAGER APPROVAL</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 flex items-center gap-1">
                            <ListPlus className="w-3 h-3 text-indigo-600" />
                            <span>📦 MONTHLY PLANNED INDENT (ITEMIZED LIST)</span>
                          </span>
                        )}

                        <span className="text-[11px] text-slate-500 font-medium">
                          Period: <span className="font-semibold text-slate-700">{req.monthYear}</span>
                        </span>
                      </div>

                      {/* Status Badge */}
                      <div>
                        {isPendingCeo && (
                          <span className="px-2.5 py-1 rounded-lg text-xs font-extrabold bg-rose-100 text-rose-800 border border-rose-200 inline-flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-rose-600" />
                            <span>Awaiting CEO Permission</span>
                          </span>
                        )}
                        {isPendingManager && (
                          <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200 inline-flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>Awaiting Manager Approval</span>
                          </span>
                        )}
                        {isApproved && (
                          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>
                              {req.status === 'APPROVED_BY_CEO' ? 'CEO Sanctioned' : 'Manager Approved'}
                            </span>
                          </span>
                        )}
                        {isRejected && (
                          <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-200 text-slate-700">
                            Rejected / Deferred
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Card Body Grid */}
                    {isMonthly && req.items && req.items.length > 0 ? (
                      /* MULTI-ITEM MONTHLY INDENT DISPLAY */
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-700">
                            Indented Parts List ({req.items.length} Distinct Items):
                          </span>
                          <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                            Total Est. Budget: ₹{req.estimatedCost?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        {/* Itemized Table of parts */}
                        <div className="overflow-x-auto rounded-lg border border-slate-300 shadow-2xs">
                          <table className="w-full text-left border-collapse border border-slate-300 text-xs">
                            <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] border-b border-slate-300 select-none">
                              <tr>
                                <th className="py-2 px-3 bg-slate-100 border-r border-b border-slate-300 text-center w-10 text-slate-500 font-mono">#</th>
                                <th className="py-2 px-3 bg-slate-100 border-r border-b border-slate-300">Part Description</th>
                                <th className="py-2 px-3 bg-slate-100 border-r border-b border-slate-300">SKU</th>
                                <th className="py-2 px-3 bg-slate-100 border-r border-b border-slate-300">Quantity</th>
                                <th className="py-2 px-3 bg-slate-100 border-r border-b border-slate-300">Unit Cost (₹)</th>
                                <th className="py-2 px-3 bg-slate-100 border-b border-slate-300 text-right">Subtotal (₹)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {req.items.map((item, idx) => (
                                <tr key={idx} className="hover:bg-blue-50/60 even:bg-slate-50/40 transition">
                                  <td className="py-1.5 px-3 border-r border-b border-slate-200 text-center text-[10px] font-mono text-slate-400 bg-slate-50/50">{idx + 1}</td>
                                  <td className="py-1.5 px-3 border-r border-b border-slate-200 font-semibold text-slate-800">
                                    {item.partName}
                                  </td>
                                  <td className="py-1.5 px-3 border-r border-b border-slate-200 font-mono text-slate-500">{item.sku}</td>
                                  <td className="py-1.5 px-3 border-r border-b border-slate-200 font-bold font-mono text-slate-900">
                                    {item.quantity} {item.unit}
                                  </td>
                                  <td className="py-1.5 px-3 border-r border-b border-slate-200 font-mono text-slate-600">
                                    ₹{item.unitCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                  </td>
                                  <td className="py-1.5 px-3 border-b border-slate-200 font-mono font-bold text-slate-800 text-right">
                                    ₹{item.totalCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs flex justify-between items-center text-slate-600">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span><b>Target Lines:</b> {req.targetLine || 'Universal Plant'} • <b>Raised by:</b></span>
                            <button
                              type="button"
                              onClick={() => handleOpenMechanicCustody(req.requestedBy)}
                              className="font-bold text-indigo-700 hover:text-indigo-900 hover:underline inline-flex items-center gap-1 cursor-pointer bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded border border-indigo-200 transition"
                              title="Click to view tools and parts handled by this mechanic"
                            >
                              <Wrench className="w-3 h-3 text-indigo-600" />
                              <span>{req.requestedBy}</span>
                            </button>
                            <span className="text-slate-500">({req.requestedByRole})</span>
                          </div>
                          <div className="text-[11px] text-slate-500 italic max-w-md truncate">
                            {req.justification}
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* SINGLE-ITEM (CRITICAL OR URGENT) DISPLAY */
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 text-xs">
                        {/* Left: Part Details */}
                        <div className="md:col-span-5 space-y-1.5">
                          <div className="font-extrabold text-sm text-slate-900">{req.partName}</div>
                          <div className="text-slate-500 font-mono text-[11px]">
                            SKU: <span className="text-indigo-700 font-bold">{req.sku}</span>
                          </div>
                          <div className="flex items-center gap-3 pt-1">
                            <span className="font-bold text-slate-800 text-sm">
                              {req.quantity} {req.unit}
                            </span>
                            <span className="font-bold font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              Est. ₹{req.estimatedCost?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>

                        {/* Middle: Justification & Line Impact */}
                        <div className="md:col-span-7 bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span>
                              Target Line:{' '}
                              <span className="font-bold text-slate-800">
                                {req.targetLine || 'Universal Plant'}
                              </span>
                              {req.targetMachineId && (
                                <span className="text-rose-600 font-mono font-bold ml-1">
                                  [M/C: {req.targetMachineId}]
                                </span>
                              )}
                            </span>
                            <span className="flex items-center gap-1">
                              <span>Raised by:</span>
                              <button
                                type="button"
                                onClick={() => handleOpenMechanicCustody(req.requestedBy)}
                                className="font-bold text-indigo-700 hover:text-indigo-900 hover:underline inline-flex items-center gap-1 cursor-pointer bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded border border-indigo-200 transition"
                                title="Click to view tools and parts handled by this mechanic"
                              >
                                <Wrench className="w-3 h-3 text-indigo-600" />
                                <span>{req.requestedBy}</span>
                              </button>
                            </span>
                          </div>
                          <p className="text-slate-700 text-xs leading-relaxed font-medium">
                            {req.justification}
                          </p>
                          {req.reviewedBy && (
                            <div className="pt-2 border-t border-slate-200 text-[10px] text-slate-500 flex items-center justify-between">
                              <span>
                                <b>Reviewed by:</b> {req.reviewedBy}
                              </span>
                              <span>{req.reviewNotes}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Card Footer Actions */}
                    {(isPendingCeo || isPendingManager) && (
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                          {isCritical ? (
                            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                          ) : isUrgent ? (
                            <Zap className="w-3.5 h-3.5 text-amber-600" />
                          ) : (
                            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                          )}
                          <span>
                            {isCritical
                              ? '🚨 High-risk line stop: Requires CEO / Plant Head digital permission.'
                              : isUrgent
                              ? '⚡ Fast-track shift requirement: Requires Maintenance Manager sign-off.'
                              : '📦 Monthly indent: Awaiting manager quota authorization.'}
                          </span>
                        </div>

                        {/* Authorization Check: Only authorized personnel can approve */}
                        {isCritical ? (
                          isAuthorizedToApproveCritical ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleReject(req.id)}
                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                              >
                                Reject
                              </button>
                              <button
                                onClick={() => handleApprove(req)}
                                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer urgent-pulse"
                              >
                                <ShieldAlert className="w-3.5 h-3.5" />
                                <span>Authorize as CEO / Plant Head</span>
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1.5">
                                <Lock className="w-3.5 h-3.5 text-rose-600" />
                                <span>Approval Restricted: Awaiting Authorized Person (CEO / Plant Admin)</span>
                              </span>
                            </div>
                          )
                        ) : (
                          isAuthorizedToApproveGeneral ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleReject(req.id)}
                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                              >
                                Reject
                              </button>
                              <button
                                onClick={() => handleApprove(req)}
                                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>Approve Requisition</span>
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1.5">
                                <Lock className="w-3.5 h-3.5 text-slate-500" />
                                <span>Approval Restricted: Awaiting Store In-Charge / Admin</span>
                              </span>
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

                <div className="pt-3 border-t border-slate-100 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setIsReqModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                  >
                    Close Desk
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleRequisitionSubmit} className="p-6 space-y-4 overflow-y-auto flex-grow max-h-[calc(90vh-140px)]">
              {/* MODE 1: MONTHLY INDENT (LIST OF PARTS) */}
              {reqMode === 'MONTHLY_INDENT' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Indented Production Month *
                      </label>
                      <select
                        value={reqMonthYear}
                        onChange={(e) => setReqMonthYear(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-800"
                      >
                        <option value="October 2026">October 2026</option>
                        <option value="November 2026">November 2026</option>
                        <option value="December 2026">December 2026</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Target Production Lines *
                      </label>
                      <select
                        value={reqTargetLine}
                        onChange={(e) => setReqTargetLine(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800 font-medium"
                      >
                        <option value="Universal Plant">Universal Plant (All Lines)</option>
                        <option value="Line 01 & Line 02">Line 01 & Line 02 (Knit Lines)</option>
                        <option value="Line 03 & Line 04">Line 03 & Line 04 (Woven & Denim)</option>
                        <option value="Workshop Buffer Bay">Workshop Buffer Bay</option>
                      </select>
                    </div>
                  </div>

                  {/* DYNAMIC LIST BUILDER: Add Part Row */}
                  <div className="bg-indigo-50/50 p-3.5 rounded-2xl border border-indigo-100 space-y-2">
                    <span className="text-xs font-bold text-indigo-950 block">
                      + Add Spare Part to Monthly List:
                    </span>
                    <div className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-7">
                        <select
                          value={newIndentPartId}
                          onChange={(e) => setNewIndentPartId(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-semibold text-slate-800"
                        >
                          {parts.map((p) => (
                            <option key={p.partId} value={p.partId}>
                              {p.name} ({p.sku}) — ₹{p.unitCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}/{p.unit}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-span-3">
                        <input
                          type="number"
                          min={1}
                          value={newIndentQty}
                          onChange={(e) => setNewIndentQty(parseInt(e.target.value) || 1)}
                          placeholder="Qty"
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-900 font-mono"
                        />
                      </div>

                      <div className="col-span-2">
                        <button
                          type="button"
                          onClick={handleAddIndentItem}
                          className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* List of Indented Parts Table */}
                  <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                    <div className="bg-slate-100 px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-600 flex justify-between">
                      <span>Itemized Indent List ({indentItems.length} Parts)</span>
                      <span>Subtotal (₹)</span>
                    </div>

                    {indentItems.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400 italic">
                        No parts added to this monthly indent yet. Select a part above and click "+ Add".
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                        {indentItems.map((item) => (
                          <div
                            key={item.partId}
                            className="p-3 text-xs flex items-center justify-between hover:bg-slate-50 transition"
                          >
                            <div className="min-w-0 flex-1 pr-2">
                              <div className="font-bold text-slate-900 truncate">{item.partName}</div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                SKU: {item.sku} • {item.quantity} {item.unit} @ ₹{item.unitCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-bold font-mono text-slate-800">
                                ₹{item.totalCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemoveIndentItem(item.partId)}
                                className="text-slate-400 hover:text-rose-600 p-1 transition cursor-pointer"
                                title="Remove item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-200 flex justify-between items-center font-bold text-xs">
                      <span className="text-slate-700">Total Monthly Indent Budget:</span>
                      <span className="font-mono text-base text-emerald-700">
                        ₹{indentTotalCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Monthly Production Target & Justification Notes *
                    </label>
                    <textarea
                      required
                      rows={2}
                      value={reqJustification}
                      onChange={(e) => setReqJustification(e.target.value)}
                      placeholder="e.g. Planned requirement for upcoming 50,000 unit woven shirt order on Line 01 and Line 03."
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800"
                    />
                  </div>
                </div>
              )}

              {/* MODE 2: URGENT NEED (FAST-TRACK MANAGER APPROVAL) */}
              {reqMode === 'URGENT_NEED' && (
                <div className="space-y-4">
                  <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 text-xs text-amber-900 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-amber-800">
                      <Zap className="w-4 h-4 text-amber-600" />
                      <span>⚡ Fast-Track Shift Need (Maintenance Manager Approval)</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-amber-900/90">
                      High priority operational part needed during the active shift to prevent seam defects or imminent machine stoppage. Fast-tracked for immediate supervisor authorization.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Affected Floor Line *
                      </label>
                      <select
                        value={reqTargetLine}
                        onChange={(e) => setReqTargetLine(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 font-medium"
                      >
                        <option value="Line 01">Line 01 (Polo / Knit)</option>
                        <option value="Line 02">Line 02 (T-Shirts Basic)</option>
                        <option value="Line 03">Line 03 (Woven Shirts)</option>
                        <option value="Line 04">Line 04 (Denim Heavy)</option>
                        <option value="Buffer Workshop">Buffer Workshop</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Target Machine ID (Optional)
                      </label>
                      <input
                        type="text"
                        value={reqTargetMachine}
                        onChange={(e) => setReqTargetMachine(e.target.value)}
                        placeholder="e.g. MC-OVK-204"
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none font-mono font-bold text-slate-900"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Select Urgent Catalog Part *
                    </label>
                    <select
                      value={reqPartId}
                      onChange={(e) => setReqPartId(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 font-semibold"
                    >
                      {parts.map((p) => (
                        <option key={p.partId} value={p.partId}>
                          {p.name} ({p.sku}) — Stock: {p.stock} {p.unit} (₹{p.unitCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}/unit)
                        </option>
                      ))}
                      <option value="CUSTOM">Custom Urgent Spare</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Required Quantity *
                      </label>
                      <input
                        type="number"
                        required
                        min={1}
                        value={reqQty}
                        onChange={(e) => setReqQty(parseInt(e.target.value) || 1)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none font-mono font-bold text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Estimated Cost (₹ INR)
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={reqCostOverride}
                        onChange={(e) => setReqCostOverride(parseFloat(e.target.value) || 0)}
                        placeholder="Auto or override"
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none font-mono font-medium text-slate-900"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Urgent Justification & Reason *
                    </label>
                    <textarea
                      required
                      rows={2}
                      value={reqJustification}
                      onChange={(e) => setReqJustification(e.target.value)}
                      placeholder="e.g. Frequent needle-looper clash causing puckering on active shift. Fast-track approval needed to prevent seam rejects."
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-slate-800"
                    />
                  </div>
                </div>
              )}

              {/* MODE 3: CRITICAL NEED (REQUIRES CEO PERMISSION) */}
              {reqMode === 'CRITICAL_CEO' && (
                <div className="space-y-4">
                  <div className="bg-rose-50 border border-rose-300 rounded-xl p-3.5 text-xs text-rose-950 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-rose-700">
                      <ShieldAlert className="w-4 h-4 text-rose-600" />
                      <span>🚨 CRITICAL LINE STOPPAGE (CEO Authorization Required)</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-rose-900">
                      Reserved for major breakdown emergencies, motor driver failure, or budget exceptions halting sewing output. Enters directly into the executive CEO permission ledger.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Halted Machine Asset ID *
                      </label>
                      <input
                        type="text"
                        required
                        value={reqTargetMachine}
                        onChange={(e) => setReqTargetMachine(e.target.value)}
                        placeholder="e.g. MC-OVK-204"
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none font-mono font-bold text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Halted Line Location *
                      </label>
                      <select
                        value={reqTargetLine}
                        onChange={(e) => setReqTargetLine(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none text-slate-800 font-bold"
                      >
                        <option value="Line 01">Line 01 (Polo / Knit)</option>
                        <option value="Line 02">Line 02 (T-Shirts Basic)</option>
                        <option value="Line 03">Line 03 (Woven Shirts)</option>
                        <option value="Line 04">Line 04 (Denim Heavy)</option>
                        <option value="Buffer Workshop">Buffer Workshop</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Select Component or Part *
                    </label>
                    <select
                      value={reqPartId}
                      onChange={(e) => setReqPartId(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none text-slate-800 font-semibold"
                    >
                      {parts.map((p) => (
                        <option key={p.partId} value={p.partId}>
                          {p.name} ({p.sku}) — ₹{p.unitCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}/{p.unit}
                        </option>
                      ))}
                      <option value="CUSTOM">Custom Burnt Component / Emergency Part</option>
                    </select>
                  </div>

                  {reqPartId === 'CUSTOM' && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Component Description & Part Code *
                      </label>
                      <input
                        type="text"
                        required
                        value={reqCustomPartName}
                        onChange={(e) => setReqCustomPartName(e.target.value)}
                        placeholder="e.g. Servo Main PCB Circuit Assembly Board"
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none text-slate-800"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Quantity Needed *
                      </label>
                      <input
                        type="number"
                        required
                        min={1}
                        value={reqQty}
                        onChange={(e) => setReqQty(parseInt(e.target.value) || 1)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none font-mono font-bold text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Total Emergency Expenditure (₹ INR) *
                      </label>
                      <input
                        type="number"
                        required
                        min={1}
                        value={reqCostOverride}
                        onChange={(e) => setReqCostOverride(parseFloat(e.target.value) || 0)}
                        placeholder="e.g. 220"
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none font-bold text-slate-900 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Emergency Justification & Production Line Halt Details *
                    </label>
                    <textarea
                      required
                      rows={2}
                      value={reqJustification}
                      onChange={(e) => setReqJustification(e.target.value)}
                      placeholder="e.g. Controller circuit burnt out during voltage spike. Entire 4-thread line stopped. Zero backup in tool crib. Immediate CEO permission needed for emergency courier procurement."
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none text-slate-800"
                    />
                  </div>
                </div>
              )}

              {/* Modal Submit Footer */}
              <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsReqModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReq}
                  className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                    reqMode === 'CRITICAL_CEO'
                      ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20 urgent-pulse'
                      : reqMode === 'URGENT_NEED'
                      ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                      : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {reqMode === 'CRITICAL_CEO'
                      ? 'Dispatch for CEO Permission'
                      : reqMode === 'URGENT_NEED'
                      ? 'Submit Urgent Need (Manager)'
                      : `Submit Monthly Indent (${indentItems.length} Parts)`}
                  </span>
                </button>
              </div>
            </form>
          )}
          </div>
        </div>
      )}

      {/* MODAL 2: FAST FLOOR ISSUE & HANDOVER MODAL */}
      {isIssueModalOpen && activeIssuePart && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
                  <ArrowUpRight className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold">Floor Issue &amp; Handover Desk</h4>
                  <p className="text-[10px] text-slate-400">Issue spare parts to line technicians with gate pass</p>
                </div>
              </div>
              <button
                onClick={() => setIsIssueModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmIssue} className="p-6 space-y-4">
              {/* Selected Part Card */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {activeIssuePart.sku}
                  </span>
                  <div className="flex items-center gap-1 text-[11px] font-mono text-slate-600">
                    <MapPin className="w-3 h-3 text-indigo-600" />
                    <span>{activeIssuePart.shelfLocation || 'Rack A-01 • Bin 01'}</span>
                  </div>
                </div>
                <div className="font-bold text-slate-900 text-sm">{activeIssuePart.name}</div>
                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/70 text-slate-500">
                  <span>Available Crib Stock:</span>
                  <strong className="text-emerald-700 font-mono">
                    {activeIssuePart.stock} {activeIssuePart.unit}
                  </strong>
                </div>
              </div>

              {/* Mechanic Roster Select */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Responsible Technician (Quota Charged) *
                </label>
                <select
                  value={selectedIssueMechanicId}
                  onChange={(e) => setSelectedIssueMechanicId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-semibold text-slate-800"
                >
                  {activeStaffRoster.length > 0 ? (
                    activeStaffRoster.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.id}) &mdash; {m.role} &bull; {m.assignedLines}
                      </option>
                    ))
                  ) : (
                    <option value="STAFF-GEN">General Maintenance Personnel</option>
                  )}
                </select>
              </div>

              {/* Physical Recipient Proof & Custody (POINT 7) */}
              <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Physical Recipient (Proof of Handover)</span>
                  </label>
                  <span className="text-[10px] text-indigo-600 font-semibold font-mono">Proof of Custody</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                      Person Receiving Spares *
                    </label>
                    <input
                      type="text"
                      required
                      value={issueReceivedByPerson}
                      onChange={(e) => setIssueReceivedByPerson(e.target.value)}
                      placeholder="e.g. Ramesh Kumar or Sanjay (Helper)"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                      Employee ID / Token No *
                    </label>
                    <input
                      type="text"
                      required
                      value={issueReceiverEmpId}
                      onChange={(e) => setIssueReceiverEmpId(e.target.value)}
                      placeholder="e.g. MEC-01 or EMP-9921"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <p className="text-[10px] text-indigo-700/90 leading-tight">
                  ⚡ An instant notification &amp; acknowledgment request will be dispatched to <strong>{activeStaffRoster.find((m) => m.id === selectedIssueMechanicId)?.name || 'the mechanic'}</strong> upon issuing.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Quantity to Issue *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={activeIssuePart.stock}
                    value={issueQty}
                    onChange={(e) => setIssueQty(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Target Line *
                  </label>
                  <select
                    value={issueTargetLine}
                    onChange={(e) => setIssueTargetLine(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800 font-medium"
                  >
                    <option value="Line 01">Line 01 (Jack A4 Lockstitch)</option>
                    <option value="Line 02">Line 02 (Pegasus Overlock)</option>
                    <option value="Line 03">Line 03 (Yamato Flatlock)</option>
                    <option value="Line 04">Line 04 (Brother Lockstitch)</option>
                    <option value="Line 05">Line 05 (Button Stitch / Kaja)</option>
                    <option value="Line 06">Line 06 (Feed Off The Arm)</option>
                    <option value="Line 07">Line 07 (Sampling / Ironing)</option>
                    <option value="Line 08">Line 08 (Packing / Finish)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Machine ID / Workstation Reference (Optional)
                </label>
                <input
                  type="text"
                  value={issueTargetMachine}
                  onChange={(e) => setIssueTargetMachine(e.target.value)}
                  placeholder="e.g. SNLS-04, OVK-02, FLATLOCK-01..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-slate-800"
                />
                {issueTargetMachine.trim() && (
                  <div className="mt-1.5 text-[11px] font-medium">
                    {isSpareCompatibleWithMachine(activeIssuePart, issueTargetMachine) ? (
                      <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 inline-flex items-center gap-1">
                        ✓ Verified compatible with {detectMachineCategory(issueTargetMachine) || 'target machine'}
                      </span>
                    ) : (
                      <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 inline-flex items-center gap-1">
                        ⚠️ Part is categorized for {activeIssuePart.machineType}, whereas machine is {detectMachineCategory(issueTargetMachine)}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Old Broken Part Scrap Return Toggle */}
              <div
                className={`p-4 rounded-2xl border space-y-2.5 ${
                  (activeIssuePart.oldPartReturnRequired ?? false)
                    ? 'bg-rose-50/70 border-rose-200'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <RefreshCw
                      className={`w-4 h-4 ${
                        (activeIssuePart.oldPartReturnRequired ?? false)
                          ? 'text-rose-600'
                          : 'text-slate-500'
                      }`}
                    />
                    <span className="text-xs font-bold text-slate-900">
                      Old Defective Part Collected?
                    </span>
                  </div>
                  {(activeIssuePart.oldPartReturnRequired ?? false) && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-200 text-rose-800">
                      1:1 Return Enforced
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-slate-600">
                  {(activeIssuePart.oldPartReturnRequired ?? false)
                    ? 'Factory policy strictly requires receiving the worn/broken component into the scrap bin upon issuing a new rotary hook, looper, blade, or motor board.'
                    : 'Standard consumable item. Defective part return optional.'}
                </p>

                <div className="flex items-center gap-4 pt-1">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                    <input
                      type="radio"
                      name="oldPartReturned"
                      checked={oldPartReturned === true}
                      onChange={() => setOldPartReturned(true)}
                      className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-emerald-700">Yes, Old Part Received</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                    <input
                      type="radio"
                      name="oldPartReturned"
                      checked={oldPartReturned === false}
                      onChange={() => setOldPartReturned(false)}
                      className="w-4 h-4 text-rose-600 focus:ring-rose-500"
                    />
                    <span className="text-rose-700">No, Pending Return</span>
                  </label>
                </div>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsIssueModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingIssue}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  <FileText className="w-4 h-4" />
                  <span>Confirm Issue &amp; Generate Gate Pass</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: PRINTABLE STORE ISSUE SLIP / GATE PASS MODAL */}
      {isGatePassOpen && gatePassData && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 print:p-0 print:bg-white print:fixed print:inset-0">
          <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 print:border-none print:shadow-none print:max-w-none print:rounded-none">
            {/* Non-print Modal Top Bar */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between print:hidden">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
                  <Printer className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h4 className="text-xs font-bold">Store Issue Chit &amp; Gate Pass Ready</h4>
                  <p className="text-[10px] text-slate-400">Print or hand over slip to mechanic</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Pass</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsGatePassOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Printable Body */}
            <div className="p-6 sm:p-8 space-y-5 print:p-6 print:space-y-4 text-slate-900 bg-white">
              {/* Header */}
              <div className="border-b-2 border-slate-900 pb-3 flex items-start justify-between">
                <div>
                  <div className="text-[10px] font-extrabold tracking-widest uppercase text-slate-500">
                    TEX-APPARELS GLOBAL MANUFACTURING &bull; CENTRAL TOOL CRIB
                  </div>
                  <h2 className="text-lg sm:text-xl font-black tracking-tight text-slate-950 mt-0.5">
                    STORE ISSUE CHIT &amp; GATE PASS
                  </h2>
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    Floor Maintenance Issue &amp; Defective Scrap Clearance
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-xs text-indigo-700">{gatePassData.slipNo}</div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">{gatePassData.date}</div>
                </div>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">
                    Issued To (Technician)
                  </span>
                  <span className="font-bold text-slate-900 text-sm block">
                    {gatePassData.mechanicName}
                  </span>
                  <span className="text-[11px] text-slate-600 font-mono">
                    ID: {gatePassData.mechanicId} &bull; {gatePassData.mechanicTrade}
                  </span>
                  {gatePassData.receivedByPerson && (
                    <div className="mt-1 text-[10px] text-indigo-900 font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                      Physical Recipient: {gatePassData.receivedByPerson} {gatePassData.receiverEmpId ? `(${gatePassData.receiverEmpId})` : ''}
                    </div>
                  )}
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">
                    Destination &amp; Machine
                  </span>
                  <span className="font-bold text-emerald-800 text-sm block">
                    {gatePassData.targetLine}
                  </span>
                  <span className="text-[11px] text-slate-600 font-mono">
                    Machine: {gatePassData.targetMachine || 'Floor Line Standby'}
                  </span>
                </div>
              </div>

              {/* Issued Item Details */}
              <div className="border border-slate-300 rounded-lg overflow-hidden shadow-2xs">
                <table className="w-full text-left border-collapse border border-slate-300 text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] border-b border-slate-300 select-none">
                    <tr>
                      <th className="py-2 px-3 bg-slate-100 border-r border-b border-slate-300">Part Description</th>
                      <th className="py-2 px-3 bg-slate-100 border-r border-b border-slate-300">SKU</th>
                      <th className="py-2 px-3 bg-slate-100 border-r border-b border-slate-300">Location</th>
                      <th className="py-2 px-3 bg-slate-100 border-b border-slate-300 text-right">Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="hover:bg-blue-50/60 transition">
                      <td className="py-2 px-3 border-r border-b border-slate-200">
                        <div className="font-bold text-slate-900">{gatePassData.part.name}</div>
                        <div className="text-[10px] text-slate-500">{gatePassData.part.compat}</div>
                      </td>
                      <td className="py-2 px-3 border-r border-b border-slate-200 font-mono font-bold text-indigo-700 text-[11px]">
                        {gatePassData.part.sku}
                      </td>
                      <td className="py-2 px-3 border-r border-b border-slate-200 font-mono text-[11px] text-slate-700">
                        {gatePassData.part.shelfLocation || 'Rack A-01'}
                      </td>
                      <td className="py-2 px-3 border-b border-slate-200 text-right font-mono font-black text-slate-900 text-sm">
                        {gatePassData.qty} {gatePassData.part.unit}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Scrap Policy Status & QR Section */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center p-3.5 bg-slate-50/70 rounded-2xl border border-slate-200">
                <div className="sm:col-span-8 space-y-2">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">
                      Defective Scrap Piece Handover
                    </span>
                    {gatePassData.oldPartReturned ? (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs mt-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>VERIFIED &bull; Defective Part Received in Scrap Bin</span>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs mt-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        <span>PENDING SCRAP &bull; Return Due within 24 Hours</span>
                      </div>
                    )}
                  </div>

                  {gatePassData.remarks && (
                    <div className="text-[11px] text-slate-600 italic">
                      Remark: &ldquo;{gatePassData.remarks}&rdquo;
                    </div>
                  )}
                  <div className="text-[10px] text-slate-400 font-mono">
                    Storekeeper: {gatePassData.storekeeper}
                  </div>
                </div>

                <div className="sm:col-span-4 flex flex-col items-center justify-center p-2 bg-white rounded-xl border border-slate-200">
                  <QRCodeSVG
                    value={`GPS:${gatePassData.slipNo}|SKU:${gatePassData.part.sku}|QTY:${gatePassData.qty}|MECH:${gatePassData.mechanicId}|DATE:${gatePassData.date}|SCRAP:${gatePassData.oldPartReturned ? 'YES' : 'NO'}`}
                    size={76}
                    level="M"
                    bgColor="#ffffff"
                    fgColor="#000000"
                  />
                  <span className="text-[8px] font-mono text-slate-500 font-bold mt-1">
                    Crib Verification QR
                  </span>
                </div>
              </div>

              {/* Dual Signatures */}
              <div className="pt-6 grid grid-cols-2 gap-8 border-t border-slate-200">
                <div className="text-center">
                  <div className="h-9 border-b border-slate-400 border-dashed" />
                  <span className="text-[10px] font-bold text-slate-600 uppercase block mt-1.5">
                    Storekeeper Authorization
                  </span>
                  <span className="text-[9px] text-slate-400 font-mono">
                    {user?.name || 'Store In-Charge'}
                  </span>
                </div>
                <div className="text-center">
                  <div className="h-9 border-b border-slate-400 border-dashed" />
                  <span className="text-[10px] font-bold text-slate-600 uppercase block mt-1.5">
                    Technician Acknowledgement
                  </span>
                  <span className="text-[9px] text-slate-400 font-mono">
                    {gatePassData.mechanicName} ({gatePassData.mechanicId})
                  </span>
                </div>
              </div>
            </div>

            {/* Non-print Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 print:hidden">
              <button
                type="button"
                onClick={() => setIsGatePassOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Slip</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: INWARD GOODS RECEIPT NOTE (GRN) INTAKE MODAL */}
      {isRestockOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold">Inward Goods (GRN) Intake Desk</h4>
                  <p className="text-[10px] text-slate-400">Receive supplier stock directly into tool crib bins</p>
                </div>
              </div>
              <button
                onClick={() => setIsRestockOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRestockSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Select Spare Part *
                </label>
                <select
                  value={restockPartId}
                  onChange={(e) => {
                    const newId = e.target.value;
                    setRestockPartId(newId);
                    const found = parts.find((p) => p.partId === newId);
                    if (found) {
                      if (found.vendor) setGrnVendor(found.vendor);
                      const suggested = Math.max(25, (found.minStock * 2) - (found.stock || 0));
                      setRestockQty(suggested);
                      sendAppNotification({
                        type: 'RESTOCK_ALERT',
                        title: `Restock Quantity Auto-Calculated: ${found.name}`,
                        message: `System auto-filled ${suggested} ${found.unit} for ${found.name} (${found.sku}) based on safety buffer (Min: ${found.minStock}, Stock: ${found.stock}).`,
                        targetRole: 'ALL',
                        senderName: user?.name || 'Store In-Charge',
                        meta: {
                          partId: found.partId,
                          partName: found.name,
                          suggestedQty: suggested,
                        },
                      });
                      showToast(`⚡ Auto-filled ${suggested} ${found.unit} replenishment for ${found.name}! Notification dispatched.`, 'info');
                    }
                  }}
                  required
                  className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-slate-800"
                >
                  {parts.map((p) => (
                    <option key={p.partId} value={p.partId}>
                      {p.name} ({p.sku}) — Stock: {p.stock} {p.unit}
                    </option>
                  ))}
                </select>
              </div>

              {/* Bin Location Preview */}
              {(() => {
                const selected = parts.find((p) => p.partId === restockPartId);
                const bin = selected?.shelfLocation || 'Rack A-01 • Bin 01';
                return (
                  <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-emerald-600" />
                      <span className="font-semibold text-emerald-950">Designated Bin Location:</span>
                    </div>
                    <span className="font-mono font-bold text-emerald-800 bg-white px-2 py-0.5 rounded border border-emerald-200">
                      {bin}
                    </span>
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Quantity Received *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={restockQty}
                    onChange={(e) => setRestockQty(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Supplier / Vendor Name
                  </label>
                  <input
                    type="text"
                    value={grnVendor}
                    onChange={(e) => setGrnVendor(e.target.value)}
                    placeholder="e.g. Organ Needle Co."
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Supplier Delivery Challan / Invoice Reference *
                </label>
                <input
                  type="text"
                  required
                  value={grnChallanNo}
                  onChange={(e) => setGrnChallanNo(e.target.value)}
                  placeholder="e.g. DC-INV-2026-9482"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-slate-800 font-mono"
                />
              </div>

              {/* Quality Check Inspection Checkbox */}
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={grnQcPassed}
                  onChange={(e) => setGrnQcPassed(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 mt-0.5"
                />
                <div className="text-xs text-slate-700">
                  <span className="font-bold text-slate-900 block">Quality &amp; Package Inspection Passed</span>
                  <span className="text-[11px] text-slate-500">Box seal verified intact, zero transit damage, piece count matched to invoice.</span>
                </div>
              </label>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsRestockOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition cursor-pointer flex items-center gap-1.5"
                >
                  <Truck className="w-4 h-4" />
                  <span>Confirm GRN Stock Intake</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: QUICK BARCODE / SKU LOOKUP MODAL */}
      {isScannerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 px-5 py-4 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold">
                  <ScanBarcode className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold">Tool Crib Barcode &amp; SKU Scanner</h4>
                  <p className="text-[10px] text-slate-400">Scan shelf barcode or click quick SKU chip</p>
                </div>
              </div>
              <button
                onClick={() => setIsScannerOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Viewfinder Graphic */}
              <div className="relative bg-slate-900 rounded-2xl h-36 flex flex-col items-center justify-center border-2 border-dashed border-indigo-500/60 overflow-hidden">
                <div className="absolute inset-x-8 top-1/2 h-0.5 bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.9)] animate-pulse" />
                <ScanBarcode className="w-12 h-12 text-slate-500/40" />
                <span className="text-[11px] font-mono text-indigo-300 mt-2 font-semibold">
                  Scanner Lens Active &bull; Ready for 1D/2D Barcode
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Instant SKU / Barcode Filter:
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Type or paste SKU code (e.g. NDL-DBX1-14)..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-slate-900 font-bold"
                  autoFocus
                />
              </div>

              {/* Quick SKU Chips */}
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">
                  Quick-Select Common SKUs:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {parts.slice(0, 8).map((p) => (
                    <button
                      key={p.partId}
                      type="button"
                      onClick={() => {
                        setSearchQuery(p.sku);
                        setIsScannerOpen(false);
                        showToast(`Filtered to ${p.sku}`, 'info');
                      }}
                      className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 border border-slate-200 text-slate-700 font-bold transition cursor-pointer"
                    >
                      {p.sku}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex justify-between items-center border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setIsScannerOpen(false);
                  }}
                  className="text-xs text-rose-600 hover:underline font-semibold"
                >
                  Clear Filter
                </button>
                <button
                  type="button"
                  onClick={() => setIsScannerOpen(false)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  Apply &amp; View Catalog
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mechanic Handled Tools & Crib Custody Modal */}
      <MechanicCustodyModal
        mechanic={selectedMechanic}
        isOpen={isMechCustodyOpen}
        onClose={() => setIsMechCustodyOpen(false)}
      />
    </div>
  );
}
