import React, { useMemo, useState } from 'react';
import { FruitIntakeRecord, FruitCustomerOverride } from '../api/client';

interface InstallmentScheduleProps {
  records: FruitIntakeRecord[];
  customerOverrides?: FruitCustomerOverride[];
  defaultContractMonths?: number;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function parseMonthKey(key: string): { monthIdx: number; year: number } {
  const [month, yearStr] = key.split(' ');
  return { monthIdx: MONTH_NAMES.indexOf(month), year: parseInt(yearStr, 10) };
}

function sortMonthKeys(keys: string[]): string[] {
  return keys.sort((a, b) => {
    const pa = parseMonthKey(a);
    const pb = parseMonthKey(b);
    if (pa.year !== pb.year) return pa.year - pb.year;
    return pa.monthIdx - pb.monthIdx;
  });
}

function generateInstallmentMonths(startMonth: string, count: number): string[] {
  const parts = startMonth.split(' ');
  if (parts.length !== 2) return [];
  let monthIdx = MONTH_NAMES.indexOf(parts[0]);
  let year = parseInt(parts[1], 10);
  if (monthIdx === -1 || isNaN(year)) return [];

  const months: string[] = [];
  for (let i = 0; i < count; i++) {
    months.push(`${MONTH_NAMES[monthIdx]} ${year}`);
    monthIdx++;
    if (monthIdx >= 12) {
      monthIdx = 0;
      year++;
    }
  }
  return months;
}

interface CustomerInstallmentRow {
  ownerCode: string;
  totalCost: number;
  deposit: number;
  net: number;
  months: number;
  monthlyAmount: number;
  contractStartMonth: string;
  installments: Record<string, number>;
}

export default function InstallmentSchedule({ records, customerOverrides = [], defaultContractMonths = 12 }: InstallmentScheduleProps) {
  const [copiedMonth, setCopiedMonth] = useState<string | null>(null);

  const overrideMap = useMemo(() => {
    const map = new Map<string, FruitCustomerOverride>();
    for (const o of customerOverrides) map.set(o.ownerCode, o);
    return map;
  }, [customerOverrides]);

  // Build per-customer rows
  const customerRows = useMemo((): CustomerInstallmentRow[] => {
    const byOwner = new Map<string, FruitIntakeRecord[]>();
    for (const r of records) {
      const existing = byOwner.get(r.ownerCode) || [];
      existing.push(r);
      byOwner.set(r.ownerCode, existing);
    }

    const rows: CustomerInstallmentRow[] = [];
    for (const [ownerCode, ownerRecords] of byOwner) {
      const override = overrideMap.get(ownerCode);

      // Calculate total cost respecting color overrides
      let totalCost = 0;
      if (override?.colorOverrides?.length) {
        // Group records by color, apply overrides
        const byColor = new Map<string, FruitIntakeRecord[]>();
        for (const r of ownerRecords) {
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
        // Add costs for colors not covered by overrides
        for (const [color, colorRecords] of byColor) {
          if (!coveredColors.has(color)) {
            totalCost += colorRecords.reduce((s, r) => s + r.totalCost, 0);
          }
        }
      } else {
        totalCost = ownerRecords.reduce((s, r) => s + r.totalCost, 0);
      }

      const deposit = override?.deposit ?? 0;
      const net = totalCost - deposit;
      const months = override?.contractLengthMonths ?? defaultContractMonths;
      const monthlyAmount = months > 0 ? Math.round((net / months) * 100) / 100 : 0;

      // Find earliest contractStartMonth
      let earliestStart = ownerRecords[0]?.contractStartMonth || '';
      for (const r of ownerRecords) {
        if (!earliestStart || (r.contractStartMonth && parseMonthKey(r.contractStartMonth).year * 12 + parseMonthKey(r.contractStartMonth).monthIdx < parseMonthKey(earliestStart).year * 12 + parseMonthKey(earliestStart).monthIdx)) {
          earliestStart = r.contractStartMonth;
        }
      }

      // Generate installments
      const installmentMonths = generateInstallmentMonths(earliestStart, months);
      const installments: Record<string, number> = {};
      for (const m of installmentMonths) {
        installments[m] = monthlyAmount;
      }

      rows.push({
        ownerCode,
        totalCost,
        deposit,
        net,
        months,
        monthlyAmount,
        contractStartMonth: earliestStart,
        installments,
      });
    }

    return rows.sort((a, b) => a.ownerCode.localeCompare(b.ownerCode));
  }, [records, overrideMap, defaultContractMonths]);

  // Collect all months across all customers
  const allMonths = useMemo(() => {
    const monthSet = new Set<string>();
    for (const row of customerRows) {
      for (const m of Object.keys(row.installments)) {
        monthSet.add(m);
      }
    }
    return sortMonthKeys(Array.from(monthSet));
  }, [customerRows]);

  // Subtotals per month
  const subtotals = useMemo(() => {
    const subs: Record<string, number> = {};
    for (const m of allMonths) subs[m] = 0;
    for (const row of customerRows) {
      for (const [m, amt] of Object.entries(row.installments)) {
        subs[m] = (subs[m] || 0) + amt;
      }
    }
    return subs;
  }, [allMonths, customerRows]);

  const copyMonth = (month: string) => {
    const lines: string[] = [];
    for (const row of customerRows) {
      const amt = row.installments[month];
      if (amt && amt > 0) {
        lines.push(`${row.ownerCode}\t${amt.toFixed(2)}`);
      }
    }
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopiedMonth(month);
      setTimeout(() => setCopiedMonth(null), 2000);
    });
  };

  if (allMonths.length === 0) {
    return <p className="text-sm text-gray-500">No installment data available.</p>;
  }

  return (
    <div className="overflow-x-auto border border-gray-200 rounded-lg">
      <table className="text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase sticky left-0 bg-gray-50 z-10">Customer</th>
            {allMonths.map((m) => (
              <th key={m} className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                <button
                  onClick={() => copyMonth(m)}
                  className="hover:text-violet-600"
                  title={`Copy ${m} data to clipboard`}
                >
                  {m.replace(/(\w+)\s/, (_, name: string) => name.substring(0, 3) + ' ')}
                  {copiedMonth === m && ' (copied)'}
                </button>
              </th>
            ))}
            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {customerRows.map((row) => {
            const rowTotal = Object.values(row.installments).reduce((s, v) => s + v, 0);
            return (
              <tr key={row.ownerCode}>
                <td className="px-3 py-1.5 font-mono sticky left-0 bg-white z-10">{row.ownerCode}</td>
                {allMonths.map((m) => (
                  <td key={m} className="px-3 py-1.5 text-right">
                    {row.installments[m] ? `$${row.installments[m].toFixed(2)}` : ''}
                  </td>
                ))}
                <td className="px-3 py-1.5 text-right font-semibold">${rowTotal.toFixed(2)}</td>
              </tr>
            );
          })}
          {/* Subtotal row */}
          <tr className="bg-gray-100 font-bold">
            <td className="px-3 py-2 sticky left-0 bg-gray-100 z-10">SUBTOTAL</td>
            {allMonths.map((m) => (
              <td key={m} className="px-3 py-2 text-right">
                ${subtotals[m].toFixed(2)}
              </td>
            ))}
            <td className="px-3 py-2 text-right">
              ${Object.values(subtotals).reduce((s, v) => s + v, 0).toFixed(2)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
