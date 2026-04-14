import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  runBilling, pollBillingProgress, getBillingResults,
  downloadExcel, BillingResults, RateRule, ActionRow,
  saveBillingPrefs, getFruitIntakeSaved, FruitIntakeRunResult,
  rectifyAction, getSettings, FruitCustomerOverride, FruitIntakeRecord,
} from '../api/client';
import ProgressBar from './ProgressBar';
import TabView from './TabView';
import ResultsTable from './ResultsTable';
import AuditTable from './AuditTable';
import BulkTable from './BulkTable';
import BarrelTable from './BarrelTable';
import CaseGoodsTable from './CaseGoodsTable';
import TankTimeTable from './TankTimeTable';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

type StepState = 'pending' | 'running' | 'done' | 'error';

export interface BillingRunState {
  month: string;
  year: number;
  running: boolean;
  progress: number;
  logs: Array<{ step: string; message: string; pct: number }>;
  stepStatus: { actions: StepState; rates: StepState; bulk: StepState; barrels: StepState; casegoods: StepState; tanktime: StepState };
  results: BillingResults | null;
  sessionId: string;
}

export function defaultBillingRunState(month?: string, year?: number): BillingRunState {
  return {
    month: month || MONTHS[new Date().getMonth()],
    year: year || new Date().getFullYear(),
    running: false,
    progress: 0,
    logs: [],
    stepStatus: { actions: 'pending', rates: 'pending', bulk: 'pending', barrels: 'pending', casegoods: 'pending', tanktime: 'pending' },
    results: null,
    sessionId: '',
  };
}

interface BillingControlsProps {
  hasSettings: boolean;
  rateRules: RateRule[];
  billingState: BillingRunState;
  onBillingStateChange: (updater: BillingRunState | ((prev: BillingRunState) => BillingRunState)) => void;
  onNavigate?: (page: string) => void;
}

export default function BillingControls({
  hasSettings, rateRules, billingState, onBillingStateChange, onNavigate,
}: BillingControlsProps) {
  const { month, year, running, progress, logs, stepStatus, results, sessionId } = billingState;
  const [fruitData, setFruitData] = useState<FruitIntakeRunResult | null>(null);
  const [defaultContractMonths, setDefaultContractMonths] = useState(12);

  useEffect(() => {
    Promise.all([getFruitIntakeSaved(), getSettings()])
      .then(([data, settings]) => {
        setFruitData(data);
        setDefaultContractMonths(settings.fruitIntakeSettings?.defaultContractMonths ?? 12);
      })
      .catch(() => {});
  }, []);

  const update = useCallback(
    (partial: Partial<BillingRunState>) =>
      onBillingStateChange((prev) => ({ ...prev, ...partial })),
    [onBillingStateChange]
  );

  const setMonth = (m: string) => update({ month: m });
  const setYear = (y: number) => update({ year: y });

  const handleRun = useCallback(async () => {
    onBillingStateChange((prev) => ({
      ...prev,
      running: true,
      progress: 0,
      logs: [],
      results: null,
      sessionId: '',
      stepStatus: { actions: 'pending', rates: 'pending', bulk: 'pending', barrels: 'pending', casegoods: 'pending', tanktime: 'pending' },
    }));

    saveBillingPrefs({ lastUsedMonth: month, lastUsedYear: year }).catch(() => {});

    try {
      const steps = ['actions', 'bulk', 'barrels', 'casegoods', 'tanktime'];

      const { sessionId: sid } = await runBilling({
        month,
        year,
        rateRules,
        steps,
      });

      onBillingStateChange((prev) => ({ ...prev, sessionId: sid }));

      pollBillingProgress(
        sid,
        (event) => {
          onBillingStateChange((prev) => {
            const nextLogs = [...prev.logs, event];
            const nextProgress = event.pct >= 0 ? event.pct : prev.progress;

            const next = { ...prev.stepStatus };
            if (event.step === 'actions') {
              next.actions = event.pct >= 30 ? 'done' : 'running';
            } else if (event.step === 'rates') {
              next.actions = 'done';
              next.rates = event.pct >= 55 ? 'done' : 'running';
            } else if (event.step === 'bulk') {
              next.bulk = event.pct >= 100 ? 'done' : 'running';
            } else if (event.step === 'barrels') {
              next.barrels = event.pct >= 95 ? 'done' : 'running';
            } else if (event.step === 'casegoods') {
              next.casegoods = event.pct >= 100 ? 'done' : 'running';
            } else if (event.step === 'tanktime') {
              next.tanktime = 'running';
            } else if (event.step === 'complete') {
              next.actions = 'done';
              next.rates = 'done';
              next.bulk = 'done';
              next.barrels = 'done';
              next.casegoods = 'done';
              next.tanktime = 'done';
            } else if (event.step === 'error') {
              if (next.actions === 'running') next.actions = 'error';
              if (next.rates === 'running') next.rates = 'error';
              if (next.bulk === 'running') next.bulk = 'error';
              if (next.barrels === 'running') next.barrels = 'error';
              if (next.casegoods === 'running') next.casegoods = 'error';
              if (next.tanktime === 'running') next.tanktime = 'error';
            }

            return { ...prev, logs: nextLogs, progress: nextProgress, stepStatus: next };
          });

          if (event.step === 'complete') {
            setTimeout(async () => {
              try {
                const data = await getBillingResults(sid);
                onBillingStateChange((prev) => ({ ...prev, results: data, running: false }));
              } catch {
                onBillingStateChange((prev) => ({
                  ...prev,
                  running: false,
                  logs: [...prev.logs, { step: 'error', message: 'Failed to fetch results.', pct: -1 }],
                }));
              }
            }, 500);
          }

          if (event.step === 'error') {
            onBillingStateChange((prev) => ({ ...prev, running: false }));
          }
        },
      );
    } catch (err) {
      onBillingStateChange((prev) => ({
        ...prev,
        running: false,
        logs: [...prev.logs, { step: 'error', message: err instanceof Error ? err.message : 'Unknown error', pct: -1 }],
      }));
    }
  }, [month, year, rateRules, onBillingStateChange]);

  const allOwnerCodes = useMemo(() => {
    if (!results) return [];
    const codes = new Set<string>();
    for (const r of results.actions) codes.add(r.ownerCode);
    for (const r of results.auditRows) codes.add(r.ownerCode);
    return [...codes].sort();
  }, [results]);

  const handleRectify = useCallback((auditIndex: number, actionRow: ActionRow) => {
    // Persist to backend so exports reflect the change
    if (sessionId) {
      rectifyAction(sessionId, auditIndex, actionRow).catch(() => {});
    }

    onBillingStateChange((prev) => {
      if (!prev.results) return prev;
      const newAudit = prev.results.auditRows.filter((_, i) => i !== auditIndex);
      // Replace the original unmatched row in actions (same actionId) instead of appending
      const existingIdx = prev.results.actions.findIndex(
        (r) => r.actionId === actionRow.actionId && !r.matched
      );
      const newActions = [...prev.results.actions];
      if (existingIdx >= 0) {
        newActions[existingIdx] = actionRow;
      } else {
        newActions.push(actionRow);
      }
      const totalBilled = newActions.filter((r) => r.matched).reduce((sum, r) => sum + r.total, 0);
      return {
        ...prev,
        results: {
          ...prev.results,
          actions: newActions,
          auditRows: newAudit,
          summary: {
            ...prev.results.summary,
            totalActions: newActions.length,
            totalBilled,
            auditCount: newAudit.length,
          },
        },
      };
    });
  }, [onBillingStateChange, sessionId]);

  // Compute fruit installment total using customer-level overrides (matches InstallmentSchedule logic)
  const fruitInstallmentTotal = useMemo(() => {
    if (!fruitData?.records?.length) return 0;
    const monthKey = `${month} ${year}`;
    const overrides = fruitData.customerOverrides || [];
    const overrideMap = new Map<string, FruitCustomerOverride>();
    for (const o of overrides) overrideMap.set(o.ownerCode, o);

    const byOwner = new Map<string, FruitIntakeRecord[]>();
    for (const r of fruitData.records) {
      const existing = byOwner.get(r.ownerCode) || [];
      existing.push(r);
      byOwner.set(r.ownerCode, existing);
    }

    let total = 0;
    for (const [ownerCode, ownerRecords] of byOwner) {
      const override = overrideMap.get(ownerCode);

      let totalCost = 0;
      if (override?.colorOverrides?.length) {
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

      // Find earliest contract start
      let earliestStart = ownerRecords[0]?.contractStartMonth || '';
      for (const r of ownerRecords) {
        if (r.contractStartMonth && earliestStart) {
          const rParts = r.contractStartMonth.split(' ');
          const eParts = earliestStart.split(' ');
          const rIdx = MONTHS.indexOf(rParts[0]) + parseInt(rParts[1]) * 12;
          const eIdx = MONTHS.indexOf(eParts[0]) + parseInt(eParts[1]) * 12;
          if (rIdx < eIdx) earliestStart = r.contractStartMonth;
        }
      }

      // Check if monthKey falls within installment window
      let mIdx = MONTHS.indexOf(earliestStart.split(' ')[0]);
      let mYear = parseInt(earliestStart.split(' ')[1]);
      if (mIdx === -1 || isNaN(mYear)) continue;
      let found = false;
      for (let i = 0; i < months; i++) {
        if (`${MONTHS[mIdx]} ${mYear}` === monthKey) { found = true; break; }
        mIdx++;
        if (mIdx >= 12) { mIdx = 0; mYear++; }
      }
      if (found && monthlyAmount > 0) total += monthlyAmount;
    }
    return total;
  }, [fruitData, month, year, defaultContractMonths]);

  const enabledRuleCount = rateRules.filter((r) => r.enabled).length;

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-semibold">Billing Controls</h2>

      {/* Period Selection */}
      <div className="grid grid-cols-2 gap-4 max-w-md">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value) || 2025)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </div>
      </div>

      {/* Rate rules info */}
      <p className="text-sm text-gray-500">{enabledRuleCount} rate rules enabled</p>
      {enabledRuleCount === 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 p-3 rounded-md text-sm">
          No rate rules configured. Go to the Rate Table page to add rules, or all actions will be unmatched.
        </div>
      )}

      {/* Fruit Intake info card */}
      {fruitData && fruitData.records.length > 0 && (
        <div className="bg-green-50 border border-green-200 p-3 rounded-md text-sm flex items-center justify-between">
          <div>
            <span className="font-medium text-green-800">Fruit Intake:</span>{' '}
            <span className="text-green-700">
              {fruitData.records.length} active installments
              {' | '}
              {month} {year} installment total:{' '}
              <strong>
                ${fruitInstallmentTotal.toFixed(2)}
              </strong>
            </span>
          </div>
          {onNavigate && (
            <button
              onClick={() => onNavigate('fruit-intake')}
              className="text-green-700 hover:text-green-900 text-xs underline"
            >
              View Details
            </button>
          )}
        </div>
      )}

      {/* Run Button */}
      <button
        onClick={handleRun}
        disabled={running || !hasSettings}
        className="px-6 py-2.5 bg-violet-600 text-white rounded-md font-medium hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {running ? 'Running...' : 'Run Billing'}
      </button>
      {!hasSettings && (
        <p className="text-sm text-amber-600">Configure your token and winery ID in Settings first.</p>
      )}

      {/* Progress */}
      {(running || logs.length > 0) && (
        <ProgressBar progress={progress} logs={logs} stepStatus={stepStatus} />
      )}

      {/* Results */}
      {results && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 sm:grid-cols-7 gap-4">
            <SummaryCard label="Total Actions" value={results.summary.totalActions} />
            <SummaryCard label="Total Billed" value={`$${results.summary.totalBilled.toFixed(2)}`} />
            <SummaryCard label="Unmatched" value={results.summary.auditCount} color="amber" />
            <SummaryCard label="BULK Lots" value={results.summary.bulkLots} />
            <SummaryCard label="Barrel Owners" value={results.summary.barrelOwners} />
            <SummaryCard label="Case Goods" value={results.summary.caseGoodsLots ?? 0} />
            <SummaryCard label="Tank Time" value={results.summary.extendedTankTimeLots ?? 0} />
          </div>

          <button
            onClick={() => downloadExcel(sessionId)}
            className="px-4 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 transition-colors"
          >
            Download Excel
          </button>

          <TabView
            tabs={[
              {
                id: 'actions',
                label: 'ACTIONS',
                badge: results.actions.length,
                content: <ResultsTable rows={results.actions} />,
              },
              {
                id: 'bulk',
                label: 'Bulk Inventory',
                badge: results.bulkInventory.length,
                content: <BulkTable rows={results.bulkInventory} />,
              },
              {
                id: 'barrels',
                label: 'Barrel Inventory',
                badge: results.barrelInventory.length,
                content: <BarrelTable rows={results.barrelInventory} />,
              },
              {
                id: 'casegoods',
                label: 'Case Goods Storage',
                badge: (results.caseGoodsInventory || []).length,
                content: <CaseGoodsTable rows={results.caseGoodsInventory || []} />,
              },
              {
                id: 'tanktime',
                label: 'Tank Time',
                badge: (results.extendedTankTime || []).length + (results.extendedTankTimeWarnings || []).length,
                content: (
                  <TankTimeTable
                    rows={results.extendedTankTime || []}
                    warnings={results.extendedTankTimeWarnings || []}
                    sessionId={sessionId}
                    onRowUpdate={(index, updatedRow) => {
                      onBillingStateChange((prev) => {
                        if (!prev.results) return prev;
                        const newRows = [...prev.results.extendedTankTime];
                        newRows[index] = updatedRow;
                        return {
                          ...prev,
                          results: { ...prev.results, extendedTankTime: newRows },
                        };
                      });
                    }}
                  />
                ),
              },
              {
                id: 'audit',
                label: 'Audit',
                badge: results.auditRows.length,
                content: (
                  <AuditTable
                    rows={results.auditRows}
                    rateRules={rateRules}
                    allOwnerCodes={allOwnerCodes}
                    onRectify={handleRectify}
                  />
                ),
              },
              {
                id: 'summary',
                label: 'Summary',
                content: (
                  <div className="grid grid-cols-2 gap-4 max-w-lg">
                    <SummaryCard label="Total Actions" value={results.summary.totalActions} />
                    <SummaryCard label="Total Billed" value={`$${results.summary.totalBilled.toFixed(2)}`} />
                    <SummaryCard label="Unmatched Actions" value={results.summary.auditCount} color="amber" />
                    <SummaryCard label="BULK Lots" value={results.summary.bulkLots} />
                    <SummaryCard label="Barrel Owners" value={results.summary.barrelOwners} />
                    <SummaryCard label="Case Goods" value={results.summary.caseGoodsLots ?? 0} />
                    <SummaryCard label="Tank Time Lots" value={results.summary.extendedTankTimeLots ?? 0} />
                  </div>
                ),
              },
            ]}
          />
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, color = 'violet' }: { label: string; value: string | number; color?: string }) {
  const bgMap: Record<string, string> = {
    violet: 'bg-violet-50 border-violet-200',
    amber: 'bg-amber-50 border-amber-200',
    green: 'bg-green-50 border-green-200',
  };
  return (
    <div className={`p-4 rounded-lg border ${bgMap[color] || bgMap.violet}`}>
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}
