import React, { useMemo, useRef, useState } from 'react';
import { FruitIntakeRecord, FruitCustomerOverride } from '../api/client';

interface CustomerRollupTabProps {
  records: FruitIntakeRecord[];
  customerOverrides: FruitCustomerOverride[];
  defaultContractMonths: number;
  onOverrideChange: (ownerCode: string, override: Partial<Omit<FruitCustomerOverride, 'ownerCode'>>) => Promise<void>;
}

interface ColorSummary {
  color: string;
  calculatedTons: number;
  tons: number;
  calculatedCost: number;
  cost: number;
}

interface CustomerRow {
  ownerCode: string;
  colors: ColorSummary[];
  totalCost: number;
  deposit: number;
  net: number;
  months: number;
  monthly: number;
}

type EditingCell = {
  ownerCode: string;
  field: string; // e.g. "tons:Red", "cost:White", "deposit", "months"
};

export default function CustomerRollupTab({
  records,
  customerOverrides,
  defaultContractMonths,
  onOverrideChange,
}: CustomerRollupTabProps) {
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState('');
  const [updatingOwner, setUpdatingOwner] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Discover all colors present in data, ordered: Red, White, Rose, Orange, then any others alphabetically
  const allColors = useMemo(() => {
    const colorSet = new Set<string>();
    for (const r of records) {
      if (r.color) colorSet.add(r.color);
    }
    const preferredOrder = ['Red', 'White', 'Rose', 'Orange'];
    const ordered: string[] = [];
    for (const c of preferredOrder) {
      if (colorSet.has(c)) {
        ordered.push(c);
        colorSet.delete(c);
      }
    }
    return [...ordered, ...Array.from(colorSet).sort()];
  }, [records]);

  // Build override lookup
  const overrideMap = useMemo(() => {
    const map = new Map<string, FruitCustomerOverride>();
    for (const o of customerOverrides) {
      map.set(o.ownerCode, o);
    }
    return map;
  }, [customerOverrides]);

  // Build customer rows
  const customerRows = useMemo((): CustomerRow[] => {
    // Group records by ownerCode
    const byOwner = new Map<string, FruitIntakeRecord[]>();
    for (const r of records) {
      const existing = byOwner.get(r.ownerCode) || [];
      existing.push(r);
      byOwner.set(r.ownerCode, existing);
    }

    const rows: CustomerRow[] = [];
    for (const [ownerCode, ownerRecords] of byOwner) {
      const override = overrideMap.get(ownerCode);
      const colorOverrides = override?.colorOverrides || [];

      // Group by color
      const byColor = new Map<string, FruitIntakeRecord[]>();
      for (const r of ownerRecords) {
        const c = r.color || 'Unknown';
        const existing = byColor.get(c) || [];
        existing.push(r);
        byColor.set(c, existing);
      }

      const colorSummaries: ColorSummary[] = [];
      for (const color of allColors) {
        const colorRecords = byColor.get(color) || [];
        const calculatedTons = colorRecords.reduce((s, r) => s + r.fruitWeightTons, 0);
        const calculatedCost = colorRecords.reduce((s, r) => s + r.totalCost, 0);

        const co = colorOverrides.find(o => o.color === color);
        const tons = co?.tonsOverride ?? calculatedTons;
        const cost = co?.costOverride ?? calculatedCost;

        colorSummaries.push({ color, calculatedTons, tons, calculatedCost, cost });
      }

      const totalCost = colorSummaries.reduce((s, c) => s + c.cost, 0);
      const deposit = override?.deposit ?? 0;
      const net = totalCost - deposit;
      const months = override?.contractLengthMonths ?? defaultContractMonths;
      const monthly = months > 0 ? Math.round((net / months) * 100) / 100 : 0;

      rows.push({ ownerCode, colors: colorSummaries, totalCost, deposit, net, months, monthly });
    }

    return rows.sort((a, b) => a.ownerCode.localeCompare(b.ownerCode));
  }, [records, allColors, overrideMap, defaultContractMonths]);

  const startEdit = (ownerCode: string, field: string, currentValue: number) => {
    setEditingCell({ ownerCode, field });
    setEditValue(currentValue.toString());
  };

  const commitEdit = async () => {
    if (!editingCell) return;
    const numVal = parseFloat(editValue);
    if (isNaN(numVal) || numVal < 0) {
      setEditingCell(null);
      return;
    }

    const { ownerCode, field } = editingCell;
    setUpdatingOwner(ownerCode);

    try {
      if (field === 'deposit') {
        await onOverrideChange(ownerCode, { deposit: numVal });
      } else if (field === 'months') {
        await onOverrideChange(ownerCode, { contractLengthMonths: Math.round(numVal) });
      } else if (field.startsWith('tons:') || field.startsWith('cost:')) {
        const [type, color] = field.split(':');
        const override = overrideMap.get(ownerCode);
        const existing = override?.colorOverrides || [];
        const co = existing.find(o => o.color === color);
        const updatedCo = co ? { ...co } : { color };

        if (type === 'tons') {
          updatedCo.tonsOverride = numVal;
        } else {
          updatedCo.costOverride = numVal;
        }

        const newColorOverrides = co
          ? existing.map(o => o.color === color ? updatedCo : o)
          : [...existing, updatedCo];

        await onOverrideChange(ownerCode, { colorOverrides: newColorOverrides });
      }
    } finally {
      setUpdatingOwner(null);
      setEditingCell(null);
    }
  };

  const cancelEdit = () => setEditingCell(null);

  const isEditing = (ownerCode: string, field: string) =>
    editingCell?.ownerCode === ownerCode && editingCell?.field === field;

  const renderEditable = (ownerCode: string, field: string, value: number, isOverridden?: boolean) => {
    if (isEditing(ownerCode, field)) {
      return (
        <input
          type="number"
          step="0.01"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit(); }}
          autoFocus
          className="w-24 px-1 py-0.5 border border-violet-400 rounded text-xs text-right font-mono"
        />
      );
    }
    return (
      <span
        onClick={() => startEdit(ownerCode, field, value)}
        className={`cursor-pointer hover:text-violet-600 hover:underline ${isOverridden ? 'text-violet-700 font-semibold' : ''}`}
      >
        ${value.toFixed(2)}
      </span>
    );
  };

  const renderEditableTons = (ownerCode: string, color: string, value: number, isOverridden: boolean) => {
    const field = `tons:${color}`;
    if (isEditing(ownerCode, field)) {
      return (
        <input
          type="number"
          step="0.01"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit(); }}
          autoFocus
          className="w-20 px-1 py-0.5 border border-violet-400 rounded text-xs text-right font-mono"
        />
      );
    }
    return (
      <span
        onClick={() => startEdit(ownerCode, field, value)}
        className={`cursor-pointer hover:text-violet-600 hover:underline ${isOverridden ? 'text-violet-700 font-semibold' : ''}`}
      >
        {value.toFixed(2)}
      </span>
    );
  };

  const renderEditableMonths = (ownerCode: string, value: number, isOverridden: boolean) => {
    if (isEditing(ownerCode, 'months')) {
      return (
        <input
          type="number"
          step="1"
          min="1"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit(); }}
          autoFocus
          className="w-16 px-1 py-0.5 border border-violet-400 rounded text-xs text-right font-mono"
        />
      );
    }
    return (
      <span
        onClick={() => startEdit(ownerCode, 'months', value)}
        className={`cursor-pointer hover:text-violet-600 hover:underline ${isOverridden ? 'text-violet-700 font-semibold' : ''}`}
      >
        {value}
      </span>
    );
  };

  const exportCsv = () => {
    const headers = ['Customer', ...allColors.flatMap(c => [`${c} Tons`, `${c} $`]), 'Total Cost', 'Deposit', 'Net', 'Months', 'Monthly'];
    const rows = customerRows.map(r => [
      r.ownerCode,
      ...r.colors.flatMap(cs => [cs.tons, cs.cost]),
      r.totalCost, r.deposit, r.net, r.months, r.monthly,
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'deposit-and-override.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const parseCsvValue = (val: string): string => {
    val = val.trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1).replace(/""/g, '"');
    return val.replace(/^\$/, '');
  };

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return;

    // Parse header to discover column indices
    const headerCols = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const colMap: Record<string, number> = {};
    headerCols.forEach((h, i) => { colMap[h] = i; });

    // Detect color columns
    const csvColors: string[] = [];
    for (const h of headerCols) {
      const m = h.match(/^(.+?)\s+Tons$/);
      if (m && !csvColors.includes(m[1])) csvColors.push(m[1]);
    }

    for (let i = 1; i < lines.length; i++) {
      // Split respecting quoted values
      const vals: string[] = [];
      let cur = '';
      let inQuote = false;
      for (const ch of lines[i]) {
        if (ch === '"') { inQuote = !inQuote; cur += ch; }
        else if (ch === ',' && !inQuote) { vals.push(cur); cur = ''; }
        else { cur += ch; }
      }
      vals.push(cur);

      const ownerCode = parseCsvValue(vals[0] || '');
      if (!ownerCode || ownerCode === 'TOTAL') continue;

      const row = customerRows.find(r => r.ownerCode === ownerCode);
      if (!row) continue;

      const override = overrideMap.get(ownerCode);
      const existingColorOverrides = override?.colorOverrides || [];
      let newColorOverrides = [...existingColorOverrides];
      let hasChanges = false;

      // Check color columns
      for (const color of csvColors) {
        const tonsIdx = colMap[`${color} Tons`];
        const costIdx = colMap[`${color} $`];
        const cs = row.colors.find(c => c.color === color);
        if (!cs) continue;

        let coChanged = false;
        const co = newColorOverrides.find(o => o.color === color);
        const updatedCo = co ? { ...co } : { color } as { color: string; tonsOverride?: number; costOverride?: number };

        if (tonsIdx !== undefined && vals[tonsIdx] !== undefined) {
          const csvTons = parseFloat(parseCsvValue(vals[tonsIdx]));
          if (!isNaN(csvTons) && Math.abs(csvTons - cs.calculatedTons) > 0.001) {
            updatedCo.tonsOverride = csvTons;
            coChanged = true;
          }
        }
        if (costIdx !== undefined && vals[costIdx] !== undefined) {
          const csvCost = parseFloat(parseCsvValue(vals[costIdx]));
          if (!isNaN(csvCost) && Math.abs(csvCost - cs.calculatedCost) > 0.001) {
            updatedCo.costOverride = csvCost;
            coChanged = true;
          }
        }

        if (coChanged) {
          newColorOverrides = co
            ? newColorOverrides.map(o => o.color === color ? updatedCo : o)
            : [...newColorOverrides, updatedCo];
          hasChanges = true;
        }
      }

      // Check deposit
      const depositIdx = colMap['Deposit'];
      let newDeposit: number | undefined;
      if (depositIdx !== undefined && vals[depositIdx] !== undefined) {
        const csvDeposit = parseFloat(parseCsvValue(vals[depositIdx]));
        if (!isNaN(csvDeposit) && Math.abs(csvDeposit - (override?.deposit ?? 0)) > 0.001) {
          newDeposit = csvDeposit;
          hasChanges = true;
        }
      }

      // Check months
      const monthsIdx = colMap['Months'];
      let newMonths: number | undefined;
      if (monthsIdx !== undefined && vals[monthsIdx] !== undefined) {
        const csvMonths = parseInt(parseCsvValue(vals[monthsIdx]), 10);
        const currentMonths = override?.contractLengthMonths ?? defaultContractMonths;
        if (!isNaN(csvMonths) && csvMonths !== currentMonths) {
          newMonths = csvMonths;
          hasChanges = true;
        }
      }

      if (hasChanges) {
        const patch: Partial<Omit<FruitCustomerOverride, 'ownerCode'>> = {};
        if (newColorOverrides.length > 0) patch.colorOverrides = newColorOverrides;
        if (newDeposit !== undefined) patch.deposit = newDeposit;
        if (newMonths !== undefined) patch.contractLengthMonths = newMonths;
        await onOverrideChange(ownerCode, patch);
      }
    }
  };

  if (customerRows.length === 0) {
    return <p className="text-sm text-gray-500">No customer data available.</p>;
  }

  // Totals row
  const grandTotalCost = customerRows.reduce((s, r) => s + r.totalCost, 0);
  const grandDeposit = customerRows.reduce((s, r) => s + r.deposit, 0);
  const grandNet = customerRows.reduce((s, r) => s + r.net, 0);

  return (
    <div>
      <div className="flex gap-2 mb-3">
        <button onClick={exportCsv} className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700">Export CSV</button>
        <button onClick={() => fileInputRef.current?.click()} className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700">Upload CSV</button>
        <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleCsvUpload} />
      </div>
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
      <table className="text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase sticky left-0 bg-gray-50 z-10">Customer</th>
            {allColors.map(color => (
              <React.Fragment key={color}>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">{color} Tons</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">{color} $</th>
              </React.Fragment>
            ))}
            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total Cost</th>
            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Deposit</th>
            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Net</th>
            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Months</th>
            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Monthly</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {customerRows.map((row) => {
            const override = overrideMap.get(row.ownerCode);
            return (
              <tr key={row.ownerCode} className={updatingOwner === row.ownerCode ? 'opacity-50' : ''}>
                <td className="px-3 py-1.5 font-mono sticky left-0 bg-white z-10">{row.ownerCode}</td>
                {row.colors.map((cs) => {
                  const co = override?.colorOverrides?.find(o => o.color === cs.color);
                  return (
                    <React.Fragment key={cs.color}>
                      <td className="px-3 py-1.5 text-right">
                        {renderEditableTons(row.ownerCode, cs.color, cs.tons, co?.tonsOverride !== undefined)}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        {renderEditable(row.ownerCode, `cost:${cs.color}`, cs.cost, co?.costOverride !== undefined)}
                      </td>
                    </React.Fragment>
                  );
                })}
                <td className="px-3 py-1.5 text-right font-semibold">${row.totalCost.toFixed(2)}</td>
                <td className="px-3 py-1.5 text-right">
                  {renderEditable(row.ownerCode, 'deposit', row.deposit, (override?.deposit ?? 0) > 0)}
                </td>
                <td className="px-3 py-1.5 text-right font-semibold">${row.net.toFixed(2)}</td>
                <td className="px-3 py-1.5 text-right">
                  {renderEditableMonths(row.ownerCode, row.months, override?.contractLengthMonths !== undefined)}
                </td>
                <td className="px-3 py-1.5 text-right font-semibold">${row.monthly.toFixed(2)}</td>
              </tr>
            );
          })}
          {/* Totals row */}
          <tr className="bg-gray-100 font-bold">
            <td className="px-3 py-2 sticky left-0 bg-gray-100 z-10">TOTAL</td>
            {allColors.map((color) => {
              const totalTons = customerRows.reduce((s, r) => s + (r.colors.find(c => c.color === color)?.tons ?? 0), 0);
              const totalCost = customerRows.reduce((s, r) => s + (r.colors.find(c => c.color === color)?.cost ?? 0), 0);
              return (
                <React.Fragment key={color}>
                  <td className="px-3 py-2 text-right">{totalTons.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right">${totalCost.toFixed(2)}</td>
                </React.Fragment>
              );
            })}
            <td className="px-3 py-2 text-right">${grandTotalCost.toFixed(2)}</td>
            <td className="px-3 py-2 text-right">${grandDeposit.toFixed(2)}</td>
            <td className="px-3 py-2 text-right">${grandNet.toFixed(2)}</td>
            <td className="px-3 py-2 text-right"></td>
            <td className="px-3 py-2 text-right"></td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>
  );
}
