export type AssetCategory =
  | 'MACHINE' // Sewing & Industrial Machinery
  | 'FURNITURE' // Furniture: Work Tables, Cutting Tables, Operator & Supervisor Chairs, Workshop Stools
  | 'TABLE' // Work Tables (backward compatibility)
  | 'CHAIR' // Chairs & Seating (backward compatibility)
  | 'VEHICLE' // Forklifts, Pallet Jacks, & Trolleys
  | 'UTILITY' // Central Utilities, Lighting Fixtures & Ventilation Fans
  | 'LIGHT' // Legacy alias under UTILITY
  | 'FAN'; // Legacy alias under UTILITY

export type MachineType =
  // 1. Overlock (Yamato, Supreme)
  | 'OVERLOCK_4_THREAD' // 4 Thread Overlock
  | 'OVERLOCK_RIB_THREAD' // Rib Thread Overlock
  | 'OVERLOCK_LFC' // LFC Overlock
  // 2. Flatlock (Yamato)
  | 'FLATLOCK_HEMMING' // Hemming Flatlock
  | 'FLATLOCK_SMALL_CYLINDER' // Small Cylinder Bed Flatlock
  | 'FLATLOCK_CYLINDER_BED' // Cylinder Bed Flatlock
  | 'FLATLOCK_FLAT_BED' // Flat Bed Flatlock
  | 'FLATLOCK_VT' // VT Flatlock
  | 'FLATLOCK_TOP_ELASTIC' // Top Elastic Flatlock
  // 3. Single Needle Machine (Brother, Supreme)
  | 'SN_BROTHER_KAJA' // Brother KAJA (Buttonhole)
  | 'SN_BROTHER_BUTTON_STITCH' // Brother Button Stitch
  | 'SN_BROTHER_BARTACK' // Brother Bartack
  // Legacy / Industrial Machine Aliases
  | 'SNLS' // Single Needle Lockstitch
  | 'DNLS' // Double Needle Lockstitch
  | 'OVERLOCK' // Generic Overlock
  | 'FLATLOCK' // Generic Flatlock
  | 'BUTTONHOLE' // Buttonhole Indexer
  | 'BARTACK' // Electronic Bartack
  | 'FEED_OFF_ARM' // Feed-off-the-arm
  | 'CUTTING_MACHINE' // Fabric End / Straight Knife Cutter
  | 'FUSING_PRESS' // Collar / Cuff Fusing Press
  | 'MACHINE_CUSTOM' // Custom / Multi-head
  // Tables
  | 'TABLE_CUTTING' // Fabric Spreading & Cutting Table
  | 'TABLE_SEWING' // Sewing Workstation Table
  | 'TABLE_INSPECTION' // QC Garment Checking Table
  | 'TABLE_PACKING' // Final Folding & Poly-Bagging Table
  | 'TABLE_PATTERN' // Pattern Drafting & Master Table
  // Chairs
  | 'CHAIR_OPERATOR' // Ergonomic Sewing Swivel Chair
  | 'CHAIR_SUPERVISOR' // High-Back Supervisor Chair
  | 'CHAIR_STOOL' // Mechanic Workshop Stool
  // Vehicles & Transport
  | 'VEHICLE_FORKLIFT' // Heavy Duty Forklift
  | 'VEHICLE_PALLET_JACK' // Manual/Electric Pallet Jack
  | 'VEHICLE_TROLLEY' // Material Handling Trolley
  // Lighting
  | 'LIGHT_HIGHBAY' // Overhead Linear High-Bay LED
  | 'LIGHT_TASK' // Needle Station Gooseneck Lamp
  | 'LIGHT_INSPECTION' // Color-Checking Inspection Tube
  // Fans & Air Movement
  | 'FAN_CEILING' // Heavy Industrial Ceiling Fan
  | 'FAN_EXHAUST' // Wall Exhaust Blower
  | 'FAN_PEDESTAL' // High-Velocity Floor Pedestal Fan
  // Utilities
  | 'UTILITY_BOILER' // Industrial Steam Generator
  | 'UTILITY_COMPRESSOR' // Screw Air Compressor
  | 'UTILITY_SAFETY' // Line Fire Safety Station
  // Custom Asset Extensions
  | 'CHAIR_CUSTOM' // Custom Chair / Seating
  | 'TABLE_CUSTOM' // Custom Table / Workstation
  | 'VEHICLE_CUSTOM' // Custom Vehicle / Transport
  | 'UTILITY_CUSTOM' // Custom Utility Fixture
  | (string & {}); // Extensible custom types

export type MachineClass = 'OVERLOCK' | 'FLATLOCK' | 'SINGLE_NEEDLE';

export type MotorType = 'SERVO' | 'CLUTCH';

export type MachineStatus =
  | 'ACTIVE'
  | 'IDLE' // Standby / Idle ready for production line assignment
  | 'BUFFER'
  | 'BREAKDOWN'
  | 'UNDER_MAINTENANCE'
  | 'SCRAP';

export type FactoryDepartment =
  | 'Sewing Floor'
  | 'Cutting Department'
  | 'Finishing & Pressing'
  | 'Embroidery & Printing'
  | 'Quality & Packing'
  | 'Warehouse & Storage'
  | 'Central Utilities & Plant'
  | 'Maintenance Workshop'
  | 'Scrap Bay';

export type FloorLine =
  | 'Line 01'
  | 'Line 02'
  | 'Line 03'
  | 'Line 04'
  | 'Buffer Workshop'
  | 'Scrap Bay'
  | 'Cutting Department'
  | 'Finishing & Pressing'
  | 'Embroidery & Printing'
  | 'Quality & Packing'
  | 'Warehouse & Storage'
  | 'Central Utilities & Plant'
  | 'Maintenance Workshop'
  | (string & {});

export interface Machine {
  id: string; // e.g., "MC-SNLS-101", "TBL-CUT-101", "CHR-ERG-101", "LGT-HBY-101", "FAN-CEIL-101"
  name?: string; // Display name, e.g. "Line 01 Fabric Spreading Table"
  company?: string; // Company / Facility Name
  brand: string; // "Juki", "Featherlite", "Philips", "Almonard", "Eastman", "Godrej"
  model: string; // "DDL-8700-7", "Optima-360", "120W-LED"
  serialNo?: string; // Serial number of machine / equipment
  serialNumber?: string; // S/N alias
  mcNo?: string; // Machine number
  category?: AssetCategory; // Defaults to 'MACHINE' if absent
  department?: FactoryDepartment; // Factory department or plant section
  machineClass?: MachineClass; // 'OVERLOCK' | 'FLATLOCK' | 'SINGLE_NEEDLE'
  type: MachineType;
  typeName?: string; // e.g. "4 Thread Overlock"
  variety?: string; // Specific subtype/variety, e.g. "Hemming Flatlock (H.F/L)", "Rib Attacher (RIP O/L)", "4-Thread Overlock (MO-6714DA)"
  subType?: string;
  motorType?: MotorType;
  purchaseDate: string; // ISO format or YYYY-MM-DD
  cost: number; // INR (₹)
  status: MachineStatus;
  zone?: string; // Client Zone: "Zone 1", "Zone 2", ... "Zone 8"
  currentLine: FloorLine;
  stationNo: string; // e.g. "Station 04", "Cutting Bay", "Inspection Bay"
  unit?: string; // Plant Unit, e.g. "Unit 01", "Unit 02", "Unit 03"
  area?: string; // Located Area, e.g. "Sewing Floor", "Cutting Section", "Finishing Bay"
  operator?: string;
  totalDowntimeMinutes: number;
  ageYears?: number;
  specs?: string; // e.g. "12ft x 6ft Laminated Surface", "360° Swivel with Lumbar Support", "120W 6500K Day White"
  previousLine?: FloorLine; // Location where asset was held before
  previousStation?: string; // Station where asset was held before
  lastMovedAt?: string; // ISO date of last relocation
  lastMovedReason?: string;
  lastMovedBy?: string;
  relocationHistory?: {
    fromLine: FloorLine;
    fromStation: string;
    toLine: FloorLine;
    toStation: string;
    movedAt: string;
    movedBy?: string;
    reason?: string;
  }[];
}

export interface AssetLogEntry {
  id: string;
  machineId: string;
  machineName?: string;
  machineType?: string;
  brand?: string;
  model?: string;
  zone: string; // Zone 1 to Zone 8
  line: string; // Line 01 to Line 08
  stationNo?: string;
  unit?: string;
  machineUnit?: string;
  previousStatus: MachineStatus;
  newStatus: MachineStatus;
  action: 'IDLE_TO_ACTIVE' | 'ACTIVE_TO_IDLE' | 'STATUS_CHANGE' | 'ZONE_LINE_CHANGE';
  changedBy: string;
  changedAt: string; // ISO timestamp
  notes?: string;
  shift?: string;
}

export type PartCategory =
  | 'Needles'
  | 'Hooks & Loopers'
  | 'Feed & Plates'
  | 'Motors & Electrical'
  | 'Fluids & Consumables'
  | 'Knives & Cutters'
  | 'Pressure Feet'
  | 'Tension & Guides'
  | 'Mechanical & Fittings'
  | 'General'
  | (string & {});

export interface SparePart {
  sNo?: number;
  partId: string; // e.g., "SP-001"
  sku: string; // e.g., "FLT-NAV-001"
  name: string; // e.g., "NAVE SET"
  category: PartCategory;
  machineType?: string; // e.g., "FLATLOCK", "OVERLOCK", "SNLS", "GENERAL", etc.
  compat: string; // description of compatibility
  stock: number;
  minStock: number; // threshold for low-stock warning
  monthlyAllowance: number;
  unitCost: number; // INR (₹)
  unit: string; // e.g., "pcs", "units", "jugs"
  compatibleTypes: MachineType[];
  shelfLocation?: string; // e.g., "Rack B-03 • Bin 12"
  oldPartReturnRequired?: boolean;
  vendor?: string;
}

export type RepairUrgency = 'CRITICAL' | 'WARNING';
export type RepairStatus = 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';

export interface RepairPartUsage {
  partId: string;
  sku: string;
  name: string;
  quantity: number;
}

export interface RepairTicket {
  id: string; // e.g., "WO-1091"
  machineId: string;
  machineType: string;
  line: string;
  unit?: string;
  reportedAt: string; // ISO date string
  reportedBy: string;
  faultCategory: string; // e.g. "Skipping Stitches", "Needle Breakage", etc.
  faultDetails: string;
  urgency: RepairUrgency;
  status: RepairStatus;
  attendedBy: string | null;
  assignedBy?: string | null;
  startedAt?: string | null;
  resolvedAt: string | null;
  completedAt?: string | null;
  downtimeMinutes: number;
  actionTaken: string;
  partsUsed: RepairPartUsage[];
  // Extended repair details & cost tracking
  issuesIdentified?: string;
  repairCost?: number; // Total actual spent amount in ₹ INR
  laborCost?: number;
  partsCost?: number;
  completionProofImage?: string | null;
  linkedTicketId?: string;
}

export interface AppNotification {
  id: string;
  type: 'RESTOCK_ALERT' | 'SPARE_ISSUE_RECEIPT' | 'CRITICAL_BREAKDOWN' | 'GENERAL';
  title: string;
  message: string;
  targetRole?: UserRole | 'ALL';
  targetUserId?: string;
  targetUnit?: string;
  senderName: string;
  createdAt: string;
  acknowledged?: boolean;
  acknowledgedAt?: string;
  meta?: Record<string, any>;
}

export type PPMFrequency = 'Weekly' | 'Monthly' | '6-Month';
export type PPMStatus = 'PENDING' | 'DUE_SOON' | 'OVERDUE' | 'COMPLETED';

export interface PPMSchedule {
  id: string;
  machineId: string;
  unit?: string;
  task: string;
  intervalDays: number;
  frequency: PPMFrequency;
  lastServiced: string;
  nextDue: string;
  status: PPMStatus | 'IN_PROGRESS';
  assignedTo?: string;
  assignedBy?: string;
  startedAt?: string;
  completedAt?: string;
  completionProofImage?: string;
  actualDurationMinutes?: number;
  technicianNotes?: string;
}

export type UserRole =
  | 'CEO'
  | 'ADMIN'
  | 'SENIOR_MECHANIC'
  | 'MECHANIC'
  | 'SENIOR_ELECTRICIAN'
  | 'ELECTRICIAN'
  | 'STORE_PERSON'
  | 'ASSET_MANAGER'
  | (string & {});

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  title: string;
  phone?: string;
  department?: string;
  employeeId?: string;
  unit?: string; // Plant Unit: "All Units" | "UNIT - 1" | "UNIT-2"
  zones?: string[]; // Assigned Factory Zones e.g. ["NETHAJI", "PEACOCK 1"]
  company?: string; // Assigned Company Name from login / user account
  companySlug?: string; // Tenant slug (e.g. 'esstee')
  status?: 'ACTIVE' | 'INACTIVE';
  defaultPassword?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type RequisitionType = 'MONTHLY_INDENT' | 'URGENT_NEED' | 'CRITICAL_CEO';
export type RequisitionUrgency = 'ROUTINE' | 'URGENT_MANAGER' | 'CRITICAL_CEO_APPROVAL';
export type RequisitionStatus =
  | 'PENDING_CEO_APPROVAL'
  | 'PENDING_MANAGER_APPROVAL'
  | 'PENDING_REVIEW'
  | 'APPROVED_BY_CEO'
  | 'APPROVED_BY_MANAGER'
  | 'REJECTED'
  | 'ORDERED'
  | 'FULFILLED';

export interface RequisitionItem {
  partId: string;
  partName: string;
  sku: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
}

export interface PartRequisition {
  id: string; // e.g. "REQ-2026-081"
  type: RequisitionType;
  // For single-part requests (Critical / Urgent)
  partId?: string;
  partName?: string;
  sku?: string;
  quantity?: number;
  unit?: string;
  // For monthly indent with multiple items
  items?: RequisitionItem[];
  itemCount: number;
  estimatedCost: number; // total INR (₹)
  urgency: RequisitionUrgency;
  requiresCeoApproval: boolean;
  requestedBy: string; // mechanic name
  requestedByRole: string;
  monthYear: string; // e.g. "October 2026"
  targetLine?: string; // e.g. "Line 02"
  targetMachineId?: string; // e.g. "MC-OVK-204"
  machineId?: string;
  justification: string;
  status: RequisitionStatus;
  createdAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  // Store Person receipt and fulfillment tracking
  assignedStorePerson?: string; // e.g. "M. Arumugam (Stores In-Charge)"
  fulfilledAt?: string;
  storeNotes?: string;
}


