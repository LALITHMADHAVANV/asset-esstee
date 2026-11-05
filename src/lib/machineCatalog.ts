import { MachineType, AssetCategory } from '@/types/cmms';

export type MachineCategoryGroup = 'OVERLOCK' | 'FLATLOCK' | 'SINGLE_NEEDLE';

export interface MachineSubtypeDef {
  id: MachineType;
  name: string;
  category: MachineCategoryGroup;
  categoryName: string;
  brands: string[];
  defaultBrand: string;
  defaultModel: string;
  specs: string;
}

export interface MachineCategoryDef {
  id: MachineCategoryGroup;
  name: string;
  description: string;
  brands: string[];
  subtypes: MachineSubtypeDef[];
}

export const MACHINE_CATALOG: MachineCategoryDef[] = [
  {
    id: 'OVERLOCK',
    name: 'Overlock Machine',
    description: 'High-speed edge overedging, seaming, and trimming machinery',
    brands: ['Yamato', 'Supreme', 'Pegasus', 'Juki'],
    subtypes: [
      {
        id: 'OVERLOCK_4_THREAD',
        name: '4 Thread Overlock',
        category: 'OVERLOCK',
        categoryName: 'Overlock',
        brands: ['Yamato', 'Supreme', 'Pegasus'],
        defaultBrand: 'Yamato',
        defaultModel: 'AZ-8000G / 4-Thread High-Speed',
        specs: '4-thread safety stitch, differential feed ratio 1:0.7–1:2, max 7,500 RPM, auto-lubrication',
      },
      {
        id: 'OVERLOCK_RIB_THREAD',
        name: 'Rib Thread Overlock',
        category: 'OVERLOCK',
        categoryName: 'Overlock',
        brands: ['Yamato', 'Supreme'],
        defaultBrand: 'Yamato',
        defaultModel: 'AZ-8500-Rib Attacher',
        specs: 'Pneumatic rib collar feeder, tension-controlled rib knit insertion, 7,000 RPM',
      },
      {
        id: 'OVERLOCK_LFC',
        name: 'LFC Overlock',
        category: 'OVERLOCK',
        categoryName: 'Overlock',
        brands: ['Yamato', 'Supreme'],
        defaultBrand: 'Supreme',
        defaultModel: 'SP-LFC-900 Electronic',
        specs: 'Light/Fine cloth edge overlock, micro-sensor needle positioning, 6,800 RPM',
      },
    ],
  },
  {
    id: 'FLATLOCK',
    name: 'Flatlock Machine',
    description: 'Interlock and coverstitch sewing machinery for activewear and knitwear',
    brands: ['Yamato', 'Pegasus', 'Juki'],
    subtypes: [
      {
        id: 'FLATLOCK_HEMMING',
        name: 'Hemming Flatlock',
        category: 'FLATLOCK',
        categoryName: 'Flatlock',
        brands: ['Yamato', 'Pegasus'],
        defaultBrand: 'Yamato',
        defaultModel: 'VG-2700-Hemming / UTT',
        specs: 'Bottom hem blindfold guide, auto underbed thread trimmer (UTT), 3-needle 5-thread, 6,000 RPM',
      },
      {
        id: 'FLATLOCK_SMALL_CYLINDER',
        name: 'Small Cylinder Bed Flatlock',
        category: 'FLATLOCK',
        categoryName: 'Flatlock',
        brands: ['Yamato'],
        defaultBrand: 'Yamato',
        defaultModel: 'VG-3721-SCB Small Cylinder',
        specs: '180mm mini cylinder circumference for tubular children cuffs and ankle openings, 5,500 RPM',
      },
      {
        id: 'FLATLOCK_CYLINDER_BED',
        name: 'Cylinder Bed Flatlock',
        category: 'FLATLOCK',
        categoryName: 'Flatlock',
        brands: ['Yamato', 'Pegasus'],
        defaultBrand: 'Yamato',
        defaultModel: 'VG-2700-CB Cylinder Bed',
        specs: 'Tubular garment assembly, 280mm cylinder bed circumference, top and bottom coverstitch',
      },
      {
        id: 'FLATLOCK_FLAT_BED',
        name: 'Flat Bed Flatlock',
        category: 'FLATLOCK',
        categoryName: 'Flatlock',
        brands: ['Yamato'],
        defaultBrand: 'Yamato',
        defaultModel: 'VF-2500-Flat Bed Series',
        specs: 'Spacious wide flatbed work area for panels, decorative flat seaming, differential feed',
      },
      {
        id: 'FLATLOCK_VT',
        name: 'VT Flatlock',
        category: 'FLATLOCK',
        categoryName: 'Flatlock',
        brands: ['Yamato'],
        defaultBrand: 'Yamato',
        defaultModel: 'VT-1500-Pro High-Lift',
        specs: 'Variable Top-feed coverstitch with synchronized upper looper motion, 6,000 RPM',
      },
      {
        id: 'FLATLOCK_TOP_ELASTIC',
        name: 'Top Elastic Flatlock',
        category: 'FLATLOCK',
        categoryName: 'Flatlock',
        brands: ['Yamato'],
        defaultBrand: 'Yamato',
        defaultModel: 'VG-2790-ET Top Elastic Attacher',
        specs: 'Computerized stepping motor elastic tape meter & feed mechanism, right-edge fabric trimmer',
      },
    ],
  },
  {
    id: 'SINGLE_NEEDLE',
    name: 'Single Needle Machine',
    description: 'Precision automated single needle indexers, button attachers, and bartack machines',
    brands: ['Brother', 'Supreme', 'Juki', 'Jack'],
    subtypes: [
      {
        id: 'SN_BROTHER_KAJA',
        name: 'Brother KAJA (Buttonhole)',
        category: 'SINGLE_NEEDLE',
        categoryName: 'Single Needle Machine',
        brands: ['Brother', 'Supreme'],
        defaultBrand: 'Brother',
        defaultModel: 'HE-800B KAJA Electronic',
        specs: 'Electronic indexer, pulse motor knife drop, 21 preset buttonhole eyelet stitch patterns',
      },
      {
        id: 'SN_BROTHER_BUTTON_STITCH',
        name: 'Brother Button Stitch',
        category: 'SINGLE_NEEDLE',
        categoryName: 'Single Needle Machine',
        brands: ['Brother', 'Supreme'],
        defaultBrand: 'Brother',
        defaultModel: 'BE-438F Direct-Drive Button Attacher',
        specs: 'Direct-drive lockstitch button sewing, quick-change clamp for 2-hole & 4-hole buttons',
      },
      {
        id: 'SN_BROTHER_BARTACK',
        name: 'Brother Bartack',
        category: 'SINGLE_NEEDLE',
        categoryName: 'Single Needle Machine',
        brands: ['Brother', 'Supreme'],
        defaultBrand: 'Brother',
        defaultModel: 'KE-430FS Electronic Direct-Drive Bartack',
        specs: 'High-speed 3,200 SPM electronic bartacker, direct-drive servo, 89 programmed patterns',
      },
      {
        id: 'SNLS',
        name: 'Single Needle Lockstitch (SNLS)',
        category: 'SINGLE_NEEDLE',
        categoryName: 'Single Needle Machine',
        brands: ['Juki', 'Brother', 'Jack'],
        defaultBrand: 'Juki',
        defaultModel: 'DDL-8700-7 Direct-Drive SNLS',
        specs: 'Automatic thread trimmer, programmable backtack, direct-drive servo, 5,000 SPM',
      },
      {
        id: 'DNLS',
        name: 'Double Needle Lockstitch (DNLS)',
        category: 'SINGLE_NEEDLE',
        categoryName: 'Single Needle Machine',
        brands: ['Brother', 'Juki'],
        defaultBrand: 'Brother',
        defaultModel: 'T-8422C Direct-Drive Twin Needle',
        specs: 'Parallel twin needle seaming, needle feed prevents slip, automatic wiper & trimmer',
      },
      {
        id: 'CUTTING_MACHINE',
        name: 'Fabric End / Straight Knife Cutter',
        category: 'SINGLE_NEEDLE',
        categoryName: 'Cutting Machinery',
        brands: ['Eastman', 'KM', 'Blue Streak'],
        defaultBrand: 'Eastman',
        defaultModel: 'Blue Streak II 8-inch 629X',
        specs: 'Heavy-duty 8-inch straight knife cloth cutter with automatic abrasive belt sharpener',
      },
      {
        id: 'FUSING_PRESS',
        name: 'Collar / Cuff Fusing Press',
        category: 'SINGLE_NEEDLE',
        categoryName: 'Pressing Machinery',
        brands: ['Hashima', 'Oshima'],
        defaultBrand: 'Hashima',
        defaultModel: 'HP-450MS Continuous Fusing Press',
        specs: 'Electronic temperature governor, seamless teflon belt, pneumatic pressure rollers',
      },
    ],
  },
];

// ============================================================================
// COMPREHENSIVE ALL-ASSET CATALOG (MACHINES, TABLES, CHAIRS, UTILITIES)
// ============================================================================

export interface AssetSubtypeDef {
  id: MachineType;
  name: string;
  category: AssetCategory;
  brands: string[];
  defaultBrand: string;
  defaultModel: string;
  defaultCost: number;
  idPrefix: string;
  specs: string;
}

export interface AssetCategoryMeta {
  id: AssetCategory;
  name: string;
  singular: string;
  description: string;
  iconName: 'Wrench' | 'LayoutGrid' | 'Armchair' | 'Zap' | 'Truck';
  badgeColor: string;
  idPrefix: string;
  subtypes: AssetSubtypeDef[];
}

export const ASSET_CATEGORIES: AssetCategoryMeta[] = [
  {
    id: 'MACHINE',
    name: 'Sewing & Industrial Machinery',
    singular: 'Machine',
    description: 'Overlock, Flatlock, Lockstitch, Buttonhole & Cutting machinery',
    iconName: 'Wrench',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    idPrefix: 'MC-',
    subtypes: [
      {
        id: 'OVERLOCK_4_THREAD',
        name: '4 Thread Overlock',
        category: 'MACHINE',
        brands: ['Yamato', 'Supreme', 'Pegasus', 'Juki'],
        defaultBrand: 'Yamato',
        defaultModel: 'AZ-8000G / 4-Thread High-Speed',
        defaultCost: 75000,
        idPrefix: 'MC-OVK-4TH-',
        specs: '4-thread safety stitch, differential feed ratio 1:0.7–1:2, max 7,500 RPM, auto-lubrication',
      },
      {
        id: 'OVERLOCK_RIB_THREAD',
        name: 'Rib Thread Overlock',
        category: 'MACHINE',
        brands: ['Yamato', 'Supreme'],
        defaultBrand: 'Yamato',
        defaultModel: 'AZ-8500-Rib Attacher',
        defaultCost: 82000,
        idPrefix: 'MC-OVK-RIB-',
        specs: 'Pneumatic rib collar feeder, tension-controlled rib knit insertion, 7,000 RPM',
      },
      {
        id: 'OVERLOCK_LFC',
        name: 'LFC Overlock',
        category: 'MACHINE',
        brands: ['Supreme', 'Yamato'],
        defaultBrand: 'Supreme',
        defaultModel: 'SP-LFC-900 Electronic',
        defaultCost: 78000,
        idPrefix: 'MC-OVK-LFC-',
        specs: 'Light/Fine cloth edge overlock, micro-sensor needle positioning, 6,800 RPM',
      },
      {
        id: 'FLATLOCK_HEMMING',
        name: 'Hemming Flatlock',
        category: 'MACHINE',
        brands: ['Yamato', 'Pegasus'],
        defaultBrand: 'Yamato',
        defaultModel: 'VG-2700-Hemming / UTT',
        defaultCost: 120000,
        idPrefix: 'MC-FLK-HEM-',
        specs: 'Bottom hem blindfold guide, auto underbed thread trimmer (UTT), 3-needle 5-thread, 6,000 RPM',
      },
      {
        id: 'FLATLOCK_SMALL_CYLINDER',
        name: 'Small Cylinder Bed Flatlock',
        category: 'MACHINE',
        brands: ['Yamato'],
        defaultBrand: 'Yamato',
        defaultModel: 'VG-3721-SCB Small Cylinder',
        defaultCost: 135000,
        idPrefix: 'MC-FLK-SMC-',
        specs: '180mm mini cylinder circumference for tubular children cuffs and ankle openings, 5,500 RPM',
      },
      {
        id: 'FLATLOCK_CYLINDER_BED',
        name: 'Cylinder Bed Flatlock',
        category: 'MACHINE',
        brands: ['Yamato', 'Pegasus'],
        defaultBrand: 'Yamato',
        defaultModel: 'VG-2700-CB Cylinder Bed',
        defaultCost: 128000,
        idPrefix: 'MC-FLK-CYL-',
        specs: 'Tubular garment assembly, 280mm cylinder bed circumference, top and bottom coverstitch',
      },
      {
        id: 'FLATLOCK_FLAT_BED',
        name: 'Flat Bed Flatlock',
        category: 'MACHINE',
        brands: ['Yamato'],
        defaultBrand: 'Yamato',
        defaultModel: 'VF-2500-Flat Bed Series',
        defaultCost: 95000,
        idPrefix: 'MC-FLK-FLT-',
        specs: 'Spacious wide flatbed work area for panels, decorative flat seaming, differential feed',
      },
      {
        id: 'FLATLOCK_VT',
        name: 'VT Flatlock',
        category: 'MACHINE',
        brands: ['Yamato'],
        defaultBrand: 'Yamato',
        defaultModel: 'VT-1500-Pro High-Lift',
        defaultCost: 110000,
        idPrefix: 'MC-FLK-VT-',
        specs: 'Variable Top-feed coverstitch with synchronized upper looper motion, 6,000 RPM',
      },
      {
        id: 'FLATLOCK_TOP_ELASTIC',
        name: 'Top Elastic Flatlock',
        category: 'MACHINE',
        brands: ['Yamato'],
        defaultBrand: 'Yamato',
        defaultModel: 'VG-2790-ET Top Elastic Attacher',
        defaultCost: 145000,
        idPrefix: 'MC-FLK-ELA-',
        specs: 'Computerized stepping motor elastic tape meter & feed mechanism, right-edge fabric trimmer',
      },
      {
        id: 'SN_BROTHER_KAJA',
        name: 'Brother KAJA (Buttonhole)',
        category: 'MACHINE',
        brands: ['Brother', 'Supreme'],
        defaultBrand: 'Brother',
        defaultModel: 'HE-800B KAJA Electronic',
        defaultCost: 145000,
        idPrefix: 'MC-SN-KAJA-',
        specs: 'Electronic indexer, pulse motor knife drop, 21 preset buttonhole eyelet stitch patterns',
      },
      {
        id: 'SN_BROTHER_BUTTON_STITCH',
        name: 'Brother Button Stitch',
        category: 'MACHINE',
        brands: ['Brother', 'Supreme'],
        defaultBrand: 'Brother',
        defaultModel: 'BE-438F Direct-Drive Button Attacher',
        defaultCost: 115000,
        idPrefix: 'MC-SN-BTN-',
        specs: 'Direct-drive lockstitch button sewing, quick-change clamp for 2-hole & 4-hole buttons',
      },
      {
        id: 'SN_BROTHER_BARTACK',
        name: 'Brother Bartack',
        category: 'MACHINE',
        brands: ['Brother', 'Supreme'],
        defaultBrand: 'Brother',
        defaultModel: 'KE-430FS Electronic Direct-Drive Bartack',
        defaultCost: 112000,
        idPrefix: 'MC-SN-BTK-',
        specs: 'High-speed 3,200 SPM electronic bartacker, direct-drive servo, 89 programmed patterns',
      },
      {
        id: 'SNLS',
        name: 'Single Needle Lockstitch (SNLS)',
        category: 'MACHINE',
        brands: ['Juki', 'Brother', 'Jack'],
        defaultBrand: 'Juki',
        defaultModel: 'DDL-8700-7 Direct-Drive SNLS',
        defaultCost: 48000,
        idPrefix: 'MC-SNLS-',
        specs: 'Automatic thread trimmer, programmable backtack, direct-drive servo, 5,000 SPM',
      },
      {
        id: 'DNLS',
        name: 'Double Needle Lockstitch (DNLS)',
        category: 'MACHINE',
        brands: ['Brother', 'Juki'],
        defaultBrand: 'Brother',
        defaultModel: 'T-8422C Direct-Drive Twin Needle',
        defaultCost: 65000,
        idPrefix: 'MC-DNLS-',
        specs: 'Parallel twin needle seaming, needle feed prevents slip, automatic wiper & trimmer',
      },
      {
        id: 'CUTTING_MACHINE',
        name: 'Straight Knife Fabric Cutter',
        category: 'MACHINE',
        brands: ['Eastman', 'KM', 'Blue Streak'],
        defaultBrand: 'Eastman',
        defaultModel: 'Blue Streak II 8-inch 629X',
        defaultCost: 92000,
        idPrefix: 'MC-CUT-',
        specs: 'Heavy-duty 8-inch straight knife cloth cutter with automatic abrasive belt sharpener',
      },
      {
        id: 'FUSING_PRESS',
        name: 'Collar / Cuff Fusing Press',
        category: 'MACHINE',
        brands: ['Hashima', 'Oshima'],
        defaultBrand: 'Hashima',
        defaultModel: 'HP-450MS Continuous Fusing Press',
        defaultCost: 165000,
        idPrefix: 'MC-FUS-',
        specs: 'Electronic temperature governor, seamless teflon belt, pneumatic pressure rollers',
      },
    ],
  },
  {
    id: 'FURNITURE',
    name: 'Furniture & Workstations',
    singular: 'Furniture',
    description: 'Work tables, cutting tables, sewing workstations, operator & supervisor chairs, workshop stools',
    iconName: 'Armchair',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    idPrefix: 'FUR-',
    subtypes: [
      // --- Work Tables & Workstations ---
      {
        id: 'TABLE_SEWING',
        name: 'Sewing Work Table / Workstation',
        category: 'FURNITURE',
        brands: ['Featherlite', 'Juki', 'Godrej', 'SteelCraft'],
        defaultBrand: 'Featherlite',
        defaultModel: 'StitchDesk-Pro K-Stand',
        defaultCost: 14000,
        idPrefix: 'TBL-SEW-',
        specs: 'Heavy steel K-stand with embedded metric measuring rule, anti-vibration feet & drawer',
      },
      {
        id: 'TABLE_CUTTING',
        name: 'Fabric Spreading & Cutting Table',
        category: 'FURNITURE',
        brands: ['Eastman', 'SteelCraft', 'KM'],
        defaultBrand: 'Eastman',
        defaultModel: 'SpreadMaster-12 Air-Flotation',
        defaultCost: 110000,
        idPrefix: 'TBL-CUT-',
        specs: '12ft x 6ft Air-flotation laminated top with end fabric clamps & pneumatic blower table',
      },
      {
        id: 'TABLE_INSPECTION',
        name: 'QC Garment Checking Table',
        category: 'FURNITURE',
        brands: ['Godrej', 'Featherlite', 'SteelCraft'],
        defaultBrand: 'Godrej',
        defaultModel: 'QC-Pro-800 Canopy Desk',
        defaultCost: 38000,
        idPrefix: 'TBL-INSP-',
        specs: '8ft x 4ft Matte white reflection-free top with measurement grid & overhead lighting canopy',
      },
      {
        id: 'TABLE_PACKING',
        name: 'Final Folding & Poly-Bagging Table',
        category: 'FURNITURE',
        brands: ['SteelCraft', 'Godrej'],
        defaultBrand: 'SteelCraft',
        defaultModel: 'PackMaster-Dual Bin',
        defaultCost: 28000,
        idPrefix: 'TBL-PCK-',
        specs: '8ft x 4ft Stainless steel edged packing surface with polybag roll dispensers & barcode bin',
      },
      {
        id: 'TABLE_PATTERN',
        name: 'Pattern Drafting & Master Table',
        category: 'FURNITURE',
        brands: ['Eastman', 'Godrej'],
        defaultBrand: 'Eastman',
        defaultModel: 'DraftCraft-Master Tilt',
        defaultCost: 42000,
        idPrefix: 'TBL-PAT-',
        specs: 'Precision magnetic drafting surface with adjustable angle tilt & metric ruler rail',
      },
      {
        id: 'TABLE_CUSTOM',
        name: 'Custom / New Work Table',
        category: 'FURNITURE',
        brands: ['Eastman', 'Godrej', 'SteelCraft', 'Custom OEM'],
        defaultBrand: 'Custom OEM',
        defaultModel: 'Custom Work Table',
        defaultCost: 25000,
        idPrefix: 'TBL-CST-',
        specs: 'Custom factory workstation, layout, or inspection table',
      },
      // --- Chairs & Floor Seating ---
      {
        id: 'CHAIR_OPERATOR',
        name: 'Ergonomic Sewing Swivel Chair',
        category: 'FURNITURE',
        brands: ['Featherlite', 'Godrej', 'Wipro'],
        defaultBrand: 'Featherlite',
        defaultModel: 'Optima-Sewing Swivel 360',
        defaultCost: 4500,
        idPrefix: 'CHR-OPR-',
        specs: 'Pneumatic height adjustment, heavy-duty polyurethane seat, 360° swivel with lumbar support',
      },
      {
        id: 'CHAIR_SUPERVISOR',
        name: 'High-Back Supervisor Chair',
        category: 'FURNITURE',
        brands: ['Featherlite', 'Godrej'],
        defaultBrand: 'Featherlite',
        defaultModel: 'Exec-Line Lead Mesh',
        defaultCost: 9800,
        idPrefix: 'CHR-SUP-',
        specs: 'Breathable mesh back, multi-lock synchro-tilt mechanism, padded armrests',
      },
      {
        id: 'CHAIR_STOOL',
        name: 'Mechanic Workshop Stool',
        category: 'FURNITURE',
        brands: ['SteelCraft', 'Godrej'],
        defaultBrand: 'SteelCraft',
        defaultModel: 'ToolBay-Steel Rolling Stool',
        defaultCost: 3200,
        idPrefix: 'CHR-STL-',
        specs: 'Heavy-duty industrial round stool with bottom tool tray and castor wheels',
      },
      {
        id: 'CHAIR_CUSTOM',
        name: 'Custom / New Seating Model',
        category: 'FURNITURE',
        brands: ['Featherlite', 'Godrej', 'Wipro', 'Steelcase', 'Custom OEM'],
        defaultBrand: 'Custom OEM',
        defaultModel: 'Custom Seating Spec',
        defaultCost: 4500,
        idPrefix: 'CHR-CST-',
        specs: 'Custom factory chair, drafting stool, or operator seating',
      },
    ],
  },
  {
    id: 'VEHICLE',
    name: 'Vehicles & Transport',
    singular: 'Vehicle',
    description: 'Forklifts, pallet jacks, trolleys and material handling vehicles',
    iconName: 'Truck',
    badgeColor: 'bg-stone-100 text-stone-800 border-stone-200',
    idPrefix: 'VHC-',
    subtypes: [
      {
        id: 'VEHICLE_FORKLIFT',
        name: 'Heavy Duty Forklift',
        category: 'VEHICLE',
        brands: ['Godrej', 'Toyota', 'KION'],
        defaultBrand: 'Godrej',
        defaultModel: 'GX-20',
        defaultCost: 1500000,
        idPrefix: 'VHC-FLT-',
        specs: '2 Ton capacity, Diesel/Electric, 3-stage mast',
      },
      {
        id: 'VEHICLE_PALLET_JACK',
        name: 'Manual/Electric Pallet Jack',
        category: 'VEHICLE',
        brands: ['Nilkamal', 'Godrej', 'Maini'],
        defaultBrand: 'Nilkamal',
        defaultModel: 'Hand Pallet Truck',
        defaultCost: 25000,
        idPrefix: 'VHC-PLT-',
        specs: '2.5 Ton capacity, Polyurethane wheels, Hydraulic lift',
      },
      {
        id: 'VEHICLE_TROLLEY',
        name: 'Material Handling Trolley',
        category: 'VEHICLE',
        brands: ['Fabricator', 'Custom OEM'],
        defaultBrand: 'Custom OEM',
        defaultModel: 'Fabric Roll Trolley',
        defaultCost: 12000,
        idPrefix: 'VHC-TRL-',
        specs: 'Heavy duty steel tubular frame with 4 heavy-duty castors',
      },
      {
        id: 'VEHICLE_CUSTOM',
        name: 'Custom Vehicle / Transport',
        category: 'VEHICLE',
        brands: ['Custom OEM'],
        defaultBrand: 'Custom OEM',
        defaultModel: 'Custom Transport Spec',
        defaultCost: 20000,
        idPrefix: 'VHC-CST-',
        specs: 'Custom factory transport vehicle or cart',
      },
    ],
  },
  {
    id: 'UTILITY',
    name: 'Lighting, Ventilation & Plant Utilities',
    singular: 'Utility Fixture',
    description: 'High-bay LED, task lamps, exhaust fans, air compressors & steam boilers',
    iconName: 'Zap',
    badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    idPrefix: 'UTL-',
    subtypes: [
      {
        id: 'LIGHT_HIGHBAY',
        name: 'Overhead Linear High-Bay LED',
        category: 'UTILITY',
        brands: ['Philips', 'Wipro', 'Crompton', 'Havells'],
        defaultBrand: 'Philips',
        defaultModel: 'CoreLine HighBay 120W',
        defaultCost: 7500,
        idPrefix: 'UTL-HBY-',
        specs: '120W, 16,000 Lumen, 6500K Day White, IP65 dust and textile fiber resistant',
      },
      {
        id: 'LIGHT_TASK',
        name: 'Needle Station Gooseneck Lamp',
        category: 'UTILITY',
        brands: ['Philips', 'Osram', 'Juki'],
        defaultBrand: 'Philips',
        defaultModel: 'FocusLED Gooseneck Task 9W',
        defaultCost: 1800,
        idPrefix: 'UTL-TSK-',
        specs: 'Flexible anti-vibration magnetic mount gooseneck with concentrated shadow-free beam',
      },
      {
        id: 'LIGHT_INSPECTION',
        name: 'Color-Checking Inspection Tube',
        category: 'UTILITY',
        brands: ['Philips', 'GretagMacbeth'],
        defaultBrand: 'Philips',
        defaultModel: 'D65 ColorMaster Tube 36W',
        defaultCost: 3500,
        idPrefix: 'UTL-QC-',
        specs: 'CRI 98+ standardized D65 artificial daylight for fabric shade & lab dip inspection',
      },
      {
        id: 'FAN_CEILING',
        name: 'Heavy Industrial Ceiling Fan',
        category: 'UTILITY',
        brands: ['Almonard', 'Crompton', 'Havells'],
        defaultBrand: 'Almonard',
        defaultModel: 'AirStorm 56-inch Industrial',
        defaultCost: 4200,
        idPrefix: 'UTL-FAN-',
        specs: '1400mm sweep, aerodynamic aluminum blades, heavy-duty double ball bearings',
      },
      {
        id: 'FAN_EXHAUST',
        name: 'Wall Exhaust Blower',
        category: 'UTILITY',
        brands: ['Almonard', 'Havells'],
        defaultBrand: 'Almonard',
        defaultModel: 'VentMax 18-inch High-Velocity',
        defaultCost: 6500,
        idPrefix: 'UTL-EXH-',
        specs: '450mm heavy-duty cast motor exhaust fan with gravity louvers for lint and heat extraction',
      },
      {
        id: 'FAN_PEDESTAL',
        name: 'High-Velocity Floor Pedestal Fan',
        category: 'UTILITY',
        brands: ['Almonard', 'Crompton'],
        defaultBrand: 'Almonard',
        defaultModel: 'BreezeMax 24-inch Pedestal',
        defaultCost: 5800,
        idPrefix: 'UTL-PED-',
        specs: '600mm oscillation fan with telescopic height adjustment and metallic safety mesh',
      },
      {
        id: 'UTILITY_BOILER',
        name: 'Industrial Steam Generator',
        category: 'UTILITY',
        brands: ['Forbes Marshall', 'Thermax'],
        defaultBrand: 'Forbes Marshall',
        defaultModel: 'SteamMaster Electric 24kW',
        defaultCost: 185000,
        idPrefix: 'UTL-BLR-',
        specs: 'Automatic water feeder, safety relief valve, 4-bar dry steam for pressing and finishing',
      },
      {
        id: 'UTILITY_COMPRESSOR',
        name: 'Screw Air Compressor',
        category: 'UTILITY',
        brands: ['Atlas Copco', 'ELGi'],
        defaultBrand: 'Atlas Copco',
        defaultModel: 'AirPro Rotary Screw 15HP',
        defaultCost: 240000,
        idPrefix: 'UTL-CMP-',
        specs: '10-bar continuous pressure, air dryer integration for pneumatic sewing clamps & trimmers',
      },
      {
        id: 'UTILITY_SAFETY',
        name: 'Line Fire Safety Station',
        category: 'UTILITY',
        brands: ['Ceasefire', 'Minimax'],
        defaultBrand: 'Ceasefire',
        defaultModel: 'SafetyStation ABC 6kg Dual',
        defaultCost: 8500,
        idPrefix: 'UTL-SFT-',
        specs: 'Dual 6kg ABC powder & CO2 fire extinguishers with inspection tag and alarm pull',
      },
      {
        id: 'UTILITY_CUSTOM',
        name: 'Custom / New Plant Utility',
        category: 'UTILITY',
        brands: ['Philips', 'Havells', 'Atlas Copco', 'Forbes Marshall', 'Custom OEM'],
        defaultBrand: 'Custom OEM',
        defaultModel: 'Custom Utility Fixture',
        defaultCost: 12000,
        idPrefix: 'UTL-CST-',
        specs: 'Custom lighting fixture, ventilation unit, or specialized plant utility',
      },
    ],
  },
];

// Flat lookup map of all asset subtypes
export const ALL_ASSET_SUBTYPES: AssetSubtypeDef[] = ASSET_CATEGORIES.flatMap(
  (cat) => cat.subtypes
);

export const ASSET_SUBTYPE_LOOKUP: Record<string, AssetSubtypeDef> = ALL_ASSET_SUBTYPES.reduce(
  (acc, item) => {
    acc[item.id] = item;
    return acc;
  },
  {} as Record<string, AssetSubtypeDef>
);

// Backward compatibility exports
export const ALL_SEWING_SUBTYPES: MachineSubtypeDef[] = MACHINE_CATALOG.flatMap(
  (cat) => cat.subtypes
);

export const SUBTYPE_LOOKUP: Record<string, MachineSubtypeDef> = ALL_SEWING_SUBTYPES.reduce(
  (acc, item) => {
    acc[item.id] = item;
    return acc;
  },
  {} as Record<string, MachineSubtypeDef>
);

export function getMachineSubtypeMeta(type: MachineType): MachineSubtypeDef | undefined {
  return SUBTYPE_LOOKUP[type];
}

export function getAssetSubtypeMeta(type: MachineType): AssetSubtypeDef | undefined {
  return ASSET_SUBTYPE_LOOKUP[type];
}

export function getCategoryForType(type: MachineType): MachineCategoryGroup {
  const norm = (type || '').toUpperCase();
  if (
    norm.startsWith('OVERLOCK') ||
    norm === 'O/L' ||
    norm.includes('O/L') ||
    norm.includes('OVER LOCK') ||
    norm.includes('OVERLOCK')
  ) {
    return 'OVERLOCK';
  }
  if (
    norm.startsWith('FLATLOCK') ||
    norm === 'F/L' ||
    norm.includes('F/L') ||
    norm.includes('FLAT LOCK') ||
    norm.includes('FLATLOCK')
  ) {
    return 'FLATLOCK';
  }
  if (norm.startsWith('SN_BROTHER') || norm === 'SNLS' || norm === 'BARTACK' || norm === 'BUTTONHOLE')
    return 'SINGLE_NEEDLE';
  return 'SINGLE_NEEDLE';
}

export function getAssetCategoryForType(type: MachineType): AssetCategory {
  const meta = ASSET_SUBTYPE_LOOKUP[type];
  if (meta) return meta.category;
  if (type.startsWith('TABLE_') || type.startsWith('CHAIR_')) return 'FURNITURE';
  if (type.startsWith('VEHICLE_')) return 'VEHICLE';
  if (type.startsWith('LIGHT_') || type.startsWith('FAN_') || type.startsWith('UTILITY_')) return 'UTILITY';
  return 'MACHINE';
}
