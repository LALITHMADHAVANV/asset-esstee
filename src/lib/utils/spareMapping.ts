import type { Machine, SparePart } from '@/types/cmms';

/**
 * Normalizes any machine object, model, or type string into the canonical
 * factory machine category corresponding to the spare parts registry.
 */
export function detectMachineCategory(
  machineOrType: Machine | string | null | undefined
): string {
  if (!machineOrType) return '';

  let text = '';
  if (typeof machineOrType === 'string') {
    text = machineOrType.toLowerCase();
  } else {
    text = [
      machineOrType.type || '',
      machineOrType.typeName || '',
      (machineOrType as any).machineType || '',
      machineOrType.model || '',
      machineOrType.name || '',
      machineOrType.machineClass || '',
      machineOrType.brand || '',
      machineOrType.id || '',
    ]
      .join(' ')
      .toLowerCase();
  }

  // 1. Flatlock
  if (
    text.includes('flatlock') ||
    text.includes('flat lock') ||
    text.includes('f/l') ||
    text.includes('fb.f/l') ||
    text.includes('h.f/l') ||
    text.includes('puller. f/l') ||
    text.includes('cylinder bed') ||
    text.includes('flat bed') ||
    text.includes('w600') ||
    text.includes('mf-') ||
    text.includes('ve2713')
  ) {
    return 'FLATLOCK';
  }

  // 2. Overlock
  if (
    text.includes('overlock') ||
    text.includes('over lock') ||
    text.includes('o/l') ||
    text.includes('rip over lock') ||
    text.includes('lfc') ||
    text.includes('mo-6714') ||
    text.includes('mo-') ||
    text.includes('mx5114') ||
    text.includes('m900') ||
    text.includes('cz-6125') ||
    text.includes('4 thread')
  ) {
    return 'OVERLOCK';
  }

  // 3. Kaja (Buttonhole)
  if (
    text.includes('kaja') ||
    text.includes('buttonhole') ||
    text.includes('button hole') ||
    text.includes('sn_brother_kaja')
  ) {
    return 'KAJA';
  }

  // 4. Bartack
  if (
    text.includes('bartack') ||
    text.includes('bar tack') ||
    text.includes('sn_brother_bartack') ||
    text.includes('lk-')
  ) {
    return 'BARTACK';
  }

  // 5. Button (Button attach/stitch - distinct from buttonhole/kaja)
  if (
    text.includes('button') &&
    !text.includes('buttonhole') &&
    !text.includes('kaja')
  ) {
    return 'BUTTON';
  }

  // 6. Picoding
  if (text.includes('picoding') || text.includes('pic')) {
    return 'PICODING';
  }

  // 7. Trimmer
  if (text.includes('trimmer')) {
    return 'TRIMMER M/C';
  }

  // 8. Rib Cutting
  if (text.includes('rib cutting') || text.includes('rib cutter')) {
    return 'RIB CUTTING';
  }

  // 9. Band Knife
  if (text.includes('band knife')) {
    return 'BAND KNIFE';
  }

  // 10. Cutter / Cutting Machine
  if (
    text.includes('cutter') ||
    text.includes('cutting') ||
    text.includes('fusing')
  ) {
    return 'CUTTER M/C';
  }

  // 11. Pattern Taker
  if (text.includes('pattern taker') || text.includes('pattern')) {
    return 'PATTERN TAKER';
  }

  // 12. Double Needle
  if (text.includes('double needle') || text.includes('dnls')) {
    return 'DOUBLE NEEDLE';
  }

  // 13. Single Needle Lockstitch (SNLS)
  if (
    text.includes('snls') ||
    text.includes('single needle') ||
    text.includes('s/n') ||
    text.includes('lockstitch') ||
    text.includes('ddl-') ||
    text.includes('a5e') ||
    text.includes('ddl')
  ) {
    return 'SNLS';
  }

  // 14. Ironing & Pressing
  if (text.includes('iron') || text.includes('steam') || text.includes('boiler')) {
    return 'IRONING';
  }

  // 15. IoT Device
  if (text.includes('iot') || text.includes('sensor')) {
    return 'IOT DEVICE';
  }

  return '';
}

/**
 * Checks whether a spare part is compatible with a given machine or machine type.
 * Universal supplies (GENERAL) are always compatible with all machines.
 */
export function isSpareCompatibleWithMachine(
  spare: SparePart,
  machineOrType: Machine | string | null | undefined
): boolean {
  // If spare has no type or is marked GENERAL, it's universal (lubricants, fittings, tape, cutters, screws)
  const spareType = (spare.machineType || 'GENERAL').toUpperCase();
  if (spareType === 'GENERAL') return true;

  if (!machineOrType) return true;

  const targetCategory = detectMachineCategory(machineOrType).toUpperCase();
  if (!targetCategory) return true; // If target category is unknown, don't hide

  // Direct match
  if (spareType === targetCategory) return true;

  // Partial or alias matches
  if (targetCategory === 'SNLS' && spareType.includes('SNLS')) return true;
  if (targetCategory === 'OVERLOCK' && (spareType.includes('OVERLOCK') || spareType === 'O/L')) return true;
  if (targetCategory === 'FLATLOCK' && (spareType.includes('FLATLOCK') || spareType.includes('F/L'))) return true;

  // Cross-compatibility special items (e.g. S.No 211 "O/L,BT ALL NEEDLE BAR" matches OVERLOCK and BARTACK)
  if (spare.name?.includes('O/L,BT ALL') && (targetCategory === 'OVERLOCK' || targetCategory === 'BARTACK')) {
    return true;
  }

  // Bartack/Button shared bobbins
  if (spare.name?.includes('BARTACK /BUTTON') && (targetCategory === 'BARTACK' || targetCategory === 'BUTTON')) {
    return true;
  }

  return false;
}

/**
 * Filters a list of spare parts for a specific machine being repaired by a mechanic.
 * Returns machine-specific spare parts first, followed by universal GENERAL parts.
 */
export function filterSparesForMachine(
  spares: SparePart[],
  machineOrType: Machine | string | null | undefined,
  includeGeneral = true
): SparePart[] {
  if (!machineOrType) return spares;

  const targetCategory = detectMachineCategory(machineOrType);
  if (!targetCategory) return spares;

  const specificSpares: SparePart[] = [];
  const generalSpares: SparePart[] = [];

  for (const part of spares) {
    const pType = (part.machineType || 'GENERAL').toUpperCase();
    if (isSpareCompatibleWithMachine(part, machineOrType)) {
      if (pType === 'GENERAL') {
        if (includeGeneral) generalSpares.push(part);
      } else {
        specificSpares.push(part);
      }
    }
  }

  return [...specificSpares, ...generalSpares];
}

/**
 * All distinct machine categories used in the factory spare parts catalog
 */
export const FACTORY_MACHINE_CATEGORIES = [
  'ALL',
  'FLATLOCK',
  'OVERLOCK',
  'SNLS',
  'KAJA',
  'BUTTON',
  'BARTACK',
  'RIB CUTTING',
  'PICODING',
  'TRIMMER M/C',
  'CUTTER M/C',
  'BAND KNIFE',
  'PATTERN TAKER',
  'DOUBLE NEEDLE',
  'IRONING',
  'IOT DEVICE',
  'GENERAL',
] as const;
