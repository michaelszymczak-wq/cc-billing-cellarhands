import {
  ActionRow,
  BarrelBillingRow,
  BillableAddOn,
  BulkBillingRow,
  CaseGoodsBillingRow,
  Consumable,
  ExtendedTankTimeRow,
  FruitCustomerOverride,
  FruitIntakeRecord,
  QBCustomerSummary,
  QBLineItem,
  QBPreviewResponse,
} from '../types';

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

// ─── Date Helpers ───

export function getLastDayOfMonth(month: string, year: number): string {
  const monthIndex = MONTHS.indexOf(month);
  if (monthIndex === -1) return `12/31/${year}`;
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const mm = String(monthIndex + 1).padStart(2, '0');
  const dd = String(lastDay).padStart(2, '0');
  return `${mm}/${dd}/${year}`;
}

export function getShortMonthYear(month: string, year: number): string {
  const short = month.substring(0, 3);
  const yy = String(year).slice(-2);
  return `${short}-${yy}`;
}

// ─── Installment Helpers ───

function parseMonthKey(key: string): { monthIdx: number; year: number } {
  const [monthName, yearStr] = key.split(' ');
  return { monthIdx: MONTHS.indexOf(monthName), year: parseInt(yearStr, 10) };
}

function generateInstallmentMonths(startMonth: string, count: number): string[] {
  const parts = startMonth.split(' ');
  if (parts.length !== 2) return [];
  let monthIdx = MONTHS.indexOf(parts[0]);
  let year = parseInt(parts[1], 10);
  if (monthIdx === -1 || isNaN(year)) return [];

  const months: string[] = [];
  for (let i = 0; i < count; i++) {
    months.push(`${MONTHS[monthIdx]} ${year}`);
    monthIdx++;
    if (monthIdx >= 12) { monthIdx = 0; year++; }
  }
  return months;
}

// ─── QB Item Mapping ───

export function mapToQuickBooksItem(
  itemCode: string,
  description: string
): { item: string; description: string } {
  switch (itemCode) {
    case 'ANALYSIS': {
      if (/free\s+so[2₂]/i.test(description) || /free\s+sulfur/i.test(description))
        return { item: 'Free SO2', description: 'Free SO2/SO2 Test' };
      if (/glucose|fructose/i.test(description))
        return { item: 'GluFru', description: 'Glucose/Fructose Analysis' };
      if (/malic/i.test(description))
        return { item: 'MALIC', description: 'Malic Acid Analysis' };
      if (/volatile|acidity|acetic/i.test(description))
        return { item: 'Vol Acid', description: 'Volatile Acidity Analysis' };
      return { item: 'Free SO2', description: description || 'Analysis' };
    }
    case 'BULK':
      return { item: 'Bulk', description: 'Full Barrel Storage' };
    case 'BARREL':
      return { item: 'Empty Barrel Storage', description: 'Empty Barrel Storage' };
    case 'PUNCHEON':
      return { item: 'Empty Puncheon Storage', description: 'Empty Puncheon Storage' };
    case 'TANK':
      return { item: 'Tank Storage', description: 'Tank Storage' };
    case 'STEAM':
      return { item: 'Steam', description: 'Barrel Steam Service' };
    case 'CONTRACT':
      return { item: 'Custom Crush', description: 'Contracted CC' };
    case 'PRESS':
      return { item: 'PRESS', description: 'Press Service' };
    case 'TASTING':
      return { item: 'Private Tasting', description: 'Private Tasting' };
    case 'LABOR':
    case 'ADDON': {
      if (/dry\s*ice/i.test(description))
        return { item: 'DRYICE', description: 'Harvest Dry Ice Charge' };
      return { item: 'Addl Winework', description: 'Billable Hours' };
    }
    case 'CASE_GOODS':
      return { item: 'Case Goods', description: 'Case Goods Pallet Storage' };
    case 'BOTTLE':
      return { item: 'Bottling', description: description || 'Bottling' };
    case 'CONSUMABLE':
      return { item: description, description: 'Consumable: ' + description };
    case 'EXTENDED_TANK_TIME':
      return { item: 'Tank Time', description: 'Extended Tank Time' };
    default:
      return { item: 'Addl Winework', description: description || 'Miscellaneous' };
  }
}

// ─── Action Row Helpers ───

function getActionItemCode(row: ActionRow): string {
  const actionType = (row.rawActionType || row.actionType || '').toUpperCase();
  if (actionType === 'ANALYSIS') return 'ANALYSIS';
  if (actionType === 'DRAIN_AND_PRESS') return 'PRESS';
  if (actionType === 'CUSTOM' && /steam/i.test(row.analysisOrNotes)) return 'STEAM';
  if (actionType === 'CUSTOM' && /tasting/i.test(row.analysisOrNotes)) return 'TASTING';
  if (actionType === 'BOTTLE') return 'BOTTLE';
  const notes = (row.analysisOrNotes || '').toLowerCase();
  const label = (row.matchedRuleLabel || '').toLowerCase();
  if (/billable/i.test(notes) || /billable/i.test(label)) return 'LABOR';
  if (actionType === 'CUSTOM') return 'LABOR';
  if (actionType === 'ADDITION') return 'LABOR';
  return 'LABOR';
}

function getActionDescription(row: ActionRow): string {
  const actionType = (row.rawActionType || row.actionType || '').toUpperCase();
  if (actionType === 'BOTTLE') {
    return row.lotCodes || row.analysisOrNotes || 'Bottling';
  }
  return row.analysisOrNotes || row.matchedRuleLabel || row.actionType;
}

function getActionQuantity(row: ActionRow): number {
  if (row.quantity && row.quantity > 0) return row.quantity;
  if (row.hours && row.hours > 0) return row.hours;
  return 1;
}

// ─── Line Item Builder ───

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function makeLineItem(
  customerJob: string,
  date: string,
  item: string,
  description: string,
  quantity: number,
  rate: number
): QBLineItem {
  const amount = round2(quantity * rate);
  return {
    arAccount: '4010 \u00b7 Sales',
    customerJob,
    date,
    salesTax: 'no tax',
    number: '250',
    class: '',
    item,
    description,
    quantity: round2(quantity),
    rate: round2(rate),
    amount,
    taxCode: 'Non',
  };
}

// ─── Build Preview ───

type EnabledSources = {
  actions: boolean;
  barrel: boolean;
  bulk: boolean;
  fruitIntake: boolean;
  addOns: boolean;
  consumables: boolean;
  caseGoods: boolean;
  extendedTankTime: boolean;
};

export function buildPreview(
  actions: ActionRow[],
  barrelInv: BarrelBillingRow[],
  bulkInv: BulkBillingRow[],
  fruitRecords: FruitIntakeRecord[],
  addOns: BillableAddOn[],
  consumables: Consumable[],
  month: string,
  year: number,
  excluded: string[],
  enabledSources: EnabledSources,
  qbCustomerMap: Record<string, string> = {},
  customerOverrides: FruitCustomerOverride[] = [],
  defaultContractMonths: number = 12,
  includeDeposits: boolean = false,
  caseGoodsInv: CaseGoodsBillingRow[] = [],
  extendedTankTimeRows: ExtendedTankTimeRow[] = []
): QBPreviewResponse {
  const billingDate = getLastDayOfMonth(month, year);
  const excludedSet = new Set(excluded.map(c => c.toUpperCase()));

  // Build override lookup for customer-level fruit installments
  const overrideMap = new Map<string, FruitCustomerOverride>();
  for (const o of customerOverrides) overrideMap.set(o.ownerCode, o);

  const allOwners = new Set<string>();
  if (enabledSources.actions) actions.filter(a => a.matched).forEach(a => allOwners.add(a.ownerCode));
  if (enabledSources.barrel) barrelInv.forEach(b => allOwners.add(b.ownerCode));
  if (enabledSources.bulk) bulkInv.forEach(b => allOwners.add(b.ownerCode));
  if (enabledSources.fruitIntake) fruitRecords.forEach(f => allOwners.add(f.ownerCode));
  if (enabledSources.addOns) addOns.forEach(a => allOwners.add(a.ownerCode));
  if (enabledSources.caseGoods) caseGoodsInv.forEach(cg => allOwners.add(cg.ownerCode));
  if (enabledSources.extendedTankTime) extendedTankTimeRows.forEach(ett => allOwners.add(ett.ownerCode));
  if (includeDeposits) {
    for (const o of customerOverrides) {
      if (o.deposit > 0) allOwners.add(o.ownerCode);
    }
  }
  if (enabledSources.consumables) {
    // Add owners from fruit records matching consumable vintages
    const consumableVintages = new Set(consumables.map(c => c.vintage));
    fruitRecords.filter(f => consumableVintages.has(f.vintage)).forEach(f => allOwners.add(f.ownerCode));
  }

  const owners = [...allOwners].filter(o => !excludedSet.has(o.toUpperCase())).sort();

  const emptySources = (): QBCustomerSummary['sources'] => ({
    actions: { items: [], subtotal: 0 },
    barrel: { items: [], subtotal: 0 },
    bulk: { items: [], subtotal: 0 },
    fruitIntake: { items: [], subtotal: 0 },
    addOns: { items: [], subtotal: 0 },
    consumables: { items: [], subtotal: 0 },
    caseGoods: { items: [], subtotal: 0 },
    extendedTankTime: { items: [], subtotal: 0 },
  });

  const customers: QBCustomerSummary[] = [];

  for (const ownerCode of owners) {
    const customerJob = qbCustomerMap[ownerCode] || ownerCode;
    const sources = emptySources();

    // ── Actions ──
    if (enabledSources.actions) {
      const ownerActions = actions.filter(a => a.ownerCode === ownerCode && a.matched);
      const grouped = new Map<string, { qty: number; total: number; rate: number; item: string; desc: string }>();
      for (const row of ownerActions) {
        const itemCode = getActionItemCode(row);
        const actionDesc = getActionDescription(row);
        const mapped = mapToQuickBooksItem(itemCode, actionDesc);
        const key = `${mapped.item}||${mapped.description}`;
        const existing = grouped.get(key);
        const qty = getActionQuantity(row);
        if (existing) {
          existing.qty += qty;
          existing.total += row.total;
        } else {
          grouped.set(key, { qty, total: row.total, rate: row.rate, item: mapped.item, desc: mapped.description });
        }
      }
      for (const [, g] of grouped) {
        const effectiveRate = g.qty > 0 ? round2(g.total / g.qty) : g.rate;
        const lineItem = makeLineItem(customerJob, billingDate, g.item, g.desc, g.qty, effectiveRate);
        lineItem.amount = round2(g.total);
        sources.actions.items.push(lineItem);
        sources.actions.subtotal += lineItem.amount;
      }
      sources.actions.subtotal = round2(sources.actions.subtotal);
    }

    // ── Barrel inventory ──
    if (enabledSources.barrel) {
      const ownerBarrels = barrelInv.filter(b => b.ownerCode === ownerCode);
      for (const b of ownerBarrels) {
        const mapped = mapToQuickBooksItem('BARREL', '');
        const lineItem = makeLineItem(customerJob, billingDate, mapped.item, mapped.description, b.avgBarrels, b.rate);
        lineItem.amount = round2(b.charge);
        sources.barrel.items.push(lineItem);
        sources.barrel.subtotal += lineItem.amount;
      }
      sources.barrel.subtotal = round2(sources.barrel.subtotal);
    }

    // ── Bulk inventory ──
    if (enabledSources.bulk) {
      const ownerBulk = bulkInv.filter(b => b.ownerCode === ownerCode);
      for (const b of ownerBulk) {
        const itemCode = b.type === 'bulk' ? 'BULK' : b.type === 'puncheon' ? 'PUNCHEON' : b.type === 'tank' ? 'TANK' : 'BARREL';
        const mapped = mapToQuickBooksItem(itemCode, '');
        const lineItem = makeLineItem(customerJob, billingDate, mapped.item, mapped.description, b.billingVolume, b.rate);
        lineItem.amount = round2(b.totalCost);
        sources.bulk.items.push(lineItem);
        sources.bulk.subtotal += lineItem.amount;
      }
      sources.bulk.subtotal = round2(sources.bulk.subtotal);
    }

    // ── Fruit Intake (customer-level installments using overrides) ──
    if (enabledSources.fruitIntake) {
      const monthKey = `${month} ${year}`;
      const ownerFruit = fruitRecords.filter(f => f.ownerCode === ownerCode);

      if (ownerFruit.length > 0) {
        const override = overrideMap.get(ownerCode);

        // Calculate total cost respecting color overrides
        let totalCost = 0;
        if (override?.colorOverrides?.length) {
          const byColor = new Map<string, FruitIntakeRecord[]>();
          for (const r of ownerFruit) {
            const existing = byColor.get(r.color) || [];
            existing.push(r);
            byColor.set(r.color, existing);
          }
          const coveredColors = new Set<string>();
          for (const co of override.colorOverrides) {
            coveredColors.add(co.color);
            if (co.costOverride !== undefined) {
              totalCost += co.costOverride;
            } else {
              const colorRecords = byColor.get(co.color) || [];
              totalCost += colorRecords.reduce((s, r) => s + r.totalCost, 0);
            }
          }
          for (const [color, colorRecords] of byColor) {
            if (!coveredColors.has(color)) {
              totalCost += colorRecords.reduce((s, r) => s + r.totalCost, 0);
            }
          }
        } else {
          totalCost = ownerFruit.reduce((s, r) => s + r.totalCost, 0);
        }

        const deposit = override?.deposit ?? 0;
        const net = totalCost - deposit;
        const months = override?.contractLengthMonths ?? defaultContractMonths;
        const monthlyAmount = months > 0 ? round2(net / months) : 0;

        // Find earliest contractStartMonth
        let earliestStart = ownerFruit[0]?.contractStartMonth || '';
        for (const r of ownerFruit) {
          if (r.contractStartMonth && earliestStart) {
            const rk = parseMonthKey(r.contractStartMonth);
            const ek = parseMonthKey(earliestStart);
            if (rk.year * 12 + rk.monthIdx < ek.year * 12 + ek.monthIdx) {
              earliestStart = r.contractStartMonth;
            }
          }
        }

        // Check if the selected month falls within the installment schedule
        const installmentMonths = generateInstallmentMonths(earliestStart, months);
        if (installmentMonths.includes(monthKey) && monthlyAmount > 0) {
          const mapped = mapToQuickBooksItem('CONTRACT', '');
          const lineItem = makeLineItem(
            customerJob, billingDate, mapped.item,
            `${mapped.description} (${months} mo)`,
            1, monthlyAmount
          );
          sources.fruitIntake.items.push(lineItem);
          sources.fruitIntake.subtotal += lineItem.amount;
        }

        sources.fruitIntake.subtotal = round2(sources.fruitIntake.subtotal);
      }
    }

    // ── Deposits ──
    if (includeDeposits) {
      const override = overrideMap.get(ownerCode);
      if (override && override.deposit > 0) {
        const lineItem = makeLineItem(
          customerJob, billingDate, 'Deposit', 'Fruit Contract Deposit',
          1, override.deposit
        );
        sources.fruitIntake.items.push(lineItem);
        sources.fruitIntake.subtotal = round2(sources.fruitIntake.subtotal + lineItem.amount);
      }
    }

    // ── Add-Ons ──
    if (enabledSources.addOns) {
      const monthIndex = MONTHS.indexOf(month);
      const monthStr = String(monthIndex + 1).padStart(2, '0');
      const yearStr = String(year);
      const ownerAddOns = addOns.filter(a => {
        if (a.ownerCode !== ownerCode) return false;
        return a.date.startsWith(`${yearStr}-${monthStr}`);
      });
      for (const addon of ownerAddOns) {
        const mapped = mapToQuickBooksItem('ADDON', addon.rateRuleLabel);
        const lineItem = makeLineItem(customerJob, billingDate, mapped.item, mapped.description, addon.quantity, addon.rate);
        lineItem.amount = round2(addon.totalCost);
        sources.addOns.items.push(lineItem);
        sources.addOns.subtotal += lineItem.amount;
      }
      sources.addOns.subtotal = round2(sources.addOns.subtotal);
    }

    // ── Consumables (shared costs by fruit tonnage) ──
    if (enabledSources.consumables) {
      for (const consumable of consumables) {
        const vintageRecords = fruitRecords.filter(f => f.vintage === consumable.vintage);
        if (vintageRecords.length === 0) continue;

        // Sum tons per owner and grand total
        const tonsByOwner = new Map<string, number>();
        let grandTotalTons = 0;
        for (const rec of vintageRecords) {
          if (excludedSet.has(rec.ownerCode.toUpperCase())) continue;
          tonsByOwner.set(rec.ownerCode, (tonsByOwner.get(rec.ownerCode) || 0) + rec.fruitWeightTons);
          grandTotalTons += rec.fruitWeightTons;
        }

        if (grandTotalTons === 0 || !tonsByOwner.has(ownerCode)) continue;

        const ownerTons = tonsByOwner.get(ownerCode) || 0;
        const sortedOwners = [...tonsByOwner.keys()].sort();
        const isLastOwner = ownerCode === sortedOwners[sortedOwners.length - 1];

        let share: number;
        if (isLastOwner) {
          // Last owner (alphabetically) gets remainder to avoid rounding drift
          const othersTotal = sortedOwners
            .filter(o => o !== ownerCode)
            .reduce((sum, o) => sum + round2((tonsByOwner.get(o)! / grandTotalTons) * consumable.totalCost), 0);
          share = round2(consumable.totalCost - othersTotal);
        } else {
          share = round2((ownerTons / grandTotalTons) * consumable.totalCost);
        }

        if (share > 0) {
          const mapped = mapToQuickBooksItem('CONSUMABLE', consumable.name);
          const lineItem = makeLineItem(customerJob, billingDate, mapped.item, mapped.description, 1, share);
          sources.consumables.items.push(lineItem);
          sources.consumables.subtotal += lineItem.amount;
        }
      }
      sources.consumables.subtotal = round2(sources.consumables.subtotal);
    }

    // ── Case Goods ──
    if (enabledSources.caseGoods) {
      const ownerCaseGoods = caseGoodsInv.filter(cg => cg.ownerCode === ownerCode);
      for (const cg of ownerCaseGoods) {
        const mapped = mapToQuickBooksItem('CASE_GOODS', '');
        const lineItem = makeLineItem(customerJob, billingDate, mapped.item, mapped.description, cg.pallets, cg.rate);
        lineItem.amount = round2(cg.totalCost);
        sources.caseGoods.items.push(lineItem);
        sources.caseGoods.subtotal += lineItem.amount;
      }
      sources.caseGoods.subtotal = round2(sources.caseGoods.subtotal);
    }

    // ── Extended Tank Time ──
    if (enabledSources.extendedTankTime) {
      const ownerTankTime = extendedTankTimeRows.filter(ett => ett.ownerCode === ownerCode);
      for (const ett of ownerTankTime) {
        const mapped = mapToQuickBooksItem('EXTENDED_TANK_TIME', '');
        const qtyLabel = ett.quantity !== undefined ? ` ${ett.quantity} ${ett.unit || 'unit'}` : '';
        const lineItem = makeLineItem(
          customerJob, billingDate, mapped.item,
          `${mapped.description}: ${ett.lotCode} (${ett.billableDays} days x${qtyLabel})`,
          1, ett.totalCharge
        );
        lineItem.amount = round2(ett.totalCharge);
        sources.extendedTankTime.items.push(lineItem);
        sources.extendedTankTime.subtotal += lineItem.amount;
      }
      sources.extendedTankTime.subtotal = round2(sources.extendedTankTime.subtotal);
    }

    const total = round2(
      sources.actions.subtotal + sources.barrel.subtotal + sources.bulk.subtotal +
      sources.fruitIntake.subtotal + sources.addOns.subtotal + sources.consumables.subtotal +
      sources.caseGoods.subtotal + sources.extendedTankTime.subtotal
    );

    if (total > 0 || sources.actions.items.length + sources.barrel.items.length +
        sources.bulk.items.length + sources.fruitIntake.items.length + sources.addOns.items.length +
        sources.consumables.items.length + sources.caseGoods.items.length +
        sources.extendedTankTime.items.length > 0) {
      customers.push({ ownerCode, sources, total });
    }
  }

  const grandTotal = round2(customers.reduce((sum, c) => sum + c.total, 0));
  const lineItemCount = customers.reduce((sum, c) => {
    return sum + c.sources.actions.items.length + c.sources.barrel.items.length +
      c.sources.bulk.items.length + c.sources.fruitIntake.items.length + c.sources.addOns.items.length +
      c.sources.consumables.items.length + c.sources.caseGoods.items.length +
      c.sources.extendedTankTime.items.length;
  }, 0);

  return { customers, grandTotal, lineItemCount, billingDate };
}

// ─── CSV Generation (RFC 4180) ───

function escapeCSV(value: string | number): string {
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function generateCSV(preview: QBPreviewResponse): string {
  const headers = [
    'AR Account', 'Customer:Job', 'Date', 'Sales Tax', 'Number',
    'Class', 'Item', 'Description', 'Quantity', 'Rate', 'Amount', 'Tax Code',
  ];
  const lines: string[] = [headers.join(',')];

  for (const customer of preview.customers) {
    const allItems: QBLineItem[] = [
      ...customer.sources.actions.items,
      ...customer.sources.barrel.items,
      ...customer.sources.bulk.items,
      ...customer.sources.fruitIntake.items,
      ...customer.sources.addOns.items,
      ...customer.sources.consumables.items,
      ...customer.sources.caseGoods.items,
      ...customer.sources.extendedTankTime.items,
    ];
    for (const item of allItems) {
      lines.push([
        escapeCSV(item.arAccount),
        escapeCSV(item.customerJob),
        escapeCSV(item.date),
        escapeCSV(item.salesTax),
        escapeCSV(item.number),
        escapeCSV(item.class),
        escapeCSV(item.item),
        escapeCSV(item.description),
        escapeCSV(item.quantity),
        escapeCSV(item.rate),
        escapeCSV(item.amount),
        escapeCSV(item.taxCode),
      ].join(','));
    }
  }

  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}
