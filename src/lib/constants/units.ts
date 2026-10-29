
import { tenantPreferences } from '@/lib/tenantPreferences';
/**
 * Factory Units configuration and matching helpers for Plant CMMS
 */

export interface FactoryUnitOption {
  id: string; // Stored value in MongoDB user / machine record
  name: string; // Friendly display name
  description: string;
  badgeColor: string;
}

export const FACTORY_UNITS: FactoryUnitOption[] = [
  {
    id: 'All Units',
    name: 'All Units',
    description: 'All Units access',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
  },
  {
    id: 'UNIT - 1',
    name: 'UNIT - 1',
    description: 'UNIT - 1 operations',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  },
  {
    id: 'UNIT-2',
    name: 'UNIT-2',
    description: 'UNIT-2 operations',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
];

export interface FactoryZoneOption {
  id: string; // Machine area/zone key: "NETHAJI", "PEACOCK 1", etc.
  name: string; // Friendly label: "NETHAJI (Main Sewing Complex)"
  description?: string;
  defaultLines: string[];
}

/**
 * Plant Unit ➔ Categorized Zones & Floor Lines mapping
 * - UNIT - 1: NETHAJI (Main Sewing Complex, Lines 01-08)
 * - UNIT-2: PEACOCK 1, PEACOCK 2, PEACOCK 3, PEACOCK 4 (Lines 01-08)
 */
export const FACTORY_UNIT_ZONES: Record<string, FactoryZoneOption[]> = {
  'UNIT - 1': [
    {
      id: 'NETHAJI',
      name: 'NETHAJI (Main Sewing Complex)',
      description: 'Main production floor, Lines 01 to 08',
      defaultLines: ['Line 01', 'Line 02', 'Line 03', 'Line 04', 'Line 05', 'Line 06', 'Line 07', 'Line 08', 'Buffer Workshop', 'Scrap Bay'],
    },
    {
      id: 'NETHAJI - Cutting Bay',
      name: 'NETHAJI - Cutting & Fusing Bay',
      description: 'Cutting spreading tables & fusing presses',
      defaultLines: ['Cutting Bay 01', 'Cutting Bay 02', 'Fusing Section', 'Band Knife Section'],
    },
    {
      id: 'NETHAJI - Finishing',
      name: 'NETHAJI - Finishing & Packing',
      description: 'Thread trimming, ironing & carton packing',
      defaultLines: ['Ironing Table 01', 'Ironing Table 02', 'Packing Line 01', 'Inspection Bay'],
    },
  ],
  'UNIT-2': [
    {
      id: 'PEACOCK',
      name: 'PEACOCK (Main Sewing Floor)',
      description: 'Main production floor, Lines 01 to 08',
      defaultLines: ['Line 01', 'Line 02', 'Line 03', 'Line 04', 'Line 05', 'Line 06', 'Line 07', 'Line 08', 'Buffer Workshop'],
    },
  ],
};

export interface DynamicFactoryZone {
  id: string;
  name: string;
  linesCount?: number;
  description?: string;
  lines?: string[];
}

export interface DynamicFactoryUnit {
  id: string;
  code: string;
  name: string;
  campus?: string;
  totalLines?: number;
  totalMachines?: number;
  status?: string;
  zones?: DynamicFactoryZone[];
}

/**
 * Reads configured factory units from Settings page (localStorage key: cmms_settings_factory_units)
 */
export function getFactoryUnitsFromSettings(): DynamicFactoryUnit[] {
  if (typeof window === 'undefined') {
    return [
      {
        id: 'UNIT - 1',
        code: 'UNIT - 1',
        name: 'UNIT - 1',
        totalLines: 8,
        campus: 'Nethaji Campus',
        zones: [
          { id: 'NETHAJI', name: 'NETHAJI (Main Sewing Complex)', linesCount: 8 },
          { id: 'NETHAJI - Cutting Bay', name: 'NETHAJI - Cutting & Fusing Bay', linesCount: 4 },
          { id: 'NETHAJI - Finishing', name: 'NETHAJI - Finishing & Packing', linesCount: 4 },
        ],
      },
      {
        id: 'UNIT-2',
        code: 'UNIT-2',
        name: 'UNIT-2',
        totalLines: 10,
        campus: 'Perundurai Campus',
        zones: [
          { id: 'PEACOCK', name: 'PEACOCK (Main Sewing Floor)', linesCount: 8, lines: ['Line 01', 'Line 02', 'Line 03', 'Line 04', 'Line 05', 'Line 06', 'Line 07', 'Line 08'] },
        ],
      },
    ];
  }
  try {
    const saved = tenantPreferences.getItem('cmms_settings_factory_units');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item: any) => {
          let unitZones: DynamicFactoryZone[] = [];
          if (Array.isArray(item.zones) && item.zones.length > 0) {
            unitZones = item.zones;
          } else {
            const norm = normalizeUnit(item.code || item.id);
            if (norm === 'unit1') {
              unitZones = [
                { id: 'NETHAJI', name: 'NETHAJI (Main Sewing Complex)', linesCount: 8 },
                { id: 'NETHAJI - Cutting Bay', name: 'NETHAJI - Cutting & Fusing Bay', linesCount: 4 },
                { id: 'NETHAJI - Finishing', name: 'NETHAJI - Finishing & Packing', linesCount: 4 },
              ];
            } else if (norm === 'unit2') {
              unitZones = [
                { id: 'PEACOCK', name: 'PEACOCK (Main Sewing Floor)', linesCount: 8, lines: ['Line 01', 'Line 02', 'Line 03', 'Line 04', 'Line 05', 'Line 06', 'Line 07', 'Line 08'] },
              ];
            } else if (item.name) {
              const clean = item.name.replace(/^Plant\s+Unit\s+\d+\s*[—–-]\s*/i, '').trim() || item.code;
              unitZones = [{ id: clean, name: clean, linesCount: Number(item.totalLines) || 8 }];
            }
          }

          return {
            id: item.code || item.id,
            code: item.code || item.id,
            name: item.code || item.id, // clean unit without extra words
            campus: item.campus || '',
            totalLines: Number(item.totalLines) || 8,
            totalMachines: Number(item.totalMachines) || 0,
            status: item.status || 'ACTIVE',
            zones: unitZones,
          };
        });
      }
    }
  } catch (err) {
    console.error('Failed to read factory units from settings', err);
  }
  return [
    {
      id: 'UNIT - 1',
      code: 'UNIT - 1',
      name: 'UNIT - 1',
      totalLines: 8,
      campus: 'Nethaji Campus',
      zones: [
        { id: 'NETHAJI', name: 'NETHAJI (Main Sewing Complex)', linesCount: 8 },
        { id: 'NETHAJI - Cutting Bay', name: 'NETHAJI - Cutting & Fusing Bay', linesCount: 4 },
        { id: 'NETHAJI - Finishing', name: 'NETHAJI - Finishing & Packing', linesCount: 4 },
      ],
    },
    {
      id: 'UNIT-2',
      code: 'UNIT-2',
      name: 'UNIT-2',
      totalLines: 10,
      campus: 'Perundurai Campus',
      zones: [
        { id: 'PEACOCK', name: 'PEACOCK (Main Sewing Floor)', linesCount: 8, lines: ['Line 01', 'Line 02', 'Line 03', 'Line 04', 'Line 05', 'Line 06', 'Line 07', 'Line 08'] },
      ],
    },
  ];
}

/**
 * Returns available zones for a given unit, dynamically linking settings data if custom unit or multi-zone
 */
export function getZonesForUnit(unit?: string | null): FactoryZoneOption[] {
  if (!unit) return FACTORY_UNIT_ZONES['UNIT - 1'];
  const norm = normalizeUnit(unit);

  // Check if unit was registered in Settings with customized zones
  const settingsUnits = getFactoryUnitsFromSettings();
  const matched = settingsUnits.find(
    (u) => normalizeUnit(u.code) === norm || normalizeUnit(u.id) === norm
  );

  if (matched?.zones && matched.zones.length > 0) {
    return matched.zones.map((z) => {
      const numLines = z.linesCount && z.linesCount > 0 ? z.linesCount : (matched.totalLines || 8);
      const generatedLines = z.lines && z.lines.length > 0
        ? z.lines
        : Array.from({ length: numLines }, (_, i) => `Line ${String(i + 1).padStart(2, '0')}`).concat(['Buffer Workshop']);

      return {
        id: z.id || z.name,
        name: z.name || z.id,
        description: z.description || `${z.name} lines`,
        defaultLines: generatedLines,
      };
    });
  }

  if (norm === 'unit2') return FACTORY_UNIT_ZONES['UNIT-2'];
  if (norm === 'unit1') return FACTORY_UNIT_ZONES['UNIT - 1'];
  if (FACTORY_UNIT_ZONES[unit]) return FACTORY_UNIT_ZONES[unit];

  if (matched) {
    const numLines = matched.totalLines && matched.totalLines > 0 ? matched.totalLines : 8;
    const generatedLines = Array.from(
      { length: numLines },
      (_, i) => `Line ${String(i + 1).padStart(2, '0')}`
    );
    generatedLines.push('Buffer Workshop');
    const cleanZone = matched.name ? matched.name.replace(/^Plant\s+Unit\s+\d+\s*[—–-]\s*/i, '').trim() : matched.code;

    return [
      {
        id: cleanZone || matched.code,
        name: cleanZone || matched.code,
        description: matched.campus || `${matched.code} production area`,
        defaultLines: generatedLines,
      },
    ];
  }

  return FACTORY_UNIT_ZONES['UNIT - 1'];
}

/**
 * Normalizes unit string for fuzzy matching (strips non-alphanumerics, case-insensitive)
 * E.g., 'UNIT - 1', 'Unit 1', 'unit-1' all normalize to 'unit1'
 */
export function normalizeUnit(val?: string | null): string {
  if (!val) return '';
  return val.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Checks if a machine / asset or record belongs to the user's unit.
 * If user has 'All Units', undefined, empty, or 'ALL', it matches everything.
 */
export function matchesUnit(itemUnit?: string | null, targetUnit?: string | null): boolean {
  if (!targetUnit || targetUnit === 'All Units' || targetUnit === 'ALL' || targetUnit === 'Plant-wide') {
    return true;
  }
  if (!itemUnit) {
    // If item has no unit specified, don't filter out unless strict
    return false;
  }
  const normItem = normalizeUnit(itemUnit);
  const normTarget = normalizeUnit(targetUnit);
  if (normItem === normTarget) return true;
  if ((normItem === 'unit1' || normItem === 'ho') && (normTarget === 'unit1' || normTarget === 'ho')) return true;
  return false;
}

/**
 * Gets the unit display badge info
 */
export function getUnitBadgeInfo(unit?: string | null): { label: string; color: string } {
  const norm = normalizeUnit(unit);
  if (!norm || norm === 'allunits' || norm === 'all' || norm === 'plantwide') {
    return {
      label: 'All Units',
      color: 'bg-purple-50 text-purple-700 border-purple-200',
    };
  }
  if (norm === 'unit1') {
    return {
      label: 'UNIT - 1',
      color: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    };
  }
  if (norm === 'unit2') {
    return {
      label: 'UNIT-2',
      color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    };
  }
  if (norm === 'unit3') {
    return {
      label: 'Unit 03',
      color: 'bg-amber-50 text-amber-700 border-amber-200',
    };
  }
  return {
    label: unit || 'Plant-wide',
    color: 'bg-slate-100 text-slate-700 border-slate-200',
  };
}

/**
 * Checks if the role is an administrative authority with multi-unit privileges
 */
export function isUserAdmin(role?: string | null): boolean {
  if (!role) return false;
  const upper = role.toUpperCase();
  return upper === 'ADMIN' || upper === 'CEO';
}

/**
 * Returns the effective scoped unit for a user.
 * - For Admin / CEO: returns whatever unit is selected, or null/'All Units' if viewing plant-wide.
 * - For all mechanics and non-admin personnel: ALWAYS strictly returns their assigned unit
 *   (defaulting to 'UNIT - 1' if not set), ensuring they only ever see data for what unit they handle.
 */
export function getUserScopedUnit(
  user?: { unit?: string | null } | null,
  role?: string | null,
  selectedAdminUnit?: string | null
): string {
  if (isUserAdmin(role)) {
    return selectedAdminUnit || user?.unit || 'All Units';
  }
  // All mechanics, electricians, store persons, etc. are strictly locked to their assigned unit
  if (user?.unit && user.unit !== 'All Units' && user.unit !== 'ALL') {
    return user.unit;
  }
  return 'UNIT - 1';
}

/**
 * Validates whether a specific unit is allowed for the user.
 * Non-admins can only ever access their assigned unit.
 */
export function isUnitAllowedForUser(
  unitToCheck: string | null | undefined,
  user?: { unit?: string | null } | null,
  role?: string | null
): boolean {
  if (isUserAdmin(role)) return true;
  const userUnit = getUserScopedUnit(user, role);
  return matchesUnit(unitToCheck, userUnit);
}
