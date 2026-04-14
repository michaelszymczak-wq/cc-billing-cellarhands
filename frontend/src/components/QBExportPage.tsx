import React, { useState } from 'react';
import {
  AppConfig, QBPreviewResponse, QBCustomerSummary, EnabledSources,
  getQBPreview, downloadQBCSV,
} from '../api/client';
import { BillingRunState } from './BillingControls';

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const SOURCE_KEYS: (keyof EnabledSources)[] = [
  'actions', 'barrel', 'bulk', 'fruitIntake', 'addOns', 'consumables', 'caseGoods', 'extendedTankTime',
];

const SOURCE_LABELS: Record<string, string> = {
  actions: 'Actions',
  barrel: 'Barrel',
  bulk: 'Bulk',
  fruitIntake: 'Fruit',
  addOns: 'Add-Ons',
  consumables: 'Consumables',
  caseGoods: 'Case Goods',
  extendedTankTime: 'Tank Time',
};

interface QBExportPageProps {
  config: AppConfig;
  billingState: BillingRunState | null;
}

export default function QBExportPage({ config, billingState }: QBExportPageProps) {
  const [month, setMonth] = useState(config.lastUsedMonth);
  const [year, setYear] = useState(config.lastUsedYear);
  const [excludedText, setExcludedText] = useState('ELE');
  const [includeDeposits, setIncludeDeposits] = useState(false);
  const [enabledSources, setEnabledSources] = useState<EnabledSources>({
    actions: true, barrel: true, bulk: true, fruitIntake: true,
    addOns: true, consumables: true, caseGoods: true, extendedTankTime: true,
  });
  const [preview, setPreview] = useState<QBPreviewResponse | null>(null);
  const [expandedOwner, setExpandedOwner] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  const hasSession = !!(billingState?.sessionId && billingState.results);

  // Sources that require a billing session
  const SESSION_SOURCES: (keyof EnabledSources)[] = ['actions', 'barrel', 'bulk', 'caseGoods', 'extendedTankTime'];
  const needsSession = SESSION_SOURCES.some(k => enabledSources[k]);
  const canGenerate = hasSession || !needsSession;

  const getExcludedList = () =>
    excludedText.split(',').map(s => s.trim()).filter(Boolean);

  const toggleSource = (key: keyof EnabledSources) => {
    setEnabledSources(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const allEnabled = SOURCE_KEYS.every(k => enabledSources[k]) && includeDeposits;
  const noneEnabled = SOURCE_KEYS.every(k => !enabledSources[k]) && !includeDeposits;

  const toggleAll = () => {
    if (allEnabled) {
      // Uncheck all
      setEnabledSources({ actions: false, barrel: false, bulk: false, fruitIntake: false, addOns: false, consumables: false, caseGoods: false, extendedTankTime: false });
      setIncludeDeposits(false);
    } else {
      // Check all
      setEnabledSources({ actions: true, barrel: true, bulk: true, fruitIntake: true, addOns: true, consumables: true, caseGoods: true, extendedTankTime: true });
      setIncludeDeposits(true);
    }
  };

  const handleGeneratePreview = async () => {
    if (!canGenerate) return;
    setLoading(true);
    setError('');
    setPreview(null);
    setExpandedOwner(null);
    try {
      const result = await getQBPreview({
        sessionId: billingState?.sessionId || '',
        month,
        year,
        excludedCustomers: getExcludedList(),
        includeDeposits,
        enabledSources,
      });
      setPreview(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate preview');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!canGenerate) return;
    setDownloading(true);
    try {
      const { blob, filename } = await downloadQBCSV({
        sessionId: billingState?.sessionId || '',
        month,
        year,
        excludedCustomers: getExcludedList(),
        includeDeposits,
        enabledSources,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setDownloading(false);
    }
  };

  const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  const toggleExpand = (ownerCode: string) => {
    setExpandedOwner(prev => prev === ownerCode ? null : ownerCode);
  };

  const renderDetail = (c: QBCustomerSummary) => {
    const allItems = [
      ...c.sources.actions.items,
      ...c.sources.barrel.items,
      ...c.sources.bulk.items,
      ...c.sources.fruitIntake.items,
      ...c.sources.addOns.items,
      ...c.sources.consumables.items,
      ...(c.sources.caseGoods?.items || []),
      ...(c.sources.extendedTankTime?.items || []),
    ];
    if (allItems.length === 0) return null;
    return (
      <tr key={`${c.ownerCode}-detail`}>
        <td colSpan={10} className="px-3 py-2 bg-gray-50">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500">
                <th className="text-left py-1 px-2">Item</th>
                <th className="text-left py-1 px-2">Description</th>
                <th className="text-right py-1 px-2">Qty</th>
                <th className="text-right py-1 px-2">Rate</th>
                <th className="text-right py-1 px-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              {allItems.map((item, i) => (
                <tr key={i} className="border-t border-gray-200">
                  <td className="py-1 px-2">{item.item}</td>
                  <td className="py-1 px-2 text-gray-600">{item.description}</td>
                  <td className="py-1 px-2 text-right">{item.quantity}</td>
                  <td className="py-1 px-2 text-right">{fmt(item.rate)}</td>
                  <td className="py-1 px-2 text-right">{fmt(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </td>
      </tr>
    );
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-1">QuickBooks Export</h2>
      <p className="text-sm text-gray-500 mb-6">Generate a QuickBooks-compatible CSV for import</p>

      {!hasSession && needsSession && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-4 mb-6">
          <p className="font-medium">No billing session available</p>
          <p className="text-sm mt-1">Run billing first, or select only settings-based sources (Fruit, Add-Ons, Consumables, Deposits) to export without a billing run.</p>
        </div>
      )}

      {/* Controls */}
      <div className="max-w-md space-y-4 mb-8">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
            <select
              value={month}
              onChange={e => setMonth(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            >
              {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
            <input
              type="number"
              value={year}
              onChange={e => setYear(parseInt(e.target.value) || year)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Excluded Customers</label>
          <input
            type="text"
            value={excludedText}
            onChange={e => setExcludedText(e.target.value)}
            placeholder="e.g. ELE, TEST"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
          <p className="text-xs text-gray-400 mt-1">Comma-separated owner codes to exclude</p>
        </div>

        {/* Source category checkboxes */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">Include Sources</label>
            <button
              onClick={toggleAll}
              className="text-xs text-violet-600 hover:text-violet-800 underline"
            >
              {allEnabled ? 'Uncheck All' : 'Check All'}
            </button>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {SOURCE_KEYS.map(key => (
              <label key={key} className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enabledSources[key]}
                  onChange={() => toggleSource(key)}
                  className="w-4 h-4 text-violet-600 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">{SOURCE_LABELS[key]}</span>
              </label>
            ))}
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={includeDeposits}
                onChange={e => setIncludeDeposits(e.target.checked)}
                className="w-4 h-4 text-violet-600 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700">Deposits</span>
            </label>
          </div>
          {noneEnabled && (
            <p className="text-xs text-amber-600 mt-1">No sources selected. Preview will be empty.</p>
          )}
        </div>

        <button
          onClick={handleGeneratePreview}
          disabled={!canGenerate || loading}
          className="w-full bg-violet-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Generating...' : 'Generate Preview'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-6 text-sm">
          {error}
        </div>
      )}

      {/* Preview Results */}
      {preview && (
        <div className="mb-8">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-white border rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{fmt(preview.grandTotal)}</p>
              <p className="text-xs text-gray-500">Grand Total</p>
            </div>
            <div className="bg-white border rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-violet-600">{preview.lineItemCount}</p>
              <p className="text-xs text-gray-500">Line Items</p>
            </div>
            <div className="bg-white border rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-purple-600">{preview.customers.length}</p>
              <p className="text-xs text-gray-500">Customers</p>
            </div>
          </div>

          {/* Download button */}
          <div className="flex gap-3 mb-4">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="bg-green-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {downloading ? 'Downloading...' : 'Download CSV'}
            </button>
          </div>

          {/* Desktop table */}
          <div className="hidden md:block">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Customer</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600">Actions</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600">Barrel</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600">Bulk</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600">Fruit</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600">Add-Ons</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600">Consumables</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600">Case Goods</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600">Tank Time</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600">Total</th>
                </tr>
              </thead>
              <tbody>
                {preview.customers.map(c => (
                  <React.Fragment key={c.ownerCode}>
                    <tr
                      className="border-b hover:bg-gray-50 cursor-pointer"
                      onClick={() => toggleExpand(c.ownerCode)}
                    >
                      <td className="px-3 py-2 font-medium">
                        <span className="text-gray-400 mr-1 text-xs">{expandedOwner === c.ownerCode ? '\u25BC' : '\u25B6'}</span>
                        {c.ownerCode}
                      </td>
                      <td className="px-3 py-2 text-right">{c.sources.actions.subtotal ? fmt(c.sources.actions.subtotal) : '-'}</td>
                      <td className="px-3 py-2 text-right">{c.sources.barrel.subtotal ? fmt(c.sources.barrel.subtotal) : '-'}</td>
                      <td className="px-3 py-2 text-right">{c.sources.bulk.subtotal ? fmt(c.sources.bulk.subtotal) : '-'}</td>
                      <td className="px-3 py-2 text-right">{c.sources.fruitIntake.subtotal ? fmt(c.sources.fruitIntake.subtotal) : '-'}</td>
                      <td className="px-3 py-2 text-right">{c.sources.addOns.subtotal ? fmt(c.sources.addOns.subtotal) : '-'}</td>
                      <td className="px-3 py-2 text-right">{c.sources.consumables.subtotal ? fmt(c.sources.consumables.subtotal) : '-'}</td>
                      <td className="px-3 py-2 text-right">{c.sources.caseGoods?.subtotal ? fmt(c.sources.caseGoods.subtotal) : '-'}</td>
                      <td className="px-3 py-2 text-right">{c.sources.extendedTankTime?.subtotal ? fmt(c.sources.extendedTankTime.subtotal) : '-'}</td>
                      <td className="px-3 py-2 text-right font-bold">{fmt(c.total)}</td>
                    </tr>
                    {expandedOwner === c.ownerCode && renderDetail(c)}
                  </React.Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-bold">
                  <td className="px-3 py-2">Total</td>
                  <td className="px-3 py-2 text-right">
                    {fmt(preview.customers.reduce((s, c) => s + c.sources.actions.subtotal, 0))}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {fmt(preview.customers.reduce((s, c) => s + c.sources.barrel.subtotal, 0))}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {fmt(preview.customers.reduce((s, c) => s + c.sources.bulk.subtotal, 0))}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {fmt(preview.customers.reduce((s, c) => s + c.sources.fruitIntake.subtotal, 0))}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {fmt(preview.customers.reduce((s, c) => s + c.sources.addOns.subtotal, 0))}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {fmt(preview.customers.reduce((s, c) => s + c.sources.consumables.subtotal, 0))}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {fmt(preview.customers.reduce((s, c) => s + (c.sources.caseGoods?.subtotal || 0), 0))}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {fmt(preview.customers.reduce((s, c) => s + (c.sources.extendedTankTime?.subtotal || 0), 0))}
                  </td>
                  <td className="px-3 py-2 text-right">{fmt(preview.grandTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {preview.customers.map(c => (
              <div key={c.ownerCode} className="border rounded-lg p-3 bg-white">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-sm">{c.ownerCode}</span>
                  <span className="font-bold text-sm">{fmt(c.total)}</span>
                </div>
                <div className="grid grid-cols-2 gap-1 text-xs text-gray-600">
                  {(['actions', 'barrel', 'bulk', 'fruitIntake', 'addOns', 'consumables', 'caseGoods', 'extendedTankTime'] as const).map(key => {
                    const sub = c.sources[key]?.subtotal || 0;
                    return sub > 0 ? <div key={key}>{SOURCE_LABELS[key]}: {fmt(sub)}</div> : null;
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
