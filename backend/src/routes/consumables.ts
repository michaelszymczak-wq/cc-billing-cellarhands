import { Router, Request, Response } from 'express';
import { loadSettings, saveSettings } from '../persistence';
import { Consumable } from '../types';

const router = Router();

// GET / — return all consumables
router.get('/', async (_req: Request, res: Response) => {
  const settings = await loadSettings();
  res.json(settings.consumables);
});

// POST / — add a new consumable
router.post('/', async (req: Request, res: Response) => {
  const body = req.body as Omit<Consumable, 'id'>;
  const settings = await loadSettings();

  const newItem: Consumable = {
    id: `cons_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    name: body.name,
    vintage: body.vintage,
    totalCost: body.totalCost,
    notes: body.notes || '',
  };

  settings.consumables.push(newItem);
  await saveSettings(settings);
  res.json(settings.consumables);
});

// DELETE /:id — remove by id
router.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const settings = await loadSettings();
  settings.consumables = settings.consumables.filter((c) => c.id !== id);
  await saveSettings(settings);
  res.json(settings.consumables);
});

export default router;
