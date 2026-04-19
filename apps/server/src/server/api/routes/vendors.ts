import { Router } from 'express';
import * as z from 'zod';
import Vendors from '../../../database/lib/vendor/vendor_service.js';
import logger from '../../../logger.js';
import mongoObjectId from '../../../utilities/mongoObjectId.js';
import HttpError from '../../middleware/httpError.js';
import { assertKnownDevice, requireKnownDevice } from '../../middleware/knownDevices.js';

const router: Router = Router();

const CreateVendorPayload = z.strictObject({
  vendor: z.strictObject({
    name: z.string(),
    homepage: z.httpUrl().optional(),
    logo: z.string().optional(),
    coatings: z.array(z.string()).optional(),
  }),
});

const UpdateVendorPayload = z.strictObject({
  vendor: CreateVendorPayload.shape.vendor.extend({
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
  const { success, data, error } = CreateVendorPayload.safeParse(req.body);
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
  const { success, data, error } = UpdateVendorPayload.safeParse(req.body);
  if (!success) {
    logger.error('Invalid vendor data provided:', error.message);
    return next(new HttpError(400, 'Invalid vendor data provided.'));
  }

  try {
    await Vendors.update(data.vendor, req.deviceId);
    res.sendStatus(204);
  } catch (e) {
    next(e);
  }
});

export default router;
