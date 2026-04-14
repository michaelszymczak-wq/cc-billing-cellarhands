import { BulkBillingRow, CaseGoodsBillingRow, InventoryLot, ProgressEvent } from '../types';
import { fetchInventorySnapshot, getDaysInMonth, getMonthIndex } from './innovintApi';

const THROTTLE_MS = 1200;
const DEFAULT_BARREL_RATE = 21;
const DEFAULT_PUNCHEON_RATE = 50;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if a lot has a BULK tag.
 */
function isBulkLot(item: InventoryLot): boolean {
  if (!item.tags) return false;
  return item.tags.some((tag) => tag === 'BULK' || tag === 'Bulk');
}

/**
 * Check if a lot has a "Barrel storage" tag (case-insensitive).
 */
function isBarrelStorageLot(item: InventoryLot): boolean {
  if (!item.tags) return false;
  return item.tags.some((tag) => tag.toLowerCase() === 'barrel storage');
}

/**
 * Check if a lot has a "Puncheon Storage" tag (case-insensitive).
 */
function isPuncheonStorageLot(item: InventoryLot): boolean {
  if (!item.tags) return false;
  return item.tags.some((tag) => tag.toLowerCase() === 'puncheon storage');
}

/**
 * Check if a lot has a "Tank Storage" or "Tank and Wine Storage" tag (case-insensitive).
 */
function isTankStorageLot(item: InventoryLot): boolean {
  if (!item.tags) return false;
  return item.tags.some((tag) => {
    const lower = tag.toLowerCase();
    return lower === 'tank storage' || lower === 'tank and wine storage';
  });
}

/**
 * Get owner code from the lot's access.owners[0].name field.
 */
function getOwnerCode(item: InventoryLot): string {
  return item.access?.owners?.[0]?.name || 'UNK';
}

/**
 * Aggregate a snapshot's bulk lots into per-customer volume totals (gallons).
 */
function aggregateBulkSnapshot(items: InventoryLot[]): Map<string, number> {
  const ownerVolumes = new Map<string, number>();

  for (const item of items) {
    if (!isBulkLot(item)) continue;

    const ownerCode = getOwnerCode(item);
    const volume = item.volume?.value || 0;
    ownerVolumes.set(ownerCode, (ownerVolumes.get(ownerCode) || 0) + volume);
  }

  return ownerVolumes;
}

/**
 * Aggregate a snapshot's "Barrel storage" lots into per-customer vessel counts.
 * Counts vessels with vesselType=BARREL and capacity 20-60 gal.
 */
function aggregateBarrelSnapshot(items: InventoryLot[]): Map<string, number> {
  const ownerCounts = new Map<string, number>();

  for (const item of items) {
    if (!isBarrelStorageLot(item)) continue;
    if (!item.vessels) continue;

    const ownerCode = getOwnerCode(item);
    let count = 0;
    for (const vessel of item.vessels) {
      if (vessel.vesselType !== 'BARREL') continue;
      const cap = vessel.capacity?.value || 0;
      if (cap >= 20 && cap <= 60) count++;
    }
    if (count > 0) {
      ownerCounts.set(ownerCode, (ownerCounts.get(ownerCode) || 0) + count);
    }
  }

  return ownerCounts;
}

/**
 * Aggregate a snapshot's "Puncheon Storage" lots into per-customer vessel counts.
 * Counts vessels with vesselType=BARREL and capacity 61-500 gal.
 */
function aggregatePuncheonSnapshot(items: InventoryLot[]): Map<string, number> {
  const ownerCounts = new Map<string, number>();

  for (const item of items) {
    if (!isPuncheonStorageLot(item)) continue;
    if (!item.vessels) continue;

    const ownerCode = getOwnerCode(item);
    let count = 0;
    for (const vessel of item.vessels) {
      if (vessel.vesselType !== 'BARREL') continue;
      const cap = vessel.capacity?.value || 0;
      if (cap >= 61 && cap <= 500) count++;
    }
    if (count > 0) {
      ownerCounts.set(ownerCode, (ownerCounts.get(ownerCode) || 0) + count);
    }
  }

  return ownerCounts;
}

/**
 * Aggregate a snapshot's "Tank Storage" / "Tank and Wine Storage" lots into per-customer volume (gallons).
 * Only includes lots that have at least one vesselType=TANK vessel.
 */
function aggregateTankSnapshot(items: InventoryLot[]): Map<string, number> {
  const ownerVolumes = new Map<string, number>();

  for (const item of items) {
    if (!isTankStorageLot(item)) continue;
    if (!item.vessels?.some((v) => v.vesselType === 'TANK')) continue;

    const ownerCode = getOwnerCode(item);
    const volume = item.volume?.value || 0;
    if (volume > 0) {
      ownerVolumes.set(ownerCode, (ownerVolumes.get(ownerCode) || 0) + volume);
    }
  }

  return ownerVolumes;
}

/**
 * Build billing rows from 3 snapshot maps for a given type.
 */
function buildRows(
  type: 'bulk' | 'barrel' | 'puncheon' | 'tank',
  snap1Map: Map<string, number>,
  snap2Map: Map<string, number>,
  snap3Map: Map<string, number>,
  rate: number
): BulkBillingRow[] {
  const allOwners = new Set<string>();
  for (const m of [snap1Map, snap2Map, snap3Map]) {
    for (const ownerCode of m.keys()) {
      allOwners.add(ownerCode);
    }
  }

  const rows: BulkBillingRow[] = [];
  for (const ownerCode of allOwners) {
    const snap1Volume = snap1Map.get(ownerCode) || 0;
    const snap2Volume = snap2Map.get(ownerCode) || 0;
    const snap3Volume = snap3Map.get(ownerCode) || 0;

    const billingVolume = Math.max(snap1Volume, snap2Volume, snap3Volume);
    const proration = snap2Volume > 0 ? 1.0 : 0.5;
    const totalCost = Math.round(billingVolume * rate * proration * 100) / 100;

    rows.push({
      type,
      ownerCode,
      snap1Volume: Math.round(snap1Volume * 100) / 100,
      snap2Volume: Math.round(snap2Volume * 100) / 100,
      snap3Volume: Math.round(snap3Volume * 100) / 100,
      billingVolume: Math.round(billingVolume * 100) / 100,
      proration,
      rate,
      totalCost,
    });
  }

  return rows;
}

/**
 * Run the bulk inventory billing process (Step 3).
 * Takes 3 snapshots (day 1, day 15, last day), aggregates by customer,
 * and applies 50%/100% proration.
 * Now also handles Barrel Storage and Puncheon Storage lots.
 */
export async function runBulkInventory(
  wineryId: string,
  token: string,
  month: string,
  year: number,
  bulkStorageRate: number,
  onProgress: (event: ProgressEvent) => void,
  barrelStorageRate: number = DEFAULT_BARREL_RATE,
  puncheonStorageRate: number = DEFAULT_PUNCHEON_RATE,
  tankStorageRate: number = 0
): Promise<BulkBillingRow[]> {
  const monthIndex = getMonthIndex(month);
  const totalDays = getDaysInMonth(month, year);

  onProgress({
    step: 'bulk',
    message: `Starting bulk inventory for ${month} ${year}. Bulk rate: $${bulkStorageRate}/gal, Barrel: $${barrelStorageRate}/barrel, Puncheon: $${puncheonStorageRate}/puncheon, Tank: $${tankStorageRate}/tank`,
    pct: 60,
  });

  if (bulkStorageRate === 0) {
    onProgress({
      step: 'bulk',
      message: 'Warning: Bulk Storage Rate is $0. Set it in Settings to bill for bulk inventory.',
      pct: -1,
    });
  }

  // 3 snapshot days: day 1, day 15, last day of month
  const snapDays = [1, 15, totalDays];
  const snapTimestamps = snapDays.map((day) => {
    const date = new Date(Date.UTC(year, monthIndex, day, 23, 59, 0));
    return { day, ts: date.toISOString() };
  });

  const bulkSnaps: Map<string, number>[] = [];
  const barrelSnaps: Map<string, number>[] = [];
  const puncheonSnaps: Map<string, number>[] = [];
  const tankSnaps: Map<string, number>[] = [];

  for (let i = 0; i < snapTimestamps.length; i++) {
    const { day, ts } = snapTimestamps[i];

    onProgress({
      step: 'bulk',
      message: `Fetching bulk inventory snapshot ${i + 1}/3 (day ${day})...`,
      pct: 60 + Math.round((i / 3) * 30),
    });

    try {
      const lots = await fetchInventorySnapshot(wineryId, token, ts, (msg) => {
        onProgress({ step: 'bulk', message: msg, pct: -1 });
      });
      bulkSnaps.push(aggregateBulkSnapshot(lots));
      barrelSnaps.push(aggregateBarrelSnapshot(lots));
      puncheonSnaps.push(aggregatePuncheonSnapshot(lots));
      tankSnaps.push(aggregateTankSnapshot(lots));
    } catch (err) {
      onProgress({
        step: 'bulk',
        message: `Warning: Failed to fetch snapshot ${i + 1} (day ${day}): ${err instanceof Error ? err.message : 'Unknown error'}`,
        pct: -1,
      });
      bulkSnaps.push(new Map());
      barrelSnaps.push(new Map());
      puncheonSnaps.push(new Map());
      tankSnaps.push(new Map());
    }

    if (i < snapTimestamps.length - 1) {
      await sleep(THROTTLE_MS);
    }
  }

  onProgress({
    step: 'bulk',
    message: 'Building billing rows...',
    pct: 93,
  });

  const bulkRows = buildRows('bulk', bulkSnaps[0], bulkSnaps[1], bulkSnaps[2], bulkStorageRate);
  const barrelRows = buildRows('barrel', barrelSnaps[0], barrelSnaps[1], barrelSnaps[2], barrelStorageRate);
  const puncheonRows = buildRows('puncheon', puncheonSnaps[0], puncheonSnaps[1], puncheonSnaps[2], puncheonStorageRate);
  const tankRows = buildRows('tank', tankSnaps[0], tankSnaps[1], tankSnaps[2], tankStorageRate);

  const allRows = [...bulkRows, ...barrelRows, ...puncheonRows, ...tankRows];
  allRows.sort((a, b) => a.type.localeCompare(b.type) || a.ownerCode.localeCompare(b.ownerCode));

  onProgress({
    step: 'bulk',
    message: `Bulk inventory complete: ${bulkRows.length} bulk, ${barrelRows.length} barrel, ${puncheonRows.length} puncheon, ${tankRows.length} tank rows.`,
    pct: 100,
  });

  return allRows;
}

// ─── Case Goods Storage ───

/**
 * Aggregate a case goods snapshot: sum volume by owner for ALL lots (no tag filter).
 */
function aggregateCaseGoodsSnapshot(items: InventoryLot[]): Map<string, number> {
  const ownerVolumes = new Map<string, number>();
  for (const item of items) {
    const ownerCode = getOwnerCode(item);
    const volume = item.volume?.value || 0;
    if (volume > 0) {
      ownerVolumes.set(ownerCode, (ownerVolumes.get(ownerCode) || 0) + volume);
    }
  }
  return ownerVolumes;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Build case goods billing rows from 3 snapshot maps.
 */
function buildCaseGoodsRows(
  snap1Map: Map<string, number>,
  snap2Map: Map<string, number>,
  snap3Map: Map<string, number>,
  rate: number
): CaseGoodsBillingRow[] {
  const allOwners = new Set<string>();
  for (const m of [snap1Map, snap2Map, snap3Map]) {
    for (const ownerCode of m.keys()) {
      allOwners.add(ownerCode);
    }
  }

  const rows: CaseGoodsBillingRow[] = [];
  for (const ownerCode of allOwners) {
    const snap1Gallons = snap1Map.get(ownerCode) || 0;
    const snap2Gallons = snap2Map.get(ownerCode) || 0;
    const snap3Gallons = snap3Map.get(ownerCode) || 0;

    const billingGallons = Math.max(snap1Gallons, snap2Gallons, snap3Gallons);
    const pallets = Math.ceil(billingGallons / 133);
    const proration = snap2Gallons > 0 ? 1.0 : 0.5;
    const totalCost = round2(pallets * rate * proration);

    rows.push({
      ownerCode,
      snap1Gallons: round2(snap1Gallons),
      snap2Gallons: round2(snap2Gallons),
      snap3Gallons: round2(snap3Gallons),
      billingGallons: round2(billingGallons),
      pallets,
      proration,
      rate,
      totalCost,
    });
  }

  return rows.sort((a, b) => a.ownerCode.localeCompare(b.ownerCode));
}

/**
 * Run case goods inventory billing using 3 snapshots (day 1, 15, last day).
 * Fetches CASE_GOODS lots and bills per pallet (133 gal/pallet, round up).
 */
export async function runCaseGoodsInventory(
  wineryId: string,
  token: string,
  month: string,
  year: number,
  caseGoodsStorageRate: number,
  onProgress: (event: ProgressEvent) => void
): Promise<CaseGoodsBillingRow[]> {
  const monthIndex = getMonthIndex(month);
  const totalDays = getDaysInMonth(month, year);

  onProgress({
    step: 'casegoods',
    message: `Starting case goods inventory for ${month} ${year}. Rate: $${caseGoodsStorageRate}/pallet`,
    pct: 60,
  });

  const snapDays = [1, 15, totalDays];
  const snapTimestamps = snapDays.map((day) => {
    const date = new Date(Date.UTC(year, monthIndex, day, 23, 59, 0));
    return { day, ts: date.toISOString() };
  });

  const snaps: Map<string, number>[] = [];

  for (let i = 0; i < snapTimestamps.length; i++) {
    const { day, ts } = snapTimestamps[i];

    onProgress({
      step: 'casegoods',
      message: `Fetching case goods snapshot ${i + 1}/3 (day ${day})...`,
      pct: 60 + Math.round((i / 3) * 30),
    });

    try {
      const lots = await fetchInventorySnapshot(wineryId, token, ts, (msg) => {
        onProgress({ step: 'casegoods', message: msg, pct: -1 });
      }, 'CASE_GOODS');
      snaps.push(aggregateCaseGoodsSnapshot(lots));
    } catch (err) {
      onProgress({
        step: 'casegoods',
        message: `Warning: Failed to fetch case goods snapshot ${i + 1} (day ${day}): ${err instanceof Error ? err.message : 'Unknown error'}`,
        pct: -1,
      });
      snaps.push(new Map());
    }

    if (i < snapTimestamps.length - 1) {
      await sleep(THROTTLE_MS);
    }
  }

  onProgress({ step: 'casegoods', message: 'Building case goods billing rows...', pct: 93 });

  const rows = buildCaseGoodsRows(snaps[0], snaps[1], snaps[2], caseGoodsStorageRate);

  onProgress({
    step: 'casegoods',
    message: `Case goods inventory complete: ${rows.length} owner rows.`,
    pct: 100,
  });

  return rows;
}
