import { ActionApiItem, ExtendedTankTimeRow, ExtendedTankTimeWarning, ProgressEvent } from '../types';
import { fetchActionsByTypes, getMonthIndex } from './innovintApi';

// ─── Color Classification ───

type WineColorGroup = 'red' | 'white' | 'rose';

const RED_COLORS = ['red', 'orange'];
const ROSE_COLORS = ['rose', 'rosé'];

function classifyColor(color: string): WineColorGroup | null {
  const lower = color.toLowerCase().trim();
  if (RED_COLORS.some(c => lower.includes(c))) return 'red';
  if (ROSE_COLORS.some(c => lower.includes(c))) return 'rose';
  if (lower.includes('white')) return 'white';
  return null;
}

// ─── Action type mapping by color ───

function getStartActionType(colorGroup: WineColorGroup): string {
  switch (colorGroup) {
    case 'red': return 'PROCESS_FRUIT_TO_WEIGHT';
    case 'white': return 'PROCESS_FRUIT_TO_VOLUME';
    case 'rose': return 'BLEED';
  }
}

function getEndActionTypes(colorGroup: WineColorGroup): string[] {
  switch (colorGroup) {
    case 'red': return ['DRAIN_AND_PRESS'];
    case 'white': return ['RACK', 'BARREL_DOWN', 'TRANSFER'];
    case 'rose': return ['RACK', 'BARREL_DOWN', 'TRANSFER'];
  }
}

// All possible start and end action types for API fetching
const ALL_START_TYPES = ['PROCESS_FRUIT_TO_WEIGHT', 'PROCESS_FRUIT_TO_VOLUME', 'BLEED'];
const ALL_END_TYPES = ['DRAIN_AND_PRESS', 'RACK', 'BARREL_DOWN', 'TRANSFER'];

// ─── Lot Code Extraction ───

function extractFillLotCodes(action: ActionApiItem): string[] {
  const codes: string[] = [];
  // fills[].lot.lotCode
  if (action.actionData?.fills) {
    for (const fill of action.actionData.fills) {
      if (fill.lot?.lotCode) codes.push(fill.lot.lotCode);
    }
  }
  // actionData.lot.lotCode
  if (action.actionData?.lot?.lotCode && codes.length === 0) {
    codes.push(action.actionData.lot.lotCode);
  }
  // involvedLots
  if (codes.length === 0 && action.actionData?.involvedLots) {
    for (const il of action.actionData.involvedLots) {
      if (il.lot?.lotCode) codes.push(il.lot.lotCode);
    }
  }
  return [...new Set(codes)];
}

function extractDrainLotCodes(action: ActionApiItem): string[] {
  const codes: string[] = [];
  // drains[].lot.lotCode
  if (action.actionData?.drains) {
    for (const drain of action.actionData.drains) {
      if (drain.lot?.lotCode) codes.push(drain.lot.lotCode);
    }
  }
  // fills[].lot.lotCode for RACK/TRANSFER/BARREL_DOWN (source lot)
  if (codes.length === 0 && action.actionData?.fills) {
    for (const fill of action.actionData.fills) {
      if (fill.lot?.lotCode) codes.push(fill.lot.lotCode);
    }
  }
  // involvedLots
  if (codes.length === 0 && action.actionData?.involvedLots) {
    for (const il of action.actionData.involvedLots) {
      if (il.lot?.lotCode) codes.push(il.lot.lotCode);
    }
  }
  // actionData.lot
  if (codes.length === 0 && action.actionData?.lot?.lotCode) {
    codes.push(action.actionData.lot.lotCode);
  }
  return [...new Set(codes)];
}

function extractOwnerCode(action: ActionApiItem, customerMap: Record<string, string>): string {
  // From lotAccess owners
  if (action.lotAccess?.owners?.length) {
    const ownerName = action.lotAccess.owners[0].name;
    if (customerMap[ownerName]) return customerMap[ownerName];
  }
  // From actionData.lot owner via lots
  if (action.actionData?.lots) {
    for (const l of action.actionData.lots) {
      // No direct owner, but we can try from the action-level lotAccess
    }
  }
  return 'UNK';
}

function extractColor(action: ActionApiItem): string {
  // Try from lot color (available in some API responses)
  // Since InnoVint doesn't always provide color directly on the action,
  // we infer from the action type
  return '';
}

// ─── Date Helpers ───

function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA);
  const b = new Date(dateB);
  const diffMs = Math.abs(b.getTime() - a.getTime());
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function toISODate(isoString: string): string {
  return isoString.split('T')[0];
}

// ─── Main Service ───

interface StartActionRecord {
  action: ActionApiItem;
  lotCodes: string[];
  ownerCode: string;
  colorGroup: WineColorGroup;
  startDate: string;
  quantity: number;
  unit: string;
}

function extractFillQuantity(action: ActionApiItem): number {
  let total = 0;

  // 1. Try fills[].volume.value (top-level fill volume)
  if (action.actionData?.fills) {
    for (const fill of action.actionData.fills) {
      if (fill.volume?.value) {
        total += fill.volume.value;
      } else if (fill.vessels) {
        // 2. Try fills[].vessels[].volume.value (nested vessel volumes)
        for (const v of fill.vessels) {
          if (v.volume?.value) total += v.volume.value;
        }
      }
    }
  }

  // 3. Try wineryContents.volume (aggregate lot volume after action)
  if (total === 0 && action.wineryContents?.volume?.value) {
    total = action.wineryContents.volume.value;
  }

  // 4. Try involvedLots[].volume
  if (total === 0 && action.actionData?.involvedLots) {
    for (const il of action.actionData.involvedLots) {
      if (il.volume?.value) total += il.volume.value;
    }
  }

  return total > 0 ? total : 1;
}

export async function runExtendedTankTime(
  wineryId: string,
  token: string,
  month: string,
  year: number,
  graceDays: number,
  ratePerTon: number,
  ratePerGal: number,
  customerMap: Record<string, string>,
  onProgress: (event: ProgressEvent) => void
): Promise<{ rows: ExtendedTankTimeRow[]; warnings: ExtendedTankTimeWarning[] }> {
  const rows: ExtendedTankTimeRow[] = [];
  const warnings: ExtendedTankTimeWarning[] = [];

  const billingMonthIndex = getMonthIndex(month);
  const billingMonthStart = new Date(Date.UTC(year, billingMonthIndex, 1));
  const billingMonthEnd = new Date(Date.UTC(year, billingMonthIndex + 1, 0, 23, 59, 59));

  // Lookback 3 months for start actions
  const lookbackStart = new Date(Date.UTC(year, billingMonthIndex - 3, 1));

  onProgress({
    step: 'tanktime',
    message: 'Fetching start actions (PROCESS_FRUIT_TO_WEIGHT, PROCESS_FRUIT_TO_VOLUME, BLEED)...',
    pct: -1,
  });

  const startActions = await fetchActionsByTypes(
    wineryId, token,
    ALL_START_TYPES,
    lookbackStart.toISOString(),
    billingMonthEnd.toISOString(),
    (msg) => onProgress({ step: 'tanktime', message: msg, pct: -1 })
  );

  onProgress({
    step: 'tanktime',
    message: `Found ${startActions.length} start actions. Fetching end actions...`,
    pct: -1,
  });

  // Fetch end actions over a wider window (from lookback start to billing month end)
  const endActions = await fetchActionsByTypes(
    wineryId, token,
    ALL_END_TYPES,
    lookbackStart.toISOString(),
    billingMonthEnd.toISOString(),
    (msg) => onProgress({ step: 'tanktime', message: msg, pct: -1 })
  );

  onProgress({
    step: 'tanktime',
    message: `Found ${endActions.length} end actions. Matching lots...`,
    pct: -1,
  });

  // Build start action records
  const startRecords: StartActionRecord[] = [];
  for (const action of startActions) {
    const actionType = action.actionType;
    let colorGroup: WineColorGroup;
    if (actionType === 'PROCESS_FRUIT_TO_WEIGHT') colorGroup = 'red';
    else if (actionType === 'PROCESS_FRUIT_TO_VOLUME') colorGroup = 'white';
    else if (actionType === 'BLEED') colorGroup = 'rose';
    else continue;

    const lotCodes = extractFillLotCodes(action);
    if (lotCodes.length === 0) continue;

    const ownerCode = extractOwnerCode(action, customerMap);
    const unit = colorGroup === 'red' ? 'ton' : 'gal';
    const quantity = extractFillQuantity(action);

    startRecords.push({
      action,
      lotCodes,
      ownerCode,
      colorGroup,
      startDate: action.effectiveAt,
      quantity,
      unit,
    });
  }

  // Build end action index: lotCode → earliest matching end action
  const endActionsByLot = new Map<string, { action: ActionApiItem; date: string }>();
  for (const action of endActions) {
    const drainLotCodes = extractDrainLotCodes(action);
    for (const lotCode of drainLotCodes) {
      const existing = endActionsByLot.get(lotCode);
      if (!existing || new Date(action.effectiveAt) < new Date(existing.date)) {
        endActionsByLot.set(lotCode, { action, date: action.effectiveAt });
      }
    }
  }

  // Match start actions to end actions
  const processedLots = new Set<string>();
  for (const startRec of startRecords) {
    const validEndTypes = getEndActionTypes(startRec.colorGroup);

    for (const lotCode of startRec.lotCodes) {
      if (processedLots.has(lotCode)) continue;
      processedLots.add(lotCode);

      const endMatch = endActionsByLot.get(lotCode);

      if (!endMatch || !validEndTypes.includes(endMatch.action.actionType)) {
        // No matching end action — generate warning
        const daysInTank = daysBetween(startRec.startDate, billingMonthEnd.toISOString());
        warnings.push({
          ownerCode: startRec.ownerCode,
          lotCode,
          color: startRec.colorGroup,
          startActionType: startRec.action.actionType,
          startDate: toISODate(startRec.startDate),
          daysInTank,
          message: `Lot ${lotCode} has been in tank for ${daysInTank} days with no ${validEndTypes.join('/')} detected`,
        });
        continue;
      }

      // End action must be after start action
      if (new Date(endMatch.date) <= new Date(startRec.startDate)) continue;

      const totalDays = daysBetween(startRec.startDate, endMatch.date);
      const billableDays = Math.max(0, totalDays - graceDays);

      // Only include if the end action occurred in the billing month
      const endDate = new Date(endMatch.date);
      if (endDate < billingMonthStart || endDate > billingMonthEnd) continue;

      if (billableDays > 0) {
        const rate = startRec.unit === 'ton' ? ratePerTon : ratePerGal;
        rows.push({
          ownerCode: startRec.ownerCode,
          lotCode,
          color: startRec.colorGroup,
          startActionType: startRec.action.actionType,
          endActionType: endMatch.action.actionType,
          startDate: toISODate(startRec.startDate),
          endDate: toISODate(endMatch.date),
          totalDays,
          includedDays: graceDays,
          billableDays,
          quantity: startRec.quantity,
          unit: startRec.unit,
          dailyRate: rate,
          totalCharge: Math.round(billableDays * rate * startRec.quantity * 100) / 100,
        });
      }
    }
  }

  onProgress({
    step: 'tanktime',
    message: `Extended tank time: ${rows.length} billable lot(s), ${warnings.length} warning(s).`,
    pct: -1,
  });

  return { rows, warnings };
}
