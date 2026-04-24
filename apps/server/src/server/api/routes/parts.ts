import { Router } from 'express';
import * as z from 'zod';
import { isValidId } from '../../../database/index.js';
import Parts from '../../../database/lib/part/part_service.js';
import logger from '../../../logger.js';
import mongoObjectId from '../../../utilities/mongoObjectId.js';
import {
  normalizeBooleanQueryValue,
  normalizeQueryValue,
} from '../../../utilities/normalizeQueryValue.js';
import HttpError from '../../middleware/httpError.js';
import { assertKnownDevice, requireKnownDevice } from '../../middleware/knownDevices.js';

const router: Router = Router();

const PartCycleTimeSchema = z.strictObject({
  operation: z.string(),
  time: z.number(),
});

const PartAdditionalCostSchema = z.strictObject({
  name: z.string(),
  cost: z.number(),
  url: z.string().optional(),
});

const PartSubComponentSchema = z.strictObject({
  partId: mongoObjectId,
  qty: z.number().positive(),
});

const PartFieldsSchema = z.strictObject({
  customer: mongoObjectId,
  part: z.string(),
  description: z.string(),
  stock: z.number(),
  location: z.string().nullish(),
  position: z.string().optional(),
  productLink: z.string().optional(),
  partFilesPath: z.string().optional(),
  revision: z.string().optional(),
  material: mongoObjectId.nullish(),
  customerSuppliedMaterial: z.boolean().optional(),
  materialCutType: z.enum(['blanks', 'bars']),
  materialLength: z.number(),
  barLength: z.number(),
  remnantLength: z.number(),
  cycleTimes: z.array(PartCycleTimeSchema),
  additionalCosts: z.array(PartAdditionalCostSchema),
  price: z.number(),
  subComponentIds: z.array(PartSubComponentSchema).optional(),
});

const CreatePartRequest = z.strictObject({
  data: PartFieldsSchema,
});

const UpdatePartRequest = z.strictObject({
  data: PartFieldsSchema.extend({
    _id: mongoObjectId,
    __v: z.number().optional(),
  }),
});

const UpdatePartStockRequest = z.strictObject({
  id: mongoObjectId,
  amount: z.number(),
});

const isAssemblyValidationError = (error: unknown): error is Error => {
  if (!(error instanceof Error)) return false;
  return (
    error.message === 'A part cannot include itself as a sub-component.' ||
    error.message === 'Sub-components cannot create recursive assembly relationships.'
  );
};

// Pagination, filtering, and sorting for the parts table. All query parameters are optional.
router.get('/parts', async (req, res, next) => {
  try {
    const data = await Parts.list({
      search: normalizeQueryValue(req.query.search),
      customer: normalizeQueryValue(req.query.customer),
      location: normalizeQueryValue(req.query.location),
      position: normalizeQueryValue(req.query.position),
      includeSubcomponents: normalizeBooleanQueryValue(req.query.includeSubcomponents),
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

router.get('/parts/search', async (req, res, next) => {
  const search = normalizeQueryValue(req.query.search);
  if (!search || search.trim().length < 2) {
    return res.status(200).json({ items: [] });
  }

  try {
    const items = await Parts.searchSummaries(search, Number(normalizeQueryValue(req.query.limit)));
    res.status(200).json({ items });
  } catch (e) {
    next(e);
  }
});

// Get distinct part locations for dropdowns and autocomplete
router.get('/parts/locations', async (_req, res, next) => {
  try {
    const locations = await Parts.getPartLocations();
    res.status(200).json(locations);
  } catch (e) {
    next(e);
  }
});

// Get distinct part positions for a given location
router.get('/parts/positions', async (req, res, next) => {
  const location = normalizeQueryValue(req.query.location);
  if (!location) return next(new HttpError(400, 'location query parameter is required'));

  try {
    const positions = await Parts.getPartPositions(location);
    res.status(200).json(positions);
  } catch (e) {
    next(e);
  }
});

// Get part by id
router.get(['/parts/:id', '/parts/info/:id'], async (req, res, next) => {
  const { id } = req.params;
  if (!isValidId(id)) return next(new HttpError(400, 'Invalid part id'));

  try {
    const part = await Parts.findById(id);
    if (!part) return next(new HttpError(404, 'Part not found.'));
    res.status(200).json(part);
  } catch (e) {
    next(e);
  }
});

router.get('/parts/:id/sub-components', async (req, res, next) => {
  const { id } = req.params;
  if (!isValidId(id)) return next(new HttpError(400, 'Invalid part id'));

  try {
    const items = await Parts.listSubComponents(id);
    res.status(200).json({ items });
  } catch (e) {
    next(e);
  }
});

router.get('/parts/:id/parents', async (req, res, next) => {
  const { id } = req.params;
  if (!isValidId(id)) return next(new HttpError(400, 'Invalid part id'));

  try {
    const items = await Parts.listParentAssemblies(id);
    res.status(200).json({ items });
  } catch (e) {
    next(e);
  }
});

router.get('/parts/:id/relations', async (req, res, next) => {
  const { id } = req.params;
  if (!isValidId(id)) return next(new HttpError(400, 'Invalid part id'));

  try {
    const relations = await Parts.listRelations(id);
    res.status(200).json(relations);
  } catch (e) {
    next(e);
  }
});

// Create new part
router.post('/parts', requireKnownDevice, async (req, res, next) => {
  assertKnownDevice(req);
  const { success, data, error } = CreatePartRequest.safeParse(req.body);
  if (!success) {
    logger.error('Invalid part data provided:', error.message);
    return next(new HttpError(400, 'Invalid part data.'));
  }

  try {
    const doc = await Parts.create(data.data, req.deviceId);
    res.status(200).json(doc);
  } catch (e) {
    if (isAssemblyValidationError(e)) return next(new HttpError(400, e.message));
    next(e);
  }
});

// Update an existing part
router.put('/parts', requireKnownDevice, async (req, res, next) => {
  assertKnownDevice(req);
  const { success, data, error } = UpdatePartRequest.safeParse(req.body);
  if (!success) {
    logger.error('Invalid part data provided:', error.message);
    return next(new HttpError(400, 'Invalid part data.'));
  }

  try {
    const response = await Parts.update(data.data, req.deviceId, {
      preserveManagedMediaFields: true,
    });
    res.status(200).json(response);
  } catch (e) {
    if (isAssemblyValidationError(e)) return next(new HttpError(400, e.message));
    next(e);
  }
});

// Adjust or set stock by a specific amount (positive or negative)
router.put('/parts/stock', requireKnownDevice, async (req, res, next) => {
  assertKnownDevice(req);
  const { success, data, error } = UpdatePartStockRequest.safeParse(req.body);
  if (!success) {
    logger.error('Invalid part stock data provided:', error.message);
    return next(new HttpError(400, 'Invalid part stock data.'));
  }

  try {
    const { status, part } = await Parts.stock(data.id, data.amount, req.deviceId);
    res.status(status).json(part);
  } catch (e) {
    next(e);
  }
});

export default router;
