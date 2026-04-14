import { Router } from 'express';
import { isValidId } from '../../../database/index.js';
import Tools from '../../../database/lib/tool/tool_service.js';
import HttpError from '../../middleware/httpError.js';
import { assertKnownDevice, requireKnownDevice } from '../../middleware/knownDevices.js';

const router: Router = Router();

function normalizeQueryValue(value: unknown): string | undefined {
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : undefined;
  return typeof value === 'string' ? value : undefined;
}

// Pagination, filtering, and sorting for the tools table. All query parameters are optional.
router.get('/tools', async (req, res, next) => {
  try {
    const data = await Tools.list({
      category: normalizeQueryValue(req.query.category) as ToolCategory | undefined,
      search: normalizeQueryValue(req.query.search),
      toolType: normalizeQueryValue(req.query.toolType),
      cuttingDia: normalizeQueryValue(req.query.cuttingDia),
      minFluteLength: normalizeQueryValue(req.query.minFluteLength),
      sort: normalizeQueryValue(req.query.sort),
      order: normalizeQueryValue(req.query.order) === 'desc' ? 'desc' : 'asc',
      limit: Number(normalizeQueryValue(req.query.limit)),
      offset: Number(normalizeQueryValue(req.query.offset)),
    });
    res.status(200).json(data);
  } catch (e) {
    next(e);
  }
});

// Get distinct tool locations for dropdowns and autocomplete
router.get('/tools/locations', async (_req, res, next) => {
  try {
    const locations = await Tools.getToolLocations();
    res.status(200).json(locations);
  } catch (e) {
    next(e);
  }
});

// Get tools that are at or below their reorder threshold and have autoReorder enabled
router.get('/tools/reorders', async (_req, res, next) => {
  try {
    const reorders = await Tools.getAutoReorders();
    res.status(200).json(reorders);
  } catch (e) {
    next(e);
  }
});

// Get tool by id
router.get('/tools/:id', async (req, res, next) => {
  const { id } = req.params;
  if (!isValidId(id)) return next(new HttpError(400, 'Invalid tool id'));

  try {
    const tool = await Tools.findById(id);
    if (!tool) return next(new HttpError(404, 'Tool not found.'));
    res.status(200).json(tool);
  } catch (e) {
    next(e);
  }
});

// Get tool by scan code (item or barcode)
router.get('/tools/info/:scanCode', async (req, res, next) => {
  const { scanCode } = req.params;

  try {
    const tool = await Tools.findByScanCode(scanCode);
    if (!tool) return next(new HttpError(404, 'Tool not found.'));
    res.status(200).json(tool);
  } catch (e) {
    next(e);
  }
});

// Create a new tool
router.post('/tools', requireKnownDevice, async (req, res, next) => {
  assertKnownDevice(req);
  const { data }: { data?: ToolDoc } = req.body;
  if (!data) return next(new HttpError(400, 'No tool data provided.'));

  try {
    const doc = await Tools.create(data, req.deviceId);
    res.status(200).json(doc);
  } catch (e) {
    next(e);
  }
});

// Update an existing tool
router.put('/tools', requireKnownDevice, async (req, res, next) => {
  assertKnownDevice(req);
  const { data }: { data?: ToolDoc } = req.body;
  if (!data) return next(new HttpError(400, 'No tool data provided.'));

  try {
    const response = await Tools.update(data, req.deviceId);
    res.status(200).json(response);
  } catch (e) {
    next(e);
  }
});

// Decrement a tool by scanning its item or barcode value
router.put('/tools/pick', requireKnownDevice, async (req, res, next) => {
  assertKnownDevice(req);
  const { scanCode }: { scanCode?: string } = req.body;
  if (!scanCode) return next(new HttpError(400, 'scanCode is required.'));

  try {
    const { status, tool } = await Tools.pick(scanCode, req.deviceId);
    res.status(status).json(tool);
  } catch (e) {
    next(e);
  }
});

// Adjust stock by a specific amount (positive or negative)
router.put('/tools/stock', requireKnownDevice, async (req, res, next) => {
  assertKnownDevice(req);
  const { id, amount }: { id: string; amount: number } = req.body;
  if (!id || amount === undefined || amount === null)
    return next(new HttpError(400, 'id and amount are required.'));
  if (!isValidId(id)) return next(new HttpError(400, 'Invalid tool id'));

  try {
    const { status, tool } = await Tools.stock(id, amount, req.deviceId);
    res.status(status).json(tool);
  } catch (e) {
    next(e);
  }
});

export default router;
