import React, { useState, useEffect } from 'react';
import {
  getSettings, saveSettings, saveBarrelSnapshots, BarrelSnapshots,
  FruitIntakeSettings, saveFruitIntakeSettings,
} from '../api/client';

interface SettingsPanelProps {
  onSettingsSaved: () => void;
}

export default function SettingsPanel({ onSettingsSaved }: SettingsPanelProps) {
  const [token, setToken] = useState('');
  const [wineryId, setWineryId] = useState('');
  const [hasToken, setHasToken] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [barrelSnapshots, setBarrelSnapshots] = useState<BarrelSnapshots>({ snap1Day: 1, snap2Day: 15, snap3Day: 'last' });
  const [bulkStorageRate, setBulkStorageRate] = useState<number>(0);
  const [barrelStorageRate, setBarrelStorageRate] = useState<number>(21);
  const [puncheonStorageRate, setPuncheonStorageRate] = useState<number>(50);
  const [tankStorageRate, setTankStorageRate] = useState<number>(0);
  const [caseGoodsStorageRate, setCaseGoodsStorageRate] = useState<number>(0);
  const [snapStatus, setSnapStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [fruitSettings, setFruitSettings] = useState<FruitIntakeSettings>({
    actionTypeKey: 'FRUITINTAKE',
    vintageLookback: 3,
    apiPageDelaySeconds: 5,
    colorRateTiers: [],
    tierByColor: true,
    minProcessingFee: 1000,
    defaultContractMonths: 12,
    smallLotFee: 1000,
    smallLotThresholdTons: 2.0,
  });
  const [fruitStatus, setFruitStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [activeStorageMonths, setActiveStorageMonths] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [storageMonthStatus, setStorageMonthStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [tankTimeRatePerTon, setTankTimeRatePerTon] = useState<number>(150);
  const [tankTimeRatePerGal, setTankTimeRatePerGal] = useState<number>(1);
  const [tankTimeGraceDays, setTankTimeGraceDays] = useState<number>(16);
  const [tankTimeStatus, setTankTimeStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  useEffect(() => {
    getSettings()
      .then((s) => {
        setToken(s.token);
        setWineryId(s.wineryId);
        setHasToken(s.hasToken);
        if (s.barrelSnapshots) setBarrelSnapshots(s.barrelSnapshots);
        if (s.bulkStorageRate !== undefined) setBulkStorageRate(s.bulkStorageRate);
        if (s.barrelStorageRate !== undefined) setBarrelStorageRate(s.barrelStorageRate);
        if (s.puncheonStorageRate !== undefined) setPuncheonStorageRate(s.puncheonStorageRate);
        if (s.tankStorageRate !== undefined) setTankStorageRate(s.tankStorageRate);
        if (s.caseGoodsStorageRate !== undefined) setCaseGoodsStorageRate(s.caseGoodsStorageRate);
        if (s.fruitIntakeSettings) setFruitSettings(s.fruitIntakeSettings);
        if (s.activeCustomerStorageMonths) setActiveStorageMonths(s.activeCustomerStorageMonths);
        if (s.extendedTankTimeRatePerTon !== undefined) setTankTimeRatePerTon(s.extendedTankTimeRatePerTon);
        if (s.extendedTankTimeRatePerGal !== undefined) setTankTimeRatePerGal(s.extendedTankTimeRatePerGal);
        if (s.extendedTankTimeGraceDays !== undefined) setTankTimeGraceDays(s.extendedTankTimeGraceDays);
      })
      .catch(() => {
        // Settings not found yet
      });
  }, []);

  const handleSave = async () => {
    setStatus('saving');
    setErrorMsg('');
    try {
      await saveSettings({ token, wineryId });
      setStatus('success');
      setHasToken(true);
      onSettingsSaved();
      setTimeout(() => setStatus('idle'), 2000);
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  return (
    <div className="max-w-lg">
      <h2 className="text-xl font-semibold mb-4">Settings</h2>
      <p className="text-sm text-gray-500 mb-6">
        Configure your API credentials. These are stored locally on your machine.
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Access Token
          </label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={hasToken ? 'Token saved (enter new to replace)' : 'Enter your InnoVint access token'}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-violet-500 focus:border-violet-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Winery ID
          </label>
          <input
            type="text"
            value={wineryId}
            onChange={(e) => setWineryId(e.target.value)}
            placeholder="e.g. 12345"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-violet-500 focus:border-violet-500"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={status === 'saving'}
          className="px-4 py-2 bg-violet-600 text-white rounded-md hover:bg-violet-700 disabled:opacity-50 transition-colors"
        >
          {status === 'saving' ? 'Saving...' : 'Save Settings'}
        </button>

        {status === 'success' && (
          <p className="text-sm text-green-600">Settings saved successfully.</p>
        )}
        {status === 'error' && (
          <p className="text-sm text-red-600">{errorMsg}</p>
        )}
      </div>

      {/* Storage Rates */}
      <div className="mt-8 pt-8 border-t border-gray-200">
        <h3 className="text-base font-semibold mb-2">Bulk Storage Rates</h3>
        <p className="text-sm text-gray-500 mb-4">
          Rates for bulk, barrel, puncheon, and tank storage. Applied to 3-snapshot billing.
        </p>
        <div className="space-y-3 max-w-md">
          <div className="grid grid-cols-2 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bulk ($/gal)</label>
              <input
                type="number"
                step="0.01"
                min={0}
                value={bulkStorageRate}
                onChange={(e) => setBulkStorageRate(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Barrel ($/barrel)</label>
              <input
                type="number"
                step="0.01"
                min={0}
                value={barrelStorageRate}
                onChange={(e) => setBarrelStorageRate(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Puncheon ($/puncheon)</label>
              <input
                type="number"
                step="0.01"
                min={0}
                value={puncheonStorageRate}
                onChange={(e) => setPuncheonStorageRate(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tank ($/gal)</label>
              <input
                type="number"
                step="0.01"
                min={0}
                value={tankStorageRate}
                onChange={(e) => setTankStorageRate(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Case Goods ($/pallet)</label>
              <input
                type="number"
                step="0.01"
                min={0}
                value={caseGoodsStorageRate}
                onChange={(e) => setCaseGoodsStorageRate(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
          </div>
          <button
            onClick={async () => {
              setStatus('saving');
              try {
                await saveSettings({ bulkStorageRate, barrelStorageRate, puncheonStorageRate, tankStorageRate, caseGoodsStorageRate });
                setStatus('success');
                setTimeout(() => setStatus('idle'), 2000);
              } catch {
                setStatus('error');
                setErrorMsg('Failed to save storage rates');
              }
            }}
            disabled={status === 'saving'}
            className="px-4 py-2 bg-violet-600 text-white rounded-md hover:bg-violet-700 disabled:opacity-50 transition-colors"
          >
            {status === 'saving' ? 'Saving...' : 'Save Storage Rates'}
          </button>
        </div>
      </div>

      {/* Extended Tank Time Settings */}
      <div className="mt-8 pt-8 border-t border-gray-200">
        <h3 className="text-base font-semibold mb-2">Extended Tank Time</h3>
        <p className="text-sm text-gray-500 mb-4">
          After fruit processing, customers receive a grace period in tank. Additional days are billed per unit per day.
        </p>
        <div className="space-y-3 max-w-md">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rate per Ton ($/ton/day)</label>
              <input
                type="number"
                step="0.01"
                min={0}
                value={tankTimeRatePerTon}
                onChange={(e) => setTankTimeRatePerTon(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rate per Gallon ($/gal/day)</label>
              <input
                type="number"
                step="0.01"
                min={0}
                value={tankTimeRatePerGal}
                onChange={(e) => setTankTimeRatePerGal(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Included Days (grace)</label>
              <input
                type="number"
                step="1"
                min={0}
                value={tankTimeGraceDays}
                onChange={(e) => setTankTimeGraceDays(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
          </div>
          <button
            onClick={async () => {
              setTankTimeStatus('saving');
              try {
                await saveSettings({ extendedTankTimeRatePerTon: tankTimeRatePerTon, extendedTankTimeRatePerGal: tankTimeRatePerGal, extendedTankTimeGraceDays: tankTimeGraceDays });
                setTankTimeStatus('success');
                setTimeout(() => setTankTimeStatus('idle'), 2000);
              } catch {
                setTankTimeStatus('error');
              }
            }}
            disabled={tankTimeStatus === 'saving'}
            className="px-4 py-2 bg-violet-600 text-white rounded-md hover:bg-violet-700 disabled:opacity-50 transition-colors"
          >
            {tankTimeStatus === 'saving' ? 'Saving...' : 'Save Tank Time Settings'}
          </button>
          {tankTimeStatus === 'success' && <p className="text-sm text-green-600">Tank time settings saved.</p>}
          {tankTimeStatus === 'error' && <p className="text-sm text-red-600">Failed to save tank time settings.</p>}
        </div>
      </div>

      {/* Active Customer Storage Months */}
      <div className="mt-8 pt-8 border-t border-gray-200">
        <h3 className="text-base font-semibold mb-2">Active Customer Storage Months</h3>
        <p className="text-sm text-gray-500 mb-4">
          Checked months bill active customers for barrel storage; unchecked months bill inactive customers.
        </p>
        <div className="flex flex-wrap gap-3 max-w-md">
          {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((label, idx) => {
            const monthNum = idx + 1;
            const checked = activeStorageMonths.includes(monthNum);
            return (
              <label key={monthNum} className="flex items-center gap-1.5 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    setActiveStorageMonths((prev) =>
                      e.target.checked ? [...prev, monthNum].sort((a, b) => a - b) : prev.filter((m) => m !== monthNum)
                    );
                  }}
                  className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                />
                {label}
              </label>
            );
          })}
        </div>
        <div className="mt-3">
          <button
            onClick={async () => {
              setStorageMonthStatus('saving');
              try {
                await saveSettings({ activeCustomerStorageMonths: activeStorageMonths });
                setStorageMonthStatus('success');
                setTimeout(() => setStorageMonthStatus('idle'), 2000);
              } catch {
                setStorageMonthStatus('error');
              }
            }}
            disabled={storageMonthStatus === 'saving'}
            className="px-4 py-2 bg-violet-600 text-white rounded-md hover:bg-violet-700 disabled:opacity-50 transition-colors"
          >
            {storageMonthStatus === 'saving' ? 'Saving...' : 'Save Storage Month Settings'}
          </button>
          {storageMonthStatus === 'success' && <p className="text-sm text-green-600 mt-1">Storage month settings saved.</p>}
          {storageMonthStatus === 'error' && <p className="text-sm text-red-600 mt-1">Failed to save storage month settings.</p>}
        </div>
      </div>

      {/* Barrel Inventory Snapshots */}
      <div className="mt-8 pt-8 border-t border-gray-200">
        <h3 className="text-base font-semibold mb-2">Barrel Inventory Snapshots</h3>
        <p className="text-sm text-gray-500 mb-4">
          Three vessel inventory exports are taken per month to calculate average empty barrel counts.
          Set the day-of-month for each snapshot.
        </p>
        <div className="space-y-3 max-w-xs">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Snapshot 1 Day</label>
            <input
              type="number"
              min={1}
              max={31}
              value={barrelSnapshots.snap1Day}
              onChange={(e) => setBarrelSnapshots((prev) => ({ ...prev, snap1Day: parseInt(e.target.value) || 1 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Snapshot 2 Day</label>
            <input
              type="number"
              min={1}
              max={31}
              value={barrelSnapshots.snap2Day}
              onChange={(e) => setBarrelSnapshots((prev) => ({ ...prev, snap2Day: parseInt(e.target.value) || 15 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Snapshot 3 Day</label>
            <select
              value={barrelSnapshots.snap3Day === 'last' ? 'last' : String(barrelSnapshots.snap3Day)}
              onChange={(e) => setBarrelSnapshots((prev) => ({
                ...prev,
                snap3Day: e.target.value === 'last' ? 'last' : parseInt(e.target.value),
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="last">Last day of month</option>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <button
            onClick={async () => {
              setSnapStatus('saving');
              try {
                await saveBarrelSnapshots(barrelSnapshots);
                setSnapStatus('success');
                setTimeout(() => setSnapStatus('idle'), 2000);
              } catch {
                setSnapStatus('error');
              }
            }}
            disabled={snapStatus === 'saving'}
            className="px-4 py-2 bg-violet-600 text-white rounded-md hover:bg-violet-700 disabled:opacity-50 transition-colors"
          >
            {snapStatus === 'saving' ? 'Saving...' : 'Save Snapshot Settings'}
          </button>
          {snapStatus === 'success' && <p className="text-sm text-green-600">Snapshot settings saved.</p>}
          {snapStatus === 'error' && <p className="text-sm text-red-600">Failed to save snapshot settings.</p>}
        </div>
      </div>

      {/* Fruit Intake Settings */}
      <div className="mt-8 pt-8 border-t border-gray-200">
        <h3 className="text-base font-semibold mb-2">Fruit Intake</h3>
        <p className="text-sm text-gray-500 mb-4">
          Configure fruit intake API settings and installment rules.
        </p>
        <div className="space-y-3 max-w-md">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Action Type Key</label>
            <input
              type="text"
              value={fruitSettings.actionTypeKey}
              onChange={(e) => setFruitSettings((p) => ({ ...p, actionTypeKey: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vintage Lookback</label>
              <input
                type="number"
                min={1}
                max={5}
                value={fruitSettings.vintageLookback}
                onChange={(e) => setFruitSettings((p) => ({ ...p, vintageLookback: parseInt(e.target.value) || 3 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">API Page Delay (s)</label>
              <input
                type="number"
                min={0}
                max={30}
                value={fruitSettings.apiPageDelaySeconds}
                onChange={(e) => setFruitSettings((p) => ({ ...p, apiPageDelaySeconds: parseInt(e.target.value) || 5 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
          </div>

          {/* Color Rate Tiers */}
          <div className="mt-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Color Rate Tiers (rate per ton by color + tonnage)</p>
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_100px_100px_120px_auto] gap-2 text-xs font-medium text-gray-500 uppercase">
                <span>Color</span>
                <span>Min Tons</span>
                <span>Max Tons</span>
                <span>Rate/Ton ($)</span>
                <span></span>
              </div>
              {(fruitSettings.colorRateTiers || []).map((tier, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_100px_100px_120px_auto] gap-2">
                  <input
                    type="text"
                    value={tier.color}
                    onChange={(e) => {
                      const tiers = [...(fruitSettings.colorRateTiers || [])];
                      tiers[idx] = { ...tiers[idx], color: e.target.value };
                      setFruitSettings((p) => ({ ...p, colorRateTiers: tiers }));
                    }}
                    className="px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                    placeholder="e.g. Red"
                  />
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={tier.minTons}
                    onChange={(e) => {
                      const tiers = [...(fruitSettings.colorRateTiers || [])];
                      tiers[idx] = { ...tiers[idx], minTons: parseFloat(e.target.value) || 0 };
                      setFruitSettings((p) => ({ ...p, colorRateTiers: tiers }));
                    }}
                    className="px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                  />
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={tier.maxTons}
                    onChange={(e) => {
                      const tiers = [...(fruitSettings.colorRateTiers || [])];
                      tiers[idx] = { ...tiers[idx], maxTons: parseFloat(e.target.value) || 0 };
                      setFruitSettings((p) => ({ ...p, colorRateTiers: tiers }));
                    }}
                    className="px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                    placeholder="0 = unlimited"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={tier.ratePerTon}
                    onChange={(e) => {
                      const tiers = [...(fruitSettings.colorRateTiers || [])];
                      tiers[idx] = { ...tiers[idx], ratePerTon: parseFloat(e.target.value) || 0 };
                      setFruitSettings((p) => ({ ...p, colorRateTiers: tiers }));
                    }}
                    className="px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                  />
                  <button
                    onClick={() => {
                      const tiers = (fruitSettings.colorRateTiers || []).filter((_, i) => i !== idx);
                      setFruitSettings((p) => ({ ...p, colorRateTiers: tiers }));
                    }}
                    className="px-2 text-red-500 hover:text-red-700 text-sm"
                  >
                    X
                  </button>
                </div>
              ))}
              <button
                onClick={() => {
                  const id = `tier_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
                  setFruitSettings((p) => ({
                    ...p,
                    colorRateTiers: [...(p.colorRateTiers || []), { id, color: '', minTons: 0, maxTons: 0, ratePerTon: 0 }],
                  }));
                }}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
              >
                + Add Tier
              </button>
            </div>
            <div className="mt-3">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={fruitSettings.tierByColor ?? true}
                  onChange={(e) => setFruitSettings((p) => ({ ...p, tierByColor: e.target.checked }))}
                  className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                />
                Tier by per-color tonnage (unchecked = total customer tonnage)
              </label>
            </div>
          </div>

          {/* Min Processing Fee & Default Installment Months */}
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Min Processing Fee ($)</label>
              <input
                type="number"
                step="0.01"
                value={fruitSettings.minProcessingFee ?? 1000}
                onChange={(e) => setFruitSettings((p) => ({ ...p, minProcessingFee: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Default Installment Length (months)</label>
              <input
                type="number"
                min={1}
                value={fruitSettings.defaultContractMonths ?? 9}
                onChange={(e) => setFruitSettings((p) => ({ ...p, defaultContractMonths: parseInt(e.target.value) || 12 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
          </div>

          {/* Small Lot Fee */}
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Small Lot Fee ($)</label>
              <input
                type="number"
                step="0.01"
                value={fruitSettings.smallLotFee ?? 1000}
                onChange={(e) => setFruitSettings((p) => ({ ...p, smallLotFee: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Small Lot Threshold (tons)</label>
              <input
                type="number"
                step="0.01"
                min={0}
                value={fruitSettings.smallLotThresholdTons ?? 2.0}
                onChange={(e) => setFruitSettings((p) => ({ ...p, smallLotThresholdTons: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
          </div>

          <button
            onClick={async () => {
              setFruitStatus('saving');
              try {
                await saveFruitIntakeSettings(fruitSettings);
                setFruitStatus('success');
                setTimeout(() => setFruitStatus('idle'), 2000);
              } catch {
                setFruitStatus('error');
              }
            }}
            disabled={fruitStatus === 'saving'}
            className="px-4 py-2 bg-violet-600 text-white rounded-md hover:bg-violet-700 disabled:opacity-50 transition-colors"
          >
            {fruitStatus === 'saving' ? 'Saving...' : 'Save Fruit Intake Settings'}
          </button>
          {fruitStatus === 'success' && <p className="text-sm text-green-600">Fruit intake settings saved.</p>}
          {fruitStatus === 'error' && <p className="text-sm text-red-600">Failed to save fruit intake settings.</p>}
        </div>
      </div>
    </div>
  );
}
