import { Router } from 'express';
import * as z from 'zod';
import { isValidId } from '../../../database/index.js';
import Tools from '../../../database/lib/tool/tool_service.js';
import logger from '../../../logger.js';
import mongoObjectId from '../../../utilities/mongoObjectId.js';
import { normalizeQueryValue } from '../../../utilities/normalizeQueryValue.js';
import HttpError from '../../middleware/httpError.js';
import { assertKnownDevice, requireKnownDevice } from '../../middleware/knownDevices.js';

const router: Router = Router();

const ToolFieldsSchema = z.strictObject({
  description: z.string().trim(),
  vendor: mongoObjectId.optional(),
  supplier: mongoObjectId.optional(),
  item: z.string().optional(),
  barcode: z.string().optional(),
  stock: z.number(),
  img: z.string().optional(),
  category: z.enum(['milling', 'turning', 'swiss', 'other']),
  toolType: z.string().optional(),
  coating: z.string().optional(),
  flutes: z.number().optional(),
  autoReorder: z.boolean(),
  reorderQty: z.number(),
  reorderThreshold: z.number(),
  productLink: z.string().optional(),
  techDataLink: z.string().optional(),
  orderLink: z.string().optional(),
  cost: z.number(),
  onOrder: z.boolean(),
  orderedOn: z.string().optional(),
  location: z.string().nullish(),
  position: z.string().optional(),
  cuttingDia: z.number().optional(),
  fluteLength: z.number().optional(),
});

const CreateToolRequest = z.strictObject({
  tool: ToolFieldsSchema,
});

const UpdateToolRequest = z.strictObject({
  tool: ToolFieldsSchema.extend({
    _id: mongoObjectId,
    __v: z.number().optional(),
  }),
});

// Pagination, filtering, and sorting for the tools table. All query parameters are optional.
router.get('/tools', async (req, res, next) => {
  try {
    const data = await Tools.list({
      category: normalizeQueryValue(req.query.category) as ToolFilterCategory | undefined,
      search: normalizeQueryValue(req.query.search),
      toolType: normalizeQueryValue(req.query.toolType),
      location: normalizeQueryValue(req.query.location),
      position: normalizeQueryValue(req.query.position),
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

// Get distinct tool positions for a given location
router.get('/tools/positions', async (req, res, next) => {
  const location = normalizeQueryValue(req.query.location);
  if (!location) return next(new HttpError(400, 'location query parameter is required'));

  try {
    const positions = await Tools.getToolPositions(location);
    res.status(200).json(positions);
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
  const { success, data, error } = CreateToolRequest.safeParse(req.body);
  if (!success) {
    logger.error('Invalid tool data provided:', error.message);
    return next(new HttpError(400, 'Invalid tool data provided.'));
  }

  try {
    const doc = await Tools.create(data.tool, req.deviceId);
    res.status(200).json(doc);
  } catch (e) {
    next(e);
  }
});

// Update an existing tool
router.put('/tools', requireKnownDevice, async (req, res, next) => {
  assertKnownDevice(req);
  const { success, data, error } = UpdateToolRequest.safeParse(req.body);
  if (!success) {
    logger.error('Invalid tool data provided:', error.message);
    return next(new HttpError(400, 'Invalid tool data provided.'));
  }

  try {
    const response = await Tools.update(data.tool, req.deviceId);
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

// Adjust or set stock by a specific amount (positive or negative)
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
