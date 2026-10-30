/**
 * Utility functions for Indian Rupee (₹) formatting across Plant CMMS
 */

export function formatRupee(
  amount: number | undefined | null,
  options?: { decimals?: boolean }
): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return '₹0';
  }
  const showDecimals = options?.decimals ?? (amount % 1 !== 0);
  return (
    '₹' +
    amount.toLocaleString('en-IN', {
      minimumFractionDigits: showDecimals ? 2 : 0,
      maximumFractionDigits: showDecimals ? 2 : 2,
    })
  );
}

export function isLineName(str?: string | null): boolean {
  if (!str) return false;
  const s = String(str).trim();
  return (
    /^line\s*\d+/i.test(s) ||
    /^sewing\s+floor\s*-\s*line\s*\d+/i.test(s) ||
    /^packing\s+line\s*\d+/i.test(s) ||
    /^cutting\s+bay\s*\d+/i.test(s) ||
    /^line\b/i.test(s)
  );
}

export function isZoneName(str?: string | null): boolean {
  if (!str) return false;
  const s = String(str).trim();
  return (
    /(^|\b)zone(\s*\d+)?\b/i.test(s) ||
    /nethaji/i.test(s) ||
    /peacock/i.test(s) ||
    /^ho(\s*\([^)]*\))?$/i.test(s)
  );
}

/**
 * Cleanly strips line and zone names from relocation or placement strings.
 * e.g. "UNIT - 1 • HO (Nethaji) • Line 04 • PF17773" => "UNIT - 1 • PF17773"
 */
export function cleanRelocationLocation(locationStr?: string | null): string {
  if (!locationStr) return '';
  const parts = String(locationStr)
    .split(/\s*•\s*|\s*➔\s*|\s*➜\s*/)
    .map((p) => p.trim())
    .filter(Boolean);

  const filtered = parts.filter((p) => !isLineName(p) && !isZoneName(p));
  if (filtered.length > 0) {
    return filtered.join(' • ');
  }
  return parts[0] || 'Plant Placement';
}

/**
 * Formats a relocation endpoint (from or to) omitting line and zone names.
 */
export function formatRelocationEndpoint(
  lineOrBay?: string | null,
  station?: string | null,
  unit?: string | null
): string {
  const parts: string[] = [];

  if (unit && unit !== 'Unassigned Unit') {
    parts.push(unit);
  }

  if (
    lineOrBay &&
    lineOrBay !== 'Unassigned Line' &&
    lineOrBay !== 'Sewing Floor' &&
    !isLineName(lineOrBay) &&
    !isZoneName(lineOrBay) &&
    !parts.includes(lineOrBay)
  ) {
    parts.push(lineOrBay);
  }

  if (station && station !== 'Unassigned Station' && station !== 'Station') {
    parts.push(station);
  }

  if (parts.length > 0) {
    return parts.join(' • ');
  }

  return station || unit || 'Plant Floor';
}

/**
 * Formats relocation data for an asset omitting line and zone names.
 */
export function formatRelocationLocation(m?: {
  unit?: string;
  area?: string;
  currentLine?: string;
  stationNo?: string;
  department?: string;
} | null): string {
  if (!m) return 'Unknown Location';

  const parts: string[] = [];

  // 1. Plant Unit
  if (m.unit && m.unit !== 'Unassigned Unit') {
    parts.push(m.unit);
  }

  // 2. Department or Area (only if NOT a line and NOT a zone)
  const candidateDept = m.department || m.area;
  if (
    candidateDept &&
    candidateDept !== 'Sewing Floor' &&
    candidateDept !== 'Unassigned Area' &&
    !isLineName(candidateDept) &&
    !isZoneName(candidateDept) &&
    !parts.includes(candidateDept)
  ) {
    parts.push(candidateDept);
  }

  // 3. Station / Bay / S/N
  if (m.stationNo && m.stationNo !== 'Unassigned Station') {
    parts.push(m.stationNo);
  }

  if (parts.length > 0) {
    return parts.join(' • ');
  }

  return m.unit || 'Plant Floor';
}

export function formatAssetLocation(m?: {
  unit?: string;
  area?: string;
  currentLine?: string;
  stationNo?: string;
  department?: string;
} | null): string {
  if (!m) return 'Unknown Location';

  const parts: string[] = [];

  // 1. Plant Unit
  if (m.unit && m.unit !== 'Unassigned Unit') {
    parts.push(m.unit);
  }

  // 2. Area / Department (excluding line names and zone names)
  const primaryArea =
    m.area && m.area !== 'Unassigned Area' && !isZoneName(m.area) && !isLineName(m.area)
      ? m.area
      : m.department && m.department !== 'Sewing Floor' && !isLineName(m.department) && !isZoneName(m.department)
      ? m.department
      : undefined;

  if (primaryArea && !parts.includes(primaryArea)) {
    parts.push(primaryArea);
  }

  // If currentLine is non-line (e.g. workshop) and not already in parts
  if (
    m.currentLine &&
    !isLineName(m.currentLine) &&
    !isZoneName(m.currentLine) &&
    !parts.includes(m.currentLine)
  ) {
    parts.push(m.currentLine);
  }

  // 3. Station / Bay
  if (m.stationNo && m.stationNo !== 'Unassigned Station') {
    parts.push(m.stationNo);
  }

  if (parts.length > 0) {
    return parts.join(' • ');
  }

  return m.unit || m.stationNo || 'Plant Floor';
}
