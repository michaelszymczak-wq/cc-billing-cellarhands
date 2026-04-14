import React, { useState } from 'react';
import { ExtendedTankTimeRow, ExtendedTankTimeWarning, updateTankTimeRow } from '../api/client';

interface TankTimeTableProps {
  rows: ExtendedTankTimeRow[];
  warnings: ExtendedTankTimeWarning[];
  sessionId: string;
  onRowUpdate: (index: number, updatedRow: ExtendedTankTimeRow) => void;
}

export default function TankTimeTable({ rows, warnings, sessionId, onRowUpdate }: TankTimeTableProps) {
  const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  const totalCharge = rows.reduce((sum, r) => sum + r.totalCharge, 0);

  const [editingCell, setEditingCell] = useState<{ index: number; field: 'dailyRate' | 'quantity' } | null>(null);
  const [editValue, setEditValue] = useState('');

  const startEdit = (index: number, field: 'dailyRate' | 'quantity', currentValue: number) => {
    setEditingCell({ index, field });
    setEditValue(currentValue.toString());
  };

  const commitEdit = async () => {
    if (!editingCell) return;
    const numVal = parseFloat(editValue);
    if (isNaN(numVal) || numVal < 0) {
      setEditingCell(null);
      return;
    }
    const row = rows[editingCell.index];
    const newRate = editingCell.field === 'dailyRate' ? numVal : row.dailyRate;
    const newQty = editingCell.field === 'quantity' ? numVal : row.quantity;

    try {
      const { row: updatedRow } = await updateTankTimeRow(sessionId, editingCell.index, newRate, newQty);
      onRowUpdate(editingCell.index, updatedRow);
    } catch {
      // silently fail
    }
    setEditingCell(null);
  };

  const cancelEdit = () => {
    setEditingCell(null);
  };

  return (
    <div className="space-y-4">
      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-sm font-medium text-amber-800 mb-2">
            Lots still in tank ({warnings.length})
          </p>
          <div className="space-y-1">
            {warnings.map((w, i) => (
              <p key={i} className="text-xs text-amber-700">
                <span className="font-mono font-medium">{w.lotCode}</span>
                {' '}({w.ownerCode}) &mdash; {w.message}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Billing rows */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-blue-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Owner</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Lot Code</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Color</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Start Action</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">End Action</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Start Date</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">End Date</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">Total Days</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">Included</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">Billable Days</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">Qty</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Unit</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">Rate/Unit/Day</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t hover:bg-blue-50/30">
                <td className="px-3 py-1.5 font-mono text-xs">{row.ownerCode}</td>
                <td className="px-3 py-1.5 font-mono text-xs">{row.lotCode}</td>
                <td className="px-3 py-1.5 capitalize">{row.color}</td>
                <td className="px-3 py-1.5 text-xs">{row.startActionType}</td>
                <td className="px-3 py-1.5 text-xs">{row.endActionType}</td>
                <td className="px-3 py-1.5 whitespace-nowrap">{row.startDate}</td>
                <td className="px-3 py-1.5 whitespace-nowrap">{row.endDate}</td>
                <td className="px-3 py-1.5 text-right">{row.totalDays}</td>
                <td className="px-3 py-1.5 text-right">{row.includedDays}</td>
                <td className="px-3 py-1.5 text-right font-medium">{row.billableDays}</td>
                <td className="px-3 py-1.5 text-right">
                  {editingCell?.index === i && editingCell.field === 'quantity' ? (
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
                  ) : (
                    <span
                      onClick={() => startEdit(i, 'quantity', row.quantity)}
                      className="cursor-pointer hover:text-violet-600 hover:underline"
                    >
                      {row.quantity?.toFixed(2) ?? '1.00'}
                    </span>
                  )}
                </td>
                <td className="px-3 py-1.5 text-xs">{row.unit || '-'}</td>
                <td className="px-3 py-1.5 text-right">
                  {editingCell?.index === i && editingCell.field === 'dailyRate' ? (
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
                  ) : (
                    <span
                      onClick={() => startEdit(i, 'dailyRate', row.dailyRate)}
                      className="cursor-pointer hover:text-violet-600 hover:underline"
                    >
                      {fmt(row.dailyRate)}
                    </span>
                  )}
                </td>
                <td className="px-3 py-1.5 text-right font-medium">{fmt(row.totalCharge)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={14} className="px-3 py-8 text-center text-gray-400">
                  No extended tank time charges for this period.
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="bg-blue-50 font-bold border-t">
                <td colSpan={13} className="px-3 py-2 text-right">Total</td>
                <td className="px-3 py-2 text-right">{fmt(totalCharge)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
