'use client';

import { textValue } from '@/lib/textValue';

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Wrench,
  LayoutGrid,
  Armchair,
  Lightbulb,
  Fan,
  Flame,
  Search,
  CheckCircle2,
  AlertTriangle,
  ClipboardCheck,
  MapPin,
  Tag,
  IndianRupee,
  Clock,
  UserCheck,
  ArrowRightLeft,
  AlertOctagon,
  Layers,
  ChevronRight,
  ShieldCheck,
  Printer,
  Truck,
  SlidersHorizontal,
  Pencil,
} from 'lucide-react';
import { EditAssetModal } from '@/components/asset/EditAssetModal';
import { Machine, FloorLine, AssetCategory, MachineStatus, RepairUrgency } from '@/types/cmms';
import { createBreakdownTicket, relocateMachine, updateMachineStatus } from '@/lib/services/cmmsService';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { getCategoryForType, SUBTYPE_LOOKUP } from '@/lib/machineCatalog';
import { PrintableAssetDocumentModal } from '@/components/print/PrintableAssetDocumentModal';
import { formatAssetLocation, formatRelocationEndpoint, cleanRelocationLocation } from '@/lib/formatters';
import { matchesUnit } from '@/lib/constants/units';

interface AssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: Machine | null;
  allAssets: Machine[];
  initialCategory?: AssetCategory;
}

interface CategoryStyle {
  label: string;
  plural: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  badge: string;
  border: string;
  dot: string;
  activeBtn: string;
}

export function getCategoryStyle(category?: AssetCategory, asset?: Machine): CategoryStyle {
  switch (category) {
    case 'FURNITURE':
    case 'TABLE':
    case 'CHAIR': {
      const isChair =
        asset?.type?.startsWith('CHAIR') ||
        asset?.id?.startsWith('CHR') ||
        asset?.category === 'CHAIR';
      if (isChair) {
        return {
          label: 'Ergonomic Chair',
          plural: 'Chairs & Seating',
          icon: Armchair,
          color: 'text-teal-800 bg-teal-50',
          badge: 'bg-teal-100 text-teal-800 border-teal-300',
          border: 'border-teal-200',
          dot: 'bg-teal-500',
          activeBtn: 'bg-teal-600 text-white shadow-xs',
        };
      }
      return {
        label: 'Work Table',
        plural: 'Furniture & Workstations',
        icon: LayoutGrid,
        color: 'text-amber-800 bg-amber-50',
        badge: 'bg-amber-100 text-amber-800 border-amber-300',
        border: 'border-amber-200',
        dot: 'bg-amber-500',
        activeBtn: 'bg-amber-600 text-white shadow-xs',
      };
    }
    case 'VEHICLE':
      return {
        label: 'Plant Vehicle',
        plural: 'Vehicles & Transport',
        icon: Truck,
        color: 'text-stone-800 bg-stone-50',
        badge: 'bg-stone-100 text-stone-800 border-stone-300',
        border: 'border-stone-200',
        dot: 'bg-stone-500',
        activeBtn: 'bg-stone-600 text-white shadow-xs',
      };
    case 'LIGHT':
      return {
        label: 'Lighting Fixture',
        plural: 'Lighting Fixtures',
        icon: Lightbulb,
        color: 'text-yellow-800 bg-yellow-50',
        badge: 'bg-yellow-100 text-yellow-800 border-yellow-300',
        border: 'border-yellow-200',
        dot: 'bg-yellow-500',
        activeBtn: 'bg-yellow-600 text-white shadow-xs',
      };
    case 'FAN':
      return {
        label: 'Ventilation Fan',
        plural: 'Fans & Air Flow',
        icon: Fan,
        color: 'text-cyan-800 bg-cyan-50',
        badge: 'bg-cyan-100 text-cyan-800 border-cyan-300',
        border: 'border-cyan-200',
        dot: 'bg-cyan-500',
        activeBtn: 'bg-cyan-600 text-white shadow-xs',
      };
    case 'UTILITY': {
      const isLight =
        asset?.type?.startsWith('LIGHT') ||
        asset?.id?.startsWith('LGT') ||
        asset?.category === 'LIGHT';
      const isFan =
        asset?.type?.startsWith('FAN') ||
        asset?.id?.startsWith('FAN') ||
        asset?.category === 'FAN';
      if (isLight) {
        return {
          label: 'Lighting Fixture (Utility)',
          plural: 'Utilities, Light & Vent',
          icon: Lightbulb,
          color: 'text-yellow-800 bg-yellow-50',
          badge: 'bg-yellow-100 text-yellow-800 border-yellow-300',
          border: 'border-yellow-200',
          dot: 'bg-yellow-500',
          activeBtn: 'bg-yellow-600 text-white shadow-xs',
        };
      }
      if (isFan) {
        return {
          label: 'Ventilation Fan (Utility)',
          plural: 'Utilities, Light & Vent',
          icon: Fan,
          color: 'text-cyan-800 bg-cyan-50',
          badge: 'bg-cyan-100 text-cyan-800 border-cyan-300',
          border: 'border-cyan-200',
          dot: 'bg-cyan-500',
          activeBtn: 'bg-cyan-600 text-white shadow-xs',
        };
      }
      return {
        label: 'Plant Utility',
        plural: 'Utilities, Light & Vent',
        icon: Flame,
        color: 'text-purple-800 bg-purple-50',
        badge: 'bg-purple-100 text-purple-800 border-purple-300',
        border: 'border-purple-200',
        dot: 'bg-purple-500',
        activeBtn: 'bg-purple-600 text-white shadow-xs',
      };
    }
    case 'MACHINE':
    default:
      return {
        label: 'Sewing Machine',
        plural: 'Machinery',
        icon: Wrench,
        color: 'text-indigo-800 bg-indigo-50',
        badge: 'bg-indigo-100 text-indigo-800 border-indigo-300',
        border: 'border-indigo-200',
        dot: 'bg-indigo-500',
        activeBtn: 'bg-indigo-600 text-white shadow-xs',
      };
  }
}

// Generate category engineering specs for any asset
function getAssetCategorySpecs(asset: Machine): Record<string, string> {
  const cat = asset.category || 'MACHINE';
  switch (cat) {
    case 'FURNITURE': {
      const isChair =
        asset.type?.startsWith('CHAIR') ||
        asset.id?.startsWith('CHR') ||
        asset.category === 'CHAIR';
      if (isChair) {
        return {
          'Height Adjustment': 'Class 4 Pneumatic gas-lift cylinder (42 cm to 56 cm)',
          'Lumbar Support': 'Ergonomic contour with height & tilt lock mechanism',
          'Seat Cushion': 'High-density molded polyurethane foam (55 kg/m³)',
          'Casters & Base': '5-star reinforced nylon base with twin-wheel friction casters',
          'Swivel Range': '360° continuous rotation with ball-bearing hub',
          'Ergonomic Compliance': 'EN 1335-1 / OSHA Apparel Floor Ergonomics Standard',
        };
      }
      return {
        'Dimensions': '120 cm x 60 cm x 75 cm (Adjustable)',
        'Bed Surface': 'Micro-pressure laminate with metric measurement rule',
        'Frame Construction': 'Heavy-gauge tubular steel with anti-vibration foot pads',
        'Load Rating': '250 kg distributed working weight',
        'Drawer Unit': 'Lockable steel slide drawer for tools and shears',
        'Air Flotation Option':
          asset.model?.includes('Air') || asset.specs?.includes('Air')
            ? 'Integrated blower bed with perforated stainless nozzle'
            : 'Passive high-glide laminate',
      };
    }
    case 'TABLE':
      return {
        'Dimensions': '120 cm x 60 cm x 75 cm (Adjustable)',
        'Bed Surface': 'Micro-pressure laminate with metric measurement rule',
        'Frame Construction': 'Heavy-gauge tubular steel with anti-vibration foot pads',
        'Load Rating': '250 kg distributed working weight',
        'Drawer Unit': 'Lockable steel slide drawer for tools and shears',
        'Air Flotation Option': asset.model?.includes('Air') || asset.specs?.includes('Air') ? 'Integrated blower bed with perforated stainless nozzle' : 'Passive high-glide laminate',
      };
    case 'CHAIR':
      return {
        'Height Adjustment': 'Class 4 Pneumatic gas-lift cylinder (42 cm to 56 cm)',
        'Lumbar Support': 'Ergonomic contour with height & tilt lock mechanism',
        'Seat Cushion': 'High-density molded polyurethane foam (55 kg/m³)',
        'Casters & Base': '5-star reinforced nylon base with twin-wheel friction casters',
        'Swivel Range': '360° continuous rotation with ball-bearing hub',
        'Ergonomic Compliance': 'EN 1335-1 / OSHA Apparel Floor Ergonomics Standard',
      };
    case 'VEHICLE':
      return {
        'Load Capacity': 'Up to 2,500 kg maximum rated pallet lift',
        'Mast/Lift Type': '3-stage full free hydraulic mast / manual pump lift',
        'Tire Composition': 'Solid Polyurethane (PU) non-marking industrial wheels',
        'Drive Type': 'Electric battery-operated / Manual manual-hydraulic',
        'Operating Aisle': 'Minimum 3,000mm Right-Angle Stacking Aisle (AST)',
        'Safety Features': 'Reversing alarm, strobe flasher, overhead operator guard',
      };
    case 'LIGHT':
      return {
        'Luminous Output': '18,000 Lumens (High-Bay) / 850 Lumens (Needle Task)',
        'Illuminance Target': '1,200 Lux directly at operator needle plate',
        'Color Temperature': '6500K Cool Daylight (Inspection grade)',
        'Color Rendering Index': 'CRI > 90 Ra (Garment shade & dye matching)',
        'Ingress Protection': 'IP65 dust-tight & moisture protected housing',
        'Optics / Diffuser': 'Micro-prismatic anti-glare polycarbonate optical lens',
      };
    case 'FAN':
      return {
        'Blade Span / Sweep': '56 inches (1400 mm) Aerodynamic aluminum blades',
        'Air Delivery Rating': '270 m³/min (9,500 CFM high velocity airflow)',
        'Motor Specification': 'Double ball bearing 100% copper wound 75W motor',
        'Speed Regulation': '5-step electronic micro-stepped line regulator',
        'Operating Velocity': '320 RPM peak at maximum speed',
        'Safety Feature': 'Secondary fall-prevention braided steel safety tether',
      };
    case 'UTILITY': {
      const isLight =
        asset.type?.startsWith('LIGHT') ||
        asset.id?.startsWith('LGT') ||
        asset.model?.includes('LED') ||
        asset.category === 'LIGHT';
      const isFan =
        asset.type?.startsWith('FAN') ||
        asset.id?.startsWith('FAN') ||
        asset.model?.includes('Fan') ||
        asset.model?.includes('Blower') ||
        asset.category === 'FAN';

      if (isLight) {
        return {
          'Luminous Output': '18,000 Lumens (High-Bay) / 850 Lumens (Needle Task)',
          'Illuminance Target': '1,200 Lux directly at operator needle plate',
          'Color Temperature': '6500K Cool Daylight (Inspection grade)',
          'Color Rendering Index': 'CRI > 90 Ra (Garment shade & dye matching)',
          'Ingress Protection': 'IP65 dust-tight & moisture protected housing',
          'Optics / Diffuser': 'Micro-prismatic anti-glare polycarbonate optical lens',
        };
      }
      if (isFan) {
        return {
          'Blade Span / Sweep': '56 inches (1400 mm) Aerodynamic aluminum blades',
          'Air Delivery Rating': '270 m³/min (9,500 CFM high velocity airflow)',
          'Motor Specification': 'Double ball bearing 100% copper wound 75W motor',
          'Speed Regulation': '5-step electronic micro-stepped line regulator',
          'Operating Velocity': '320 RPM peak at maximum speed',
          'Safety Feature': 'Secondary fall-prevention braided steel safety tether',
        };
      }
      return {
        'Working Pressure': '4.5 to 7.0 Bar (65 to 100 PSI regulated)',
        'Output Capacity': 'Central steam dry vapor generation / 45 CFM compressed air',
        'Safety Relief': 'Dual ASME-certified pop-off pressure safety relief valves',
        'Power Supply': '415V 3-Phase 50Hz industrial feed',
        'Water Treatment': 'Integrated cation ion-exchange water softening bed',
        'Shutoff Control': 'Quarter-turn emergency isolation ball valve with lockout tag',
      };
    }
    case 'MACHINE':
    default: {
      const machineCat = asset.machineClass || getCategoryForType(asset.type);
      if (machineCat === 'OVERLOCK') {
        return {
          'Machine Category': 'Overlock Machine (Edge Overedging & Trimming)',
          'Permitted OEM Brands': 'Yamato, Supreme',
          'Subtype Variety': asset.typeName || '4 Thread Overlock',
          'Max Sewing Speed': '7,500 RPM (High-speed continuous seaming)',
          'Stitch Formation': '2-Needle 4-Thread overedge / safety stitch',
          'Differential Feed': 'Micro-dial adjustable ratio (1:0.7 stretching to 1:2.0 gathering)',
          'Needle System': 'DCx27 / B27 (#09 to #14 knit gauge)',
          'Lubrication': 'Centrifugal forced-feed oil pump with clear sight dome',
          'Key Specification': asset.specs || 'High-speed edge overedging with auto-lubrication',
        };
      } else if (machineCat === 'FLATLOCK') {
        return {
          'Machine Category': 'Flatlock Machine (Interlock / Coverstitch)',
          'Permitted OEM Brands': 'Yamato',
          'Subtype Variety': asset.typeName || 'Hemming / Cylinder Bed Flatlock',
          'Max Sewing Speed': '6,000 RPM (Interlock knit garment seaming)',
          'Bed Architecture':
            asset.type === 'FLATLOCK_SMALL_CYLINDER'
              ? '180mm Mini Cylinder Bed (Cuffs & Ankles)'
              : asset.type === 'FLATLOCK_CYLINDER_BED'
              ? '280mm Cylinder Bed (Tubular Knits)'
              : 'Flat Bed / Variable Top-Feed (VT)',
          'Stitch Formation': '3-Needle 5-Thread top and bottom coverstitch',
          'Needle System': 'UY128GAS (#09 to #14 stretch knit gauge)',
          'Thread Trimmer': 'Pneumatic under-bed thread trimmer (UTT) / tape cutter',
          'Key Specification': asset.specs || 'Tubular garment assembly with top coverstitch',
        };
      } else {
        return {
          'Machine Category': 'Single Needle Machine (Indexer / Tacker / Attacher)',
          'Permitted OEM Brands': 'Brother, Supreme',
          'Subtype Variety': asset.typeName || 'Brother KAJA / Button Stitch / Bartack',
          'Max Cycle Speed': '3,200 to 4,200 SPM (Direct-drive servo)',
          'Indexing & Drive': 'Direct-drive servo motor with digital pulse motor stepping',
          'Stitch Patterns': '21 preset buttonhole eyelet cycles / 89 bartack patterns',
          'Needle System': 'DPx5 / 134R (#11 to #18 fabric gauge)',
          'Work Clamp': 'Electronic quick-change button clamp & indexer drop',
          'Lubrication': 'Semi-dry / minimal lubrication head (anti-oil stain guarantee)',
          'Key Specification': asset.specs || 'Electronic indexer, pulse motor knife drop',
        };
      }
    }
  }
}

function getCategorySOP(category?: AssetCategory, asset?: Machine): string[] {
  switch (category) {
    case 'FURNITURE': {
      const isChair =
        asset?.type?.startsWith('CHAIR') ||
        asset?.id?.startsWith('CHR') ||
        asset?.category === 'CHAIR';
      if (isChair) {
        return [
          'Adjust the pneumatic chair height so your knees form a 90° angle with feet flat on the floor or treadle.',
          'Always set lumbar support firmly against the lower back before beginning extended sewing shifts.',
          'Never stand on swivel chairs or use them as a stepping ladder to retrieve garment rolls.',
        ];
      }
      return [
        'Keep table surface completely free of loose sewing needles, shears, and pins before starting work.',
        'Wipe the laminated cutting surface daily using approved anti-static microfiber cloth.',
        'Ensure table levelers are securely locked to the concrete floor to prevent operational vibration.',
      ];
    }
    case 'TABLE':
      return [
        'Keep table surface completely free of loose sewing needles, shears, and pins before starting work.',
        'Wipe the laminated cutting surface daily using approved anti-static microfiber cloth.',
        'Ensure table levelers are securely locked to the concrete floor to prevent operational vibration.',
      ];
    case 'CHAIR':
      return [
        'Adjust the pneumatic chair height so your knees form a 90° angle with feet flat on the floor or treadle.',
        'Always set lumbar support firmly against the lower back before beginning extended sewing shifts.',
        'Never stand on swivel chairs or use them as a stepping ladder to retrieve garment rolls.',
      ];
    case 'VEHICLE':
      return [
        'Inspect solid PU tires for debris embedded in treads before starting shift.',
        'Check hydraulic fluid levels and verify lift mast operates smoothly without jerking.',
        'Sound horn and engage warning strobes when crossing pedestrian crosswalks in the plant.',
      ];
    case 'LIGHT':
      return [
        'Inspect task light gooseneck position to illuminate needle plate without casting shadows or glare.',
        'Keep optical diffuser clean and free from lint buildup to sustain 1,000+ Lux illumination standard.',
        'Report any light flicker or ballast hum immediately to prevent technician eye strain and headache.',
      ];
    case 'FAN':
      return [
        'Ensure minimum overhead ceiling clearance of 2.7 meters above sewing operator floor level.',
        'Turn off fan before cleaning blades to avoid motor imbalance or mechanical obstruction.',
        'Verify that the secondary safety drop-cable is anchored to the structural plant truss.',
      ];
    case 'UTILITY': {
      const isLight =
        asset?.type?.startsWith('LIGHT') ||
        asset?.id?.startsWith('LGT') ||
        asset?.category === 'LIGHT';
      const isFan =
        asset?.type?.startsWith('FAN') ||
        asset?.id?.startsWith('FAN') ||
        asset?.category === 'FAN';

      if (isLight) {
        return [
          'Inspect task light gooseneck position to illuminate needle plate without casting shadows or glare.',
          'Keep optical diffuser clean and free from lint buildup to sustain 1,000+ Lux illumination standard.',
          'Report any light flicker or ballast hum immediately to prevent technician eye strain and headache.',
        ];
      }
      if (isFan) {
        return [
          'Ensure minimum overhead ceiling clearance of 2.7 meters above sewing operator floor level.',
          'Turn off fan before cleaning blades to avoid motor imbalance or mechanical obstruction.',
          'Verify that the secondary safety drop-cable is anchored to the structural plant truss.',
        ];
      }
      return [
        'Perform daily morning boiler sludge blowdown before opening steam main valve to the iron line.',
        'Inspect air compressor pressure gauge sight glasses and verify condensate auto-drain functions.',
        'Never tamper with or override ASME certified pressure relief safety valves.',
      ];
    }
    case 'MACHINE':
    default: {
      const machineCat = asset ? asset.machineClass || getCategoryForType(asset.type) : 'OVERLOCK';
      if (machineCat === 'OVERLOCK') {
        return [
          'Verify looper-to-needle clearance (0.05 mm) and ensure trimming knife blade is sharp and nick-free.',
          'Check oil flow in circular sight dome before operating high-speed 7,500 RPM cycle.',
          'Ensure differential feed ratio is locked at the prescribed knit stretch/gather tension for the production style.',
        ];
      } else if (machineCat === 'FLATLOCK') {
        return [
          'Inspect bottom looper and top spreader thread path; ensure silicone thread lubricator box is topped up.',
          'For cylinder bed operations, check tubular garment clearance around the 180mm/280mm arm.',
          'Test pneumatic under-bed trimmer (UTT) suction and ensure waste fabric vacuum duct is unobstructed.',
        ];
      } else {
        return [
          'Verify electronic pulse knife drop alignment with buttonhole indexer eyelet die before starting lot.',
          'Ensure work clamp pressure is adjusted correctly to secure button or bartack without crushing fabric grain.',
          'Perform dry-head test cycle to confirm zero oil mist on white or light-color test swatches.',
        ];
      }
    }
  }
}

function getCategoryChecklist(category?: AssetCategory, asset?: Machine): string[] {
  switch (category) {
    case 'FURNITURE': {
      const isChair =
        asset?.type?.startsWith('CHAIR') ||
        asset?.id?.startsWith('CHR') ||
        asset?.category === 'CHAIR';
      if (isChair) {
        return [
          'Daily: Check pneumatic gas lift height retention under operator load.',
          'Weekly: Remove thread fluff and lint tangled in 5-star swivel wheel casters.',
          'Monthly: Tighten backrest bracket screws; inspect molded foam seat integrity.',
        ];
      }
      return [
        'Daily: Inspect surface for scratches, chips, or rough burrs that could snag delicate knit fabrics.',
        'Weekly: Check frame bolt tightness and inspect caster wheel locks on movable inspection beds.',
        'Monthly: Calibrate levelness using spirit level; vacuum lint buildup under table drawer slides.',
      ];
    }
    case 'TABLE':
      return [
        'Daily: Inspect surface for scratches, chips, or rough burrs that could snag delicate knit fabrics.',
        'Weekly: Check frame bolt tightness and inspect caster wheel locks on movable inspection beds.',
        'Monthly: Calibrate levelness using spirit level; vacuum lint buildup under table drawer slides.',
      ];
    case 'CHAIR':
      return [
        'Daily: Check pneumatic gas lift height retention under operator load.',
        'Weekly: Remove thread fluff and lint tangled in 5-star swivel wheel casters.',
        'Monthly: Tighten backrest bracket screws; inspect molded foam seat integrity.',
      ];
    case 'VEHICLE':
      return [
        'Daily: Check battery charge (if electric), test horn/brakes, verify tire condition.',
        'Weekly: Inspect hydraulic lines for leaks, grease mast chains and carriage rollers.',
        'Monthly: Service mast hydraulics, check steering linkage, load test to rated capacity.',
      ];
    case 'LIGHT':
      return [
        'Daily: Visual check of LED light output and task gooseneck fixture stability.',
        'Weekly: Wipe exterior diffuser with dry microfiber cloth to remove cotton fly.',
        'Monthly: Perform Lux meter audit on workstation needle plate (Target: 1,000 to 1,200 Lux).',
      ];
    case 'FAN':
      return [
        'Daily: Observe smooth rotation with no bearing wobble, rattle, or vibration.',
        'Weekly: Wipe fan blades to remove accumulated garment dust and maintain dynamic balance.',
        'Monthly: Inspect regulator switch box, capacitor, and secondary steel safety tether tension.',
      ];
    case 'UTILITY': {
      const isLight =
        asset?.type?.startsWith('LIGHT') ||
        asset?.id?.startsWith('LGT') ||
        asset?.category === 'LIGHT';
      const isFan =
        asset?.type?.startsWith('FAN') ||
        asset?.id?.startsWith('FAN') ||
        asset?.category === 'FAN';

      if (isLight) {
        return [
          'Daily: Visual check of LED light output and task gooseneck fixture stability.',
          'Weekly: Wipe exterior diffuser with dry microfiber cloth to remove cotton fly.',
          'Monthly: Perform Lux meter audit on workstation needle plate (Target: 1,000 to 1,200 Lux).',
        ];
      }
      if (isFan) {
        return [
          'Daily: Observe smooth rotation with no bearing wobble, rattle, or vibration.',
          'Weekly: Wipe fan blades to remove accumulated garment dust and maintain dynamic balance.',
          'Monthly: Inspect regulator switch box, capacitor, and secondary steel safety tether tension.',
        ];
      }
      return [
        'Daily: Check steam operating pressure (4.5 to 6.0 Bar) and water level sight tube.',
        'Weekly: Manual pop-test of pressure safety relief valve to prevent valve seat seizure.',
        'Monthly: Replace compressed air intake filter cartridge; inspect plant steam pipe lagging.',
      ];
    }
    case 'MACHINE':
    default: {
      const machineCat = asset ? asset.machineClass || getCategoryForType(asset.type) : 'OVERLOCK';
      if (machineCat === 'OVERLOCK') {
        return [
          'Daily: Check oil level sight dome and wipe fabric lint from upper/lower trimming knife bracket.',
          'Weekly: Inspect looper timing, looper guard clearance, and needle deflector alignment.',
          'Monthly: Replace dull movable trimming knife; clean oil filter mesh and renew high-speed spindle lubricant.',
        ];
      } else if (machineCat === 'FLATLOCK') {
        return [
          'Daily: Clean lint from cylinder bed throat plate and check top spreader thread tension discs.',
          'Weekly: Inspect feed dog differential mechanism and calibrate pneumatic UTT knife stroke.',
          'Monthly: Check looper drive ball joints, check needle bar height against gauge block, flush reservoir.',
        ];
      } else {
        return [
          'Daily: Inspect button clamp rubber pads / bartack work holder for wear or loose mounting screws.',
          'Weekly: Check electronic pulse motor knife drop blade sharpness and lubricate needle bar slide.',
          'Monthly: Calibrate electronic sensor origins, test emergency cycle stop button, run diagnostic pattern self-test.',
        ];
      }
    }
  }
}

export function AssetModal({
  isOpen,
  onClose,
  asset,
  allAssets,
  initialCategory = 'MACHINE',
}: AssetModalProps) {
  const { showToast } = useToast();
  const { user } = useAuth();

  const [activeCategory, setActiveCategory] = useState<AssetCategory>(() => {
    let cat = asset?.category || initialCategory;
    if (cat === 'LIGHT' || cat === 'FAN') cat = 'UTILITY';
    if (cat === 'TABLE' || cat === 'CHAIR') cat = 'FURNITURE';
    return cat;
  });
  const [furnitureFilter, setFurnitureFilter] = useState<'ALL' | 'TABLE' | 'CHAIR'>('ALL');
  const [utilityFilter, setUtilityFilter] = useState<'ALL' | 'PLANT' | 'LIGHT' | 'FAN'>('ALL');
  const [selectedAssetId, setSelectedAssetId] = useState<string>(
    asset?.id || ''
  );
  const [activeTab, setActiveTab] = useState<'DETAILS' | 'REPORT' | 'RELOCATE'>('DETAILS');
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Breakdown Ticket Form
  const [faultType, setFaultType] = useState<string>('Mechanical Malfunction / Operational Fault');
  const [urgency, setUrgency] = useState<RepairUrgency>('CRITICAL');
  const [faultNotes, setFaultNotes] = useState<string>('');
  const [selectedMechanic, setSelectedMechanic] = useState<string>('');
  const [registeredTechs, setRegisteredTechs] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Fetch registered mechanics
  useEffect(() => {
    fetch('/api/users')
      .then((r) => r.json())
      .then((data) => {
        if (data.users && Array.isArray(data.users)) {
          const techs = data.users.filter((u: any) =>
            ['MECHANIC', 'ELECTRICIAN', 'SENIOR_MECHANIC', 'SENIOR_ELECTRICIAN'].includes(textValue((u.role || '')).toUpperCase())
          );
          setRegisteredTechs(techs);
        }
      })
      .catch(() => {});
  }, []);

  // Relocate Form
  const [targetLine, setTargetLine] = useState<FloorLine>('Line 01');
  const [targetStation, setTargetStation] = useState<string>('Station 01');
  const [relocateReason, setRelocateReason] = useState<string>('');

  // Sync state on open
  useEffect(() => {
    if (isOpen) {
      setFurnitureFilter('ALL');
      setUtilityFilter('ALL');
      if (asset) {
        setSelectedAssetId(asset.id);
        let cat = asset.category || 'MACHINE';
        if (cat === 'LIGHT' || cat === 'FAN') cat = 'UTILITY';
        if (cat === 'TABLE' || cat === 'CHAIR') cat = 'FURNITURE';
        setActiveCategory(cat);
      } else {
        let cat = initialCategory || 'MACHINE';
        if (cat === 'LIGHT' || cat === 'FAN') cat = 'UTILITY';
        if (cat === 'TABLE' || cat === 'CHAIR') cat = 'FURNITURE';
        setActiveCategory(cat);
        const match = allAssets.find((m) => {
          const mCat = m.category || 'MACHINE';
          if (cat === 'UTILITY') {
            return mCat === 'UTILITY' || mCat === 'LIGHT' || mCat === 'FAN';
          }
          if (cat === 'FURNITURE') {
            return mCat === 'FURNITURE' || mCat === 'TABLE' || mCat === 'CHAIR';
          }
          return mCat === cat;
        });
        if (match) setSelectedAssetId(match.id);
      }
      setActiveTab('DETAILS');
    }
  }, [isOpen, asset, initialCategory, allAssets]);

  // Assets in current active category
  const categoryAssets = useMemo(() => {
    if (activeCategory === 'UTILITY') {
      return allAssets.filter((m) => {
        const cat = m.category || 'MACHINE';
        return cat === 'UTILITY' || cat === 'LIGHT' || cat === 'FAN';
      });
    }
    if (activeCategory === 'FURNITURE') {
      return allAssets.filter((m) => {
        const cat = m.category || 'MACHINE';
        return cat === 'FURNITURE' || cat === 'TABLE' || cat === 'CHAIR';
      });
    }
    return allAssets.filter((m) => (m.category || 'MACHINE') === activeCategory);
  }, [allAssets, activeCategory]);

  // Filtered by search & sub-filters if any
  const filteredCategoryAssets = useMemo(() => {
    let list = categoryAssets;
    if (activeCategory === 'FURNITURE' && furnitureFilter !== 'ALL') {
      list = list.filter((m) => {
        const isChair =
          m.type?.startsWith('CHAIR') || m.id?.startsWith('CHR') || m.category === 'CHAIR';
        if (furnitureFilter === 'CHAIR') return isChair;
        if (furnitureFilter === 'TABLE') return !isChair;
        return true;
      });
    }
    if (activeCategory === 'UTILITY' && utilityFilter !== 'ALL') {
      list = list.filter((m) => {
        const isLight =
          m.type?.startsWith('LIGHT') || m.id?.startsWith('LGT') || m.category === 'LIGHT';
        const isFan =
          m.type?.startsWith('FAN') || m.id?.startsWith('FAN') || m.category === 'FAN';
        if (utilityFilter === 'LIGHT') return isLight;
        if (utilityFilter === 'FAN') return isFan;
        if (utilityFilter === 'PLANT') return !isLight && !isFan;
        return true;
      });
    }
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (m) =>
        textValue(m.id).toLowerCase().includes(q) ||
        textValue((m.name || '')).toLowerCase().includes(q) ||
        textValue((m.brand || '')).toLowerCase().includes(q) ||
        textValue((m.stationNo || '')).toLowerCase().includes(q) ||
        textValue((m.currentLine || '')).toLowerCase().includes(q)
    );
  }, [categoryAssets, searchQuery, activeCategory, utilityFilter, furnitureFilter]);

  // Active Asset
  const currentAsset: Machine | undefined = useMemo(() => {
    return (
      allAssets.find((m) => m.id === selectedAssetId) ||
      categoryAssets[0] ||
      asset ||
      allAssets[0]
    );
  }, [allAssets, selectedAssetId, categoryAssets, asset]);

  // Show all registered technicians across all units (prioritizing asset's unit first)
  const availableMechanics = useMemo(() => {
    const machineUnit = currentAsset?.unit || '';
    return [...registeredTechs].sort((a, b) => {
      const aMatches = machineUnit && matchesUnit(a.unit, machineUnit) ? 1 : 0;
      const bMatches = machineUnit && matchesUnit(b.unit, machineUnit) ? 1 : 0;
      if (aMatches !== bMatches) return bMatches - aMatches;
      const uComp = (a.unit || '').localeCompare(b.unit || '');
      if (uComp !== 0) return uComp;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [registeredTechs, currentAsset?.unit]);

  // Group technicians by unit for organized dropdown display
  const groupedMechanics = useMemo(() => {
    const groups: Record<string, any[]> = {};
    availableMechanics.forEach((m: any) => {
      const u = m.unit || 'All Units';
      if (!groups[u]) groups[u] = [];
      groups[u].push(m);
    });
    return groups;
  }, [availableMechanics]);

  if (!isOpen || !currentAsset) return null;

  const currentCat = currentAsset.category || activeCategory || 'MACHINE';
  const catStyle = getCategoryStyle(currentCat, currentAsset);
  const CatIcon = catStyle.icon;

  const specs = getAssetCategorySpecs(currentAsset);
  const sop = getCategorySOP(currentCat, currentAsset);
  const checklist = getCategoryChecklist(currentCat, currentAsset);

  // Status Helpers
  const isDown = currentAsset.status === 'BREAKDOWN';
  const isBuffer = currentAsset.status === 'BUFFER';
  const isScrap = currentAsset.status === 'SCRAP';

  const dotColor = isDown
    ? 'bg-rose-500 animate-ping'
    : isBuffer
    ? 'bg-amber-500'
    : isScrap
    ? 'bg-slate-400'
    : 'bg-emerald-500';

  const statusBadge = isDown
    ? 'bg-rose-100 text-rose-800 border-rose-300'
    : isBuffer
    ? 'bg-amber-100 text-amber-800 border-amber-300'
    : isScrap
    ? 'bg-slate-100 text-slate-700 border-slate-300'
    : 'bg-emerald-100 text-emerald-800 border-emerald-300';

  // Handle Quick Status Change
  const handleQuickStatus = async (newStatus: MachineStatus) => {
    try {
      await updateMachineStatus(currentAsset.id, newStatus);
      showToast(`${currentAsset.id} marked as ${newStatus}!`, 'success');
    } catch (e) {
      showToast('Failed to update status', 'error');
    }
  };

  // Submit Breakdown Ticket
  const handleReportBreakdown = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const ticketId = await createBreakdownTicket({
        machineId: currentAsset.id,
        machineType: currentAsset.typeName || currentAsset.type || currentCat,
        line: currentAsset.currentLine,
        reportedAt: new Date().toISOString(),
        reportedBy: `${user?.name || 'Supervisor'} (${user?.title || 'Floor'})`,
        faultCategory: faultType,
        faultDetails: faultNotes.trim() || `Reported from Asset Inspection Popup.`,
        urgency,
        attendedBy: selectedMechanic.trim() || null,
        assignedBy: user?.name || 'Floor Dispatch',
      });

      showToast(
        selectedMechanic
          ? `Breakdown #${ticketId} dispatched and assigned to ${selectedMechanic} (${currentAsset.unit || 'Floor'})!`
          : `Critical breakdown #${ticketId} dispatched for ${currentAsset.id} on ${currentAsset.currentLine}!`,
        'success'
      );
      setFaultNotes('');
      setSelectedMechanic('');
      setActiveTab('DETAILS');
    } catch (err) {
      showToast('Failed to dispatch ticket', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Relocation
  const handleRelocate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await relocateMachine(
        currentAsset.id,
        targetLine,
        targetStation,
        relocateReason.trim() || 'Floor line rebalancing',
        user?.name || 'Supervisor'
      );
      showToast(
        `Asset ${currentAsset.id} relocated to ${targetLine} (${targetStation})`,
        'success'
      );
      setRelocateReason('');
      setActiveTab('DETAILS');
    } catch (err) {
      showToast('Failed to relocate asset', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden my-auto">
        {/* Header with Category Badge & Asset Title */}
        <div className="bg-slate-50 p-4 sm:p-5 text-slate-800 flex items-center justify-between border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center border shrink-0 ${catStyle.badge}`}
            >
              <CatIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-extrabold text-sm sm:text-base text-slate-900">
                  {currentAsset.id}
                </span>
                <span
                  className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${catStyle.badge}`}
                >
                  {catStyle.label}
                </span>
                {currentAsset.variety && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {currentAsset.variety}
                  </span>
                )}
                <div className="flex items-center gap-1.5 ml-1">
                  <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                  <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border ${statusBadge}`}>
                    {currentAsset.status}
                  </span>
                </div>
              </div>
              <h3 className="font-bold text-xs sm:text-sm text-slate-600 truncate mt-0.5">
                {currentAsset.name || `${currentAsset.brand} ${currentAsset.model}`}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(true)}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              title="Edit Asset Details"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Edit Asset</span>
            </button>
            <button
              type="button"
              onClick={() => setIsPrintModalOpen(true)}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              title="Print Asset QR Tag or Equipment Document"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print Tag / Doc</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
              title="Close popup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Category Switcher Pills */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 text-xs font-semibold scrollbar-none">
            <button
              type="button"
              onClick={() => {
                setActiveCategory('MACHINE');
                const first = allAssets.find((m) => (m.category || 'MACHINE') === 'MACHINE');
                if (first) setSelectedAssetId(first.id);
              }}
              className={`px-2.5 py-1.5 rounded-xl border transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                activeCategory === 'MACHINE'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Machinery</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveCategory('FURNITURE');
                setFurnitureFilter('ALL');
                const first = allAssets.find(
                  (m) =>
                    m.category === 'FURNITURE' ||
                    m.category === 'TABLE' ||
                    m.category === 'CHAIR'
                );
                if (first) setSelectedAssetId(first.id);
              }}
              className={`px-2.5 py-1.5 rounded-xl border transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                activeCategory === 'FURNITURE'
                  ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Armchair className="w-3.5 h-3.5" />
              <span>Furniture &amp; Seating</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveCategory('VEHICLE');
                const first = allAssets.find((m) => m.category === 'VEHICLE');
                if (first) setSelectedAssetId(first.id);
              }}
              className={`px-2.5 py-1.5 rounded-xl border transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                activeCategory === 'VEHICLE'
                  ? 'bg-stone-600 text-white border-stone-600 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Vehicles</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveCategory('UTILITY');
                setUtilityFilter('ALL');
                const first = allAssets.find(
                  (m) =>
                    (m.category || 'MACHINE') === 'UTILITY' ||
                    m.category === 'LIGHT' ||
                    m.category === 'FAN'
                );
                if (first) setSelectedAssetId(first.id);
              }}
              className={`px-2.5 py-1.5 rounded-xl border transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                activeCategory === 'UTILITY'
                  ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Utilities &amp; Plant</span>
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative w-full sm:w-56 shrink-0">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search asset in category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl pl-8 pr-3 py-1 text-xs text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Category Assets Picker Strip */}
        <div className="px-4 py-2 bg-slate-100/70 border-b border-slate-200 overflow-x-auto flex items-center gap-2 shrink-0 scrollbar-none">
          {activeCategory === 'FURNITURE' ? (
            <div className="flex items-center gap-1 shrink-0 pr-2 mr-1 border-r border-slate-300">
              <span className="text-[10px] font-black text-amber-800 uppercase tracking-wider mr-1">
                Filter:
              </span>
              <button
                type="button"
                onClick={() => setFurnitureFilter('ALL')}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                  furnitureFilter === 'ALL'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                All ({categoryAssets.length})
              </button>
              <button
                type="button"
                onClick={() => setFurnitureFilter('TABLE')}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer flex items-center gap-1 ${
                  furnitureFilter === 'TABLE'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <LayoutGrid className="w-3 h-3 text-amber-600" />
                Work Tables (
                {
                  categoryAssets.filter(
                    (m) =>
                      !m.type?.startsWith('CHAIR') &&
                      !m.id?.startsWith('CHR') &&
                      m.category !== 'CHAIR'
                  ).length
                }
                )
              </button>
              <button
                type="button"
                onClick={() => setFurnitureFilter('CHAIR')}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer flex items-center gap-1 ${
                  furnitureFilter === 'CHAIR'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Armchair className="w-3 h-3 text-teal-600" />
                Chairs (
                {
                  categoryAssets.filter(
                    (m) =>
                      m.type?.startsWith('CHAIR') ||
                      m.id?.startsWith('CHR') ||
                      m.category === 'CHAIR'
                  ).length
                }
                )
              </button>
            </div>
          ) : activeCategory === 'UTILITY' ? (
            <div className="flex items-center gap-1 shrink-0 pr-2 mr-1 border-r border-slate-300">
              <span className="text-[10px] font-black text-purple-800 uppercase tracking-wider mr-1">
                Filter:
              </span>
              <button
                type="button"
                onClick={() => setUtilityFilter('ALL')}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                  utilityFilter === 'ALL'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                All ({categoryAssets.length})
              </button>
              <button
                type="button"
                onClick={() => setUtilityFilter('PLANT')}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer flex items-center gap-1 ${
                  utilityFilter === 'PLANT'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Flame className="w-3 h-3 text-purple-500" />
                Power & Steam (
                {
                  categoryAssets.filter(
                    (m) =>
                      !m.type?.startsWith('LIGHT') &&
                      !m.type?.startsWith('FAN') &&
                      !m.id?.startsWith('LGT') &&
                      !m.id?.startsWith('FAN')
                  ).length
                }
                )
              </button>
              <button
                type="button"
                onClick={() => setUtilityFilter('LIGHT')}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer flex items-center gap-1 ${
                  utilityFilter === 'LIGHT'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Lightbulb className="w-3 h-3 text-amber-500" />
                Lighting (
                {
                  categoryAssets.filter(
                    (m) =>
                      m.type?.startsWith('LIGHT') ||
                      m.id?.startsWith('LGT') ||
                      m.category === 'LIGHT'
                  ).length
                }
                )
              </button>
              <button
                type="button"
                onClick={() => setUtilityFilter('FAN')}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer flex items-center gap-1 ${
                  utilityFilter === 'FAN'
                    ? 'bg-cyan-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Fan className="w-3 h-3 text-cyan-500" />
                Fans & Vent (
                {
                  categoryAssets.filter(
                    (m) =>
                      m.type?.startsWith('FAN') ||
                      m.id?.startsWith('FAN') ||
                      m.category === 'FAN'
                  ).length
                }
                )
              </button>
            </div>
          ) : (
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
              {catStyle.plural} ({filteredCategoryAssets.length}):
            </span>
          )}
          {filteredCategoryAssets.length === 0 ? (
            <span className="text-xs text-slate-400 italic">No assets found</span>
          ) : (
            filteredCategoryAssets.map((m) => {
              const isSelected = m.id === currentAsset.id;
              const isUnitDown = m.status === 'BREAKDOWN';
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setSelectedAssetId(m.id);
                    setActiveTab('DETAILS');
                  }}
                  className={`px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-slate-900 text-white shadow-xs font-bold'
                      : 'bg-white text-slate-700 border border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isUnitDown ? 'bg-rose-500 animate-ping' : 'bg-emerald-500'
                    }`}
                  />
                  <span className="font-mono">{m.id}</span>
                  <span className="text-[10px] opacity-75 truncate max-w-[80px]">
                    {m.brand}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Modal Navigation Tabs (Details / Report / Relocate) */}
        <div className="px-5 pt-3 bg-white border-b border-slate-100 flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('DETAILS')}
            className={`pb-2.5 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'DETAILS'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Specifications & Blueprints</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('REPORT')}
            className={`pb-2.5 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'REPORT'
                ? 'border-rose-600 text-rose-700'
                : 'border-transparent text-slate-500 hover:text-rose-700'
            }`}
          >
            <AlertOctagon className="w-3.5 h-3.5" />
            <span>Report Breakdown</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('RELOCATE')}
            className={`pb-2.5 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'RELOCATE'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-indigo-700'
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Relocate Station</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: ASSET SPECIFICATIONS & BLUEPRINTS */}
          {activeTab === 'DETAILS' && (
            <div className="space-y-6">
              {/* Identity & Location Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-indigo-600" />
                    <span>Unit &amp; Area</span>
                  </div>
                  <div className="font-bold text-xs text-slate-900 mt-1 truncate">
                    {formatAssetLocation(currentAsset)}
                  </div>
                  <div className="text-[10px] text-indigo-600 font-semibold truncate">
                    {currentAsset.area || currentAsset.currentLine} ({currentAsset.stationNo})
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <UserCheck className="w-3 h-3 text-emerald-600" />
                    <span>Assigned Operator</span>
                  </div>
                  <div className="font-bold text-xs text-slate-900 mt-1 truncate">
                    {currentAsset.operator || 'Unassigned'}
                  </div>
                  <div className="text-[10px] text-slate-500">Certified Floor Operator</div>
                </div>

                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <IndianRupee className="w-3 h-3 text-amber-600" />
                    <span>Valuation</span>
                  </div>
                  <div className="font-bold text-sm text-slate-900 mt-1 font-mono">
                    ₹{currentAsset.cost?.toLocaleString('en-IN') || '0'}
                  </div>
                  <div className="text-[10px] text-slate-500">Asset Capital Cost</div>
                </div>

                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Clock className="w-3 h-3 text-cyan-600" />
                    <span>Service History</span>
                  </div>
                  <div className="font-bold text-xs text-slate-900 mt-1">
                    {currentAsset.totalDowntimeMinutes || 0} min
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Age: {currentAsset.ageYears ? `${currentAsset.ageYears} yrs` : 'New'}
                  </div>
                </div>
              </div>

              {/* Status Management Bar */}
              <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs">
                  <span className="font-bold text-slate-700">Operational Status: </span>
                  <span className={`font-bold px-2 py-0.5 rounded-full border ${statusBadge}`}>
                    {currentAsset.status}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-400 font-medium mr-1">Quick Status:</span>
                  <button
                    type="button"
                    onClick={() => handleQuickStatus('ACTIVE')}
                    className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-300 transition cursor-pointer"
                  >
                    Active
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickStatus('BUFFER')}
                    className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-300 transition cursor-pointer"
                  >
                    Buffer
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickStatus('BREAKDOWN')}
                    className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-300 transition cursor-pointer"
                  >
                    Breakdown
                  </button>
                </div>
              </div>

              {/* Asset Location Tracking: Where Held Before & Where Moved To */}
              <div className="bg-gradient-to-br from-slate-50 via-indigo-50/40 to-slate-50 p-4 rounded-2xl border border-indigo-100 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <ArrowRightLeft className="w-4 h-4 text-indigo-600" />
                    <span>Location Tracking & Movement History</span>
                  </div>
                  {currentAsset.lastMovedAt ? (
                    <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-100/80 px-2 py-0.5 rounded-full border border-indigo-200">
                      Relocated: {new Date(currentAsset.lastMovedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400 font-medium">
                      Original Floor Position
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* Where Held Before */}
                  <div className={`p-3 rounded-xl border transition ${
                    currentAsset.previousLine
                      ? 'bg-white border-amber-200 shadow-xs'
                      : 'bg-slate-100/70 border-slate-200 text-slate-400'
                  }`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        Where Held Before
                      </span>
                      {currentAsset.previousLine && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 uppercase">
                          Previous Origin
                        </span>
                      )}
                    </div>
                    {currentAsset.previousLine ? (
                      <div>
                        <div className="font-extrabold text-slate-900 text-sm">
                          {currentAsset.previousLine}
                        </div>
                        <div className="text-xs font-semibold text-amber-700 mt-0.5">
                          {currentAsset.previousStation || 'Station Unspecified'}
                        </div>
                      </div>
                    ) : (
                      <div className="text-slate-400 italic text-[11px] py-1">
                        No previous relocation recorded. Original factory placement.
                      </div>
                    )}
                  </div>

                  {/* Where Moved To / Current Location */}
                  <div className="bg-white p-3 rounded-xl border border-emerald-300 shadow-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-emerald-600" />
                        Where Moved To (Current)
                      </span>
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 uppercase animate-pulse">
                        Active Station
                      </span>
                    </div>
                    <div className="font-extrabold text-emerald-950 text-sm">
                      {formatAssetLocation(currentAsset)}
                    </div>
                    <div className="text-xs font-semibold text-emerald-700 mt-0.5">
                      {currentAsset.area || currentAsset.currentLine} • {currentAsset.stationNo} • {currentAsset.department || 'Floor'}
                    </div>
                  </div>
                </div>

                {currentAsset.lastMovedReason && (
                  <div className="text-xs text-slate-700 bg-white/90 p-2.5 rounded-xl border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-indigo-900 text-[11px] uppercase">Transfer Reason:</span>
                      <span className="italic font-medium text-slate-800">&ldquo;{currentAsset.lastMovedReason}&rdquo;</span>
                    </div>
                    {currentAsset.lastMovedBy && (
                      <span className="text-[10px] text-slate-500 shrink-0">
                        Moved by: <strong className="text-slate-700">{currentAsset.lastMovedBy}</strong>
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Category Technical Specifications */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Category Engineering Specifications ({catStyle.label})</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {Object.entries(specs).map(([key, val]) => (
                    <div
                      key={key}
                      className="bg-white p-2.5 rounded-xl border border-slate-200 text-xs flex items-center justify-between"
                    >
                      <span className="text-slate-500 font-medium">{key}</span>
                      <span className="font-semibold text-slate-900 font-mono text-right max-w-[55%] truncate">
                        {val}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* SOP & Maintenance Checklist Side-by-Side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* SOP */}
                <div className="bg-amber-50/50 p-3.5 rounded-2xl border border-amber-200 space-y-2">
                  <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span>Standard Operating Procedures (SOP)</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-amber-950">
                    {sop.map((step, idx) => (
                      <li key={idx} className="flex items-start gap-1.5 leading-snug">
                        <span className="text-amber-600 font-bold font-mono text-[11px] shrink-0 mt-0.5">
                          {idx + 1}.
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Checklist */}
                <div className="bg-emerald-50/50 p-3.5 rounded-2xl border border-emerald-200 space-y-2">
                  <div className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                    <ClipboardCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Preventive Maintenance Checklist</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-emerald-950">
                    {checklist.map((task, idx) => (
                      <li key={idx} className="flex items-start gap-1.5 leading-snug">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{task}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Action Buttons Footer */}
              <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(true)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Tag &amp; Passport</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('REPORT')}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-300 transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <AlertOctagon className="w-3.5 h-3.5" />
                    <span>Report Breakdown</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('RELOCATE')}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>Relocate Station</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: REPORT BREAKDOWN TICKET */}
          {activeTab === 'REPORT' && (
            <form onSubmit={handleReportBreakdown} className="space-y-4">
              <div className="bg-rose-50 p-3 rounded-2xl border border-rose-200 text-xs text-rose-800 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertOctagon className="w-4 h-4 text-rose-600" />
                  <span>Dispatch Maintenance Breakdown Ticket</span>
                </div>
                <p>
                  Create an immediate mechanical fault ticket for{' '}
                  <strong className="font-mono">{currentAsset.id}</strong> stationed at{' '}
                  <strong>{formatAssetLocation(currentAsset)}</strong>.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Urgency Level
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['CRITICAL', 'WARNING', 'INFO'] as RepairUrgency[]).map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setUrgency(level)}
                      className={`p-2 rounded-xl border text-xs font-bold transition cursor-pointer ${
                        urgency === level
                          ? level === 'CRITICAL'
                            ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                            : level === 'WARNING'
                            ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                            : 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Fault Category / Symptom
                </label>
                <input
                  type="text"
                  value={faultType}
                  onChange={(e) => setFaultType(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-rose-500"
                  required
                />
              </div>

              {/* Assign to Mechanic Dropdown across All Units */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Assign To Technician (All Units) *</span>
                  </label>
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                    {availableMechanics.length} available
                  </span>
                </div>
                <select
                  value={selectedMechanic}
                  onChange={(e) => setSelectedMechanic(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-800 outline-none font-semibold focus:bg-white transition cursor-pointer"
                >
                  <option value="">-- Select Technician (All Units) --</option>
                  {Object.entries(groupedMechanics).map(([unitGroup, techs]) => (
                    <optgroup key={unitGroup} label={`📍 ${unitGroup}`}>
                      {techs.map((m: any) => (
                        <option key={m.uid || m.id || m.name} value={m.name}>
                          {m.name} ({m.role || 'Mechanic'}) • {m.unit || unitGroup}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Detailed Mechanic Fault Notes
                </label>
                <textarea
                  rows={3}
                  value={faultNotes}
                  onChange={(e) => setFaultNotes(e.target.value)}
                  placeholder="Describe exact symptoms, error codes, noise, stitch defect, or component breakage..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setActiveTab('DETAILS')}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <AlertOctagon className="w-4 h-4" />
                  <span>{isSubmitting ? 'Dispatching...' : 'Dispatch Ticket'}</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: RELOCATE STATION */}
          {activeTab === 'RELOCATE' && (
            <form onSubmit={handleRelocate} className="space-y-4">
              <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-200 text-xs text-indigo-950 space-y-2">
                <div className="font-bold flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <ArrowRightLeft className="w-4 h-4 text-indigo-600" />
                    <span>Floor Line Rebalancing & Physical Transfer</span>
                  </span>
                  <span className="text-[10px] font-mono font-bold bg-indigo-200/70 text-indigo-900 px-2 py-0.5 rounded">
                    {currentAsset.id}
                  </span>
                </div>
                <p className="text-slate-600 text-[11px]">
                  Track asset rebalancing across lines and departments. Previous location and current movement log will be recorded.
                </p>

                {/* Visual Transit Chain */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
                  {/* Where Held Before */}
                  <div className="bg-white/80 p-2.5 rounded-xl border border-indigo-100">
                    <div className="text-[10px] uppercase font-bold text-slate-400">1. Where Held Before</div>
                    <div className="font-bold text-slate-700 truncate mt-0.5">
                      {currentAsset.previousLine || 'Original Factory Position'}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">
                      {currentAsset.previousStation || 'No prior moves'}
                    </div>
                  </div>

                  {/* Current Location */}
                  <div className="bg-white p-2.5 rounded-xl border border-indigo-300 shadow-xs">
                    <div className="text-[10px] uppercase font-bold text-indigo-600">2. Current Location (From)</div>
                    <div className="font-extrabold text-indigo-950 truncate mt-0.5">
                      {currentAsset.area || currentAsset.currentLine}
                    </div>
                    <div className="text-[10px] text-indigo-700 font-semibold truncate">
                      {currentAsset.unit ? `${currentAsset.unit} • ` : ''}{currentAsset.stationNo}
                    </div>
                  </div>

                  {/* New Target Location */}
                  <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-300 shadow-xs">
                    <div className="text-[10px] uppercase font-bold text-emerald-700">3. Target Moved To</div>
                    <div className="font-extrabold text-emerald-950 truncate mt-0.5">
                      {targetLine}
                    </div>
                    <div className="text-[10px] text-emerald-700 font-semibold truncate">
                      {targetStation || 'Pending Station'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Destination Line / Zone *
                  </label>
                  <select
                    value={targetLine}
                    onChange={(e) => setTargetLine(e.target.value as FloorLine)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  >
                    <optgroup label="🧵 Sewing & Assembly Floor">
                      <option value="Line 01">Sewing Floor - Line 01 (Polos & Knits)</option>
                      <option value="Line 02">Sewing Floor - Line 02 (Tees & Tops)</option>
                      <option value="Line 03">Sewing Floor - Line 03 (Wovens & Shirts)</option>
                      <option value="Line 04">Sewing Floor - Line 04 (Heavy Denim)</option>
                    </optgroup>
                    <optgroup label="🏢 Factory Plant Departments">
                      <option value="Cutting Department">Fabric Cutting Department</option>
                      <option value="Finishing & Pressing">Finishing & Steam Pressing</option>
                      <option value="Embroidery & Printing">Embroidery & Printing Unit</option>
                      <option value="Quality & Packing">Quality Assurance & Packing</option>
                      <option value="Warehouse & Storage">Warehouse & Raw Materials</option>
                      <option value="Central Utilities & Plant">Central Utilities & Power Plant</option>
                      <option value="Maintenance Workshop">Maintenance Workshop & Tool Bay</option>
                      <option value="Scrap Bay">Scrap & Salvage Bay</option>
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Destination Station Number *
                  </label>
                  <input
                    type="text"
                    value={targetStation}
                    onChange={(e) => setTargetStation(e.target.value)}
                    placeholder="e.g. Station 04"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Relocation Justification / Reason *
                </label>
                <input
                  type="text"
                  value={relocateReason}
                  onChange={(e) => setRelocateReason(e.target.value)}
                  placeholder="e.g. Production ramp-up, line balancing, overhaul completion"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setActiveTab('DETAILS')}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  <span>{isSubmitting ? 'Relocating...' : 'Confirm Relocation'}</span>
                </button>
              </div>

              {/* Movement History Ledger (If Any) */}
              {currentAsset.relocationHistory && currentAsset.relocationHistory.length > 0 && (
                <div className="pt-3 border-t border-slate-200 space-y-2">
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>Historical Movement & Transfer Ledger ({currentAsset.relocationHistory.length} Moves)</span>
                  </div>
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white text-xs">
                    {currentAsset.relocationHistory.map((item, idx) => (
                      <div key={idx} className="p-3 space-y-1 hover:bg-slate-50 transition">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span className="text-slate-600">{formatRelocationEndpoint(item.fromLine, item.fromStation, currentAsset?.unit)}</span>
                            <span className="text-indigo-600">➔</span>
                            <span className="text-emerald-700">{formatRelocationEndpoint(item.toLine, item.toStation, currentAsset?.unit)}</span>
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(item.movedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                        {item.reason && (
                          <div className="text-[11px] text-slate-500 italic">
                            &ldquo;{item.reason}&rdquo;
                            {item.movedBy && <span className="not-italic text-slate-400"> • By {item.movedBy}</span>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </form>
          )}
        </div>
      </div>

      {/* Printable Asset Document Modal */}
      {currentAsset && (
        <PrintableAssetDocumentModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          asset={currentAsset}
          allAssets={filteredCategoryAssets}
          initialMode="TAG"
        />
      )}

      {/* Edit Asset Modal */}
      {currentAsset && (
        <EditAssetModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          asset={currentAsset}
        />
      )}
    </div>
  );
}
