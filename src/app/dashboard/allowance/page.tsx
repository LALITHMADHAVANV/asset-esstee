'use client';

import { textValue } from '@/lib/textValue';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Wrench,
  Armchair,
  Zap,
  Truck,
  Search,
  MapPin,
  Calendar,
  Clock,
  Building2,
  Layers,
  ChevronDown,
  ChevronUp,
  Disc,
  Cog,
  Cpu,
  Scissors,
  CheckCircle2,
  X,
  Table as TableIcon,
  Sofa,
  DoorClosed,
  Sliders,
  Filter,
  AirVent,
  Fan,
  Lightbulb,
  Camera,
  Car,
  CarTaxiFront,
  Bus,
  IndianRupee,
  AlertTriangle,
  AlertCircle,
  TrendingUp,
  Sparkles,
  Download,
} from 'lucide-react';
import { Machine, AssetCategory, RepairTicket, PPMSchedule } from '@/types/cmms';
import { subscribeMachines, subscribeRepairs, subscribePPMSchedules } from '@/lib/services/cmmsService';
import { formatAssetLocation } from '@/lib/formatters';

// Standard 4 categories requested
type MainCategory = 'MACHINE' | 'FURNITURE' | 'UTILITY' | 'VEHICLE';

type MachineSubtype =
  | 'ALL'
  | 'OVERLOCK'
  | 'FLATLOCK'
  | 'SINGLE_NEEDLE'
  | 'SPECIAL_ELECTRONIC'
  | 'CUTTING_PRESSING';

type FurnitureSubtype =
  | 'ALL'
  | 'CHAIR'
  | 'TABLE'
  | 'OPERATOR_CHAIR'
  | 'SOFA'
  | 'DOOR';

type TableSpecificType =
  | 'ALL'
  | 'CHECKER_TABLE'
  | 'IRONING_TABLE'
  | 'WORK_TABLE'
  | 'OFFICE_TABLE'
  | 'CUTTING_TABLE';

type ChairSpecificType =
  | 'ALL'
  | 'OPERATOR_CHAIR'
  | 'OFFICE_CHAIR'
  | 'KUSAN_CHAIR';

// Electrical utilities subtypes requested: AC, fan, light, Camera
type UtilitySubtype = 'ALL' | 'AC' | 'FAN' | 'LIGHT' | 'CAMERA';

// Vehicle subtypes requested: car, auto, tempo, lorry, bus
type VehicleSubtype = 'ALL' | 'CAR' | 'AUTO' | 'TEMPO' | 'LORRY' | 'BUS';

interface AssetItem {
  id: string;
  name: string;
  company: string; // Brand / Manufacturer
  category: MainCategory;
  categoryLabel: string;
  machineSubtype?: MachineSubtype;
  furnitureSubtype?: FurnitureSubtype;
  tableSpecificType?: TableSpecificType;
  chairSpecificType?: ChairSpecificType;
  utilitySubtype?: UtilitySubtype;
  vehicleSubtype?: VehicleSubtype;
  purchaseDate: string;
  age: string;
  relocation: string; // Now occupied location / line & station
  status: string;
  cost?: number; // Real acquisition cost from Asset Registry
  monthlyAllowance?: number; // in ₹ INR
  spentAmount?: number; // in ₹ INR
  remainingBalance?: number; // in ₹ INR
  allowanceStatus?: 'WITHIN_BUDGET' | 'NEAR_LIMIT' | 'OVER_BUDGET';

  // Cost metrics requested by user
  purchasePrice?: number;
  totalRepairCost?: number;
  recentRepairCost?: number;
  preventiveMaintenancePrice?: number;
  predictedPreventiveCost?: number;
}

// Default mixed factory asset catalog items
const DEFAULT_MIXED_ASSETS: AssetItem[] = [
  // --- Machines ---
  {
    id: 'MC-OVK-101',
    name: '4-Thread High Speed Overlock (AZ-8000G)',
    company: 'Yamato',
    category: 'MACHINE',
    categoryLabel: 'Machine',
    machineSubtype: 'OVERLOCK',
    purchaseDate: '2022-03-15',
    age: '4.1 yrs',
    relocation: 'Line 01 • Station 04',
    status: 'ACTIVE',
  },
  {
    id: 'MC-SNLS-102',
    name: 'Direct-Drive Single Needle Lockstitch (DDL-8700)',
    company: 'Juki',
    category: 'MACHINE',
    categoryLabel: 'Machine',
    machineSubtype: 'SINGLE_NEEDLE',
    purchaseDate: '2021-08-15',
    age: '4.7 yrs',
    relocation: 'Line 02 • Station 01',
    status: 'ACTIVE',
  },
  {
    id: 'MC-BTN-103',
    name: 'Electronic Buttonhole Indexer Machine (HE-800B)',
    company: 'Brother',
    category: 'MACHINE',
    categoryLabel: 'Machine',
    machineSubtype: 'SPECIAL_ELECTRONIC',
    purchaseDate: '2020-11-20',
    age: '5.4 yrs',
    relocation: 'Line 01 • Station 09',
    status: 'ACTIVE',
  },
  {
    id: 'MC-FLK-104',
    name: 'Cylinder Bed Interlock Flatlock (W500PV)',
    company: 'Pegasus',
    category: 'MACHINE',
    categoryLabel: 'Machine',
    machineSubtype: 'FLATLOCK',
    purchaseDate: '2023-01-10',
    age: '3.3 yrs',
    relocation: 'Line 03 • Station 03',
    status: 'ACTIVE',
  },
  {
    id: 'MC-OVK-106',
    name: 'Rib Thread Attacher Overlock (AZ-8500)',
    company: 'Supreme',
    category: 'MACHINE',
    categoryLabel: 'Machine',
    machineSubtype: 'OVERLOCK',
    purchaseDate: '2022-07-19',
    age: '3.8 yrs',
    relocation: 'Line 01 • Station 06',
    status: 'ACTIVE',
  },
  {
    id: 'MC-CUT-105',
    name: 'Blue Streak II 8-inch Straight Knife Cutter',
    company: 'Eastman',
    category: 'MACHINE',
    categoryLabel: 'Machine',
    machineSubtype: 'CUTTING_PRESSING',
    purchaseDate: '2021-05-18',
    age: '4.9 yrs',
    relocation: 'Cutting Department • Bay 01',
    status: 'ACTIVE',
  },

  // --- Furniture: Tables ---
  {
    id: 'FUR-TBL-201',
    name: 'Fabric Spreading & Cutting Master Table (12ft x 6ft)',
    company: 'Godrej Interio',
    category: 'FURNITURE',
    categoryLabel: 'Furniture',
    furnitureSubtype: 'TABLE',
    tableSpecificType: 'CUTTING_TABLE',
    purchaseDate: '2020-02-14',
    age: '6.2 yrs',
    relocation: 'Cutting Bay • Station 02',
    status: 'ACTIVE',
  },
  {
    id: 'FUR-TBL-203',
    name: 'Checker Table (QC Garment Checking Inspection Table)',
    company: 'SteelCraft Industrial',
    category: 'FURNITURE',
    categoryLabel: 'Furniture',
    furnitureSubtype: 'TABLE',
    tableSpecificType: 'CHECKER_TABLE',
    purchaseDate: '2022-09-05',
    age: '3.6 yrs',
    relocation: 'Quality Bay • Station 01',
    status: 'ACTIVE',
  },
  {
    id: 'FUR-TBL-205',
    name: 'Ironing Table (Vacuum Suction Steam Pressing Table)',
    company: 'Ramsons Garment Machinery',
    category: 'FURNITURE',
    categoryLabel: 'Furniture',
    furnitureSubtype: 'TABLE',
    tableSpecificType: 'IRONING_TABLE',
    purchaseDate: '2021-08-10',
    age: '4.7 yrs',
    relocation: 'Finishing Bay • Ironing Bay 02',
    status: 'ACTIVE',
  },
  {
    id: 'FUR-TBL-206',
    name: 'Work Table (Sewing Line Modular Workstation Assembly Table)',
    company: 'Godrej Interio',
    category: 'FURNITURE',
    categoryLabel: 'Furniture',
    furnitureSubtype: 'TABLE',
    tableSpecificType: 'WORK_TABLE',
    purchaseDate: '2022-03-18',
    age: '4.1 yrs',
    relocation: 'Line 01 • Staging Bay',
    status: 'ACTIVE',
  },
  {
    id: 'FUR-TBL-207',
    name: 'Office Table (Supervisor Modular L-Shape Admin Desk)',
    company: 'Featherlite Workspaces',
    category: 'FURNITURE',
    categoryLabel: 'Furniture',
    furnitureSubtype: 'TABLE',
    tableSpecificType: 'OFFICE_TABLE',
    purchaseDate: '2021-06-20',
    age: '4.8 yrs',
    relocation: 'Line 02 • Supervisor Desk',
    status: 'ACTIVE',
  },

  // --- Furniture: Chairs & Operator Chairs ---
  {
    id: 'FUR-CHR-202',
    name: 'Operator Chair (Ergonomic Sewing Machine Swivel Operator Chair)',
    company: 'Featherlite',
    category: 'FURNITURE',
    categoryLabel: 'Furniture',
    furnitureSubtype: 'OPERATOR_CHAIR',
    chairSpecificType: 'OPERATOR_CHAIR',
    purchaseDate: '2023-06-22',
    age: '2.8 yrs',
    relocation: 'Line 01 • Station 04',
    status: 'ACTIVE',
  },
  {
    id: 'FUR-CHR-204',
    name: 'Office Chair (High-Back Executive Supervisor Chair)',
    company: 'Featherlite',
    category: 'FURNITURE',
    categoryLabel: 'Furniture',
    furnitureSubtype: 'CHAIR',
    chairSpecificType: 'OFFICE_CHAIR',
    purchaseDate: '2021-12-01',
    age: '4.4 yrs',
    relocation: 'Admin Office • Cabin 01',
    status: 'ACTIVE',
  },
  {
    id: 'FUR-CHR-208',
    name: 'Kusan Chair (Padded Cushion Workshop Line Chair)',
    company: 'Godrej Interio',
    category: 'FURNITURE',
    categoryLabel: 'Furniture',
    furnitureSubtype: 'CHAIR',
    chairSpecificType: 'KUSAN_CHAIR',
    purchaseDate: '2022-04-18',
    age: '4.0 yrs',
    relocation: 'Line 03 • Inspection Bay',
    status: 'ACTIVE',
  },
  {
    id: 'FUR-CHR-209',
    name: 'Operator Chair (Adjustable Footring High Stool Operator Chair)',
    company: 'Nilkamal Furniture',
    category: 'FURNITURE',
    categoryLabel: 'Furniture',
    furnitureSubtype: 'OPERATOR_CHAIR',
    chairSpecificType: 'OPERATOR_CHAIR',
    purchaseDate: '2023-01-15',
    age: '3.2 yrs',
    relocation: 'Line 04 • Station 08',
    status: 'ACTIVE',
  },

  // --- Furniture: Sofa ---
  {
    id: 'FUR-SOF-210',
    name: 'Sofa (Executive 3-Seater Leatherette Visitor Lounge Sofa)',
    company: 'Godrej Interio',
    category: 'FURNITURE',
    categoryLabel: 'Furniture',
    furnitureSubtype: 'SOFA',
    purchaseDate: '2021-03-10',
    age: '5.1 yrs',
    relocation: 'Floor Reception & Visitor Lounge',
    status: 'ACTIVE',
  },
  {
    id: 'FUR-SOF-211',
    name: 'Sofa (2-Seater Fabric Restroom & Office Lounge Sofa)',
    company: 'Durian Furniture',
    category: 'FURNITURE',
    categoryLabel: 'Furniture',
    furnitureSubtype: 'SOFA',
    purchaseDate: '2022-07-22',
    age: '3.7 yrs',
    relocation: 'Plant Manager Office',
    status: 'ACTIVE',
  },

  // --- Furniture: Door ---
  {
    id: 'FUR-DOR-212',
    name: 'Door (Emergency Fire Exit Acoustic Steel Door)',
    company: 'Shakti Met-Dor',
    category: 'FURNITURE',
    categoryLabel: 'Furniture',
    furnitureSubtype: 'DOOR',
    purchaseDate: '2019-11-05',
    age: '6.4 yrs',
    relocation: 'Line 01 • Exit Gate 02',
    status: 'ACTIVE',
  },
  {
    id: 'FUR-DOR-213',
    name: 'Door (Soundproof Workshop Double Leaf Partition Door)',
    company: 'Tata Steel Pravesh',
    category: 'FURNITURE',
    categoryLabel: 'Furniture',
    furnitureSubtype: 'DOOR',
    purchaseDate: '2020-05-12',
    age: '5.9 yrs',
    relocation: 'Maintenance Workshop Entry',
    status: 'ACTIVE',
  },

  // --- Electrical Utilities: AC, Fan, Light, Camera ---
  {
    id: 'UTL-AC-301',
    name: '2.0 Ton Inverter Split Air Conditioner (FTKF60TV)',
    company: 'Daikin',
    category: 'UTILITY',
    categoryLabel: 'Electrical Utilities',
    utilitySubtype: 'AC',
    purchaseDate: '2022-04-10',
    age: '4.0 yrs',
    relocation: 'Admin & QA Lab • Server Room',
    status: 'ACTIVE',
  },
  {
    id: 'UTL-AC-302',
    name: '8.5 Ton Central Ductable Commercial Packaging AC',
    company: 'Voltas',
    category: 'UTILITY',
    categoryLabel: 'Electrical Utilities',
    utilitySubtype: 'AC',
    purchaseDate: '2021-03-15',
    age: '5.1 yrs',
    relocation: 'Sewing Floor • Central Duct Bay',
    status: 'ACTIVE',
  },
  {
    id: 'UTL-FAN-303',
    name: 'Heavy Duty 24-inch Industrial Pedestal Air Fan',
    company: 'Almonard',
    category: 'UTILITY',
    categoryLabel: 'Electrical Utilities',
    utilitySubtype: 'FAN',
    purchaseDate: '2021-06-20',
    age: '4.8 yrs',
    relocation: 'Line 02 • Station 05',
    status: 'ACTIVE',
  },
  {
    id: 'UTL-FAN-304',
    name: 'High-Velocity Wall Exhaust Blower Ventilation Fan (36-inch)',
    company: 'Havells',
    category: 'UTILITY',
    categoryLabel: 'Electrical Utilities',
    utilitySubtype: 'FAN',
    purchaseDate: '2020-09-12',
    age: '5.6 yrs',
    relocation: 'Sewing Floor • North Wall Bay',
    status: 'ACTIVE',
  },
  {
    id: 'UTL-LGT-305',
    name: '120W High-Bay Linear LED Workstation Grid Light',
    company: 'Philips Industrial',
    category: 'UTILITY',
    categoryLabel: 'Electrical Utilities',
    utilitySubtype: 'LIGHT',
    purchaseDate: '2022-01-25',
    age: '4.2 yrs',
    relocation: 'Line 01 • Overhead Bay',
    status: 'ACTIVE',
  },
  {
    id: 'UTL-LGT-306',
    name: '45W Continuous Diffused Shadowless Inspection Light',
    company: 'Wipro Lighting',
    category: 'UTILITY',
    categoryLabel: 'Electrical Utilities',
    utilitySubtype: 'LIGHT',
    purchaseDate: '2023-03-18',
    age: '3.1 yrs',
    relocation: 'QC Inspection Bay • Station 02',
    status: 'ACTIVE',
  },
  {
    id: 'UTL-CAM-307',
    name: '4MP PTZ ColorVu 360° Dome CCTV Camera',
    company: 'Hikvision',
    category: 'UTILITY',
    categoryLabel: 'Electrical Utilities',
    utilitySubtype: 'CAMERA',
    purchaseDate: '2022-08-05',
    age: '3.7 yrs',
    relocation: 'Main Factory Gate & Dispatch Bay',
    status: 'ACTIVE',
  },
  {
    id: 'UTL-CAM-308',
    name: '5MP Outdoor IR Night Vision Bullet Surveillance Camera',
    company: 'CP Plus',
    category: 'UTILITY',
    categoryLabel: 'Electrical Utilities',
    utilitySubtype: 'CAMERA',
    purchaseDate: '2021-11-20',
    age: '4.4 yrs',
    relocation: 'Raw Material Warehouse • Bay 03',
    status: 'ACTIVE',
  },

  // --- Vehicles: Car, Auto, Tempo, Lorry, Bus ---
  {
    id: 'VEH-CAR-401',
    name: 'Swift VXi 1.2L DualJet (Staff Field Pool Car)',
    company: 'Maruti Suzuki',
    category: 'VEHICLE',
    categoryLabel: 'Vehicle',
    vehicleSubtype: 'CAR',
    purchaseDate: '2022-02-14',
    age: '4.2 yrs',
    relocation: 'Parking Yard • Bay A-01',
    status: 'ACTIVE',
  },
  {
    id: 'VEH-CAR-402',
    name: 'Innova Crysta 2.4 VX (Executive Inspection Car)',
    company: 'Toyota',
    category: 'VEHICLE',
    categoryLabel: 'Vehicle',
    vehicleSubtype: 'CAR',
    purchaseDate: '2021-07-28',
    age: '4.7 yrs',
    relocation: 'Admin Portico • Bay 01',
    status: 'ACTIVE',
  },
  {
    id: 'VEH-AUT-403',
    name: 'Compact RE 4-Stroke CNG Passenger Auto Rickshaw',
    company: 'Bajaj Auto',
    category: 'VEHICLE',
    categoryLabel: 'Vehicle',
    vehicleSubtype: 'AUTO',
    purchaseDate: '2022-10-10',
    age: '3.5 yrs',
    relocation: 'Factory Internal Transit • Gate 01',
    status: 'ACTIVE',
  },
  {
    id: 'VEH-AUT-404',
    name: 'Ape City Plus CNG 3-Wheeler Auto',
    company: 'Piaggio',
    category: 'VEHICLE',
    categoryLabel: 'Vehicle',
    vehicleSubtype: 'AUTO',
    purchaseDate: '2023-04-15',
    age: '3.0 yrs',
    relocation: 'Staff Transit • Gate 03',
    status: 'ACTIVE',
  },
  {
    id: 'VEH-TMP-405',
    name: 'Ace Gold Diesel Mini Tempo (Chota Hathi)',
    company: 'Tata Motors',
    category: 'VEHICLE',
    categoryLabel: 'Vehicle',
    vehicleSubtype: 'TEMPO',
    purchaseDate: '2021-05-18',
    age: '4.9 yrs',
    relocation: 'Loading Dock 01 • Fabric Dispatch',
    status: 'ACTIVE',
  },
  {
    id: 'VEH-TMP-406',
    name: 'Bolero Maxi Truck Plus Commercial Cargo Tempo',
    company: 'Mahindra',
    category: 'VEHICLE',
    categoryLabel: 'Vehicle',
    vehicleSubtype: 'TEMPO',
    purchaseDate: '2020-11-22',
    age: '5.4 yrs',
    relocation: 'Accessories Receiving Bay • Dock 03',
    status: 'ACTIVE',
  },
  {
    id: 'VEH-LRY-407',
    name: 'Tata 1618 Heavy Goods Carrier Lorry (6-Wheeler)',
    company: 'Tata Motors',
    category: 'VEHICLE',
    categoryLabel: 'Vehicle',
    vehicleSubtype: 'LORRY',
    purchaseDate: '2022-09-08',
    age: '3.6 yrs',
    relocation: 'Packaging & Logistics Dispatch Unit',
    status: 'ACTIVE',
  },
  {
    id: 'VEH-LRY-408',
    name: 'Ashok Leyland 1920 Long Haul Freight Lorry',
    company: 'Ashok Leyland',
    category: 'VEHICLE',
    categoryLabel: 'Vehicle',
    vehicleSubtype: 'LORRY',
    purchaseDate: '2023-01-20',
    age: '3.2 yrs',
    relocation: 'Finished Goods Export Bay',
    status: 'ACTIVE',
  },
  {
    id: 'VEH-BUS-409',
    name: 'Starbus Ultra 34-Seater Staff Commuter Bus',
    company: 'Tata Motors',
    category: 'VEHICLE',
    categoryLabel: 'Vehicle',
    vehicleSubtype: 'BUS',
    purchaseDate: '2019-12-05',
    age: '6.3 yrs',
    relocation: 'Route 01 • Main Plant Bus Bay',
    status: 'ACTIVE',
  },
  {
    id: 'VEH-BUS-410',
    name: 'Oyster 40-Seater Worker Transit Bus',
    company: 'Ashok Leyland',
    category: 'VEHICLE',
    categoryLabel: 'Vehicle',
    vehicleSubtype: 'BUS',
    purchaseDate: '2020-03-14',
    age: '6.1 yrs',
    relocation: 'Route 02 • Sub-Contracting Unit',
    status: 'ACTIVE',
  },
];

// Helper to determine machine subtype from name/type/id
function detectMachineSubtype(name: string, type: string, id: string): MachineSubtype {
  const s = `${name} ${type} ${id}`.toUpperCase();
  if (s.includes('OVERLOCK') || s.includes('OVK') || s.includes('LFC') || s.includes('RIB')) return 'OVERLOCK';
  if (s.includes('FLATLOCK') || s.includes('FLK') || s.includes('INTERLOCK') || s.includes('CYLINDER')) return 'FLATLOCK';
  if (s.includes('BUTTON') || s.includes('BTN') || s.includes('BARTACK') || s.includes('KAJA')) return 'SPECIAL_ELECTRONIC';
  if (s.includes('CUTTER') || s.includes('KNIFE') || s.includes('CUT') || s.includes('FUSING') || s.includes('PRESS')) return 'CUTTING_PRESSING';
  return 'SINGLE_NEEDLE';
}

// Helper to determine furniture subtype and specific types from name/id
function detectFurnitureSubtypes(name: string, id: string): {
  sub: FurnitureSubtype;
  tableType?: TableSpecificType;
  chairType?: ChairSpecificType;
} {
  const s = `${name} ${id}`.toUpperCase();

  // 1. Sofa
  if (s.includes('SOFA') || s.includes('COUCH') || s.includes('LOUNGE')) {
    return { sub: 'SOFA' };
  }

  // 2. Door
  if (s.includes('DOOR') || s.includes('GATE') || s.includes('PARTITION')) {
    return { sub: 'DOOR' };
  }

  // 3. Table
  if (s.includes('TABLE') || s.includes('DESK') || s.includes('TBL')) {
    let tType: TableSpecificType = 'WORK_TABLE';
    if (s.includes('CHECKER') || s.includes('INSPECTION') || s.includes('QC')) tType = 'CHECKER_TABLE';
    else if (s.includes('IRONING') || s.includes('STEAM') || s.includes('PRESS')) tType = 'IRONING_TABLE';
    else if (s.includes('OFFICE') || s.includes('SUPERVISOR') || s.includes('ADMIN')) tType = 'OFFICE_TABLE';
    else if (s.includes('CUTTING') || s.includes('SPREADING')) tType = 'CUTTING_TABLE';
    return { sub: 'TABLE', tableType: tType };
  }

  // 4. Chair / Operator Chair
  let cType: ChairSpecificType = 'OFFICE_CHAIR';
  let isOpChair = false;
  if (s.includes('OPERATOR') || s.includes('SEWING CHAIR')) {
    cType = 'OPERATOR_CHAIR';
    isOpChair = true;
  } else if (s.includes('KUSAN') || s.includes('CUSHION') || s.includes('STOOL')) {
    cType = 'KUSAN_CHAIR';
  }

  return {
    sub: isOpChair ? 'OPERATOR_CHAIR' : 'CHAIR',
    chairType: cType,
  };
}

// Helper to determine utility subtype (AC, Fan, Light, Camera) from name/id
function detectUtilitySubtype(name: string, type: string, id: string): UtilitySubtype {
  const s = `${name} ${type} ${id}`.toUpperCase();
  if (s.includes('AIR CONDITION') || s.includes('AC') || s.includes('HVAC') || s.includes('SPLIT') || s.includes('COOLER') || s.includes('DUCTABLE')) return 'AC';
  if (s.includes('FAN') || s.includes('BLOWER') || s.includes('EXHAUST') || s.includes('PEDESTAL') || s.includes('VENTILAT')) return 'FAN';
  if (s.includes('LIGHT') || s.includes('LAMP') || s.includes('LED') || s.includes('TUBE') || s.includes('BAY') || s.includes('DIFFUSED')) return 'LIGHT';
  if (s.includes('CAMERA') || s.includes('CCTV') || s.includes('CAM') || s.includes('SURVEILLANCE') || s.includes('DOME') || s.includes('BULLET')) return 'CAMERA';
  return 'AC';
}

// Helper to determine vehicle subtype (Car, Auto, Tempo, Lorry, Bus) from name/id
function detectVehicleSubtype(name: string, type: string, id: string): VehicleSubtype {
  const s = `${name} ${type} ${id}`.toUpperCase();
  if (s.includes('BUS') || s.includes('STARBUS') || s.includes('OYSTER') || s.includes('COACH')) return 'BUS';
  if (s.includes('LORRY') || s.includes('LRY') || s.includes('VAN') || s.includes('EECO') || s.includes('OMNI') || s.includes('URBANIA') || s.includes('MINIVAN') || s.includes('FREIGHT') || s.includes('HAUL')) return 'LORRY';
  if (s.includes('TEMPO') || s.includes('ACE') || s.includes('BOLERO') || s.includes('PICKUP') || s.includes('TROLLEY') || s.includes('PALLET') || s.includes('FORKLIFT') || s.includes('TRUCK')) return 'TEMPO';
  if (s.includes('AUTO') || s.includes('RICKSHAW') || s.includes('APE') || s.includes('3 WHEEL')) return 'AUTO';
  if (s.includes('CAR') || s.includes('SWIFT') || s.includes('INNOVA') || s.includes('SEDAN') || s.includes('SUV')) return 'CAR';
  return 'CAR';
}

// Helper to calculate age in years from date
function calculateAge(dateStr: string): string {
  if (!dateStr) return '1.0 yr';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const years = diffMs / (1000 * 60 * 60 * 24 * 365.25);
  if (isNaN(years) || years < 0) return '0.5 yr';
  return `${years.toFixed(1)} yrs`;
}

// Helper to determine asset subcategory title
function getAssetSubCategory(item: AssetItem): string {
  if (item.category === 'MACHINE') {
    if (item.machineSubtype === 'OVERLOCK') return 'Overlock Machine';
    if (item.machineSubtype === 'FLATLOCK') return 'Flatlock Machine';
    if (item.machineSubtype === 'SINGLE_NEEDLE') return 'Single Needle Machine';
    if (item.machineSubtype === 'SPECIAL_ELECTRONIC') return 'Buttonhole & Electronic';
    if (item.machineSubtype === 'CUTTING_PRESSING') return 'Cutting & Pressing';
    return 'Industrial Machine';
  }
  if (item.category === 'FURNITURE') {
    if (item.tableSpecificType) {
      return item.tableSpecificType.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
    }
    if (item.chairSpecificType) {
      return item.chairSpecificType.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
    }
    if (item.furnitureSubtype === 'OPERATOR_CHAIR') return 'Operator Chair';
    if (item.furnitureSubtype === 'SOFA') return 'Sofa';
    if (item.furnitureSubtype === 'DOOR') return 'Door';
    if (item.furnitureSubtype === 'TABLE') return 'Work Table';
    if (item.furnitureSubtype === 'CHAIR') return 'Office Chair';
    return 'Furniture';
  }
  if (item.category === 'UTILITY') {
    if (item.utilitySubtype === 'AC') return 'Air Conditioner (AC)';
    if (item.utilitySubtype === 'FAN') return 'Ventilation Fan';
    if (item.utilitySubtype === 'LIGHT') return 'High-Bay / LED Light';
    if (item.utilitySubtype === 'CAMERA') return 'CCTV Surveillance Camera';
    return 'Electrical Utility';
  }
  if (item.category === 'VEHICLE') {
    if (item.vehicleSubtype === 'CAR') return 'Pool Car';
    if (item.vehicleSubtype === 'AUTO') return 'Passenger Auto';
    if (item.vehicleSubtype === 'TEMPO') return 'Cargo Tempo';
    if (item.vehicleSubtype === 'LORRY') return 'Heavy Freight Lorry';
    if (item.vehicleSubtype === 'BUS') return 'Commuter Bus';
    return 'Vehicle Fleet';
  }
  return 'Standard Asset';
}

// Helper to determine location department/line
function getAssetLocation(item: AssetItem): string {
  if (!item.relocation) return 'Main Facility';
  const parts = item.relocation.split('•');
  return textValue(parts[0]).trim();
}

// Helper to detect if asset has been relocated
function isItemRelocated(item: AssetItem, liveMachines: Machine[] = []): boolean {
  const m = liveMachines.find((mach) => textValue(mach.id).toLowerCase() === textValue(item.id).toLowerCase());
  if (m) {
    if (m.relocationHistory && m.relocationHistory.length > 0) return true;
    if (m.previousLine && m.previousLine !== m.currentLine) return true;
    if (m.lastMovedReason && textValue(m.lastMovedReason).toLowerCase().includes('reloc')) return true;
  }
  if (item.id.includes('104') || item.id.includes('204') || item.id.includes('304') || item.id.includes('404')) {
    return true;
  }
  return false;
}

// Helper to map AssetCategory to the 4 main groups
function mapToMainCategory(cat?: AssetCategory): MainCategory {
  if (!cat) return 'MACHINE';
  if (cat === 'MACHINE') return 'MACHINE';
  if (cat === 'FURNITURE' || cat === 'TABLE' || cat === 'CHAIR') return 'FURNITURE';
  if (cat === 'VEHICLE') return 'VEHICLE';
  return 'UTILITY';
}

// Helper to calculate maintenance allowances and actual occurring lifecycle costs for assets
function getAllowanceData(
  id: string,
  category: MainCategory,
  actualCost?: number,
  machineRepairs: RepairTicket[] = [],
  machinePpm: PPMSchedule[] = []
): {
  monthlyAllowance: number;
  spentAmount: number;
  remainingBalance: number;
  allowanceStatus: 'WITHIN_BUDGET' | 'NEAR_LIMIT' | 'OVER_BUDGET';
  purchasePrice: number;
  totalRepairCost: number;
  recentRepairCost: number;
  preventiveMaintenancePrice: number;
  predictedPreventiveCost: number;
} {
  let seed = 0;
  for (let i = 0; i < id.length; i++) {
    seed = (seed * 31 + id.charCodeAt(i)) % 10000;
  }

  let baseAllowance = 15000;
  // If actual acquisition cost is provided from Asset Registry, match it exactly!
  let purchasePrice = typeof actualCost === 'number' && actualCost > 0 ? actualCost : 75000;
  if (category === 'MACHINE') {
    baseAllowance = 16000 + (seed % 10) * 1500; // ₹16,000 - ₹29,500
    if (!(typeof actualCost === 'number' && actualCost > 0)) {
      purchasePrice = 65000 + (seed % 15) * 8000; // ₹65,000 - ₹1,77,000
    }
  } else if (category === 'FURNITURE') {
    baseAllowance = 3000 + (seed % 6) * 600; // ₹3,000 - ₹6,000
    if (!(typeof actualCost === 'number' && actualCost > 0)) {
      purchasePrice = 4500 + (seed % 10) * 1800; // ₹4,500 - ₹20,700
    }
  } else if (category === 'UTILITY') {
    baseAllowance = 7000 + (seed % 8) * 1200; // ₹7,000 - ₹15,400
    if (!(typeof actualCost === 'number' && actualCost > 0)) {
      purchasePrice = 14000 + (seed % 12) * 4500; // ₹14,000 - ₹63,500
    }
  } else if (category === 'VEHICLE') {
    baseAllowance = 24000 + (seed % 12) * 2000; // ₹24,000 - ₹46,000
    if (!(typeof actualCost === 'number' && actualCost > 0)) {
      purchasePrice = 180000 + (seed % 16) * 75000; // ₹1,80,000 - ₹13,05,000
    }
  }

  // 1. Repair costs - ONLY display when repair actually occurs
  let totalRepairCost = 0;
  let recentRepairCost = 0;

  if (machineRepairs.length > 0) {
    totalRepairCost = machineRepairs.reduce((sum, r) => {
      const cost =
        typeof r.repairCost === 'number' && r.repairCost >= 0
          ? r.repairCost
          : r.partsUsed && r.partsUsed.length > 0
          ? r.partsUsed.reduce((s, p) => sum + (p.quantity || 1) * 350, 0)
          : (r.status === 'COMPLETED' ? 450 : 250);
      return sum + cost;
    }, 0);

    const sortedRepairs = [...machineRepairs].sort(
      (a, b) => new Date(b.reportedAt || 0).getTime() - new Date(a.reportedAt || 0).getTime()
    );
    const mostRecent = sortedRepairs[0];
    recentRepairCost =
      typeof mostRecent.repairCost === 'number' && mostRecent.repairCost >= 0
        ? mostRecent.repairCost
        : mostRecent.partsUsed && mostRecent.partsUsed.length > 0
        ? mostRecent.partsUsed.reduce((s, p) => s + (p.quantity || 1) * 350, 0)
        : (mostRecent.status === 'COMPLETED' ? 450 : 250);
  }

  // 2. Preventive maintenance price - ONLY display when completed PPM occurs
  const completedPpm = machinePpm.filter((p) => p.status === 'COMPLETED' || !!p.lastServiced);
  const pendingPpm = machinePpm.filter(
    (p) => p.status === 'PENDING' || p.status === 'DUE_SOON' || p.status === 'OVERDUE' || p.status === 'IN_PROGRESS'
  );

  const preventiveMaintenancePrice = completedPpm.length > 0 ? completedPpm.length * 450 : 0;
  const predictedPreventiveCost = pendingPpm.length > 0 ? pendingPpm.length * 450 : (completedPpm.length > 0 ? 450 : 0);

  // 3. Spent Amount and Remaining Balance
  const spentAmount = totalRepairCost + preventiveMaintenancePrice;
  const remainingBalance = baseAllowance - spentAmount;
  let allowanceStatus: 'WITHIN_BUDGET' | 'NEAR_LIMIT' | 'OVER_BUDGET' = 'WITHIN_BUDGET';
  if (remainingBalance < 0) {
    allowanceStatus = 'OVER_BUDGET';
  } else if (baseAllowance > 0 && spentAmount / baseAllowance >= 0.85) {
    allowanceStatus = 'NEAR_LIMIT';
  }

  return {
    monthlyAllowance: baseAllowance,
    spentAmount,
    remainingBalance,
    allowanceStatus,
    purchasePrice,
    totalRepairCost,
    recentRepairCost,
    preventiveMaintenancePrice,
    predictedPreventiveCost,
  };
}

export type TimeFilterPeriod = 'WEEK' | 'MONTH' | 'YEAR' | 'CUSTOM';

function formatToYMD(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getWeekRange(refDate = new Date()) {
  const d = new Date(refDate);
  const day = d.getDay(); // 0 is Sun, 1 is Mon...
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    startDate: formatToYMD(monday),
    endDate: formatToYMD(sunday),
  };
}

function getMonthRange(refDate = new Date()) {
  const d = new Date(refDate);
  const firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return {
    startDate: formatToYMD(firstDay),
    endDate: formatToYMD(lastDay),
  };
}

function getYearRange(refDate = new Date()) {
  const d = new Date(refDate);
  const firstDay = new Date(d.getFullYear(), 0, 1);
  const lastDay = new Date(d.getFullYear(), 11, 31);
  return {
    startDate: formatToYMD(firstDay),
    endDate: formatToYMD(lastDay),
  };
}

function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const d = new Date(year, month, day);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function AllowancePage() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [repairs, setRepairs] = useState<RepairTicket[]>([]);
  const [ppmList, setPpmList] = useState<PPMSchedule[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<MainCategory | 'ALL'>('ALL');

  // Time period filter ('WEEK' | 'MONTH' | 'YEAR' | 'CUSTOM')
  const [timePeriod, setTimePeriod] = useState<TimeFilterPeriod>('MONTH');
  const [startDate, setStartDate] = useState<string>(() => getMonthRange().startDate);
  const [endDate, setEndDate] = useState<string>(() => getMonthRange().endDate);

  const handlePeriodSelect = (period: TimeFilterPeriod) => {
    setTimePeriod(period);
    if (period === 'WEEK') {
      const { startDate: s, endDate: e } = getWeekRange();
      setStartDate(s);
      setEndDate(e);
    } else if (period === 'MONTH') {
      const { startDate: s, endDate: e } = getMonthRange();
      setStartDate(s);
      setEndDate(e);
    } else if (period === 'YEAR') {
      const { startDate: s, endDate: e } = getYearRange();
      setStartDate(s);
      setEndDate(e);
    }
  };

  // Scaling multiplier relative to 1 calendar month (30.4 days)
  const periodMultiplier = useMemo(() => {
    if (timePeriod === 'WEEK') return 7 / 30.4;
    if (timePeriod === 'MONTH') return 1.0;
    if (timePeriod === 'YEAR') return 12.0;
    if (!startDate || !endDate) return 1.0;
    const s = new Date(startDate + 'T00:00:00').getTime();
    const e = new Date(endDate + 'T00:00:00').getTime();
    if (isNaN(s) || isNaN(e) || e < s) return 1.0;
    const days = Math.max(1, Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1);
    return days / 30.4;
  }, [timePeriod, startDate, endDate]);

  // Drawer states
  const [activeDrawer, setActiveDrawer] = useState<'NONE' | 'MACHINE' | 'FURNITURE' | 'UTILITY' | 'VEHICLE'>('NONE');

  // Machine subtype filter
  const [selectedMachineSubtype, setSelectedMachineSubtype] = useState<MachineSubtype>('ALL');

  // Furniture subtype filters
  const [selectedFurnitureSubtype, setSelectedFurnitureSubtype] = useState<FurnitureSubtype>('ALL');
  const [activeFurnitureTab, setActiveFurnitureTab] = useState<'TABLE' | 'CHAIR' | 'SOFA' | 'DOOR' | 'ALL'>('TABLE');
  const [selectedTableType, setSelectedTableType] = useState<TableSpecificType>('ALL');
  const [selectedChairType, setSelectedChairType] = useState<ChairSpecificType>('ALL');
  const [tableSearchQuery, setTableSearchQuery] = useState('');
  const [chairSearchQuery, setChairSearchQuery] = useState('');
  const [furnitureSearchQuery, setFurnitureSearchQuery] = useState('');

  // Utility subtype filter (AC, Fan, Light, Camera)
  const [selectedUtilitySubtype, setSelectedUtilitySubtype] = useState<UtilitySubtype>('ALL');

  // Vehicle subtype filter (Car, Auto, Tempo, Lorry, Bus)
  const [selectedVehicleSubtype, setSelectedVehicleSubtype] = useState<VehicleSubtype>('ALL');

  // Budget status filter (All, Within Budget, Near Limit, Over Budget)
  const [budgetFilter, setBudgetFilter] = useState<'ALL' | 'WITHIN_BUDGET' | 'NEAR_LIMIT' | 'OVER_BUDGET'>('ALL');

  // General search query
  const [searchQuery, setSearchQuery] = useState('');

  // Cascading & Dimensional Filters matching History page
  const [subCategoryFilter, setSubCategoryFilter] = useState<string>('ALL');
  const [locationFilter, setLocationFilter] = useState<string>('ALL');
  const [repairCostFilter, setRepairCostFilter] = useState<'ALL' | 'HAS_COST' | 'ZERO' | 'UNDER_500' | '500_TO_1500' | 'OVER_1500'>('ALL');
  const [preventiveCostFilter, setPreventiveCostFilter] = useState<'ALL' | 'HAS_COST' | 'ZERO' | 'UNDER_1500' | '1500_TO_3500' | 'OVER_3500'>('ALL');
  const [purchaseFromDate, setPurchaseFromDate] = useState<string>('');
  const [purchaseToDate, setPurchaseToDate] = useState<string>('');
  const [groupBy, setGroupBy] = useState<'NONE' | 'CATEGORY' | 'SUBCATEGORY' | 'LOCATION' | 'RELOCATION' | 'BUDGET'>('NONE');
  const [collapsedSections, setCollapsedSections] = useState<string[]>([]);

  // Subscribe to machines, repairs, and PPM schedules from DB/API
  useEffect(() => {
    const unsubMachines = subscribeMachines((data) => {
      setMachines(data);
    });
    const unsubRepairs = subscribeRepairs((data) => {
      setRepairs(data);
    });
    const unsubPpm = subscribePPMSchedules((data) => {
      setPpmList(data);
    });
    return () => {
      unsubMachines();
      unsubRepairs();
      unsubPpm();
    };
  }, []);

  // Merge registered machines from MongoDB with the sample catalog
  const allItems: AssetItem[] = useMemo(() => {
    const dbItems: AssetItem[] = machines.map((m) => {
      const cat = mapToMainCategory(m.category);
      const catLabel =
        cat === 'MACHINE'
          ? 'Machine'
          : cat === 'FURNITURE'
          ? 'Furniture'
          : cat === 'UTILITY'
          ? 'Electrical Utilities'
          : 'Vehicle';

      const occupied = formatAssetLocation(m);

      let mSubtype: MachineSubtype | undefined;
      let fSubtype: FurnitureSubtype | undefined;
      let tType: TableSpecificType | undefined;
      let cType: ChairSpecificType | undefined;
      let uSubtype: UtilitySubtype | undefined;
      let vSubtype: VehicleSubtype | undefined;

      if (cat === 'MACHINE') {
        mSubtype = detectMachineSubtype(m.name || '', m.typeName || m.type || '', m.id);
      } else if (cat === 'FURNITURE') {
        const detected = detectFurnitureSubtypes(m.name || '', m.id);
        fSubtype = detected.sub;
        tType = detected.tableType;
        cType = detected.chairType;
      } else if (cat === 'UTILITY') {
        uSubtype = detectUtilitySubtype(m.name || '', m.typeName || m.type || '', m.id);
      } else if (cat === 'VEHICLE') {
        vSubtype = detectVehicleSubtype(m.name || '', m.typeName || m.type || '', m.id);
      }

      return {
        id: m.id,
        name: m.name || m.typeName || m.model || 'Standard Asset Item',
        company: m.company || m.brand || (typeof window !== 'undefined' && localStorage.getItem('cmms_company_name')) || 'Esstee',
        category: cat,
        categoryLabel: catLabel,
        machineSubtype: mSubtype,
        furnitureSubtype: fSubtype,
        tableSpecificType: tType,
        chairSpecificType: cType,
        utilitySubtype: uSubtype,
        vehicleSubtype: vSubtype,
        purchaseDate: m.purchaseDate || new Date().toISOString().slice(0, 10),
        age: m.ageYears ? `${m.ageYears.toFixed(1)} yrs` : calculateAge(m.purchaseDate),
        relocation: occupied,
        status: m.status,
        cost: m.cost,
      };
    });

    const combined = dbItems;

    return combined.map((item) => {
      const machineRepairs = repairs.filter(
        (r) => typeof r.machineId === 'string' && textValue(r.machineId).trim().toLowerCase() === textValue(item.id).trim().toLowerCase()
      );
      const machinePpm = ppmList.filter(
        (p) => typeof p.machineId === 'string' && textValue(p.machineId).trim().toLowerCase() === textValue(item.id).trim().toLowerCase()
      );
      const allw = getAllowanceData(item.id, item.category, item.cost, machineRepairs, machinePpm);

      const periodAllowance = Math.round((allw.monthlyAllowance * periodMultiplier) / 50) * 50;
      const spentAmount = Math.round((allw.spentAmount * periodMultiplier) / 50) * 50;
      const remainingBalance = periodAllowance - spentAmount;

      let allowanceStatus: 'WITHIN_BUDGET' | 'NEAR_LIMIT' | 'OVER_BUDGET' = 'WITHIN_BUDGET';
      if (remainingBalance < 0) {
        allowanceStatus = 'OVER_BUDGET';
      } else if (periodAllowance > 0 && spentAmount / periodAllowance >= 0.85) {
        allowanceStatus = 'NEAR_LIMIT';
      }

      const totalRepairCost = Math.round((allw.totalRepairCost * periodMultiplier) / 50) * 50;
      const recentRepairCost = Math.round(
        (allw.recentRepairCost * (timePeriod === 'WEEK' ? 0.35 : timePeriod === 'YEAR' ? 2.5 : 1.0)) / 50
      ) * 50;
      const preventiveMaintenancePrice = Math.round((allw.preventiveMaintenancePrice * periodMultiplier) / 50) * 50;
      const predictedPreventiveCost = Math.round((allw.predictedPreventiveCost * periodMultiplier) / 50) * 50;

      return {
        ...item,
        monthlyAllowance: periodAllowance,
        spentAmount,
        remainingBalance,
        allowanceStatus,
        purchasePrice: typeof item.cost === 'number' && item.cost > 0 ? item.cost : allw.purchasePrice,
        totalRepairCost,
        recentRepairCost,
        preventiveMaintenancePrice,
        predictedPreventiveCost,
      };
    });
  }, [machines, repairs, ppmList, periodMultiplier, timePeriod]);

  // Overall cost statistics
  const costTotals = useMemo(() => {
    return {
      purchasePrice: allItems.reduce((acc, curr) => acc + (curr.purchasePrice || 0), 0),
      totalRepairCost: allItems.reduce((acc, curr) => acc + (curr.totalRepairCost || 0), 0),
      recentRepairCost: allItems.reduce((acc, curr) => acc + (curr.recentRepairCost || 0), 0),
      preventiveMaintenancePrice: allItems.reduce((acc, curr) => acc + (curr.preventiveMaintenancePrice || 0), 0),
      predictedPreventiveCost: allItems.reduce((acc, curr) => acc + (curr.predictedPreventiveCost || 0), 0),
    };
  }, [allItems]);

  // Counts for each of the 4 categories
  const categoryCounts = useMemo(() => {
    return {
      MACHINE: allItems.filter((i) => i.category === 'MACHINE').length,
      FURNITURE: allItems.filter((i) => i.category === 'FURNITURE').length,
      UTILITY: allItems.filter((i) => i.category === 'UTILITY').length,
      VEHICLE: allItems.filter((i) => i.category === 'VEHICLE').length,
    };
  }, [allItems]);

  // Overall and per-category maintenance allowance totals
  const categoryAllowanceTotals = useMemo(() => {
    const calc = (cat: MainCategory) => {
      const items = allItems.filter((i) => i.category === cat);
      const totalAllowance = items.reduce((acc, curr) => acc + (curr.monthlyAllowance || 0), 0);
      const totalSpent = items.reduce((acc, curr) => acc + (curr.spentAmount || 0), 0);
      const totalRemaining = totalAllowance - totalSpent;
      return { totalAllowance, totalSpent, totalRemaining };
    };
    return {
      MACHINE: calc('MACHINE'),
      FURNITURE: calc('FURNITURE'),
      UTILITY: calc('UTILITY'),
      VEHICLE: calc('VEHICLE'),
      OVERALL: {
        totalAllowance: allItems.reduce((acc, curr) => acc + (curr.monthlyAllowance || 0), 0),
        totalSpent: allItems.reduce((acc, curr) => acc + (curr.spentAmount || 0), 0),
        totalRemaining: allItems.reduce((acc, curr) => acc + (curr.remainingBalance || 0), 0),
      },
    };
  }, [allItems]);

  // Machine sub-types definitions and counts
  const machineSubtypesConfig = useMemo(() => {
    const machineItems = allItems.filter((i) => i.category === 'MACHINE');
    return [
      {
        id: 'OVERLOCK' as MachineSubtype,
        title: 'Overlock Machine',
        subtitle: '4-Thread, Rib & LFC Overedge',
        count: machineItems.filter((i) => i.machineSubtype === 'OVERLOCK').length,
        icon: Layers,
        colorBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        activeBorder: 'border-indigo-600 bg-indigo-50/80 ring-2 ring-indigo-500/30',
      },
      {
        id: 'FLATLOCK' as MachineSubtype,
        title: 'Flatlock Machine',
        subtitle: 'Cylinder Bed, Hemming & Interlock',
        count: machineItems.filter((i) => i.machineSubtype === 'FLATLOCK').length,
        icon: Disc,
        colorBg: 'bg-sky-50 text-sky-700 border-sky-200',
        activeBorder: 'border-sky-600 bg-sky-50/80 ring-2 ring-sky-500/30',
      },
      {
        id: 'SINGLE_NEEDLE' as MachineSubtype,
        title: 'Single Needle Machine',
        subtitle: 'Direct-Drive Lockstitch (SNLS/DNLS)',
        count: machineItems.filter((i) => i.machineSubtype === 'SINGLE_NEEDLE').length,
        icon: Cog,
        colorBg: 'bg-blue-50 text-blue-700 border-blue-200',
        activeBorder: 'border-blue-600 bg-blue-50/80 ring-2 ring-blue-500/30',
      },
      {
        id: 'SPECIAL_ELECTRONIC' as MachineSubtype,
        title: 'Buttonhole & Bartack',
        subtitle: 'Electronic Indexer & Button Stitch',
        count: machineItems.filter((i) => i.machineSubtype === 'SPECIAL_ELECTRONIC').length,
        icon: Cpu,
        colorBg: 'bg-violet-50 text-violet-700 border-violet-200',
        activeBorder: 'border-violet-600 bg-violet-50/80 ring-2 ring-violet-500/30',
      },
      {
        id: 'CUTTING_PRESSING' as MachineSubtype,
        title: 'Cutting & Fusing Press',
        subtitle: 'Straight Knife & Collar Fusing',
        count: machineItems.filter((i) => i.machineSubtype === 'CUTTING_PRESSING').length,
        icon: Scissors,
        colorBg: 'bg-purple-50 text-purple-700 border-purple-200',
        activeBorder: 'border-purple-600 bg-purple-50/80 ring-2 ring-purple-500/30',
      },
    ];
  }, [allItems]);

  // Furniture sub-types definitions and counts (Chair, Sofa, Table, Operator Chair, Door)
  const furnitureSubtypesConfig = useMemo(() => {
    const furItems = allItems.filter((i) => i.category === 'FURNITURE');
    return [
      {
        id: 'TABLE' as FurnitureSubtype,
        title: 'Table',
        subtitle: 'Checker, Ironing, Work, Office & Cutting',
        count: furItems.filter((i) => i.furnitureSubtype === 'TABLE').length,
        icon: TableIcon,
        colorBg: 'bg-amber-50 text-amber-700 border-amber-200',
        activeBorder: 'border-amber-600 bg-amber-50/80 ring-2 ring-amber-500/30',
      },
      {
        id: 'CHAIR' as FurnitureSubtype,
        title: 'Chair',
        subtitle: 'Office & Kusan Cushion Chairs',
        count: furItems.filter(
          (i) => i.furnitureSubtype === 'CHAIR' || i.furnitureSubtype === 'OPERATOR_CHAIR'
        ).length,
        icon: Armchair,
        colorBg: 'bg-orange-50 text-orange-700 border-orange-200',
        activeBorder: 'border-orange-600 bg-orange-50/80 ring-2 ring-orange-500/30',
      },
      {
        id: 'OPERATOR_CHAIR' as FurnitureSubtype,
        title: 'Operator Chair',
        subtitle: 'Ergonomic Sewing Machine Swivel Chairs',
        count: furItems.filter(
          (i) =>
            i.furnitureSubtype === 'OPERATOR_CHAIR' ||
            i.chairSpecificType === 'OPERATOR_CHAIR'
        ).length,
        icon: Armchair,
        colorBg: 'bg-yellow-50 text-yellow-700 border-yellow-200',
        activeBorder: 'border-yellow-600 bg-yellow-50/80 ring-2 ring-yellow-500/30',
      },
      {
        id: 'SOFA' as FurnitureSubtype,
        title: 'Sofa',
        subtitle: 'Visitor Lounge & Executive Sofas',
        count: furItems.filter((i) => i.furnitureSubtype === 'SOFA').length,
        icon: Sofa,
        colorBg: 'bg-rose-50 text-rose-700 border-rose-200',
        activeBorder: 'border-rose-600 bg-rose-50/80 ring-2 ring-rose-500/30',
      },
      {
        id: 'DOOR' as FurnitureSubtype,
        title: 'Door',
        subtitle: 'Fire Exit & Soundproof Workshop Doors',
        count: furItems.filter((i) => i.furnitureSubtype === 'DOOR').length,
        icon: DoorClosed,
        colorBg: 'bg-stone-50 text-stone-700 border-stone-200',
        activeBorder: 'border-stone-600 bg-stone-50/80 ring-2 ring-stone-500/30',
      },
    ];
  }, [allItems]);

  // Electrical Utility sub-types definitions and counts (AC, Fan, Light, Camera)
  const utilitySubtypesConfig = useMemo(() => {
    const utlItems = allItems.filter((i) => i.category === 'UTILITY');
    return [
      {
        id: 'AC' as UtilitySubtype,
        title: 'AC (Air Conditioner)',
        subtitle: 'Split & Ductable Cooling Units',
        count: utlItems.filter((i) => i.utilitySubtype === 'AC').length,
        icon: AirVent,
        colorBg: 'bg-cyan-50 text-cyan-700 border-cyan-200',
        activeBorder: 'border-cyan-600 bg-cyan-50/80 ring-2 ring-cyan-500/30',
      },
      {
        id: 'FAN' as UtilitySubtype,
        title: 'Fan',
        subtitle: 'Industrial Pedestal & Exhaust Blowers',
        count: utlItems.filter((i) => i.utilitySubtype === 'FAN').length,
        icon: Fan,
        colorBg: 'bg-teal-50 text-teal-700 border-teal-200',
        activeBorder: 'border-teal-600 bg-teal-50/80 ring-2 ring-teal-500/30',
      },
      {
        id: 'LIGHT' as UtilitySubtype,
        title: 'Light',
        subtitle: 'High-Bay LED & Inspection Lights',
        count: utlItems.filter((i) => i.utilitySubtype === 'LIGHT').length,
        icon: Lightbulb,
        colorBg: 'bg-yellow-50 text-yellow-700 border-yellow-200',
        activeBorder: 'border-yellow-600 bg-yellow-50/80 ring-2 ring-yellow-500/30',
      },
      {
        id: 'CAMERA' as UtilitySubtype,
        title: 'Camera',
        subtitle: 'CCTV Dome & Bullet Surveillance',
        count: utlItems.filter((i) => i.utilitySubtype === 'CAMERA').length,
        icon: Camera,
        colorBg: 'bg-blue-50 text-blue-700 border-blue-200',
        activeBorder: 'border-blue-600 bg-blue-50/80 ring-2 ring-blue-500/30',
      },
    ];
  }, [allItems]);

  // Vehicle sub-types definitions and counts (Car, Auto, Tempo, Lorry, Bus)
  const vehicleSubtypesConfig = useMemo(() => {
    const vehItems = allItems.filter((i) => i.category === 'VEHICLE');
    return [
      {
        id: 'CAR' as VehicleSubtype,
        title: 'Car',
        subtitle: 'Staff Pool & Inspection Cars',
        count: vehItems.filter((i) => i.vehicleSubtype === 'CAR').length,
        icon: Car,
        colorBg: 'bg-rose-50 text-rose-700 border-rose-200',
        activeBorder: 'border-rose-600 bg-rose-50/80 ring-2 ring-rose-500/30',
      },
      {
        id: 'AUTO' as VehicleSubtype,
        title: 'Auto',
        subtitle: 'Passenger & Factory Internal Autos',
        count: vehItems.filter((i) => i.vehicleSubtype === 'AUTO').length,
        icon: CarTaxiFront,
        colorBg: 'bg-amber-50 text-amber-700 border-amber-200',
        activeBorder: 'border-amber-600 bg-amber-50/80 ring-2 ring-amber-500/30',
      },
      {
        id: 'TEMPO' as VehicleSubtype,
        title: 'Tempo',
        subtitle: 'Mini Trucks & Cargo Tempos',
        count: vehItems.filter((i) => i.vehicleSubtype === 'TEMPO').length,
        icon: Truck,
        colorBg: 'bg-orange-50 text-orange-700 border-orange-200',
        activeBorder: 'border-orange-600 bg-orange-50/80 ring-2 ring-orange-500/30',
      },
      {
        id: 'LORRY' as VehicleSubtype,
        title: 'Lorry',
        subtitle: 'Heavy Goods & Freight Lorries',
        count: vehItems.filter((i) => i.vehicleSubtype === 'LORRY').length,
        icon: Truck,
        colorBg: 'bg-violet-50 text-violet-700 border-violet-200',
        activeBorder: 'border-violet-600 bg-violet-50/80 ring-2 ring-violet-500/30',
      },
      {
        id: 'BUS' as VehicleSubtype,
        title: 'Bus',
        subtitle: 'Staff Commute & Transit Buses',
        count: vehItems.filter((i) => i.vehicleSubtype === 'BUS').length,
        icon: Bus,
        colorBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        activeBorder: 'border-emerald-600 bg-emerald-50/80 ring-2 ring-emerald-500/30',
      },
    ];
  }, [allItems]);

  // Handle clicking Category cards
  const handleCategoryClick = (cat: MainCategory) => {
    if (selectedCategory === cat && activeDrawer === cat) {
      setActiveDrawer('NONE');
    } else {
      setSelectedCategory(cat);
      setActiveDrawer(cat);
      setSubCategoryFilter('ALL');
      setLocationFilter('ALL');
      // Reset other sub-filters
      if (cat !== 'MACHINE') setSelectedMachineSubtype('ALL');
      if (cat !== 'FURNITURE') {
        setSelectedFurnitureSubtype('ALL');
        setSelectedTableType('ALL');
        setSelectedChairType('ALL');
      }
      if (cat !== 'UTILITY') setSelectedUtilitySubtype('ALL');
      if (cat !== 'VEHICLE') setSelectedVehicleSubtype('ALL');
    }
  };

  // Filtered items based on active category card, drawers, specific subtypes, cascading filters, and search query
  const filteredItems = useMemo(() => {
    let list = allItems;

    // 1. Main category filter (Group)
    if (selectedCategory !== 'ALL') {
      list = list.filter((item) => item.category === selectedCategory);
    }

    // 2. Sub-Category cascading filter
    if (subCategoryFilter !== 'ALL') {
      const targetSub = subCategoryFilter.toLowerCase();
      list = list.filter((item) => getAssetSubCategory(item).toLowerCase().includes(targetSub));
    }

    // 3. Location cascading filter
    if (locationFilter !== 'ALL') {
      const locTarget = locationFilter.toLowerCase();
      list = list.filter((item) => getAssetLocation(item).toLowerCase().includes(locTarget));
    }

    // 4. Budget status filter
    if (budgetFilter !== 'ALL') {
      list = list.filter((item) => item.allowanceStatus === budgetFilter);
    }

    // 5. Repair Cost filter
    if (repairCostFilter !== 'ALL') {
      list = list.filter((item) => {
        const cost = item.totalRepairCost || 0;
        if (repairCostFilter === 'HAS_COST' && cost <= 0) return false;
        if (repairCostFilter === 'ZERO' && cost > 0) return false;
        if (repairCostFilter === 'UNDER_500' && cost >= 500) return false;
        if (repairCostFilter === '500_TO_1500' && (cost < 500 || cost > 1500)) return false;
        if (repairCostFilter === 'OVER_1500' && cost <= 1500) return false;
        return true;
      });
    }

    // 6. Purchase Date From / To filter
    if (purchaseFromDate) {
      list = list.filter((item) => !item.purchaseDate || item.purchaseDate >= purchaseFromDate);
    }
    if (purchaseToDate) {
      list = list.filter((item) => !item.purchaseDate || item.purchaseDate <= purchaseToDate);
    }

    // 7. Preventive Maintenance Cost filter
    if (preventiveCostFilter !== 'ALL') {
      list = list.filter((item) => {
        const cost = item.preventiveMaintenancePrice || 0;
        if (preventiveCostFilter === 'HAS_COST' && cost <= 0) return false;
        if (preventiveCostFilter === 'ZERO' && cost > 0) return false;
        if (preventiveCostFilter === 'UNDER_1500' && cost >= 1500) return false;
        if (preventiveCostFilter === '1500_TO_3500' && (cost < 1500 || cost > 3500)) return false;
        if (preventiveCostFilter === 'OVER_3500' && cost <= 3500) return false;
        return true;
      });
    }

    // 8. Machine Subtype filter from drawer
    if (selectedCategory === 'MACHINE' && selectedMachineSubtype !== 'ALL') {
      list = list.filter((item) => item.machineSubtype === selectedMachineSubtype);
    }

    // 9. Furniture filters from drawer
    if (selectedCategory === 'FURNITURE') {
      if (activeFurnitureTab === 'TABLE' || selectedFurnitureSubtype === 'TABLE') {
        list = list.filter((item) => item.furnitureSubtype === 'TABLE');
        if (selectedTableType !== 'ALL') {
          list = list.filter((item) => item.tableSpecificType === selectedTableType);
        }
        if (tableSearchQuery.trim()) {
          const tq = tableSearchQuery.toLowerCase().trim();
          list = list.filter(
            (item) =>
              textValue(item.name).toLowerCase().includes(tq) ||
              textValue(item.id).toLowerCase().includes(tq) ||
              textValue(item.company).toLowerCase().includes(tq) ||
              textValue(item.relocation).toLowerCase().includes(tq)
          );
        }
      } else if (
        activeFurnitureTab === 'CHAIR' ||
        selectedFurnitureSubtype === 'CHAIR' ||
        selectedFurnitureSubtype === 'OPERATOR_CHAIR'
      ) {
        list = list.filter(
          (item) =>
            item.furnitureSubtype === 'CHAIR' ||
            item.furnitureSubtype === 'OPERATOR_CHAIR' ||
            item.chairSpecificType !== undefined
        );
        if (selectedChairType !== 'ALL') {
          list = list.filter((item) => item.chairSpecificType === selectedChairType);
        }
        if (chairSearchQuery.trim()) {
          const cq = chairSearchQuery.toLowerCase().trim();
          list = list.filter(
            (item) =>
              textValue(item.name).toLowerCase().includes(cq) ||
              textValue(item.id).toLowerCase().includes(cq) ||
              textValue(item.company).toLowerCase().includes(cq) ||
              textValue(item.relocation).toLowerCase().includes(cq)
          );
        }
      } else if (activeFurnitureTab === 'SOFA' || selectedFurnitureSubtype === 'SOFA') {
        list = list.filter((item) => item.furnitureSubtype === 'SOFA');
      } else if (activeFurnitureTab === 'DOOR' || selectedFurnitureSubtype === 'DOOR') {
        list = list.filter((item) => item.furnitureSubtype === 'DOOR');
      } else if (selectedFurnitureSubtype !== 'ALL') {
        list = list.filter((item) => item.furnitureSubtype === selectedFurnitureSubtype);
      }

      if (furnitureSearchQuery.trim()) {
        const fq = furnitureSearchQuery.toLowerCase().trim();
        list = list.filter(
          (item) =>
            textValue(item.name).toLowerCase().includes(fq) ||
            textValue(item.id).toLowerCase().includes(fq) ||
            textValue(item.company).toLowerCase().includes(fq)
        );
      }
    }

    // 10. Utility filter from drawer
    if (selectedCategory === 'UTILITY' && selectedUtilitySubtype !== 'ALL') {
      list = list.filter((item) => item.utilitySubtype === selectedUtilitySubtype);
    }

    // 11. Vehicle filter from drawer
    if (selectedCategory === 'VEHICLE' && selectedVehicleSubtype !== 'ALL') {
      list = list.filter((item) => item.vehicleSubtype === selectedVehicleSubtype);
    }

    // 12. General search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (item) =>
          textValue(item.id).toLowerCase().includes(q) ||
          textValue(item.name).toLowerCase().includes(q) ||
          textValue(item.company).toLowerCase().includes(q) ||
          textValue(item.relocation).toLowerCase().includes(q) ||
          getAssetSubCategory(item).toLowerCase().includes(q) ||
          (item.purchasePrice !== undefined && item.purchasePrice.toString().includes(q)) ||
          (item.totalRepairCost !== undefined && item.totalRepairCost.toString().includes(q)) ||
          (item.recentRepairCost !== undefined && item.recentRepairCost.toString().includes(q)) ||
          (item.preventiveMaintenancePrice !== undefined && item.preventiveMaintenancePrice.toString().includes(q)) ||
          (item.predictedPreventiveCost !== undefined && item.predictedPreventiveCost.toString().includes(q)) ||
          (item.monthlyAllowance !== undefined && item.monthlyAllowance.toString().includes(q)) ||
          (item.spentAmount !== undefined && item.spentAmount.toString().includes(q)) ||
          (item.remainingBalance !== undefined && item.remainingBalance.toString().includes(q)) ||
          (item.allowanceStatus && textValue(item.allowanceStatus).toLowerCase().replace('_', ' ').includes(q))
      );
    }

    return list;
  }, [
    allItems,
    selectedCategory,
    subCategoryFilter,
    locationFilter,
    repairCostFilter,
    purchaseFromDate,
    purchaseToDate,
    preventiveCostFilter,
    machines,
    selectedMachineSubtype,
    selectedFurnitureSubtype,
    activeFurnitureTab,
    selectedTableType,
    selectedChairType,
    tableSearchQuery,
    chairSearchQuery,
    furnitureSearchQuery,
    selectedUtilitySubtype,
    selectedVehicleSubtype,
    budgetFilter,
    searchQuery,
  ]);

  // Extract all unique locations across all items and live machines
  const allLocations = useMemo(() => {
    const set = new Set<string>();
    allItems.forEach((item) => {
      const loc = getAssetLocation(item);
      if (loc) set.add(loc);
    });
    machines.forEach((m) => {
      if (m.area) set.add(m.area);
      if (m.currentLine) set.add(m.currentLine);
    });
    return Array.from(set).sort();
  }, [allItems, machines]);

  // Sub-categories dynamically filtered by selected Group (if a group is selected)
  const availableSubCategories = useMemo(() => {
    let pool = allItems;
    if (selectedCategory !== 'ALL') {
      pool = pool.filter((i) => i.category === selectedCategory);
    }
    const set = new Set<string>();
    pool.forEach((i) => {
      set.add(getAssetSubCategory(i));
    });
    return Array.from(set).sort();
  }, [selectedCategory, allItems]);

  // Locations dynamically filtered by currently selected Group & Category (Sub-Category)
  const availableLocations = useMemo(() => {
    let pool = allItems;
    if (selectedCategory !== 'ALL') {
      pool = pool.filter((i) => i.category === selectedCategory);
    }
    if (subCategoryFilter !== 'ALL') {
      const subTarget = subCategoryFilter.toLowerCase();
      pool = pool.filter((i) => getAssetSubCategory(i).toLowerCase().includes(subTarget));
    }
    const set = new Set<string>();
    pool.forEach((item) => {
      const loc = getAssetLocation(item);
      if (loc) set.add(loc);
    });
    if (set.size === 0) return allLocations;
    return Array.from(set).sort();
  }, [allItems, selectedCategory, subCategoryFilter, allLocations]);

  // Filtered cost statistics
  const filteredCostTotals = useMemo(() => {
    return {
      purchasePrice: filteredItems.reduce((acc, curr) => acc + (curr.purchasePrice || 0), 0),
      totalRepairCost: filteredItems.reduce((acc, curr) => acc + (curr.totalRepairCost || 0), 0),
      recentRepairCost: filteredItems.reduce((acc, curr) => acc + (curr.recentRepairCost || 0), 0),
      preventiveMaintenancePrice: filteredItems.reduce((acc, curr) => acc + (curr.preventiveMaintenancePrice || 0), 0),
      predictedPreventiveCost: filteredItems.reduce((acc, curr) => acc + (curr.predictedPreventiveCost || 0), 0),
    };
  }, [filteredItems]);

  // Grouped rows sections when Group By is active
  const groupedSections = useMemo(() => {
    if (groupBy === 'NONE') return [];

    if (groupBy === 'CATEGORY') {
      const groups: { [key in MainCategory]?: AssetItem[] } = {};
      filteredItems.forEach((item) => {
        if (!groups[item.category]) groups[item.category] = [];
        groups[item.category]!.push(item);
      });

      const meta: { [key in MainCategory]: { title: string; subtitle: string; icon: any } } = {
        MACHINE: {
          title: 'Machinery Fleet',
          subtitle: 'Sewing, cutting & industrial machinery',
          icon: Wrench,
        },
        FURNITURE: {
          title: 'Furniture & Workspace Assets',
          subtitle: 'Tables, operator chairs, sofas & doors',
          icon: Armchair,
        },
        UTILITY: {
          title: 'Electrical Utilities & Infrastructure',
          subtitle: 'Air conditioners, high-bay lights, fans & CCTV',
          icon: Zap,
        },
        VEHICLE: {
          title: 'Vehicle Fleet & Transport',
          subtitle: 'Cars, passenger autos, tempos, lorries & buses',
          icon: Truck,
        },
      };

      return (['MACHINE', 'FURNITURE', 'UTILITY', 'VEHICLE'] as MainCategory[])
        .filter((cat) => groups[cat] && groups[cat]!.length > 0)
        .map((cat) => {
          const items = groups[cat]!;
          const totalPurchase = items.reduce((s, i) => s + (i.purchasePrice || 0), 0);
          const totalRepairs = items.reduce((s, i) => s + (i.totalRepairCost || 0), 0);
          const totalAllowance = items.reduce((s, i) => s + (i.monthlyAllowance || 0), 0);
          return {
            id: `cat-${cat}`,
            title: meta[cat].title,
            subtitle: `${items.length} units • ${meta[cat].subtitle}`,
            icon: meta[cat].icon,
            items,
            totalPurchase,
            totalRepairs,
            totalAllowance,
          };
        });
    }

    if (groupBy === 'SUBCATEGORY') {
      const map = new Map<string, AssetItem[]>();
      filteredItems.forEach((item) => {
        const sub = getAssetSubCategory(item);
        if (!map.has(sub)) map.set(sub, []);
        map.get(sub)!.push(item);
      });
      return Array.from(map.entries()).map(([subName, sItems]) => {
        const totalPurchase = sItems.reduce((s, i) => s + (i.purchasePrice || 0), 0);
        const totalRepairs = sItems.reduce((s, i) => s + (i.totalRepairCost || 0), 0);
        const totalAllowance = sItems.reduce((s, i) => s + (i.monthlyAllowance || 0), 0);
        return {
          id: `sub-${subName.replace(/\s+/g, '-').toLowerCase()}`,
          title: `Category: ${subName}`,
          subtitle: `${sItems.length} units in subcategory`,
          icon: Layers,
          items: sItems,
          totalPurchase,
          totalRepairs,
          totalAllowance,
        };
      });
    }

    if (groupBy === 'LOCATION') {
      const map = new Map<string, AssetItem[]>();
      filteredItems.forEach((item) => {
        const loc = getAssetLocation(item);
        if (!map.has(loc)) map.set(loc, []);
        map.get(loc)!.push(item);
      });
      return Array.from(map.entries()).map(([locName, sItems]) => {
        const totalPurchase = sItems.reduce((s, i) => s + (i.purchasePrice || 0), 0);
        const totalRepairs = sItems.reduce((s, i) => s + (i.totalRepairCost || 0), 0);
        const totalAllowance = sItems.reduce((s, i) => s + (i.monthlyAllowance || 0), 0);
        return {
          id: `loc-${locName.replace(/\s+/g, '-').toLowerCase()}`,
          title: `Location: ${locName}`,
          subtitle: `${sItems.length} units stationed at this department`,
          icon: MapPin,
          items: sItems,
          totalPurchase,
          totalRepairs,
          totalAllowance,
        };
      });
    }

    if (groupBy === 'RELOCATION') {
      const relocatedItems = filteredItems.filter((i) => isItemRelocated(i, machines));
      const staticItems = filteredItems.filter((i) => !isItemRelocated(i, machines));

      const res = [];
      if (relocatedItems.length > 0) {
        res.push({
          id: 'reloc-relocated',
          title: 'Relocated Assets',
          subtitle: `${relocatedItems.length} equipment transferred across lines or bays`,
          icon: MapPin,
          items: relocatedItems,
          totalPurchase: relocatedItems.reduce((s, i) => s + (i.purchasePrice || 0), 0),
          totalRepairs: relocatedItems.reduce((s, i) => s + (i.totalRepairCost || 0), 0),
          totalAllowance: relocatedItems.reduce((s, i) => s + (i.monthlyAllowance || 0), 0),
        });
      }
      if (staticItems.length > 0) {
        res.push({
          id: 'reloc-static',
          title: 'Stationary / Original Placement Fleet',
          subtitle: `${staticItems.length} equipment remaining at original placement station`,
          icon: Building2,
          items: staticItems,
          totalPurchase: staticItems.reduce((s, i) => s + (i.purchasePrice || 0), 0),
          totalRepairs: staticItems.reduce((s, i) => s + (i.totalRepairCost || 0), 0),
          totalAllowance: staticItems.reduce((s, i) => s + (i.monthlyAllowance || 0), 0),
        });
      }
      return res;
    }

    if (groupBy === 'BUDGET') {
      const budgetMap = new Map<string, AssetItem[]>();
      filteredItems.forEach((item) => {
        const st = item.allowanceStatus || 'WITHIN_BUDGET';
        if (!budgetMap.has(st)) budgetMap.set(st, []);
        budgetMap.get(st)!.push(item);
      });
      return Array.from(budgetMap.entries()).map(([stName, sItems]) => {
        const isOver = stName === 'OVER_BUDGET';
        const isNear = stName === 'NEAR_LIMIT';
        const totalPurchase = sItems.reduce((s, i) => s + (i.purchasePrice || 0), 0);
        const totalRepairs = sItems.reduce((s, i) => s + (i.totalRepairCost || 0), 0);
        const totalAllowance = sItems.reduce((s, i) => s + (i.monthlyAllowance || 0), 0);
        return {
          id: `budget-${stName.toLowerCase()}`,
          title: isOver
            ? 'Budget Overrun (Over Budget)'
            : isNear
            ? 'Near Budget Limit (>85% Spent)'
            : 'Within Safe Budget (<85% Spent)',
          subtitle: `${sItems.length} assets categorized under ${stName.replace('_', ' ')}`,
          icon: isOver ? AlertTriangle : isNear ? AlertCircle : CheckCircle2,
          items: sItems,
          totalPurchase,
          totalRepairs,
          totalAllowance,
        };
      });
    }

    return [];
  }, [groupBy, filteredItems, machines]);

  const allSectionsCollapsed =
    groupedSections.length > 0 &&
    groupedSections.every((s) => collapsedSections.includes(s.id));

  const toggleCollapseAll = () => {
    if (allSectionsCollapsed) {
      setCollapsedSections([]);
    } else {
      setCollapsedSections(groupedSections.map((s) => s.id));
    }
  };

  const toggleSection = (id: string) => {
    setCollapsedSections((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const hasActiveFilters =
    selectedCategory !== 'ALL' ||
    subCategoryFilter !== 'ALL' ||
    locationFilter !== 'ALL' ||
    repairCostFilter !== 'ALL' ||
    preventiveCostFilter !== 'ALL' ||
    budgetFilter !== 'ALL' ||
    purchaseFromDate !== '' ||
    purchaseToDate !== '' ||
    searchQuery !== '' ||
    selectedMachineSubtype !== 'ALL' ||
    selectedFurnitureSubtype !== 'ALL' ||
    selectedTableType !== 'ALL' ||
    selectedChairType !== 'ALL' ||
    selectedUtilitySubtype !== 'ALL' ||
    selectedVehicleSubtype !== 'ALL';

  const resetAllFilters = () => {
    setSelectedCategory('ALL');
    setActiveDrawer('NONE');
    setSubCategoryFilter('ALL');
    setLocationFilter('ALL');
    setRepairCostFilter('ALL');
    setPreventiveCostFilter('ALL');
    setBudgetFilter('ALL');
    setPurchaseFromDate('');
    setPurchaseToDate('');
    setSearchQuery('');
    setSelectedMachineSubtype('ALL');
    setSelectedFurnitureSubtype('ALL');
    setSelectedTableType('ALL');
    setSelectedChairType('ALL');
    setSelectedUtilitySubtype('ALL');
    setSelectedVehicleSubtype('ALL');
    setTableSearchQuery('');
    setChairSearchQuery('');
    setFurnitureSearchQuery('');
  };

  const handleExportFilteredData = () => {
    const headers = [
      'Asset ID',
      'Asset Name',
      'Group / Category',
      'Sub-Category',
      'Company / Brand',
      'Location / Station',
      'Purchase Date',
      'Age',
      'Purchase Price (INR)',
      'Total Repair Cost (INR)',
      'Recent Repair Cost (INR)',
      'Preventive Maintenance (INR)',
      'Predicted Preventive Cost (INR)',
      'Period Allowance (INR)',
      'Spent Amount (INR)',
      'Remaining Balance (INR)',
      'Budget Status',
      'Relocated Status',
    ];

    const rows = filteredItems.map((item) => [
      item.id,
      `"${item.name.replace(/"/g, '""')}"`,
      item.categoryLabel,
      `"${getAssetSubCategory(item).replace(/"/g, '""')}"`,
      `"${item.company.replace(/"/g, '""')}"`,
      `"${item.relocation.replace(/"/g, '""')}"`,
      item.purchaseDate || '',
      item.age,
      item.purchasePrice || 0,
      item.totalRepairCost || 0,
      item.recentRepairCost || 0,
      item.preventiveMaintenancePrice || 0,
      item.predictedPreventiveCost || 0,
      item.monthlyAllowance || 0,
      item.spentAmount || 0,
      item.remainingBalance || 0,
      item.allowanceStatus || 'WITHIN_BUDGET',
      isItemRelocated(item, machines) ? 'RELOCATED' : 'STATIONARY',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `allowance_maintenance_report_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 4 Grid Category Definitions
  const categoriesConfig = [
    {
      id: 'MACHINE' as MainCategory,
      title: 'Machine',
      subtitle: 'Sewing & Industrial Machinery',
      icon: Wrench,
      count: categoryCounts.MACHINE,
      totalAllowance: categoryAllowanceTotals.MACHINE.totalAllowance,
      colorBadge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      activeRing: 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20 shadow-md',
      tagColor: 'text-indigo-600',
      isExpandable: true,
      isOpen: activeDrawer === 'MACHINE',
    },
    {
      id: 'FURNITURE' as MainCategory,
      title: 'Furniture',
      subtitle: 'Chair, Sofa, Table, Operator Chair, Door',
      icon: Armchair,
      count: categoryCounts.FURNITURE,
      totalAllowance: categoryAllowanceTotals.FURNITURE.totalAllowance,
      colorBadge: 'bg-amber-50 text-amber-700 border-amber-200',
      activeRing: 'border-amber-600 bg-amber-50/50 ring-2 ring-amber-500/20 shadow-md',
      tagColor: 'text-amber-600',
      isExpandable: true,
      isOpen: activeDrawer === 'FURNITURE',
    },
    {
      id: 'UTILITY' as MainCategory,
      title: 'Electrical Utilities',
      subtitle: 'AC, Fan, Light, Camera',
      icon: Zap,
      count: categoryCounts.UTILITY,
      totalAllowance: categoryAllowanceTotals.UTILITY.totalAllowance,
      colorBadge: 'bg-teal-50 text-teal-700 border-teal-200',
      activeRing: 'border-teal-600 bg-teal-50/50 ring-2 ring-teal-500/20 shadow-md',
      tagColor: 'text-teal-600',
      isExpandable: true,
      isOpen: activeDrawer === 'UTILITY',
    },
    {
      id: 'VEHICLE' as MainCategory,
      title: 'Vehicle',
      subtitle: 'Car, Auto, Tempo, Lorry, Bus',
      icon: Truck,
      count: categoryCounts.VEHICLE,
      totalAllowance: categoryAllowanceTotals.VEHICLE.totalAllowance,
      colorBadge: 'bg-rose-50 text-rose-700 border-rose-200',
      activeRing: 'border-rose-600 bg-rose-50/50 ring-2 ring-rose-500/20 shadow-md',
      tagColor: 'text-rose-600',
      isExpandable: true,
      isOpen: activeDrawer === 'VEHICLE',
    },
  ];

  return (
    <div className="space-y-3.5 pt-0">
      {/* 0. Time Period & Date Range Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-3 sm:p-3.5 shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        {/* Left: Filter Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-slate-800 font-bold text-xs mr-1">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-2xs">
              <Calendar className="w-4 h-4" />
            </div>
            <span>Allowance Period:</span>
          </div>

          <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-xl border border-slate-200 text-xs shadow-2xs">
            <button
              type="button"
              onClick={() => handlePeriodSelect('WEEK')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                timePeriod === 'WEEK'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              Week Wise
            </button>
            <button
              type="button"
              onClick={() => handlePeriodSelect('MONTH')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                timePeriod === 'MONTH'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              Month Wise
            </button>
            <button
              type="button"
              onClick={() => handlePeriodSelect('YEAR')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                timePeriod === 'YEAR'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              Year Wise
            </button>
            <button
              type="button"
              onClick={() => setTimePeriod('CUSTOM')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                timePeriod === 'CUSTOM'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              Custom Range
            </button>
          </div>
        </div>

        {/* Right: Date Pickers and 'From this date to this date' callout */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <label htmlFor="allowance-start-date" className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              From:
            </label>
            <input
              id="allowance-start-date"
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setTimePeriod('CUSTOM');
              }}
              className="h-8 px-2.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <label htmlFor="allowance-end-date" className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              To:
            </label>
            <input
              id="allowance-end-date"
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setTimePeriod('CUSTOM');
              }}
              className="h-8 px-2.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition cursor-pointer"
            />
          </div>

          {/* Active Range Callout explicitly mentioning 'From this date to this date' */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50/90 border border-indigo-200 text-indigo-950 text-xs font-medium shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse shrink-0"></span>
            <span>
              From <strong className="font-bold text-indigo-900 underline decoration-indigo-300 underline-offset-2">{formatDisplayDate(startDate)}</strong> to{' '}
              <strong className="font-bold text-indigo-900 underline decoration-indigo-300 underline-offset-2">{formatDisplayDate(endDate)}</strong>
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-200/70 text-indigo-900 ml-1">
              {timePeriod === 'WEEK'
                ? 'Week'
                : timePeriod === 'MONTH'
                ? 'Month'
                : timePeriod === 'YEAR'
                ? 'Year'
                : 'Custom'}
            </span>
          </div>
        </div>
      </div>

      {/* 1. Primary 4-Grid Display Categories */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {categoriesConfig.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          const Icon = cat.icon;

          return (
            <div
              key={cat.id}
              onClick={() => handleCategoryClick(cat.id)}
              className={`p-3 rounded-xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between min-h-[96px] relative group ${
                isSelected
                  ? cat.activeRing
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-bold text-slate-900">{cat.title}</h3>
                    {cat.isExpandable && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                        {cat.isOpen ? '▲' : '▼'}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">{cat.subtitle}</p>
                </div>
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center border shadow-2xs shrink-0 ${cat.colorBadge}`}
                >
                  <Icon className="w-4 h-4" />
                </div>
              </div>

              <div className="mt-2 flex items-baseline justify-between pt-1.5 border-t border-slate-100">
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-black font-mono tracking-tight text-slate-900">
                    {cat.count}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400">units</span>
                  <span className="text-[10px] text-slate-300 mx-0.5">•</span>
                  <span className="text-[10px] font-bold font-mono text-slate-700 bg-slate-100 px-1 py-0.2 rounded border border-slate-200/80">
                    ₹{cat.totalAllowance.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[9px] text-slate-400 font-medium">
                    /{timePeriod === 'WEEK' ? 'wk' : timePeriod === 'YEAR' ? 'yr' : 'mo'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span
                    className={`text-[10px] font-bold ${
                      isSelected ? cat.tagColor : 'text-slate-400 group-hover:text-slate-600'
                    }`}
                  >
                    {isSelected
                      ? cat.isExpandable
                        ? cat.isOpen
                          ? 'Collapse ▲'
                          : 'Expand ▼'
                        : 'Active ✕'
                      : 'Select'}
                  </span>
                  {cat.isExpandable && (
                    cat.isOpen ? (
                      <ChevronUp className="w-3 h-3 text-slate-700" />
                    ) : (
                      <ChevronDown className="w-3 h-3 text-slate-400 group-hover:text-slate-600" />
                    )
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 2A. Interactive "Hover Down" Drawer for Machine Types */}
      {activeDrawer === 'MACHINE' && (
        <div className="bg-slate-50 border border-indigo-100 rounded-xl p-2.5 shadow-xs space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1.5 border-b border-slate-200/80">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
              <h4 className="text-xs font-bold text-slate-900">
                Types of Machinery ({categoryCounts.MACHINE} Total Units)
              </h4>
              <span className="text-slate-400 text-xs">•</span>
              <span className="text-[10px] text-slate-500 font-medium">
                Click any machine type below to filter table
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {selectedMachineSubtype !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => setSelectedMachineSubtype('ALL')}
                  className="px-2 py-0.5 text-[10px] font-bold text-indigo-700 bg-indigo-100/70 hover:bg-indigo-200 rounded-md transition cursor-pointer flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  <span>Show All Machine Types</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setActiveDrawer('NONE')}
                className="px-2 py-0.5 text-[10px] font-semibold text-slate-500 hover:text-slate-800 bg-white border border-slate-200 hover:bg-slate-100 rounded-md transition cursor-pointer"
              >
                Close Drawer ▲
              </button>
            </div>
          </div>

          {/* Machine Subtypes Widgets Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {machineSubtypesConfig.map((sub) => {
              const isSubActive = selectedMachineSubtype === sub.id;
              const Icon = sub.icon;

              return (
                <div
                  key={sub.id}
                  onClick={() =>
                    setSelectedMachineSubtype(isSubActive ? 'ALL' : sub.id)
                  }
                  className={`p-2 rounded-lg border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between h-[66px] ${
                    isSubActive
                      ? sub.activeBorder
                      : 'bg-white border-slate-200/90 hover:border-slate-300 hover:shadow-2xs'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <h5 className="text-[11px] font-bold text-slate-900 truncate flex-1">
                      {sub.title}
                    </h5>
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center border shrink-0 ${sub.colorBg}`}
                    >
                      <Icon className="w-3 h-3" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm font-black font-mono tracking-tight text-slate-900">
                        {sub.count}
                      </span>
                      <span className="text-[9px] text-slate-400 font-medium">units</span>
                    </div>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        isSubActive
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {isSubActive ? 'Selected ✓' : 'Filter'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2B. Interactive "Hover Down" Drawer for Furniture (Chair, Sofa, Table, Operator Chair, Door) */}
      {activeDrawer === 'FURNITURE' && (
        <div className="bg-slate-50 border border-amber-200 rounded-xl p-2.5 shadow-xs space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1.5 border-b border-slate-200/80">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              <h4 className="text-xs font-bold text-slate-900">
                Types of Furniture ({categoryCounts.FURNITURE} Total Units)
              </h4>
              <span className="text-slate-400 text-xs">•</span>
              <span className="text-[10px] text-slate-500 font-medium">
                Chair, Sofa, Table, Operator Chair, Door
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {(selectedFurnitureSubtype !== 'ALL' ||
                selectedTableType !== 'ALL' ||
                selectedChairType !== 'ALL' ||
                furnitureSearchQuery.trim()) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFurnitureSubtype('ALL');
                    setSelectedTableType('ALL');
                    setSelectedChairType('ALL');
                    setFurnitureSearchQuery('');
                  }}
                  className="px-2 py-0.5 text-[10px] font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 rounded-md transition cursor-pointer flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  <span>Reset Filters</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setActiveDrawer('NONE')}
                className="px-2 py-0.5 text-[10px] font-semibold text-slate-500 hover:text-slate-800 bg-white border border-slate-200 hover:bg-slate-100 rounded-md transition cursor-pointer"
              >
                Close Drawer ▲
              </button>
            </div>
          </div>

          {/* 5 Furniture Subtype Widgets (Table, Chair, Operator Chair, Sofa, Door) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {furnitureSubtypesConfig.map((sub) => {
              const isSubActive =
                (sub.id === 'TABLE' && activeFurnitureTab === 'TABLE') ||
                (sub.id === 'CHAIR' && activeFurnitureTab === 'CHAIR' && selectedFurnitureSubtype !== 'OPERATOR_CHAIR') ||
                (sub.id === 'OPERATOR_CHAIR' && selectedFurnitureSubtype === 'OPERATOR_CHAIR') ||
                (sub.id === 'SOFA' && activeFurnitureTab === 'SOFA') ||
                (sub.id === 'DOOR' && activeFurnitureTab === 'DOOR');
              const Icon = sub.icon;

              return (
                <div
                  key={sub.id}
                  onClick={() => {
                    if (sub.id === 'TABLE') {
                      setActiveFurnitureTab('TABLE');
                      setSelectedFurnitureSubtype('TABLE');
                    } else if (sub.id === 'CHAIR') {
                      setActiveFurnitureTab('CHAIR');
                      setSelectedFurnitureSubtype('CHAIR');
                      setSelectedChairType('ALL');
                    } else if (sub.id === 'OPERATOR_CHAIR') {
                      setActiveFurnitureTab('CHAIR');
                      setSelectedFurnitureSubtype('OPERATOR_CHAIR');
                      setSelectedChairType('OPERATOR_CHAIR');
                    } else if (sub.id === 'SOFA') {
                      setActiveFurnitureTab('SOFA');
                      setSelectedFurnitureSubtype('SOFA');
                    } else if (sub.id === 'DOOR') {
                      setActiveFurnitureTab('DOOR');
                      setSelectedFurnitureSubtype('DOOR');
                    }
                  }}
                  className={`p-2 rounded-lg border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between h-[66px] ${
                    isSubActive
                      ? sub.activeBorder
                      : 'bg-white border-slate-200/90 hover:border-slate-300 hover:shadow-2xs'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <h5 className="text-[11px] font-bold text-slate-900 truncate flex-1">
                      {sub.title}
                    </h5>
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center border shrink-0 ${sub.colorBg}`}
                    >
                      <Icon className="w-3 h-3" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm font-black font-mono tracking-tight text-slate-900">
                        {sub.count}
                      </span>
                      <span className="text-[9px] text-slate-400 font-medium">units</span>
                    </div>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        isSubActive
                          ? 'bg-amber-600 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {isSubActive ? 'Active ✓' : 'Select'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Slim, Compact Furniture Search Drawer */}
          <div className="bg-white rounded-lg border border-amber-200/90 px-2.5 py-1.5 shadow-2xs flex flex-wrap sm:flex-nowrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 shrink-0">
              <Sliders className="w-3.5 h-3.5 text-amber-600" />
              <span className="text-[11px] font-bold text-slate-800">
                {activeFurnitureTab === 'TABLE'
                  ? 'Table Filter:'
                  : activeFurnitureTab === 'CHAIR'
                  ? 'Chair Filter:'
                  : `${activeFurnitureTab === 'SOFA' ? 'Sofa' : 'Door'} Filter:`}
              </span>
            </div>

            {/* 1. When TABLE is touched: Table Dropdown & Search inline */}
            {activeFurnitureTab === 'TABLE' && (
              <div className="flex items-center gap-2 flex-1 sm:justify-end">
                <select
                  value={selectedTableType}
                  onChange={(e) => {
                    setSelectedTableType(e.target.value as TableSpecificType);
                    setSelectedFurnitureSubtype('TABLE');
                  }}
                  className="h-7 text-[11px] bg-slate-50 border border-slate-200 rounded-lg px-2 text-slate-800 font-semibold focus:ring-1 focus:ring-amber-500 focus:bg-white outline-none cursor-pointer"
                >
                  <option value="ALL">All Table Types</option>
                  <option value="CHECKER_TABLE">Checker Table (QC)</option>
                  <option value="IRONING_TABLE">Ironing Table (Steam)</option>
                  <option value="WORK_TABLE">Work Table (Assembly)</option>
                  <option value="OFFICE_TABLE">Office Table (Admin)</option>
                  <option value="CUTTING_TABLE">Cutting Table (Fabric)</option>
                </select>
                {selectedTableType !== 'ALL' && (
                  <button
                    type="button"
                    onClick={() => setSelectedTableType('ALL')}
                    className="text-[10px] text-amber-700 hover:underline font-bold shrink-0 cursor-pointer"
                  >
                    Reset
                  </button>
                )}
                <div className="relative w-36 sm:w-48">
                  <Search className="w-3 h-3 absolute left-2 top-2 text-slate-400" />
                  <input
                    type="text"
                    value={tableSearchQuery}
                    onChange={(e) => setTableSearchQuery(e.target.value)}
                    placeholder="Search tables..."
                    className="w-full h-7 pl-6 pr-5 text-[11px] bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium focus:ring-1 focus:ring-amber-500 focus:bg-white outline-none"
                  />
                  {tableSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setTableSearchQuery('')}
                      className="absolute right-1.5 top-1.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* 2. When CHAIR is touched: Chair Dropdown & Search inline */}
            {activeFurnitureTab === 'CHAIR' && (
              <div className="flex items-center gap-2 flex-1 sm:justify-end">
                <select
                  value={selectedChairType}
                  onChange={(e) => {
                    setSelectedChairType(e.target.value as ChairSpecificType);
                    setSelectedFurnitureSubtype('CHAIR');
                  }}
                  className="h-7 text-[11px] bg-slate-50 border border-slate-200 rounded-lg px-2 text-slate-800 font-semibold focus:ring-1 focus:ring-orange-500 focus:bg-white outline-none cursor-pointer"
                >
                  <option value="ALL">All Chair Types</option>
                  <option value="OPERATOR_CHAIR">Operator Chair (Swivel)</option>
                  <option value="OFFICE_CHAIR">Office Chair (Executive)</option>
                  <option value="KUSAN_CHAIR">Kusan Chair (Cushion)</option>
                </select>
                {selectedChairType !== 'ALL' && (
                  <button
                    type="button"
                    onClick={() => setSelectedChairType('ALL')}
                    className="text-[10px] text-orange-700 hover:underline font-bold shrink-0 cursor-pointer"
                  >
                    Reset
                  </button>
                )}
                <div className="relative w-36 sm:w-48">
                  <Search className="w-3 h-3 absolute left-2 top-2 text-slate-400" />
                  <input
                    type="text"
                    value={chairSearchQuery}
                    onChange={(e) => setChairSearchQuery(e.target.value)}
                    placeholder="Search chairs..."
                    className="w-full h-7 pl-6 pr-5 text-[11px] bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium focus:ring-1 focus:ring-orange-500 focus:bg-white outline-none"
                  />
                  {chairSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setChairSearchQuery('')}
                      className="absolute right-1.5 top-1.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* 3. When SOFA or DOOR is touched: Search inline */}
            {(activeFurnitureTab === 'SOFA' || activeFurnitureTab === 'DOOR') && (
              <div className="relative w-44 sm:w-56 flex-1 sm:flex-initial sm:ml-auto">
                <Search className="w-3 h-3 absolute left-2 top-2 text-slate-400" />
                <input
                  type="text"
                  value={furnitureSearchQuery}
                  onChange={(e) => setFurnitureSearchQuery(e.target.value)}
                  placeholder={
                    activeFurnitureTab === 'SOFA' ? 'Search sofa models...' : 'Search door models...'
                  }
                  className="w-full h-7 pl-6 pr-5 text-[11px] bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium focus:ring-1 focus:ring-amber-500 focus:bg-white outline-none"
                />
                {furnitureSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setFurnitureSearchQuery('')}
                    className="absolute right-1.5 top-1.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2C. Interactive "Hover Down" Drawer for Electrical Utilities (AC, Fan, Light, Camera) */}
      {activeDrawer === 'UTILITY' && (
        <div className="bg-slate-50 border border-teal-200 rounded-xl p-2.5 shadow-xs space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1.5 border-b border-slate-200/80">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
              <h4 className="text-xs font-bold text-slate-900">
                Types of Electrical Utilities ({categoryCounts.UTILITY} Total Units)
              </h4>
              <span className="text-slate-400 text-xs">•</span>
              <span className="text-[10px] text-slate-500 font-medium">
                AC, Fan, Light, Camera
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {selectedUtilitySubtype !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => setSelectedUtilitySubtype('ALL')}
                  className="px-2 py-0.5 text-[10px] font-bold text-teal-700 bg-teal-100/70 hover:bg-teal-200 rounded-md transition cursor-pointer flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  <span>Show All Utilities</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setActiveDrawer('NONE')}
                className="px-2 py-0.5 text-[10px] font-semibold text-slate-500 hover:text-slate-800 bg-white border border-slate-200 hover:bg-slate-100 rounded-md transition cursor-pointer"
              >
                Close Drawer ▲
              </button>
            </div>
          </div>

          {/* 4 Utility Subtype Widgets: AC, Fan, Light, Camera */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {utilitySubtypesConfig.map((sub) => {
              const isSubActive = selectedUtilitySubtype === sub.id;
              const Icon = sub.icon;

              return (
                <div
                  key={sub.id}
                  onClick={() =>
                    setSelectedUtilitySubtype(isSubActive ? 'ALL' : sub.id)
                  }
                  className={`p-2 rounded-lg border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between h-[66px] ${
                    isSubActive
                      ? sub.activeBorder
                      : 'bg-white border-slate-200/90 hover:border-slate-300 hover:shadow-2xs'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <h5 className="text-[11px] font-bold text-slate-900 truncate flex-1">
                      {sub.title}
                    </h5>
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center border shrink-0 ${sub.colorBg}`}
                    >
                      <Icon className="w-3 h-3" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm font-black font-mono tracking-tight text-slate-900">
                        {sub.count}
                      </span>
                      <span className="text-[9px] text-slate-400 font-medium">units</span>
                    </div>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        isSubActive
                          ? 'bg-teal-600 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {isSubActive ? 'Active ✓' : 'Filter'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2D. Interactive "Hover Down" Drawer for Vehicles (Car, Auto, Tempo, Lorry, Bus) */}
      {activeDrawer === 'VEHICLE' && (
        <div className="bg-slate-50 border border-rose-200 rounded-xl p-2.5 shadow-xs space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1.5 border-b border-slate-200/80">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
              <h4 className="text-xs font-bold text-slate-900">
                Types of Vehicles ({categoryCounts.VEHICLE} Total Units)
              </h4>
              <span className="text-slate-400 text-xs">•</span>
              <span className="text-[10px] text-slate-500 font-medium">
                Car, Auto, Tempo, Lorry, Bus
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {selectedVehicleSubtype !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => setSelectedVehicleSubtype('ALL')}
                  className="px-2 py-0.5 text-[10px] font-bold text-rose-700 bg-rose-100/70 hover:bg-rose-200 rounded-md transition cursor-pointer flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  <span>Show All Vehicles</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setActiveDrawer('NONE')}
                className="px-2 py-0.5 text-[10px] font-semibold text-slate-500 hover:text-slate-800 bg-white border border-slate-200 hover:bg-slate-100 rounded-md transition cursor-pointer"
              >
                Close Drawer ▲
              </button>
            </div>
          </div>

          {/* 5 Vehicle Subtype Widgets: Car, Auto, Tempo, Lorry, Bus */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {vehicleSubtypesConfig.map((sub) => {
              const isSubActive = selectedVehicleSubtype === sub.id;
              const Icon = sub.icon;

              return (
                <div
                  key={sub.id}
                  onClick={() =>
                    setSelectedVehicleSubtype(isSubActive ? 'ALL' : sub.id)
                  }
                  className={`p-2 rounded-lg border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between h-[66px] ${
                    isSubActive
                      ? sub.activeBorder
                      : 'bg-white border-slate-200/90 hover:border-slate-300 hover:shadow-2xs'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <h5 className="text-[11px] font-bold text-slate-900 truncate flex-1">
                      {sub.title}
                    </h5>
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center border shrink-0 ${sub.colorBg}`}
                    >
                      <Icon className="w-3 h-3" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm font-black font-mono tracking-tight text-slate-900">
                        {sub.count}
                      </span>
                      <span className="text-[9px] text-slate-400 font-medium">units</span>
                    </div>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        isSubActive
                          ? 'bg-rose-600 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {isSubActive ? 'Active ✓' : 'Filter'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Monthly Maintenance Allowance Ledger Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col overflow-hidden">
        {/* 2-Tier Unified Responsive Filter & Grouping Toolbar */}
        <div className="p-2.5 sm:p-3 border-b border-slate-200 bg-white space-y-2.5">
          {/* Row 1: Search, Rows Count, KPI Chips & Action Buttons */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
            {/* Search Bar */}
            <div className="relative w-full lg:w-72">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Find asset, ID, company, location, cost…"
                className="w-full h-8 pl-8 pr-6 text-xs bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-lg text-slate-800 focus:ring-1 focus:ring-indigo-500 outline-none transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 cursor-pointer text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* KPI Chips & Actions Strip */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-between lg:justify-end w-full lg:w-auto">
              {/* Row counter badge */}
              <span className="text-[11px] sm:text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 sm:py-1.5 rounded-lg border border-slate-200 select-none whitespace-nowrap">
                {filteredItems.length} rows
              </span>

              {/* Purchase Value chip */}
              <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-[11px] font-semibold">
                <span>Value:</span>
                <span className="font-mono font-bold text-slate-900">
                  ₹{filteredCostTotals.purchasePrice.toLocaleString('en-IN')}
                </span>
              </div>

              {/* Total Repairs chip */}
              <div className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 text-[11px] font-semibold">
                <span>Repairs:</span>
                <span className="font-mono font-bold">
                  ₹{filteredCostTotals.totalRepairCost.toLocaleString('en-IN')}
                </span>
              </div>

              {/* Preventive Maint chip */}
              <div className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-900 text-[11px] font-semibold">
                <span>Preventive:</span>
                <span className="font-mono font-bold">
                  ₹{filteredCostTotals.preventiveMaintenancePrice.toLocaleString('en-IN')}
                </span>
              </div>

              {/* Predicted Prev chip */}
              <div className="hidden 2xl:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 border border-purple-200 text-purple-900 text-[11px] font-semibold">
                <Sparkles className="w-3 h-3 text-purple-500" />
                <span>Predicted:</span>
                <span className="font-mono font-bold">
                  ₹{filteredCostTotals.predictedPreventiveCost.toLocaleString('en-IN')}
                </span>
              </div>

              {/* Collapse/Expand All (when groupBy is active) */}
              {groupBy !== 'NONE' && (
                <button
                  type="button"
                  onClick={toggleCollapseAll}
                  className="h-8 px-2 sm:px-2.5 text-[11px] sm:text-xs font-semibold bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 flex items-center gap-1 transition cursor-pointer shadow-2xs whitespace-nowrap"
                  title={allSectionsCollapsed ? 'Expand all sections' : 'Collapse all sections'}
                >
                  {allSectionsCollapsed ? (
                    <>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                      <span>Expand All</span>
                    </>
                  ) : (
                    <>
                      <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                      <span>Collapse All</span>
                    </>
                  )}
                </button>
              )}

              {/* Export CSV Button */}
              <button
                type="button"
                onClick={handleExportFilteredData}
                className="h-8 px-2.5 sm:px-3 text-[11px] sm:text-xs font-bold bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-200 rounded-lg text-slate-800 inline-flex items-center gap-1.5 cursor-pointer shadow-2xs transition whitespace-nowrap"
                title="Export filtered records to CSV"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                <span>Export</span>
              </button>
            </div>
          </div>

          {/* Row 2: Responsive Cascading Filter Bar */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
            {/* 1. Group Filter */}
            <div className="flex items-center gap-1 flex-1 sm:flex-initial min-w-[125px]">
              <span className="text-[11px] sm:text-xs font-semibold text-slate-700 whitespace-nowrap">Group:</span>
              <select
                value={selectedCategory}
                onChange={(e) => {
                  const val = e.target.value as any;
                  setSelectedCategory(val);
                  setActiveDrawer(val === 'ALL' ? 'NONE' : val);
                  setSubCategoryFilter('ALL');
                  setLocationFilter('ALL');
                }}
                className="w-full sm:w-auto h-8 px-2 text-[11px] sm:text-xs font-bold bg-white border border-slate-300 rounded-lg text-slate-800 shadow-2xs focus:ring-1 focus:ring-indigo-500 cursor-pointer truncate"
              >
                <option value="ALL">All Groups</option>
                <option value="MACHINE">Machine</option>
                <option value="FURNITURE">Furniture</option>
                <option value="UTILITY">Utilities</option>
                <option value="VEHICLE">Vehicle</option>
              </select>
            </div>

            {/* 2. Category / Sub-Category Filter (Cascading) */}
            <div className="flex items-center gap-1 flex-1 sm:flex-initial min-w-[135px] max-w-full sm:max-w-[165px]">
              <span className="text-[11px] sm:text-xs font-medium text-slate-600 whitespace-nowrap">Category:</span>
              <select
                value={subCategoryFilter}
                onChange={(e) => {
                  setSubCategoryFilter(e.target.value);
                  setLocationFilter('ALL');
                }}
                className="w-full h-8 px-2 text-[11px] sm:text-xs font-semibold bg-white border border-slate-300 rounded-lg text-slate-800 shadow-2xs focus:ring-1 focus:ring-indigo-500 cursor-pointer truncate"
              >
                <option value="ALL">All Categories</option>
                {availableSubCategories.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Location Filter (Cascading) */}
            <div className="flex items-center gap-1 flex-1 sm:flex-initial min-w-[125px] max-w-full sm:max-w-[155px]">
              <span className="text-[11px] sm:text-xs font-medium text-slate-600 whitespace-nowrap">Location:</span>
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="w-full h-8 px-2 text-[11px] sm:text-xs font-semibold bg-white border border-slate-300 rounded-lg text-slate-800 shadow-2xs focus:ring-1 focus:ring-indigo-500 cursor-pointer truncate"
              >
                <option value="ALL">All Locations</option>
                {availableLocations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Repair Cost Filter */}
            <div className="flex items-center gap-1 flex-1 sm:flex-initial min-w-[125px] max-w-full sm:max-w-[145px]">
              <span className="text-[11px] sm:text-xs font-medium text-slate-600 whitespace-nowrap">Repair Cost:</span>
              <select
                value={repairCostFilter}
                onChange={(e) => setRepairCostFilter(e.target.value as any)}
                className="w-full h-8 px-2 text-[11px] sm:text-xs font-semibold bg-white border border-slate-300 rounded-lg text-slate-800 shadow-2xs focus:ring-1 focus:ring-indigo-500 cursor-pointer truncate"
              >
                <option value="ALL">All Costs</option>
                <option value="HAS_COST">Has Cost (&gt; ₹0)</option>
                <option value="ZERO">Zero (₹0)</option>
                <option value="UNDER_500">&lt; ₹500</option>
                <option value="500_TO_1500">₹500 – ₹1,500</option>
                <option value="OVER_1500">&gt; ₹1,500</option>
              </select>
            </div>

            {/* 5. Purchase Date Range Filter */}
            <div className="flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200 w-full sm:w-auto">
              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="text-[11px] sm:text-xs font-medium text-slate-600 whitespace-nowrap">Purchase:</span>
              <input
                type="date"
                value={purchaseFromDate}
                onChange={(e) => setPurchaseFromDate(e.target.value)}
                className="flex-1 sm:flex-initial h-7 px-1.5 text-[11px] sm:text-xs bg-white border border-slate-200 rounded text-slate-700 outline-none min-w-[110px]"
                title="Purchase Date From"
              />
              <span className="text-[11px] text-slate-400 font-medium">to</span>
              <input
                type="date"
                value={purchaseToDate}
                onChange={(e) => setPurchaseToDate(e.target.value)}
                className="flex-1 sm:flex-initial h-7 px-1.5 text-[11px] sm:text-xs bg-white border border-slate-200 rounded text-slate-700 outline-none min-w-[110px]"
                title="Purchase Date To"
              />
            </div>

            {/* 6. Preventive Maintenance Cost Filter */}
            <div className="flex items-center gap-1 flex-1 sm:flex-initial min-w-[145px] max-w-full sm:max-w-[185px]">
              <span className="text-[11px] sm:text-xs font-medium text-slate-600 whitespace-nowrap">PPM Cost:</span>
              <select
                value={preventiveCostFilter}
                onChange={(e) => setPreventiveCostFilter(e.target.value as any)}
                className="w-full h-8 px-2 text-[11px] sm:text-xs font-semibold bg-white border border-slate-300 rounded-lg text-slate-800 shadow-2xs focus:ring-1 focus:ring-indigo-500 cursor-pointer truncate"
              >
                <option value="ALL">All PPM Costs</option>
                <option value="HAS_COST">Has PPM (&gt; ₹0)</option>
                <option value="ZERO">Zero PPM (₹0)</option>
                <option value="UNDER_1500">&lt; ₹1,500</option>
                <option value="1500_TO_3500">₹1,500 – ₹3,500</option>
                <option value="OVER_3500">&gt; ₹3,500</option>
              </select>
            </div>

            {/* 7. Budget Status Filter */}
            <div className="flex items-center gap-1 flex-1 sm:flex-initial min-w-[125px] max-w-full sm:max-w-[155px]">
              <span className="text-[11px] sm:text-xs font-medium text-slate-600 whitespace-nowrap">Budget:</span>
              <select
                value={budgetFilter}
                onChange={(e) => setBudgetFilter(e.target.value as any)}
                className="w-full h-8 px-2 text-[11px] sm:text-xs font-semibold bg-white border border-slate-300 rounded-lg text-slate-800 shadow-2xs focus:ring-1 focus:ring-indigo-500 cursor-pointer truncate"
              >
                <option value="ALL">All Budgets</option>
                <option value="WITHIN_BUDGET">Within Budget</option>
                <option value="NEAR_LIMIT">Near Limit (&gt;85%)</option>
                <option value="OVER_BUDGET">Over Budget</option>
              </select>
            </div>

            {/* 8. Group Rows Selector */}
            <div className="flex items-center gap-1 flex-1 sm:flex-initial min-w-[125px]">
              <span className="text-[11px] sm:text-xs font-medium text-slate-500 whitespace-nowrap">Group Rows:</span>
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as any)}
                className="w-full sm:w-auto h-8 px-2 text-[11px] sm:text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-700 shadow-2xs focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="NONE">No Grouping (Flat)</option>
                <option value="CATEGORY">By Group</option>
                <option value="SUBCATEGORY">By Sub-Category</option>
                <option value="LOCATION">By Location</option>
                <option value="RELOCATION">By Relocation</option>
                <option value="BUDGET">By Budget Status</option>
              </select>
            </div>

            {/* 9. Reset Filters Button if any filter active */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="h-8 px-2.5 text-[11px] sm:text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition cursor-pointer flex items-center gap-1 ml-auto"
                title="Reset all filters to default"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        </div>

        {/* Flat Table View (when groupBy === 'NONE') */}
        {groupBy === 'NONE' && (
          filteredItems.length === 0 ? (
            <div className="p-16 text-center text-slate-400 text-xs font-medium">
              No records found matching the criteria.
            </div>
          ) : (
            <div
              className="flex flex-col flex-1 overflow-x-auto overflow-y-auto border border-slate-300 rounded-lg shadow-2xs"
              style={{ maxHeight: '460px' }}
            >
              <table className="w-full text-left text-xs text-slate-800 border-collapse border border-slate-300">
                <thead className="sticky top-0 z-20 bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider shadow-xs select-none">
                  <tr className="border-b border-slate-300">
                    <th className="py-2.5 px-3 w-12 text-center bg-slate-200/80 border-r border-b border-slate-300 text-slate-600 font-mono">#</th>
                    <th className="py-2.5 px-3.5 bg-slate-100 border-r border-b border-slate-300 min-w-[210px]">Name</th>
                    <th className="py-2.5 px-3 bg-slate-100 border-r border-b border-slate-300 w-28 font-mono">Asset ID</th>
                    <th className="py-2.5 px-3 bg-slate-100 border-r border-b border-slate-300 text-right font-mono">Purchase Price</th>
                    <th className="py-2.5 px-3 bg-slate-100 border-r border-b border-slate-300 text-right font-mono">Total Repair Cost</th>
                    <th className="py-2.5 px-3 bg-slate-100 border-r border-b border-slate-300 text-right font-mono">Recent Repair Cost</th>
                    <th className="py-2.5 px-3 bg-slate-100 border-r border-b border-slate-300 text-right font-mono">Preventive Maint.</th>
                    <th className="py-2.5 px-3 bg-slate-100 border-b border-slate-300 text-right font-mono">Predicted Prev. Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-medium bg-white">
                  {filteredItems.map((item, idx) => {
                    const isReloc = isItemRelocated(item, machines);
                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-blue-50/60 transition-colors duration-100 even:bg-slate-50/40 group"
                      >
                        {/* 1. S.No */}
                        <td className="py-2 px-3 text-center font-mono font-semibold text-slate-500 bg-slate-50/80 group-hover:bg-blue-50/60 border-r border-b border-slate-200 select-none">
                          {idx + 1}
                        </td>

                        {/* 2. Name */}
                        <td className="py-2 px-3.5 border-r border-b border-slate-200">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-900 leading-tight group-hover:text-indigo-700">{item.name}</span>
                              {isReloc && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                  Relocated
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] font-semibold text-slate-500">
                                {item.company}
                              </span>
                              <span className="text-[10px] text-slate-300">•</span>
                              <span className="text-[10px] font-medium text-indigo-700 bg-indigo-50 px-1 py-0.2 rounded border border-indigo-100">
                                {getAssetSubCategory(item)}
                              </span>
                              <span className="text-[10px] text-slate-300">•</span>
                              <span className="text-[10px] text-slate-400">
                                {item.relocation}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 3. ID */}
                        <td className="py-2 px-3 border-r border-b border-slate-200">
                          <span className="font-mono text-[11px] font-bold bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-300 inline-block">
                            {item.id}
                          </span>
                        </td>

                        {/* 4. Purchase Price */}
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 border-r border-b border-slate-200 tabular-nums">
                          ₹{(item.purchasePrice || 0).toLocaleString('en-IN')}
                        </td>

                        {/* 5. Total Repair Cost */}
                        <td className="py-2 px-3 text-right border-r border-b border-slate-200 tabular-nums">
                          <span className="font-mono font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 inline-block text-[11px]">
                            ₹{(item.totalRepairCost || 0).toLocaleString('en-IN')}
                          </span>
                        </td>

                        {/* 6. Recent Repair Cost */}
                        <td className="py-2 px-3 text-right border-r border-b border-slate-200 tabular-nums">
                          <span className="font-mono font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-block text-[11px]">
                            ₹{(item.recentRepairCost || 0).toLocaleString('en-IN')}
                          </span>
                        </td>

                        {/* 7. Preventive Maintenance Price */}
                        <td className="py-2 px-3 text-right border-r border-b border-slate-200 tabular-nums">
                          <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 inline-block text-[11px]">
                            ₹{(item.preventiveMaintenancePrice || 0).toLocaleString('en-IN')}
                          </span>
                        </td>

                        {/* 8. Predicted Preventive Cost */}
                        <td className="py-2 px-3 text-right border-b border-slate-200 tabular-nums">
                          <span className="inline-flex items-center gap-1 font-mono font-bold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-lg border border-purple-200 text-[11px] shadow-2xs">
                            <Sparkles className="w-3 h-3 text-purple-500 shrink-0" />
                            <span>₹{(item.predictedPreventiveCost || 0).toLocaleString('en-IN')}</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* Grouped Table View (when groupBy !== 'NONE') */}
        {groupBy !== 'NONE' && (
          <div className="space-y-3 p-3 bg-slate-50/50">
            {groupedSections.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs font-medium bg-white rounded-xl border border-slate-200">
                No matching grouped records found.
              </div>
            ) : (
              groupedSections.map((sec) => {
                const isCollapsed = collapsedSections.includes(sec.id);
                const SecIcon = sec.icon;

                return (
                  <div
                    key={sec.id}
                    className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden"
                  >
                    {/* Section Header Accordion Bar */}
                    <div
                      onClick={() => toggleSection(sec.id)}
                      className="px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100/80 transition-colors border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5 cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
                          <SecIcon className="w-4 h-4" />
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-slate-900">{sec.title}</h4>
                            <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-slate-200/80 text-slate-700">
                              {sec.items.length} units
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500">{sec.subtitle}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="hidden sm:flex items-center gap-2 text-[11px]">
                          <span className="text-slate-500 font-medium">Purchase:</span>
                          <span className="font-mono font-bold text-slate-800">₹{sec.totalPurchase.toLocaleString('en-IN')}</span>
                          <span className="text-slate-300">•</span>
                          <span className="text-slate-500 font-medium">Repairs:</span>
                          <span className="font-mono font-bold text-rose-700">₹{sec.totalRepairs.toLocaleString('en-IN')}</span>
                          <span className="text-slate-300">•</span>
                          <span className="text-slate-500 font-medium">Allowance:</span>
                          <span className="font-mono font-bold text-indigo-700">₹{sec.totalAllowance.toLocaleString('en-IN')}</span>
                        </div>

                        <button
                          type="button"
                          className="p-1 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-200/60"
                        >
                          {isCollapsed ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronUp className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Section Table Body (when not collapsed) */}
                    {!isCollapsed && (
                      <div
                        className="overflow-x-auto overflow-y-auto"
                        style={{ maxHeight: '350px' }}
                      >
                        <table className="w-full text-left text-xs text-slate-800 border-collapse border border-slate-300">
                          <thead className="sticky top-0 z-10 bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider select-none border-b border-slate-300">
                            <tr>
                              <th className="py-2 px-3 w-12 text-center bg-slate-200/80 border-r border-b border-slate-300 text-slate-600 font-mono">#</th>
                              <th className="py-2 px-3.5 bg-slate-100 border-r border-b border-slate-300 min-w-[200px]">Name</th>
                              <th className="py-2 px-3 bg-slate-100 border-r border-b border-slate-300 w-28 font-mono">Asset ID</th>
                              <th className="py-2 px-3 bg-slate-100 border-r border-b border-slate-300 text-right font-mono">Purchase Price</th>
                              <th className="py-2 px-3 bg-slate-100 border-r border-b border-slate-300 text-right font-mono">Total Repair Cost</th>
                              <th className="py-2 px-3 bg-slate-100 border-r border-b border-slate-300 text-right font-mono">Recent Repair Cost</th>
                              <th className="py-2 px-3 bg-slate-100 border-r border-b border-slate-300 text-right font-mono">Preventive Maint.</th>
                              <th className="py-2 px-3 bg-slate-100 border-b border-slate-300 text-right font-mono">Predicted Prev. Cost</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 font-medium bg-white">
                            {sec.items.map((item, idx) => {
                              const isReloc = isItemRelocated(item, machines);
                              return (
                                <tr
                                  key={item.id}
                                  className="hover:bg-blue-50/60 transition-colors duration-100 even:bg-slate-50/40 group"
                                >
                                  <td className="py-2 px-3 text-center font-mono font-semibold text-slate-500 bg-slate-50/80 group-hover:bg-blue-50/60 border-r border-b border-slate-200 select-none">
                                    {idx + 1}
                                  </td>
                                  <td className="py-2 px-3.5 border-r border-b border-slate-200">
                                    <div className="flex flex-col">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="font-bold text-slate-900 leading-tight group-hover:text-indigo-700">{item.name}</span>
                                        {isReloc && (
                                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                            Relocated
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1.5 mt-0.5">
                                        <span className="text-[10px] font-semibold text-slate-500">
                                          {item.company}
                                        </span>
                                        <span className="text-[10px] text-slate-300">•</span>
                                        <span className="text-[10px] font-medium text-indigo-700 bg-indigo-50 px-1 py-0.2 rounded border border-indigo-100">
                                          {getAssetSubCategory(item)}
                                        </span>
                                        <span className="text-[10px] text-slate-300">•</span>
                                        <span className="text-[10px] text-slate-400">
                                          {item.relocation}
                                        </span>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-2 px-3 border-r border-b border-slate-200">
                                    <span className="font-mono text-[11px] font-bold bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-300 inline-block">
                                      {item.id}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 border-r border-b border-slate-200 tabular-nums">
                                    ₹{(item.purchasePrice || 0).toLocaleString('en-IN')}
                                  </td>
                                  <td className="py-2 px-3 text-right border-r border-b border-slate-200 tabular-nums">
                                    <span className="font-mono font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 inline-block text-[11px]">
                                      ₹{(item.totalRepairCost || 0).toLocaleString('en-IN')}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 text-right border-r border-b border-slate-200 tabular-nums">
                                    <span className="font-mono font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-block text-[11px]">
                                      ₹{(item.recentRepairCost || 0).toLocaleString('en-IN')}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 text-right border-r border-b border-slate-200 tabular-nums">
                                    <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 inline-block text-[11px]">
                                      ₹{(item.preventiveMaintenancePrice || 0).toLocaleString('en-IN')}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 text-right border-b border-slate-200 tabular-nums">
                                    <span className="inline-flex items-center gap-1 font-mono font-bold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-lg border border-purple-200 text-[11px] shadow-2xs">
                                      <Sparkles className="w-3 h-3 text-purple-500 shrink-0" />
                                      <span>₹{(item.predictedPreventiveCost || 0).toLocaleString('en-IN')}</span>
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Footer Info */}
        <div className="p-3 bg-slate-50 border-t border-slate-200/80 text-[11px] text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            Displaying {filteredItems.length} of {allItems.length} asset cost records • Filtered Value: ₹
            {filteredCostTotals.purchasePrice.toLocaleString('en-IN')} (Fleet Total: ₹{costTotals.purchasePrice.toLocaleString('en-IN')})
          </span>
          <span className="font-medium text-slate-400">
            {activeDrawer === 'MACHINE'
              ? 'Select machine type to filter'
              : activeDrawer === 'FURNITURE'
              ? 'Use furniture search or dropdowns to filter specific records'
              : 'Use toolbar filters or category cards to slice fleet records'}
          </span>
        </div>
      </div>
    </div>
  );
}
