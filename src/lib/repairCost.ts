import type { RepairPartUsage, RepairTicket, SparePart } from '@/types/cmms';

/** Spare usage is the only repair expense. Never infer charges from work time. */
export function repairSpareCost(
  repair: Pick<RepairTicket, 'partsUsed' | 'partsCost'>,
  catalog: Pick<SparePart, 'partId' | 'sku' | 'unitCost'>[] = []
): number {
  if (!repair.partsUsed?.length) return 0;
  if (Number.isFinite(repair.partsCost) && repair.partsCost! >= 0) return repair.partsCost!;
  return Math.round(repair.partsUsed.reduce((sum, usage) => {
    const part = catalog.find(p => p.partId === usage.partId || (usage.sku && p.sku === usage.sku));
    const unitCost = usage.unitCost ?? part?.unitCost ?? 0;
    return sum + (Number.isFinite(unitCost) && unitCost >= 0 && Number.isFinite(usage.quantity) && usage.quantity > 0
      ? unitCost * usage.quantity : 0);
  }, 0) * 100) / 100;
}

export function spareUsageCost(partsUsed: RepairPartUsage[]): number {
  return repairSpareCost({ partsUsed });
}
