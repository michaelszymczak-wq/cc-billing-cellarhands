import { Router, Request, Response } from 'express';
import { sessions } from './actions';
import { loadSettings, loadSessionResult } from '../persistence';
import { buildPreview, generateCSV, getShortMonthYear } from '../services/qbExport';

const router = Router();

async function loadSession(sessionId: string) {
  if (!sessionId) return undefined;
  let session = sessions.get(sessionId);
  if (!session?.billingResult) {
    const stored = await loadSessionResult(sessionId);
    if (stored?.billingResult) {
      sessions.set(sessionId, stored);
      session = stored;
    }
  }
  return session;
}

const defaultEnabledSources = { actions: true, barrel: true, bulk: true, fruitIntake: true, addOns: true, consumables: true, caseGoods: true, extendedTankTime: true };

// Sources that require a billing session (come from the billing run)
const SESSION_SOURCES: (keyof typeof defaultEnabledSources)[] = ['actions', 'barrel', 'bulk', 'caseGoods', 'extendedTankTime'];

interface RequestBody {
  sessionId: string;
  month: string;
  year: number;
  excludedCustomers?: string[];
  includeDeposits?: boolean;
  enabledSources?: {
    actions: boolean;
    barrel: boolean;
    bulk: boolean;
    fruitIntake: boolean;
    addOns: boolean;
    consumables: boolean;
    caseGoods: boolean;
    extendedTankTime: boolean;
  };
}

function needsSession(body: RequestBody): boolean {
  const sources = body.enabledSources ?? defaultEnabledSources;
  return SESSION_SOURCES.some(k => sources[k]);
}

async function buildFromBody(body: RequestBody) {
  const session = await loadSession(body.sessionId);
  const br = session?.billingResult;

  const settings = await loadSettings();
  const excluded = body.excludedCustomers ?? [];
  const fruitRecords = settings.fruitIntake?.records || [];
  const customerOverrides = settings.fruitIntake?.customerOverrides || [];
  const defaultContractMonths = settings.fruitIntakeSettings?.defaultContractMonths ?? 12;
  const addOns = settings.billableAddOns || [];
  const consumables = settings.consumables || [];
  const enabledSources = body.enabledSources ?? defaultEnabledSources;

  const qbCustomerMap: Record<string, string> = {};
  for (const c of settings.customers) {
    if (c.code && c.displayName) qbCustomerMap[c.code] = c.displayName;
  }

  return buildPreview(
    br?.actions || [],
    br?.barrelInventory || [],
    br?.bulkInventory || [],
    fruitRecords,
    addOns,
    consumables,
    body.month,
    body.year,
    excluded,
    enabledSources,
    qbCustomerMap,
    customerOverrides,
    defaultContractMonths,
    body.includeDeposits ?? false,
    br?.caseGoodsInventory || [],
    br?.extendedTankTime || []
  );
}

// POST /preview — generate QB export preview
router.post('/preview', async (req: Request, res: Response) => {
  const body = req.body as RequestBody;

  if (needsSession(body)) {
    const session = await loadSession(body.sessionId);
    if (!session?.billingResult) {
      res.status(404).json({ error: 'No billing results found for this session. Run billing first.' });
      return;
    }
  }

  const preview = await buildFromBody(body);
  res.json(preview);
});

// POST /download — generate and stream QB CSV
router.post('/download', async (req: Request, res: Response) => {
  const body = req.body as RequestBody;

  if (needsSession(body)) {
    const session = await loadSession(body.sessionId);
    if (!session?.billingResult) {
      res.status(404).json({ error: 'No billing results found for this session. Run billing first.' });
      return;
    }
  }

  const preview = await buildFromBody(body);
  const csv = generateCSV(preview);
  const label = getShortMonthYear(body.month, body.year);
  const filename = `QB-Export_${label}.csv`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
});

export default router;
