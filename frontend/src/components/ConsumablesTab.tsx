import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Consumable, FruitIntakeRecord,
  getConsumables, addConsumable, deleteConsumable,
  getFruitIntakeSaved,
} from '../api/client';

export default function ConsumablesTab() {
  const [consumables, setConsumables] = useState<Consumable[]>([]);
  const [fruitRecords, setFruitRecords] = useState<FruitIntakeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [vintage, setVintage] = useState(new Date().getFullYear());
  const [totalCost, setTotalCost] = useState('');
  const [notes, setNotes] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cons, fruit] = await Promise.all([getConsumables(), getFruitIntakeSaved()]);
      setConsumables(cons);
      setFruitRecords(fruit?.records || []);
    } catch {
      // ignore
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!name.trim() || !totalCost) return;
    const result = await addConsumable({
      name: name.trim(),
      vintage,
      totalCost: parseFloat(totalCost),
      notes,
    });
    setConsumables(result);
    setName('');
    setTotalCost('');
    setNotes('');
    setShowForm(false);
  };

  const handleDelete = async (id: string) => {
    const result = await deleteConsumable(id);
    setConsumables(result);
  };

  const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  // Distribution preview for each consumable
  const distributions = useMemo(() => {
    return consumables.map(cons => {
      const vintageRecords = fruitRecords.filter(f => f.vintage === cons.vintage);
      const tonsByOwner = new Map<string, number>();
      let grandTotal = 0;
      for (const rec of vintageRecords) {
        tonsByOwner.set(rec.ownerCode, (tonsByOwner.get(rec.ownerCode) || 0) + rec.fruitWeightTons);
        grandTotal += rec.fruitWeightTons;
      }
      if (grandTotal === 0) return { consumable: cons, allocations: [], grandTotalTons: 0 };

      const sortedOwners = [...tonsByOwner.keys()].sort();
      const allocations: { ownerCode: string; tons: number; share: number }[] = [];
      let othersSum = 0;

      for (let i = 0; i < sortedOwners.length; i++) {
        const owner = sortedOwners[i];
        const tons = tonsByOwner.get(owner)!;
        const isLast = i === sortedOwners.length - 1;
        let share: number;
        if (isLast) {
          share = Math.round((cons.totalCost - othersSum) * 100) / 100;
        } else {
          share = Math.round(((tons / grandTotal) * cons.totalCost) * 100) / 100;
          othersSum += share;
        }
        allocations.push({ ownerCode: owner, tons, share });
      }
      return { consumable: cons, allocations, grandTotalTons: grandTotal };
    });
  }, [consumables, fruitRecords]);

  if (loading) return <div className="text-gray-400 text-sm">Loading consumables...</div>;

  return (
    <div className="space-y-6">
      {/* Consumables table */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Consumables</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-1.5 bg-violet-600 text-white rounded-md text-sm hover:bg-violet-700 transition-colors"
        >
          {showForm ? 'Cancel' : 'Add Consumable'}
        </button>
      </div>

      {showForm && (
        <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
              <input
                type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. Dry Ice"
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Vintage</label>
              <input
                type="number" value={vintage} onChange={e => setVintage(parseInt(e.target.value) || vintage)}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Total Cost ($)</label>
              <input
                type="number" value={totalCost} onChange={e => setTotalCost(e.target.value)}
                placeholder="1000.00" step="0.01"
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <input
                type="text" value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Optional"
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
              />
            </div>
          </div>
          <button
            onClick={handleAdd}
            disabled={!name.trim() || !totalCost}
            className="px-4 py-1.5 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            Save
          </button>
        </div>
      )}

      {consumables.length === 0 ? (
        <p className="text-sm text-gray-400">No consumables added yet. Add a shared cost to distribute across customers by fruit tonnage.</p>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left px-3 py-2 font-medium text-gray-600">Name</th>
              <th className="text-right px-3 py-2 font-medium text-gray-600">Vintage</th>
              <th className="text-right px-3 py-2 font-medium text-gray-600">Total Cost</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Notes</th>
              <th className="text-center px-3 py-2 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {consumables.map(c => (
              <tr key={c.id} className="border-b hover:bg-gray-50">
                <td className="px-3 py-2">{c.name}</td>
                <td className="px-3 py-2 text-right">{c.vintage}</td>
                <td className="px-3 py-2 text-right">{fmt(c.totalCost)}</td>
                <td className="px-3 py-2 text-gray-500">{c.notes}</td>
                <td className="px-3 py-2 text-center">
                  <button
                    onClick={() => handleDelete(c.id)}
                    className="text-red-500 hover:text-red-700 text-xs"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Distribution Preview */}
      {distributions.some(d => d.allocations.length > 0) && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Distribution Preview</h3>
          {distributions.map(d => {
            if (d.allocations.length === 0) return null;
            return (
              <div key={d.consumable.id} className="border rounded-lg p-4">
                <p className="text-sm font-medium mb-2">
                  {d.consumable.name} ({d.consumable.vintage}) &mdash; {fmt(d.consumable.totalCost)} across {d.grandTotalTons.toFixed(2)} total tons
                </p>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="text-left px-2 py-1 font-medium text-gray-600">Customer</th>
                      <th className="text-right px-2 py-1 font-medium text-gray-600">Tons</th>
                      <th className="text-right px-2 py-1 font-medium text-gray-600">% Share</th>
                      <th className="text-right px-2 py-1 font-medium text-gray-600">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.allocations.map(a => (
                      <tr key={a.ownerCode} className="border-b">
                        <td className="px-2 py-1">{a.ownerCode}</td>
                        <td className="px-2 py-1 text-right">{a.tons.toFixed(2)}</td>
                        <td className="px-2 py-1 text-right">{((a.tons / d.grandTotalTons) * 100).toFixed(1)}%</td>
                        <td className="px-2 py-1 text-right">{fmt(a.share)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-bold bg-gray-50">
                      <td className="px-2 py-1">Total</td>
                      <td className="px-2 py-1 text-right">{d.grandTotalTons.toFixed(2)}</td>
                      <td className="px-2 py-1 text-right">100%</td>
                      <td className="px-2 py-1 text-right">{fmt(d.allocations.reduce((s, a) => s + a.share, 0))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
