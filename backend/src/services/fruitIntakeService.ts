import {
  FruitColorRateTier,
  FruitInstallment,
  FruitIntakeApiItem,
  FruitIntakeRecord,
  FruitIntakeRunResult,
  FruitIntakeSettings,
  ProgressEvent,
} from '../types';

const BASE_URL = 'https://sutter.innovint.us';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch fruit intake report from InnoVint API with pagination.
 */
export async function fetchFruitIntakeReport(
  wineryId: string,
  token: string,
  vintages: number[],
  pageDelaySeconds: number,
  onProgress: (event: ProgressEvent) => void
): Promise<FruitIntakeApiItem[]> {
  const allItems: FruitIntakeApiItem[] = [];
  let offset = 0;
  const size = 200;
  const maxPages = 50;
  let page = 0;

  while (page < maxPages) {
    const url = new URL(`${BASE_URL}/wineries/${wineryId}/components/fruitIntakeReport`);
    url.searchParams.set('size', String(size));
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('states', 'ACTIVE');
    url.searchParams.set('vintages', vintages.join(','));

    onProgress({
      step: 'fruit-intake',
      message: `Fetching fruit intake page ${page + 1} (offset ${offset})...`,
      pct: Math.min(50, Math.round((page / 10) * 50)),
    });

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Access-Token ${token}`,
          'Accept': 'application/json',
        },
      });
    } catch (err) {
      onProgress({
        step: 'fruit-intake',
        message: `Network error on page ${page + 1}: ${err instanceof Error ? err.message : 'Unknown error'}`,
        pct: -1,
      });
      break;
    }

    if (response.status === 429) {
      onProgress({
        step: 'fruit-intake',
        message: 'Rate limited by InnoVint API. Stopping pagination.',
        pct: -1,
      });
      break;
    }

    if (!response.ok) {
      let body = '';
      try { body = await response.text(); } catch { /* ignore */ }
      onProgress({
        step: 'fruit-intake',
        message: `API error ${response.status}: ${response.statusText}. ${body.slice(0, 200)}`,
        pct: -1,
      });
      break;
    }

    const data = (await response.json()) as unknown;
    const items: FruitIntakeApiItem[] = Array.isArray(data) ? data : [];

    // Filter out voided records
    const active = items.filter((item) => !item.voided);
    allItems.push(...active);

    if (items.length < size) break;
    offset += items.length;
    page++;

    if (page < maxPages && pageDelaySeconds > 0) {
      await delay(pageDelaySeconds * 1000);
    }
  }

  onProgress({
    step: 'fruit-intake',
    message: `Fetched ${allItems.length} fruit intake records.`,
    pct: 50,
  });

  return allItems;
}

/**
 * Fetch fruit lots from the lotsModular API to get tags and owner names.
 */
export async function fetchFruitLots(
  wineryId: string,
  token: string,
  vintages: number[],
  pageDelaySeconds: number,
  onProgress: (event: ProgressEvent) => void
): Promise<Array<{ lotCode: string; tags: string[]; ownerName: string }>> {
  const allLots: Array<{ lotCode: string; tags: string[]; ownerName: string }> = [];
  let requestCount = 0;

  for (const vintage of vintages) {
    let offset = 0;
    const size = 200;
    const maxPages = 50;
    let page = 0;

    while (page < maxPages) {
      // 4-second delay before each request (except the very first) to avoid rate limiting
      if (requestCount > 0) {
        await delay(4000);
      }

      const url = `${BASE_URL}/wineries/${wineryId}/lotsModular?fruitLot=true&includeFullLot=true&includeIntendedUseAllocations=true&includeWorkOrders=true&minComponentPercent=-1&offset=${offset}&sort=lotCode:1&vintages=${vintage}&size=${size}`;

      onProgress({
        step: 'fruit-lots',
        message: `Fetching lots for vintage ${vintage}, page ${page + 1} (offset=${offset}, size=${size})...`,
        pct: -1,
      });

      requestCount++;
      let response: Response;
      try {
        response = await fetch(url, {
          headers: {
            'Authorization': `Access-Token ${token}`,
            'Accept': 'application/json',
          },
        });
      } catch (err) {
        onProgress({
          step: 'fruit-lots',
          message: `Network error fetching lots: ${err instanceof Error ? err.message : 'Unknown error'}`,
          pct: -1,
        });
        break;
      }

      if (response.status === 429) {
        onProgress({ step: 'fruit-lots', message: `Rate limited fetching lots (vintage ${vintage}, page ${page + 1}). Stopping.`, pct: -1 });
        break;
      }

      if (!response.ok) {
        let body = '';
        try { body = await response.text(); } catch { /* ignore */ }
        onProgress({
          step: 'fruit-lots',
          message: `Lots API error ${response.status}: ${body.slice(0, 200)}`,
          pct: -1,
        });
        break;
      }

      const data = (await response.json()) as unknown;
      const items: Array<Record<string, unknown>> = Array.isArray(data) ? data : [];

      onProgress({
        step: 'fruit-lots',
        message: `Vintage ${vintage} page ${page + 1}: got ${items.length} lots.`,
        pct: -1,
      });

      for (const item of items) {
        const lotCode = (item as { lotCode?: string }).lotCode || '';
        const tags: string[] = Array.isArray((item as { tags?: unknown[] }).tags) ? (item as { tags: string[] }).tags : [];
        const access = item.access as { owners?: Array<{ name: string }> } | undefined;
        const ownerName = access?.owners?.[0]?.name || '';
        if (tags.length > 0) {
          onProgress({
            step: 'fruit-lots',
            message: `  Lot ${lotCode}: tags=${JSON.stringify(tags)}, owner=${ownerName}`,
            pct: -1,
          });
        }
        allLots.push({ lotCode, tags, ownerName });
      }

      if (items.length < size) break;
      offset += items.length;
      page++;
    }
  }

  const taggedCount = allLots.filter((l) => l.tags.some((t) => t.toLowerCase().startsWith('program'))).length;
  onProgress({
    step: 'fruit-lots',
    message: `Fetched ${allLots.length} fruit lots (${taggedCount} with program tags).`,
    pct: -1,
  });

  return allLots;
}

/**
 * Build a map from lotCode to the owner name from the lots API.
 */
export function buildLotOwnerMap(
  lots: Array<{ lotCode: string; tags: string[]; ownerName: string }>
): Map<string, string> {
  const map = new Map<string, string>();
  for (const lot of lots) {
    if (lot.ownerName) {
      map.set(lot.lotCode, lot.ownerName);
    }
  }
  return map;
}

/**
 * Find the matching color rate tier for a given color and customer tonnage.
 * Filters by color (case-insensitive), then finds the tier where minTons <= customerTons < maxTons (maxTons=0 means unlimited).
 */
export function findColorRateTier(
  color: string,
  customerTons: number,
  tiers: FruitColorRateTier[]
): FruitColorRateTier | undefined {
  const colorLower = color.toLowerCase();
  return tiers.find((t) =>
    t.color.toLowerCase() === colorLower &&
    customerTons >= t.minTons &&
    (t.maxTons === 0 || customerTons < t.maxTons)
  );
}

/**
 * Generate monthly installments for a contract.
 */
export function generateInstallments(
  contractStartMonth: string,
  contractLengthMonths: number,
  monthlyAmount: number
): FruitInstallment[] {
  const installments: FruitInstallment[] = [];
  const parts = contractStartMonth.split(' ');
  if (parts.length !== 2) return installments;

  let monthIdx = MONTHS.indexOf(parts[0]);
  let year = parseInt(parts[1], 10);
  if (monthIdx === -1 || isNaN(year)) return installments;

  for (let i = 0; i < contractLengthMonths; i++) {
    installments.push({
      month: `${MONTHS[monthIdx]} ${year}`,
      amount: monthlyAmount,
    });
    monthIdx++;
    if (monthIdx >= 12) {
      monthIdx = 0;
      year++;
    }
  }

  return installments;
}

/**
 * Determine contract start month: always November of the vintage year.
 */
function getContractStartMonth(effectiveDate: string): string {
  const date = new Date(effectiveDate);
  const year = date.getUTCFullYear();
  return `November ${year}`;
}

/**
 * Get the contract end month from start + length.
 */
export function getContractEndMonth(contractStartMonth: string, lengthMonths: number): string {
  if (lengthMonths <= 0) return contractStartMonth;
  const installments = generateInstallments(contractStartMonth, lengthMonths, 0);
  return installments.length > 0 ? installments[installments.length - 1].month : contractStartMonth;
}

/**
 * Process a single raw fruit intake API item into a FruitIntakeRecord.
 * Rate and colorRateTierId are passed in (determined by two-pass logic in runFruitIntake).
 */
export function processRawRecord(
  item: FruitIntakeApiItem,
  customerMap: Record<string, string>,
  lotOwnerMap: Map<string, string>,
  contractRatePerTon: number,
  colorRateTierId: string | undefined,
  minProcessingFee: number,
  defaultContractMonths: number,
  smallLotFee: number = 0,
  smallLotThresholdTons: number = 0
): FruitIntakeRecord {
  const lotCode = item.lot?.lotCode || '';
  const fruitWeightTons = item.fruitWeight?.value || 0;
  const effectiveDate = item.effectiveAt || '';
  const vintage = item.vintage || 0;
  const weighTagNumber = item.weighTagNumber || '';
  const color = item.lot?.color || '';
  const varietal = item.varietal?.name || '';

  // Owner: prefer lot API's owner name, fall back to fruit intake API
  const ownerName = lotOwnerMap.get(lotCode) || item.access?.owners?.[0]?.name || '';

  // Owner code: use customerMap override if present, otherwise use ownerName directly from API
  let ownerCode: string;
  if (ownerName && customerMap[ownerName]) {
    ownerCode = customerMap[ownerName];
  } else if (ownerName) {
    ownerCode = ownerName;
  } else {
    ownerCode = 'UNMAPPED';
  }

  const contractLengthMonths = defaultContractMonths;

  const lotSmallLotFee = (smallLotThresholdTons > 0 && fruitWeightTons < smallLotThresholdTons) ? smallLotFee : 0;
  const totalCost = Math.max(fruitWeightTons * contractRatePerTon, minProcessingFee) + lotSmallLotFee;
  const monthlyAmount = contractLengthMonths > 0 ? Math.round((totalCost / contractLengthMonths) * 100) / 100 : 0;
  const contractStartMonth = getContractStartMonth(effectiveDate);
  const contractEndMonth = getContractEndMonth(contractStartMonth, contractLengthMonths);
  const installments = generateInstallments(contractStartMonth, contractLengthMonths, monthlyAmount);

  return {
    id: `fi_${item.eventId}_${item.actionId}`,
    eventId: String(item.eventId),
    actionId: String(item.actionId),
    vintage,
    effectiveDate,
    weighTagNumber,
    ownerName,
    ownerCode,
    lotCode,
    varietal,
    color,
    fruitWeightTons,
    contractLengthMonths,
    contractRatePerTon,
    totalCost,
    smallLotFee: lotSmallLotFee,
    monthlyAmount,
    contractStartMonth,
    contractEndMonth,
    installments,
    savedAt: new Date().toISOString(),
    colorRateTierId,
  };
}

/**
 * Recalculate a record with a new contract length.
 */
export function recalculateRecord(
  record: FruitIntakeRecord,
  newContractLengthMonths: number,
  minProcessingFee: number = 0
): FruitIntakeRecord {
  const contractRatePerTon = record.contractRatePerTon;
  const totalCost = Math.max(record.fruitWeightTons * contractRatePerTon, minProcessingFee) + (record.smallLotFee || 0);
  const monthlyAmount = newContractLengthMonths > 0
    ? Math.round((totalCost / newContractLengthMonths) * 100) / 100
    : 0;
  const contractEndMonth = getContractEndMonth(record.contractStartMonth, newContractLengthMonths);
  const installments = generateInstallments(record.contractStartMonth, newContractLengthMonths, monthlyAmount);

  return {
    ...record,
    contractLengthMonths: newContractLengthMonths,
    contractRatePerTon,
    totalCost,
    monthlyAmount,
    contractEndMonth,
    installments,
  };
}

/**
 * Main entry: fetch, dedup, process, merge with existing records.
 */
export async function runFruitIntake(
  wineryId: string,
  token: string,
  settings: FruitIntakeSettings,
  customerMap: Record<string, string>,
  existingRecords: FruitIntakeRecord[],
  onProgress: (event: ProgressEvent) => void
): Promise<FruitIntakeRunResult> {
  const currentYear = new Date().getFullYear();
  const vintages: number[] = [];
  for (let i = 0; i < settings.vintageLookback; i++) {
    vintages.push(currentYear - i);
  }

  onProgress({
    step: 'fruit-intake',
    message: `Querying vintages: ${vintages.join(', ')}`,
    pct: 5,
  });

  const rawItems = await fetchFruitIntakeReport(
    wineryId,
    token,
    vintages,
    settings.apiPageDelaySeconds,
    onProgress
  );

  // Fetch fruit lots to get owner names
  onProgress({
    step: 'fruit-lots',
    message: 'Fetching fruit lots for owner mapping...',
    pct: 52,
  });

  const fruitLots = await fetchFruitLots(wineryId, token, vintages, settings.apiPageDelaySeconds, onProgress);
  const lotOwnerMap = buildLotOwnerMap(fruitLots);

  const colorRateTiers = settings.colorRateTiers || [];
  const tierByColor = settings.tierByColor ?? true;

  onProgress({
    step: 'fruit-lots',
    message: `Lot owner map: ${lotOwnerMap.size} lots mapped, ${colorRateTiers.length} color rate tiers available.`,
    pct: 55,
  });
  const minProcessingFee = settings.minProcessingFee || 0;
  const defaultContractMonths = settings.defaultContractMonths || 12;
  const smallLotFee = settings.smallLotFee || 0;
  const smallLotThresholdTons = settings.smallLotThresholdTons || 0;

  // Build dedup sets from existing records
  const existingEventIds = new Set(existingRecords.map((r) => r.eventId));
  const existingCompositeKeys = new Set(
    existingRecords.map((r) => `${r.lotCode}_${r.vintage}_${r.effectiveDate}`)
  );

  // ── Two-pass approach ──

  // First pass: collect non-duplicate items and accumulate tonnage per customer per vintage
  interface RawEntry {
    item: FruitIntakeApiItem;
    ownerCode: string;
    color: string;
    tons: number;
    vintage: number;
  }
  const newEntries: RawEntry[] = [];
  let dupCount = 0;

  onProgress({
    step: 'fruit-intake',
    message: `Processing ${rawItems.length} records (pass 1: tonnage collection)...`,
    pct: 60,
  });

  for (const item of rawItems) {
    const eventId = String(item.eventId);
    const compositeKey = `${item.lot?.lotCode || ''}_${item.vintage}_${item.effectiveAt}`;

    if (existingEventIds.has(eventId) || existingCompositeKeys.has(compositeKey)) {
      dupCount++;
      continue;
    }

    const lotCode = item.lot?.lotCode || '';
    const ownerName = lotOwnerMap.get(lotCode) || item.access?.owners?.[0]?.name || '';
    let ownerCode: string;
    if (ownerName && customerMap[ownerName]) {
      ownerCode = customerMap[ownerName];
    } else if (ownerName) {
      ownerCode = ownerName;
    } else {
      ownerCode = 'UNMAPPED';
    }

    const color = item.lot?.color || '';
    const tons = item.fruitWeight?.value || 0;
    const vintage = item.vintage || 0;

    newEntries.push({ item, ownerCode, color, tons, vintage });
    existingEventIds.add(eventId);
    existingCompositeKeys.add(compositeKey);
  }

  // Also include existing records in tonnage calculations (vintage-specific)
  const customerTonnageByColor = new Map<string, number>(); // key: "ownerCode|vintage|color"
  const customerTonnageTotal = new Map<string, number>();    // key: "ownerCode|vintage"

  // Count existing records' tonnage
  for (const r of existingRecords) {
    const colorKey = `${r.ownerCode}|${r.vintage}|${r.color.toLowerCase()}`;
    customerTonnageByColor.set(colorKey, (customerTonnageByColor.get(colorKey) || 0) + r.fruitWeightTons);
    const totalKey = `${r.ownerCode}|${r.vintage}`;
    customerTonnageTotal.set(totalKey, (customerTonnageTotal.get(totalKey) || 0) + r.fruitWeightTons);
  }

  // Count new entries' tonnage
  for (const entry of newEntries) {
    const colorKey = `${entry.ownerCode}|${entry.vintage}|${entry.color.toLowerCase()}`;
    customerTonnageByColor.set(colorKey, (customerTonnageByColor.get(colorKey) || 0) + entry.tons);
    const totalKey = `${entry.ownerCode}|${entry.vintage}`;
    customerTonnageTotal.set(totalKey, (customerTonnageTotal.get(totalKey) || 0) + entry.tons);
  }

  // Second pass: assign rates based on color + tonnage tier
  onProgress({
    step: 'fruit-intake',
    message: `Processing ${newEntries.length} new records (pass 2: rate assignment)...`,
    pct: 70,
  });

  const newRecords: FruitIntakeRecord[] = [];
  for (const entry of newEntries) {
    const customerTons = tierByColor
      ? (customerTonnageByColor.get(`${entry.ownerCode}|${entry.vintage}|${entry.color.toLowerCase()}`) || 0)
      : (customerTonnageTotal.get(`${entry.ownerCode}|${entry.vintage}`) || 0);

    const tier = findColorRateTier(entry.color, customerTons, colorRateTiers);
    const contractRatePerTon = tier?.ratePerTon || 0;
    const colorRateTierId = tier?.id;

    const record = processRawRecord(
      entry.item,
      customerMap,
      lotOwnerMap,
      contractRatePerTon,
      colorRateTierId,
      minProcessingFee,
      defaultContractMonths,
      smallLotFee,
      smallLotThresholdTons
    );

    newRecords.push(record);
  }

  const newCount = newRecords.length;

  // Merge: existing + new
  const allRecords = [...existingRecords, ...newRecords];

  onProgress({
    step: 'fruit-intake',
    message: `Done. ${newCount} new records, ${dupCount} duplicates skipped.`,
    pct: 90,
  });

  return {
    runId: `run_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    ranAt: new Date().toISOString(),
    vintagesQueried: vintages,
    totalRecords: allRecords.length,
    newRecords: newCount,
    duplicatesSkipped: dupCount,
    records: allRecords,
  };
}
