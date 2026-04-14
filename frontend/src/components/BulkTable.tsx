import React from 'react';
import { BulkBillingRow } from '../api/client';

interface BulkTableProps {
  rows: BulkBillingRow[];
}

const TYPE_LABELS: Record<string, string> = {
  bulk: 'Bulk',
  barrel: 'Barrel',
  puncheon: 'Puncheon',
  tank: 'Tank',
};

function unitLabel(type: string): string {
  if (type === 'bulk' || type === 'tank') return 'gal';
  return 'barrels';
}

function snapHeader(snap: number, type: string): string {
  const unit = unitLabel(type);
  return `Snap ${snap} (${unit})`;
}

export default function BulkTable({ rows }: BulkTableProps) {
  return (
    <div className="overflow-x-auto border border-gray-200 rounded-lg">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Type</th>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Owner</th>
            <th className="px-3 py-2 text-right font-medium text-gray-600">Snap 1</th>
            <th className="px-3 py-2 text-right font-medium text-gray-600">Snap 2</th>
            <th className="px-3 py-2 text-right font-medium text-gray-600">Snap 3</th>
            <th className="px-3 py-2 text-right font-medium text-gray-600">Billing Qty</th>
            <th className="px-3 py-2 text-right font-medium text-gray-600">Proration</th>
            <th className="px-3 py-2 text-right font-medium text-gray-600">Rate</th>
            <th className="px-3 py-2 text-right font-medium text-gray-600">Total Cost</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const unit = unitLabel(row.type || 'bulk');
            const decimals = row.type === 'bulk' ? 1 : 0;
            return (
              <tr key={`${row.type}-${row.ownerCode}-${i}`} className="border-t hover:bg-gray-50">
                <td className="px-3 py-1.5">{TYPE_LABELS[row.type] || 'Bulk'}</td>
                <td className="px-3 py-1.5 font-mono">{row.ownerCode}</td>
                <td className="px-3 py-1.5 text-right">{row.snap1Volume.toFixed(decimals)}</td>
                <td className="px-3 py-1.5 text-right">{row.snap2Volume.toFixed(decimals)}</td>
                <td className="px-3 py-1.5 text-right">{row.snap3Volume.toFixed(decimals)}</td>
                <td className="px-3 py-1.5 text-right">{row.billingVolume.toFixed(decimals)} {unit}</td>
                <td className="px-3 py-1.5 text-right">{(row.proration * 100).toFixed(0)}%</td>
                <td className="px-3 py-1.5 text-right">${row.rate.toFixed(2)}</td>
                <td className="px-3 py-1.5 text-right font-semibold">${row.totalCost.toFixed(2)}</td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={9} className="px-3 py-8 text-center text-gray-400">
                No bulk inventory data.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
