import { Router } from 'express';
import * as z from 'zod';
import Vendors from '../../../database/lib/vendor/vendor_service.js';
import logger from '../../../logger.js';
import mongoObjectId from '../../../utilities/mongoObjectId.js';
import HttpError from '../../middleware/httpError.js';
import { assertKnownDevice, requireKnownDevice } from '../../middleware/knownDevices.js';

const router: Router = Router();

const VendorFieldsSchema = z.strictObject({
  name: z.string().trim().min(1).max(20),
  homepage: z.httpUrl().optional(),
  logo: z.string().optional(),
  coatings: z.array(z.string()).optional(),
});

const CreateVendorRequest = z.strictObject({
  vendor: VendorFieldsSchema,
});

const UpdateVendorRequest = z.strictObject({
  vendor: VendorFieldsSchema.extend({
    _id: mongoObjectId,
    __v: z.number().optional(),
  }),
});

router.get('/vendors', async (_req, res, next) => {
  try {
    const data = await Vendors.list();
    res.status(200).json(data);
  } catch (e) {
    next(e);
  }
});

router.post('/vendors', requireKnownDevice, async (req, res, next) => {
  assertKnownDevice(req);
  const { success, data, error } = CreateVendorRequest.safeParse(req.body);
  if (!success) {
    logger.error('Invalid vendor data provided:', error.message);
    return next(new HttpError(400, 'Invalid vendor data provided.'));
  }

  try {
    const doc = await Vendors.create(data.vendor, req.deviceId);
    res.status(200).json(doc);
  } catch (e) {
    next(e);
  }
});

router.put('/vendors', requireKnownDevice, async (req, res, next) => {
  assertKnownDevice(req);
  const { success, data, error } = UpdateVendorRequest.safeParse(req.body);
  if (!success) {
    logger.error('Invalid vendor data provided:', error.message);
    return next(new HttpError(400, 'Invalid vendor data provided.'));
  }

  try {
    const doc = await Vendors.update(data.vendor, req.deviceId);
    res.status(200).json(doc);
  } catch (e) {
    next(e);
  }
});

export default router;
