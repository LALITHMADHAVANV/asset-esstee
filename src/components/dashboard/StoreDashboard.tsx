'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Package,
  Boxes,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Plus,
  ArrowRight,
  TrendingDown,
  Check,
  X,
  IndianRupee,
  Layers,
  Trash2,
  Search,
  Filter,
  Download,
  Calendar,
  Clock,
  User,
  Wrench,
  Factory,
  RotateCcw,
  Printer,
  FileText,
  BadgeAlert,
  ShieldCheck,
  MapPin,
  Zap,
} from 'lucide-react';
import { Machine, RepairTicket, PPMSchedule, SparePart, PartRequisition, RequisitionItem } from '@/types/cmms';
import { adjustPartStock, restockPart, createRequisition, sendAppNotification } from '@/lib/services/cmmsService';
import { FACTORY_MECHANICS_ROSTER, MechanicDuty, userToMechanicDuty } from '@/lib/constants/mechanics';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';

interface StoreIssueRecord {
  id: string; // e.g. SLIP-1082
  date: string; // ISO string or formatted
  mechanicId: string;
  mechanicName: string;
  targetLine: string;
  targetMachineId?: string;
  partId: string;
  partName: string;
  sku: string;
  quantity: number;
  unit: string;
  oldPartReturned: boolean;
  remarks?: string;
  storekeeper: string;
  receivedByPerson?: string;
  receiverEmpId?: string;
  receiverPhone?: string;
  notificationSent?: boolean;
}

interface DraftIndentItem {
  id: string;
  partId: string;
  partName: string;
  sku: string;
  quantity: number;
  unit: string;
  unitCost: number;
}

interface StoreDashboardProps {
  machines?: Machine[];
  repairs?: RepairTicket[];
  ppmSchedules?: PPMSchedule[];
  parts: SparePart[];
  requisitions: PartRequisition[];
  lastRefresh: Date;
  onRefresh: () => void;
  isLoading?: boolean;
}

// Local storage key for persistent store issue ledger
const STORAGE_STORE_ISSUES = 'cmms_store_issues';

export function StoreDashboard({
  machines = [],
  repairs = [],
  ppmSchedules = [],
  parts,
  requisitions,
  lastRefresh,
  onRefresh,
  isLoading = false,
}: StoreDashboardProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();

  // ─── 1. MECHANIC ISSUE LOG STATE (REPORT 1) ──────────────────────
  const [issueRecords, setIssueRecords] = useState<StoreIssueRecord[]>([]);
  const [issueSearch, setIssueSearch] = useState('');
  const [selectedMechanicFilter, setSelectedMechanicFilter] = useState('ALL');
  const [scrapReturnFilter, setScrapReturnFilter] = useState<'ALL' | 'RETURNED' | 'PENDING'>('ALL');

  // Load persistent store issue records from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_STORE_ISSUES);
      if (raw) {
        setIssueRecords(JSON.parse(raw));
      } else {
        // Initial empty or sample records if needed
        const initial: StoreIssueRecord[] = [
          {
            id: 'SLIP-1082',
            date: new Date(Date.now() - 45 * 60000).toISOString(),
            mechanicId: 'MEC-01',
            mechanicName: 'Ramesh Kumar',
            targetLine: 'Line 01',
            targetMachineId: 'MC-OVK-101',
            partId: 'PRT-02',
            partName: 'Rotary Hook Hirose Koban HSH-7.94BTR',
            sku: 'HK-KOB-794',
            quantity: 1,
            unit: 'units',
            oldPartReturned: true,
            remarks: 'Replaced sheared gear hook. Old unit received into scrap bin.',
            storekeeper: user?.name || 'Store In-Charge',
          },
          {
            id: 'SLIP-1081',
            date: new Date(Date.now() - 140 * 60000).toISOString(),
            mechanicId: 'MEC-02',
            mechanicName: 'Murugan S.',
            targetLine: 'Line 02',
            targetMachineId: 'MC-SNLS-102',
            partId: 'PRT-01',
            partName: 'Organ Needles DBx1 (#14/90) Knit & Woven',
            sku: 'NDL-DBX1-14',
            quantity: 20,
            unit: 'pcs',
            oldPartReturned: true,
            remarks: 'Daily line needle packet replacement.',
            storekeeper: user?.name || 'Store In-Charge',
          },
          {
            id: 'SLIP-1079',
            date: new Date(Date.now() - 24 * 3600000).toISOString(),
            mechanicId: 'ELE-02',
            mechanicName: 'Karthik N.',
            targetLine: 'Line 03',
            targetMachineId: 'MC-BTN-103',
            partId: 'PRT-07',
            partName: 'Direct-Drive Servo Motor Cogged Belt M-42',
            sku: 'MOT-SRV-BLT',
            quantity: 1,
            unit: 'pcs',
            oldPartReturned: false,
            remarks: 'Snaped belt on floor. Scrap pending return to tool crib.',
            storekeeper: user?.name || 'Store In-Charge',
          },
        ];
        setIssueRecords(initial);
        localStorage.setItem(STORAGE_STORE_ISSUES, JSON.stringify(initial));
      }
    } catch {
      // Ignore
    }
  }, [user]);

  const saveIssueRecords = (records: StoreIssueRecord[]) => {
    setIssueRecords(records);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_STORE_ISSUES, JSON.stringify(records));
      } catch {
        // Ignore
      }
    }
  };

  // Toggle Scrap Return status
  const handleToggleScrapReturn = (id: string) => {
    const updated = issueRecords.map((r) =>
      r.id === id ? { ...r, oldPartReturned: !r.oldPartReturned } : r
    );
    saveIssueRecords(updated);
    showToast('Scrap return status updated!', 'info');
  };

  // ─── 2. STOCK BALANCE STATE (REPORT 2) ───────────────────────────
  const [stockSearch, setStockSearch] = useState('');
  const [stockCategoryFilter, setStockCategoryFilter] = useState('ALL');
  const [stockStatusFilter, setStockStatusFilter] = useState<'ALL' | 'LOW_STOCK' | 'NORMAL'>('ALL');

  // Fast Restock modal / action
  const handleQuickRestock = async (partId: string, partName: string, amount: number = 25) => {
    try {
      await restockPart(partId, amount);
      sendAppNotification({
        type: 'RESTOCK_ALERT',
        title: `Quick Restock Completed: ${partName}`,
        message: `Fast restocked +${amount} units into crib stock. Notification dispatched to maintenance team.`,
        targetRole: 'ALL',
        senderName: user?.name || 'Store In-Charge',
      });
      showToast(`Restocked +${amount} units of ${partName}! Notification dispatched.`, 'success');
      onRefresh();
    } catch {
      showToast('Failed to restock part', 'error');
    }
  };

  // ─── RESTOCK MODAL STATE WITH AUTO-FILL & NOTIFICATION (POINT 8) ─
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
  const [restockPartId, setRestockPartId] = useState('');
  const [restockQty, setRestockQty] = useState(25);
  const [restockPoRef, setRestockPoRef] = useState('');
  const [isSubmittingRestock, setIsSubmittingRestock] = useState(false);

  const selectedPartForRestock = useMemo(() => {
    return parts.find((p) => p.partId === restockPartId) || parts[0];
  }, [parts, restockPartId]);

  const handleOpenRestockModal = (part?: SparePart) => {
    const target = part || parts[0];
    if (target) {
      setRestockPartId(target.partId);
      const suggestedQty = Math.max(25, (target.minStock * 2) - (target.stock || 0));
      setRestockQty(suggestedQty);
      setRestockPoRef(`PO-REC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
      setIsRestockModalOpen(true);

      // POINT 8: Dispatch notification immediately when auto-filling restock qty
      sendAppNotification({
        type: 'RESTOCK_ALERT',
        title: `Restock Quantity Auto-Calculated: ${target.name}`,
        message: `System auto-filled ${suggestedQty} ${target.unit} for ${target.name} (${target.sku}) based on safety buffer (Min: ${target.minStock}, Stock: ${target.stock}).`,
        targetRole: 'ALL',
        senderName: user?.name || 'Store In-Charge',
        meta: {
          partId: target.partId,
          partName: target.name,
          sku: target.sku,
          suggestedQty,
          minStock: target.minStock,
          currentStock: target.stock,
        },
      });

      showToast(
        `⚡ Auto-filled ${suggestedQty} ${target.unit} replenishment for ${target.name}! Notification dispatched to Admin & Maintenance.`,
        'info'
      );
    }
  };

  const handleSelectRestockPart = (pId: string) => {
    setRestockPartId(pId);
    const target = parts.find((p) => p.partId === pId);
    if (target) {
      const suggestedQty = Math.max(25, (target.minStock * 2) - (target.stock || 0));
      setRestockQty(suggestedQty);

      sendAppNotification({
        type: 'RESTOCK_ALERT',
        title: `Restock Quantity Auto-Calculated: ${target.name}`,
        message: `System auto-filled ${suggestedQty} ${target.unit} for ${target.name} (${target.sku}) based on safety buffer (Min: ${target.minStock}, Stock: ${target.stock}).`,
        targetRole: 'ALL',
        senderName: user?.name || 'Store In-Charge',
        meta: {
          partId: target.partId,
          partName: target.name,
          sku: target.sku,
          suggestedQty,
          minStock: target.minStock,
          currentStock: target.stock,
        },
      });

      showToast(
        `⚡ Auto-filled ${suggestedQty} ${target.unit} replenishment for ${target.name}! Notification dispatched.`,
        'info'
      );
    }
  };

  const handleConfirmRestockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPartForRestock || restockQty <= 0) return;
    setIsSubmittingRestock(true);
    try {
      await restockPart(selectedPartForRestock.partId, restockQty, restockPoRef);
      sendAppNotification({
        type: 'RESTOCK_ALERT',
        title: `Inventory Restocked: ${selectedPartForRestock.name}`,
        message: `Successfully received and shelved +${restockQty} ${selectedPartForRestock.unit} under ${restockPoRef}. Bin: ${selectedPartForRestock.shelfLocation || 'Tool Crib'}.`,
        targetRole: 'ALL',
        senderName: user?.name || 'Store In-Charge',
      });
      showToast(`Restocked +${restockQty} ${selectedPartForRestock.unit} for ${selectedPartForRestock.name}!`, 'success');
      setIsRestockModalOpen(false);
      onRefresh();
    } catch {
      showToast('Failed to restock spare part', 'error');
    } finally {
      setIsSubmittingRestock(false);
    }
  };

  // ─── 3. ISSUE PART TO MECHANIC MODAL STATE (POINT 7) ─────────────
  const [registeredStaff, setRegisteredStaff] = useState<MechanicDuty[]>([]);

  useEffect(() => {
    fetch('/api/users')
      .then((r) => r.json())
      .then((data) => {
        if (data.users && Array.isArray(data.users)) {
          const staff = data.users.filter((u: any) =>
            ['MECHANIC', 'SENIOR_MECHANIC', 'ELECTRICIAN', 'SENIOR_ELECTRICIAN', 'STORE_PERSON', 'ADMIN'].includes(u.role)
          );
          if (staff.length > 0) {
            setRegisteredStaff(staff.map(userToMechanicDuty));
          }
        }
      })
      .catch(() => {});
  }, []);

  const activeStaffRoster = registeredStaff.length > 0 ? registeredStaff : FACTORY_MECHANICS_ROSTER;

  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [issueMechanicId, setIssueMechanicId] = useState('');
  const [issuePartId, setIssuePartId] = useState('');
  const [issueQty, setIssueQty] = useState(1);
  const [issueLine, setIssueLine] = useState('Line 01');
  const [issueMachineId, setIssueMachineId] = useState('');
  const [issueOldReturned, setIssueOldReturned] = useState(true);
  const [issueRemarks, setIssueRemarks] = useState('');
  const [receivedByPerson, setReceivedByPerson] = useState('');
  const [receiverEmpId, setReceiverEmpId] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');

  // Default to first staff member when roster loads
  useEffect(() => {
    if (activeStaffRoster.length > 0 && (!issueMechanicId || !activeStaffRoster.some((m) => m.id === issueMechanicId))) {
      setIssueMechanicId(activeStaffRoster[0].id);
      setReceivedByPerson(activeStaffRoster[0].name);
      setReceiverEmpId(activeStaffRoster[0].id);
    }
  }, [activeStaffRoster, issueMechanicId]);

  // Sync default receiver details when mechanic changes
  useEffect(() => {
    const m = activeStaffRoster.find((mech) => mech.id === issueMechanicId);
    if (m) {
      setReceivedByPerson(m.name);
      setReceiverEmpId(m.id);
    }
  }, [issueMechanicId, activeStaffRoster]);

  // Selected part in issue modal
  const selectedPartForIssue = useMemo(() => {
    return parts.find((p) => p.partId === issuePartId) || parts[0];
  }, [parts, issuePartId]);

  // Set default part on modal open
  useEffect(() => {
    if (parts.length > 0 && !issuePartId) {
      setIssuePartId(parts[0].partId);
    }
  }, [parts, issuePartId]);

  const handleConfirmIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPartForIssue) return;

    if (issueQty <= 0) {
      showToast('Quantity must be greater than 0', 'warning');
      return;
    }
    if (issueQty > (selectedPartForIssue.stock || 0)) {
      showToast(
        `Insufficient stock! Only ${selectedPartForIssue.stock} ${selectedPartForIssue.unit} available in crib.`,
        'error'
      );
      return;
    }

    try {
      // Deduct stock in database / service
      await adjustPartStock(selectedPartForIssue.partId, -issueQty);

      const targetMech =
        activeStaffRoster.find((m) => m.id === issueMechanicId) ||
        activeStaffRoster[0] || {
          id: receiverEmpId.trim() || 'EMP-01',
          name: receivedByPerson.trim() || 'Maintenance Staff',
          role: 'Staff',
        };

      const actualReceiver = receivedByPerson.trim() || targetMech.name;
      const actualEmpId = receiverEmpId.trim() || targetMech.id;

      const newRecord: StoreIssueRecord = {
        id: `SLIP-${Math.floor(1000 + Math.random() * 9000)}`,
        date: new Date().toISOString(),
        mechanicId: targetMech.id,
        mechanicName: targetMech.name,
        targetLine: issueLine,
        targetMachineId: issueMachineId.trim() || undefined,
        partId: selectedPartForIssue.partId,
        partName: selectedPartForIssue.name,
        sku: selectedPartForIssue.sku,
        quantity: issueQty,
        unit: selectedPartForIssue.unit,
        oldPartReturned: issueOldReturned,
        remarks: issueRemarks.trim() || undefined,
        storekeeper: user?.name ? `${user.name} (Store In-Charge)` : 'Store In-Charge',
        receivedByPerson: actualReceiver,
        receiverEmpId: actualEmpId,
        receiverPhone: receiverPhone.trim() || undefined,
        notificationSent: true,
      };

      const updatedList = [newRecord, ...issueRecords];
      saveIssueRecords(updatedList);

      // POINT 7: Dispatch acknowledgment notification to responsible mechanic
      sendAppNotification({
        type: 'SPARE_ISSUE_RECEIPT',
        title: `Spare Parts Issued — ${selectedPartForIssue.name}`,
        message: `${issueQty} ${selectedPartForIssue.unit} handed over to ${actualReceiver} (${actualEmpId}) for ${issueLine}${issueMachineId ? ` • Machine ${issueMachineId}` : ''}. Please confirm receipt.`,
        targetRole: 'MECHANIC',
        targetUserId: targetMech.name,
        senderName: user?.name || 'Store In-Charge',
        meta: {
          slipId: newRecord.id,
          partId: selectedPartForIssue.partId,
          partName: selectedPartForIssue.name,
          quantity: issueQty,
          unit: selectedPartForIssue.unit,
          receivedByPerson: actualReceiver,
          receiverEmpId: actualEmpId,
          mechanicName: targetMech.name,
          mechanicId: targetMech.id,
        },
      });

      showToast(
        `Issued ${issueQty} ${selectedPartForIssue.unit} to ${actualReceiver}. Acknowledgment notification dispatched to ${targetMech.name} (Slip #${newRecord.id})`,
        'success'
      );

      setIsIssueModalOpen(false);
      setIssueQty(1);
      setIssueRemarks('');
      setIssueMachineId('');
      onRefresh();
    } catch {
      showToast('Failed to issue part to mechanic', 'error');
    }
  };

  // ─── 4. CREATE NEW INDENT MODAL STATE ───────────────────────────
  const [isNewIndentModalOpen, setIsNewIndentModalOpen] = useState(false);
  const [indentMonth, setIndentMonth] = useState(
    new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })
  );
  const [indentLine, setIndentLine] = useState('Line 01 & Line 02');
  const [indentJustification, setIndentJustification] = useState(
    'Monthly spare parts quota allocation and line buffer inventory.'
  );
  const [indentItems, setIndentItems] = useState<DraftIndentItem[]>([
    {
      id: 'item-1',
      partId: '',
      partName: '',
      sku: '',
      quantity: 10,
      unit: 'pcs',
      unitCost: 0,
    },
  ]);

  const handleAddIndentItem = () => {
    setIndentItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}-${Math.random()}`,
        partId: '',
        partName: '',
        sku: '',
        quantity: 5,
        unit: 'pcs',
        unitCost: 0,
      },
    ]);
  };

  const handleRemoveIndentItem = (id: string) => {
    if (indentItems.length === 1) {
      showToast('An indent must have at least one item.', 'warning');
      return;
    }
    setIndentItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleItemPartSelect = (id: string, partId: string) => {
    const selected = parts.find((p) => p.partId === partId);
    if (!selected) return;
    setIndentItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              partId: selected.partId,
              partName: selected.name,
              sku: selected.sku,
              unit: selected.unit,
              unitCost: selected.unitCost,
            }
          : item
      )
    );
  };

  const handleUpdateItemField = (id: string, field: keyof DraftIndentItem, value: any) => {
    setIndentItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const draftTotalCost = useMemo(() => {
    return indentItems.reduce(
      (acc, it) => acc + (Number(it.quantity) || 0) * (Number(it.unitCost) || 0),
      0
    );
  }, [indentItems]);

  const draftTotalUnits = useMemo(() => {
    return indentItems.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);
  }, [indentItems]);

  const handleCreateNewIndent = async (e: React.FormEvent) => {
    e.preventDefault();

    const validItems = indentItems.filter((i) => i.partName.trim() && (Number(i.quantity) || 0) > 0);
    if (validItems.length === 0) {
      showToast('Please add at least one item with a valid part name and quantity.', 'error');
      return;
    }

    try {
      const formattedItems: RequisitionItem[] = validItems.map((item) => {
        const qty = Number(item.quantity) || 1;
        const rate = Number(item.unitCost) || 0;
        return {
          partId: item.partId || `PRT-${Date.now()}`,
          partName: item.partName.trim(),
          sku: item.sku.trim() || 'SKU-GEN',
          quantity: qty,
          unit: item.unit.trim() || 'pcs',
          unitCost: rate,
          totalCost: qty * rate,
        };
      });

      const totalCost = formattedItems.reduce((acc, it) => acc + it.totalCost, 0);
      const totalUnits = formattedItems.reduce((acc, it) => acc + it.quantity, 0);
      const storeOfficerName = user?.name ? `${user.name} (Store In-Charge)` : 'Store In-Charge';

      await createRequisition({
        type: 'MONTHLY_INDENT',
        items: formattedItems,
        itemCount: totalUnits,
        estimatedCost: totalCost,
        urgency: 'ROUTINE',
        requiresCeoApproval: false,
        requestedBy: storeOfficerName,
        requestedByRole: 'STORE_PERSON',
        monthYear: indentMonth,
        targetLine: indentLine,
        justification: indentJustification.trim() || 'Monthly tool crib spare parts quota indent.',
        status: 'ORDERED',
      });

      showToast(`Monthly indent created with ${formattedItems.length} items!`, 'success');
      setIsNewIndentModalOpen(false);
      onRefresh();

      // Reset form
      setIndentItems([
        {
          id: `item-${Date.now()}`,
          partId: '',
          partName: '',
          sku: '',
          quantity: 10,
          unit: 'pcs',
          unitCost: 0,
        },
      ]);
    } catch (err) {
      console.error(err);
      showToast('Error creating new indent.', 'error');
    }
  };

  // ─── FILTERED DATASETS ───────────────────────────────────────────
  // Filtered Issue Log (Report 1)
  const filteredIssues = useMemo(() => {
    return issueRecords.filter((r) => {
      if (selectedMechanicFilter !== 'ALL' && r.mechanicId !== selectedMechanicFilter) return false;
      if (scrapReturnFilter === 'RETURNED' && !r.oldPartReturned) return false;
      if (scrapReturnFilter === 'PENDING' && r.oldPartReturned) return false;

      if (issueSearch.trim()) {
        const q = issueSearch.toLowerCase();
        const m1 = r.mechanicName.toLowerCase().includes(q);
        const m2 = r.partName.toLowerCase().includes(q);
        const m3 = r.id.toLowerCase().includes(q);
        const m4 = (r.targetMachineId || '').toLowerCase().includes(q);
        const m5 = (r.targetLine || '').toLowerCase().includes(q);
        if (!m1 && !m2 && !m3 && !m4 && !m5) return false;
      }
      return true;
    });
  }, [issueRecords, selectedMechanicFilter, scrapReturnFilter, issueSearch]);

  // Filtered Stock Balance (Report 2)
  const filteredStock = useMemo(() => {
    return parts.filter((p) => {
      const isLow = (p.stock || 0) <= (p.minStock || 0);
      if (stockStatusFilter === 'LOW_STOCK' && !isLow) return false;
      if (stockStatusFilter === 'NORMAL' && isLow) return false;

      if (stockCategoryFilter !== 'ALL' && p.category !== stockCategoryFilter) return false;

      if (stockSearch.trim()) {
        const q = stockSearch.toLowerCase();
        const m1 = p.name.toLowerCase().includes(q);
        const m2 = p.sku.toLowerCase().includes(q);
        const m3 = (p.shelfLocation || '').toLowerCase().includes(q);
        const m4 = (p.category || '').toLowerCase().includes(q);
        if (!m1 && !m2 && !m3 && !m4) return false;
      }
      return true;
    });
  }, [parts, stockStatusFilter, stockCategoryFilter, stockSearch]);

  // Categories present in catalog
  const stockCategories = useMemo(() => {
    const cats = new Set<string>();
    parts.forEach((p) => {
      if (p.category) cats.add(p.category);
    });
    return Array.from(cats).sort();
  }, [parts]);

  // Total valuation
  const totalValuation = useMemo(() => {
    return parts.reduce((acc, p) => acc + (p.stock || 0) * (p.unitCost || 0), 0);
  }, [parts]);

  const lowStockCount = useMemo(() => {
    return parts.filter((p) => (p.stock || 0) <= (p.minStock || 0)).length;
  }, [parts]);

  const pendingScrapReturnsCount = useMemo(() => {
    return issueRecords.filter((r) => !r.oldPartReturned).length;
  }, [issueRecords]);

  // ─── 5. CSV EXPORT HELPERS ───────────────────────────────────────
  const handleExportIssueReport = () => {
    if (filteredIssues.length === 0) {
      showToast('No issue records to export', 'info');
      return;
    }
    const headers = [
      'Slip No',
      'Date & Time',
      'Mechanic ID',
      'Mechanic Name',
      'Target Line',
      'Target Machine',
      'Part Name',
      'SKU',
      'Qty Issued',
      'Unit',
      'Old Scrap Returned',
      'Remarks',
      'Storekeeper',
    ];
    const rows = filteredIssues.map((r) => [
      `"${r.id}"`,
      `"${new Date(r.date).toLocaleString('en-IN')}"`,
      `"${r.mechanicId}"`,
      `"${r.mechanicName}"`,
      `"${r.targetLine}"`,
      `"${r.targetMachineId || 'Floor'}"`,
      `"${r.partName.replace(/"/g, '""')}"`,
      `"${r.sku}"`,
      r.quantity,
      `"${r.unit}"`,
      r.oldPartReturned ? 'YES - RETURNED' : 'NO - PENDING',
      `"${(r.remarks || '').replace(/"/g, '""')}"`,
      `"${r.storekeeper}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Store_Mechanic_Issue_Log_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Exported ${filteredIssues.length} mechanic issue records!`, 'success');
  };

  const handleExportStockReport = () => {
    if (filteredStock.length === 0) {
      showToast('No stock items to export', 'info');
      return;
    }
    const headers = [
      'Sl No',
      'Part ID',
      'Part Name',
      'SKU',
      'Category',
      'Shelf Location',
      'Current Stock',
      'Min Alert Level',
      'Unit Rate (INR)',
      'Total Value (INR)',
      'Stock Status',
    ];
    const rows = filteredStock.map((p, idx) => [
      idx + 1,
      `"${p.partId}"`,
      `"${p.name.replace(/"/g, '""')}"`,
      `"${p.sku}"`,
      `"${p.category}"`,
      `"${p.shelfLocation || 'Tool Crib'}"`,
      p.stock,
      p.minStock,
      p.unitCost,
      (p.stock || 0) * (p.unitCost || 0),
      (p.stock || 0) <= (p.minStock || 0) ? 'LOW STOCK ALERT' : 'HEALTHY IN STOCK',
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Tool_Crib_Stock_Balance_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Exported ${filteredStock.length} stock items to CSV!`, 'success');
  };

  return (
    <div className="space-y-6 pb-16 max-w-7xl mx-auto">
      {/* ─── 1. SIMPLIFIED STORE REGISTER HEADER ───────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Stores &amp; Tool Crib Daily Ledger
              </h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Official Register
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Logged in: <strong>{user?.name || 'Store In-Charge'}</strong> • Real-time mechanic parts issue chits &amp; inventory balance reports
            </p>
          </div>
        </div>

        {/* TOP QUICK ACTION BUTTONS */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={() => setIsIssueModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-xs cursor-pointer"
            title="Fast issue spare parts to a factory mechanic with chit generation"
          >
            <Plus className="w-4 h-4" />
            <span>Issue Part to Mechanic</span>
          </button>

          <button
            onClick={() => setIsNewIndentModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-xs cursor-pointer"
            title="Add a monthly spare parts indent quota"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Indent</span>
          </button>

          <button
            onClick={onRefresh}
            disabled={isLoading}
            title="Refresh All Store Data"
            className="p-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ─── 2. PLAIN-ENGLISH KPI STRIP ───────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Parts Issued</span>
            <Wrench className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{issueRecords.length}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Total recorded chits</div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Scrap Pending</span>
            <BadgeAlert className={`w-4 h-4 ${pendingScrapReturnsCount > 0 ? 'text-rose-600' : 'text-slate-400'}`} />
          </div>
          <div className={`text-2xl font-black ${pendingScrapReturnsCount > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
            {pendingScrapReturnsCount}
          </div>
          <div className="text-[11px] text-rose-600 font-semibold mt-0.5">Old parts not returned</div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Low Stock Alert</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600">{lowStockCount}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Items below min safety level</div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Stock Value</span>
            <IndianRupee className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            ₹{totalValuation.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">{parts.length} registered SKUs</div>
        </div>
      </div>

      {/* ─── REPORT 1: MECHANIC PARTS ISSUE LOG (TOP SECTION) ──────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden space-y-3 p-4 sm:p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                1
              </span>
              <h2 className="text-base font-bold text-slate-900">
                Mechanic Spare Parts Issue Report (Chit Register)
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 pl-8">
              Parts withdrawn by mechanics for machine repairs and 1:1 damaged scrap return tracking
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsIssueModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-2xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Issue Part</span>
            </button>

            <button
              onClick={handleExportIssueReport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer"
              title="Download Mechanic Issues as CSV spreadsheet"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Filter Bar for Report 1 */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={issueSearch}
              onChange={(e) => setIssueSearch(e.target.value)}
              placeholder="Search by Mechanic, Machine, Line, or Part..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedMechanicFilter}
              onChange={(e) => setSelectedMechanicFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-700 font-medium cursor-pointer"
            >
              <option value="ALL">All Mechanics ({issueRecords.length})</option>
              {activeStaffRoster.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.id})
                </option>
              ))}
            </select>

            <select
              value={scrapReturnFilter}
              onChange={(e) => setScrapReturnFilter(e.target.value as any)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-700 font-medium cursor-pointer"
            >
              <option value="ALL">All Scrap Statuses</option>
              <option value="RETURNED">Scrap Returned (OK)</option>
              <option value="PENDING">Pending Scrap Return (!)</option>
            </select>
          </div>
        </div>

        {/* Table 1: Spreadsheet Ledger */}
        <div className="border border-slate-300 rounded-xl overflow-hidden shadow-2xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-300 select-none">
              <tr>
                <th className="py-2.5 px-3 border-r border-slate-300 text-center w-10">#</th>
                <th className="py-2.5 px-3 border-r border-slate-300 font-mono whitespace-nowrap">Date &amp; Time</th>
                <th className="py-2.5 px-3 border-r border-slate-300 font-mono whitespace-nowrap">Chit / Slip #</th>
                <th className="py-2.5 px-3 border-r border-slate-300 whitespace-nowrap min-w-[130px]">Mechanic Name</th>
                <th className="py-2.5 px-3 border-r border-slate-300 whitespace-nowrap">Machine / Line</th>
                <th className="py-2.5 px-3 border-r border-slate-300 min-w-[180px]">Spare Part Given &amp; SKU</th>
                <th className="py-2.5 px-3 border-r border-slate-300 text-center whitespace-nowrap">Qty</th>
                <th className="py-2.5 px-3 border-r border-slate-300 text-center whitespace-nowrap">1:1 Scrap Return</th>
                <th className="py-2.5 px-3 border-r border-slate-300 min-w-[150px]">Store Remarks</th>
                <th className="py-2.5 px-3 text-center whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white font-medium">
              {filteredIssues.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400">
                    No mechanic parts issue records found matching your filter.
                  </td>
                </tr>
              ) : (
                filteredIssues.map((r, idx) => {
                  const d = new Date(r.date);
                  return (
                    <tr key={r.id} className="hover:bg-blue-50/60 even:bg-slate-50/40 transition">
                      <td className="py-2 px-3 text-center border-r border-slate-200 text-slate-400 font-mono text-[11px]">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 whitespace-nowrap font-mono text-[10px] text-slate-600">
                        {d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}{' '}
                        •{' '}
                        {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 font-mono font-bold text-indigo-700 text-[11px] whitespace-nowrap">
                        {r.id}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 whitespace-nowrap font-bold text-slate-900">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>{r.mechanicName}</span>
                        </div>
                        {r.receivedByPerson && (
                          <div className="mt-1 flex items-center gap-1">
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200" title="Physical recipient proof">
                              Received by: <strong>{r.receivedByPerson}</strong> {r.receiverEmpId ? `(${r.receiverEmpId})` : ''}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 whitespace-nowrap">
                        <div className="flex items-center gap-1 text-[11px]">
                          <span className="font-mono font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                            {r.targetMachineId || 'Floor'}
                          </span>
                          <span className="text-slate-500">({r.targetLine})</span>
                        </div>
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200">
                        <div className="font-semibold text-slate-900 leading-snug">{r.partName}</div>
                        <div className="font-mono text-[10px] text-slate-500 mt-0.5">SKU: {r.sku}</div>
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 text-center font-bold text-slate-900 font-mono">
                        {r.quantity} {r.unit}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 text-center whitespace-nowrap">
                        {r.oldPartReturned ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Returned</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            <span>Scrap Pending</span>
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 text-slate-600 text-[11px] italic">
                        {r.remarks || 'Standard maintenance issuance.'}
                      </td>
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        <button
                          onClick={() => handleToggleScrapReturn(r.id)}
                          className="text-[10px] font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded transition cursor-pointer"
                          title="Toggle Old Scrap Returned Status"
                        >
                          {r.oldPartReturned ? 'Mark Pending' : 'Mark Returned'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot className="bg-slate-50 font-bold border-t border-slate-300 text-xs text-slate-700">
              <tr>
                <td colSpan={6} className="py-2 px-3">
                  Showing {filteredIssues.length} mechanic part issue transactions
                </td>
                <td colSpan={4} className="py-2 px-3 text-right text-slate-500 font-normal">
                  Pending scrap returns: <strong className="text-rose-700 font-bold">{pendingScrapReturnsCount}</strong> items
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ─── REPORT 2: CURRENT STOCK BALANCE & SHELVES (BOTTOM SECTION) ─ */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden space-y-3 p-4 sm:p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                2
              </span>
              <h2 className="text-base font-bold text-slate-900">
                Tool Crib Stock Balance &amp; Bin Shelf Register
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 pl-8">
              Live on-shelf spare part quantities, safety alert levels, and tool crib bin locations
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => router.push('/dashboard/store-inbox')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl transition cursor-pointer"
            >
              <Package className="w-3.5 h-3.5" />
              <span>Monthly Indents Inbox</span>
            </button>

            <button
              onClick={() => handleExportStockReport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer"
              title="Download Stock Sheet as CSV spreadsheet"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={() => handleOpenRestockModal()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition cursor-pointer"
              title="Restock spare parts and replenish safety buffer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Restock Spares</span>
            </button>
          </div>
        </div>

        {/* Filter Bar for Report 2 */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={stockSearch}
              onChange={(e) => setStockSearch(e.target.value)}
              placeholder="Search by Part Name, SKU, or Shelf Location..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={stockCategoryFilter}
              onChange={(e) => setStockCategoryFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-700 font-medium cursor-pointer"
            >
              <option value="ALL">All Categories</option>
              {stockCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              value={stockStatusFilter}
              onChange={(e) => setStockStatusFilter(e.target.value as any)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-700 font-medium cursor-pointer"
            >
              <option value="ALL">All Stock Levels</option>
              <option value="LOW_STOCK">Critical Low Stock ({lowStockCount})</option>
              <option value="NORMAL">Healthy Stock</option>
            </select>
          </div>
        </div>

        {/* Table 2: Stock Balance Spreadsheet */}
        <div className="border border-slate-300 rounded-xl overflow-hidden shadow-2xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-300 select-none">
              <tr>
                <th className="py-2.5 px-3 border-r border-slate-300 text-center w-10">#</th>
                <th className="py-2.5 px-3 border-r border-slate-300 min-w-[200px]">Part Name &amp; Description</th>
                <th className="py-2.5 px-3 border-r border-slate-300 font-mono w-28">SKU</th>
                <th className="py-2.5 px-3 border-r border-slate-300 whitespace-nowrap">Category</th>
                <th className="py-2.5 px-3 border-r border-slate-300 whitespace-nowrap">Shelf Location</th>
                <th className="py-2.5 px-3 border-r border-slate-300 text-center whitespace-nowrap">Current Stock</th>
                <th className="py-2.5 px-3 border-r border-slate-300 text-center whitespace-nowrap">Safety Alert</th>
                <th className="py-2.5 px-3 border-r border-slate-300 text-right whitespace-nowrap font-mono">Rate (₹)</th>
                <th className="py-2.5 px-3 border-r border-slate-300 text-right whitespace-nowrap font-mono">Total Value (₹)</th>
                <th className="py-2.5 px-3 border-r border-slate-300 text-center whitespace-nowrap">Status</th>
                <th className="py-2.5 px-3 text-center whitespace-nowrap">Fast Restock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white font-medium">
              {filteredStock.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-400">
                    No spare parts found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredStock.map((p, idx) => {
                  const isLow = (p.stock || 0) <= (p.minStock || 0);
                  const totalLineVal = (p.stock || 0) * (p.unitCost || 0);

                  return (
                    <tr key={p.partId} className="hover:bg-blue-50/60 even:bg-slate-50/40 transition">
                      <td className="py-2 px-3 text-center border-r border-slate-200 text-slate-400 font-mono text-[11px]">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200">
                        <div className="font-bold text-slate-900 leading-snug">{p.name}</div>
                        <div className="text-[10px] text-slate-500 truncate max-w-xs">{p.compat}</div>
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 font-mono text-[11px] font-semibold text-slate-600">
                        {p.sku}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 whitespace-nowrap text-slate-700">
                        {p.category}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                          <MapPin className="w-2.5 h-2.5 text-indigo-600" />
                          <span>{p.shelfLocation || 'Tool Crib'}</span>
                        </span>
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 text-center whitespace-nowrap">
                        <span
                          className={`font-black font-mono text-xs px-2.5 py-0.5 rounded-md ${
                            isLow ? 'bg-rose-100 text-rose-700' : 'bg-emerald-50 text-emerald-800'
                          }`}
                        >
                          {p.stock} {p.unit}
                        </span>
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 text-center whitespace-nowrap font-mono text-slate-500">
                        {p.minStock} {p.unit}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 text-right whitespace-nowrap font-mono">
                        ₹{(p.unitCost || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 text-right whitespace-nowrap font-mono font-bold text-slate-900">
                        ₹{totalLineVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 text-center whitespace-nowrap">
                        {isLow ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            <span>Low Stock Alert</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Healthy</span>
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenRestockModal(p)}
                            className="px-2.5 py-1 text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition shadow-2xs cursor-pointer flex items-center gap-1"
                            title="Restock part with auto-calculated replenishment"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Restock</span>
                          </button>
                          <button
                            onClick={() => handleQuickRestock(p.partId, p.name, 25)}
                            className="px-2 py-1 text-[10px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
                            title="Quick +25 units"
                          >
                            +25
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot className="bg-slate-50 font-bold border-t border-slate-300 text-xs text-slate-700">
              <tr>
                <td colSpan={5} className="py-2 px-3">
                  Total {filteredStock.length} spare parts displayed
                </td>
                <td colSpan={3} className="py-2 px-3 text-right text-slate-600">
                  Total Filtered Valuation:
                </td>
                <td className="py-2 px-3 text-right font-mono font-black text-slate-900 text-sm">
                  ₹{filteredStock.reduce((acc, p) => acc + (p.stock || 0) * (p.unitCost || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ─── MODAL A: ISSUE PART TO MECHANIC ──────────────────────── */}
      {isIssueModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <Wrench className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Issue Spare Part to Mechanic
                  </h3>
                  <p className="text-xs text-slate-500">
                    Hand over replacement part and log Chit / Gate Pass
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsIssueModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmIssue} className="space-y-3.5 text-xs">
              {/* Mechanic Selection */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                  Responsible Mechanic (Charged To)
                </label>
                <select
                  value={issueMechanicId}
                  onChange={(e) => setIssueMechanicId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  {activeStaffRoster.length > 0 ? (
                    activeStaffRoster.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.role}) • {m.shift}
                      </option>
                    ))
                  ) : (
                    <option value="STAFF-GEN">General Maintenance Personnel</option>
                  )}
                </select>
              </div>

              {/* Physical Recipient Proof & Verification (POINT 7) */}
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
                      value={receivedByPerson}
                      onChange={(e) => setReceivedByPerson(e.target.value)}
                      placeholder="e.g. Ramesh Kumar or Sanjay (Helper)"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                      Employee ID / Token No *
                    </label>
                    <input
                      type="text"
                      required
                      value={receiverEmpId}
                      onChange={(e) => setReceiverEmpId(e.target.value)}
                      placeholder="e.g. MEC-01 or EMP-9921"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                    Contact Phone / Line Extension (Optional)
                  </label>
                  <input
                    type="text"
                    value={receiverPhone}
                    onChange={(e) => setReceiverPhone(e.target.value)}
                    placeholder="e.g. Ext 402 or +91 98401 23456"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <p className="text-[10px] text-indigo-700/90 leading-tight">
                  ⚡ An instant notification &amp; acknowledgment request will be dispatched to <strong>{activeStaffRoster.find((m) => m.id === issueMechanicId)?.name || 'the mechanic'}</strong> for verification upon issuing.
                </p>
              </div>

              {/* Spare Part Selection */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                  Spare Part Required
                </label>
                <select
                  value={issuePartId}
                  onChange={(e) => setIssuePartId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  {parts.map((p) => (
                    <option key={p.partId} value={p.partId}>
                      {p.name} (Stock: {p.stock} {p.unit}) - {p.shelfLocation || 'Tool Crib'}
                    </option>
                  ))}
                </select>
                {selectedPartForIssue && (
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1 px-1">
                    <span>SKU: <strong className="font-mono text-slate-700">{selectedPartForIssue.sku}</strong></span>
                    <span>Available Crib Stock: <strong className="font-mono text-emerald-700">{selectedPartForIssue.stock} {selectedPartForIssue.unit}</strong></span>
                  </div>
                )}
              </div>

              {/* Quantity & Location */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                    Quantity to Issue
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={selectedPartForIssue ? selectedPartForIssue.stock : 999}
                    value={issueQty}
                    onChange={(e) => setIssueQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold focus:bg-white focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                    Target Line
                  </label>
                  <select
                    value={issueLine}
                    onChange={(e) => setIssueLine(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs cursor-pointer"
                  >
                    <option value="Line 01">Line 01 (Overlock)</option>
                    <option value="Line 02">Line 02 (Lockstitch)</option>
                    <option value="Line 03">Line 03</option>
                    <option value="Line 04">Line 04</option>
                    <option value="Cutting Section">Cutting Section</option>
                    <option value="Finishing Bay">Finishing Bay</option>
                    <option value="General Maintenance">General Floor</option>
                  </select>
                </div>
              </div>

              {/* Machine ID (Optional) */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                  Machine ID (Optional)
                </label>
                <input
                  type="text"
                  value={issueMachineId}
                  onChange={(e) => setIssueMachineId(e.target.value)}
                  placeholder="e.g. MC-OVK-101 or Station 04"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:bg-white focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* 1:1 Scrap Return Checkbox */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="scrapReturnedCheck"
                  checked={issueOldReturned}
                  onChange={(e) => setIssueOldReturned(e.target.checked)}
                  className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <label htmlFor="scrapReturnedCheck" className="text-xs text-amber-950 font-medium cursor-pointer">
                  <strong>1:1 Damaged Scrap Received into Crib:</strong> Mechanic returned the broken/worn part for factory scrap accounting.
                </label>
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                  Chit Notes / Reason
                </label>
                <input
                  type="text"
                  value={issueRemarks}
                  onChange={(e) => setIssueRemarks(e.target.value)}
                  placeholder="e.g. Needle breakdown replacement on Line 01"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsIssueModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Issue &amp; Deduct Stock</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: RESTOCK CRIB SPARES WITH AUTO-FILL & NOTIFICATION (POINT 8) ─ */}
      {isRestockModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <Boxes className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Restock Tool Crib Inventory
                  </h3>
                  <p className="text-xs text-slate-500">
                    Replenish stock buffer and dispatch notification to maintenance team
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRestockModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmRestockSubmit} className="space-y-3.5 text-xs">
              {/* Part Selector */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                  Select Spare Part to Restock
                </label>
                <select
                  value={restockPartId}
                  onChange={(e) => handleSelectRestockPart(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  {parts.map((p) => (
                    <option key={p.partId} value={p.partId}>
                      {p.name} ({p.sku}) — Stock: {p.stock} {p.unit} (Min: {p.minStock})
                    </option>
                  ))}
                </select>
              </div>

              {/* Buffer & Shelf Status Card */}
              {selectedPartForRestock && (
                <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-indigo-950 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{selectedPartForRestock.shelfLocation || 'Tool Crib • Bin A-01'}</span>
                    </span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-white border border-indigo-200 text-indigo-800">
                      ₹{selectedPartForRestock.unitCost} / {selectedPartForRestock.unit}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-center text-[11px]">
                    <div className="bg-white p-2 rounded-lg border border-indigo-100">
                      <span className="text-slate-500 block text-[10px]">Current In-Stock</span>
                      <strong className="text-slate-900 font-mono text-sm">{selectedPartForRestock.stock} {selectedPartForRestock.unit}</strong>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-indigo-100">
                      <span className="text-slate-500 block text-[10px]">Safety Buffer Min</span>
                      <strong className="text-amber-800 font-mono text-sm">{selectedPartForRestock.minStock} {selectedPartForRestock.unit}</strong>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] text-indigo-800 font-medium bg-indigo-100/60 p-1.5 rounded-lg">
                    <Zap className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>Auto-calculated replenishment quantity auto-filled and broadcast to floor supervisors.</span>
                  </div>
                </div>
              )}

              {/* Quantity to Receive & PO Reference */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                    Replenishment Quantity *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={9999}
                    required
                    value={restockQty}
                    onChange={(e) => setRestockQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                    PO / Challan Reference
                  </label>
                  <input
                    type="text"
                    value={restockPoRef}
                    onChange={(e) => setRestockPoRef(e.target.value)}
                    placeholder="e.g. PO-REC-2026-102"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:bg-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsRestockModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRestock}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSubmittingRestock ? 'Restocking...' : `Confirm Restock (+${restockQty})`}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL B: CREATE NEW MONTHLY INDENT ─────────────────────── */}
      {isNewIndentModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Create New Monthly Store Indent
                  </h3>
                  <p className="text-xs text-slate-500">
                    Request monthly spare parts quota and buffer items for tool crib custody
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNewIndentModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNewIndent} className="space-y-4 overflow-y-auto flex-1 pr-1">
              {/* Config Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                    Month &amp; Year
                  </label>
                  <input
                    type="text"
                    value={indentMonth}
                    onChange={(e) => setIndentMonth(e.target.value)}
                    placeholder="e.g. October 2026"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                    Target Line / Area
                  </label>
                  <select
                    value={indentLine}
                    onChange={(e) => setIndentLine(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden cursor-pointer"
                  >
                    <option value="Line 01 & Line 02">Line 01 &amp; Line 02</option>
                    <option value="Line 01">Line 01 (Overlock &amp; SNLS)</option>
                    <option value="Line 02">Line 02 (Lockstitch &amp; Special)</option>
                    <option value="Line 03">Line 03</option>
                    <option value="Line 04">Line 04</option>
                    <option value="Cutting Section">Cutting Section</option>
                    <option value="Finishing Bay">Finishing Bay</option>
                    <option value="All Factory Lines">All Factory Lines (Plant-wide)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                    Requested By
                  </label>
                  <input
                    type="text"
                    disabled
                    value={user?.name ? `${user.name} (Store In-Charge)` : 'Store In-Charge'}
                    className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Items Section ("add things") */}
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Indent Line Items ({indentItems.length} Products)</span>
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Add parts and quantities needed for the monthly store quota
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddIndentItem}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="border border-slate-300 rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-300 select-none">
                      <tr>
                        <th className="py-2.5 px-3 border-r border-slate-300 min-w-[190px]">
                          Select or Enter Part Name
                        </th>
                        <th className="py-2.5 px-3 border-r border-slate-300 font-mono w-28">SKU</th>
                        <th className="py-2.5 px-3 border-r border-slate-300 w-20 text-center">Qty</th>
                        <th className="py-2.5 px-3 border-r border-slate-300 w-20 text-center">Unit</th>
                        <th className="py-2.5 px-3 border-r border-slate-300 w-24 text-right font-mono">Rate (₹)</th>
                        <th className="py-2.5 px-3 border-r border-slate-300 w-28 text-right font-mono">Subtotal (₹)</th>
                        <th className="py-2.5 px-2 text-center w-10">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {indentItems.map((item) => {
                        const lineSubtotal = (Number(item.quantity) || 0) * (Number(item.unitCost) || 0);

                        return (
                          <tr key={item.id} className="hover:bg-slate-50/60 transition">
                            <td className="py-2 px-3 border-r border-slate-200">
                              <div className="space-y-1">
                                {parts.length > 0 && (
                                  <select
                                    value={item.partId}
                                    onChange={(e) => handleItemPartSelect(item.id, e.target.value)}
                                    className="w-full text-[11px] p-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 cursor-pointer"
                                  >
                                    <option value="">-- Choose from Catalog --</option>
                                    {parts.map((p) => (
                                      <option key={p.partId} value={p.partId}>
                                        {p.name} ({p.sku}) - ₹{p.unitCost}
                                      </option>
                                    ))}
                                  </select>
                                )}
                                <input
                                  type="text"
                                  value={item.partName}
                                  onChange={(e) => handleUpdateItemField(item.id, 'partName', e.target.value)}
                                  placeholder="Or type part name..."
                                  className="w-full text-xs px-2 py-1 bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 font-medium"
                                  required
                                />
                              </div>
                            </td>

                            <td className="py-2 px-3 border-r border-slate-200">
                              <input
                                type="text"
                                value={item.sku}
                                onChange={(e) => handleUpdateItemField(item.id, 'sku', e.target.value)}
                                placeholder="SKU-XXX"
                                className="w-full text-[11px] font-mono px-2 py-1 bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500"
                              />
                            </td>

                            <td className="py-2 px-2 border-r border-slate-200 text-center">
                              <input
                                type="number"
                                min={1}
                                value={item.quantity}
                                onChange={(e) =>
                                  handleUpdateItemField(item.id, 'quantity', Math.max(1, parseInt(e.target.value) || 1))
                                }
                                className="w-full text-xs font-mono font-bold text-center px-1 py-1 bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500"
                                required
                              />
                            </td>

                            <td className="py-2 px-2 border-r border-slate-200 text-center">
                              <select
                                value={item.unit}
                                onChange={(e) => handleUpdateItemField(item.id, 'unit', e.target.value)}
                                className="w-full text-[11px] px-1 py-1 bg-white border border-slate-200 rounded-lg text-center cursor-pointer"
                              >
                                <option value="pcs">pcs</option>
                                <option value="units">units</option>
                                <option value="sets">sets</option>
                                <option value="boxes">boxes</option>
                                <option value="jugs">jugs</option>
                              </select>
                            </td>

                            <td className="py-2 px-2 border-r border-slate-200 text-right">
                              <input
                                type="number"
                                min={0}
                                step="any"
                                value={item.unitCost}
                                onChange={(e) =>
                                  handleUpdateItemField(item.id, 'unitCost', Math.max(0, parseFloat(e.target.value) || 0))
                                }
                                className="w-full text-xs font-mono text-right px-2 py-1 bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500"
                              />
                            </td>

                            <td className="py-2 px-3 border-r border-slate-200 text-right font-mono font-bold text-slate-800">
                              ₹{lineSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>

                            <td className="py-2 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveIndentItem(item.id)}
                                className="text-slate-400 hover:text-rose-600 p-1 rounded-md transition cursor-pointer"
                                title="Remove Item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-slate-50 font-bold border-t border-slate-300 text-xs">
                      <tr>
                        <td colSpan={2} className="py-2.5 px-3 text-slate-700">
                          Total Indent Allocation
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono text-indigo-700">
                          {draftTotalUnits}
                        </td>
                        <td colSpan={2} className="py-2.5 px-3 text-right text-slate-600 font-mono">
                          Grand Total:
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900 text-sm">
                          ₹{draftTotalCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Justification & Remarks */}
              <div className="text-xs space-y-1">
                <label className="block text-[11px] font-semibold text-slate-600 uppercase">
                  Indent Justification &amp; Purpose
                </label>
                <textarea
                  rows={2}
                  value={indentJustification}
                  onChange={(e) => setIndentJustification(e.target.value)}
                  placeholder="State the purpose for this monthly indent allocation..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              {/* Modal Footer Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100 shrink-0">
                <div className="text-xs text-slate-500">
                  <strong className="text-slate-800">{indentItems.length}</strong> items • Estimated CapEx:{' '}
                  <strong className="text-slate-900 font-mono">
                    ₹{draftTotalCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </strong>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsNewIndentModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>Create &amp; Dispatch Indent</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
