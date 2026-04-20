import { Router } from 'express';
import * as z from 'zod';
import Suppliers from '../../../database/lib/supplier/supplier_service.js';
import logger from '../../../logger.js';
import mongoObjectId from '../../../utilities/mongoObjectId.js';
import HttpError from '../../middleware/httpError.js';
import { assertKnownDevice, requireKnownDevice } from '../../middleware/knownDevices.js';

const router: Router = Router();

const CreateSupplierRequest = z.strictObject({
  supplier: z.strictObject({
    name: z.string(),
    homepage: z.httpUrl().optional(),
    logo: z.string().optional(),
  }),
});
export type CreateSupplierPayload = z.infer<typeof CreateSupplierRequest.shape.supplier>;

const UpdateSupplierRequest = z.strictObject({
  supplier: CreateSupplierRequest.shape.supplier.extend({
    _id: mongoObjectId,
    __v: z.number().optional(),
  }),
});
export type UpdateSupplierPayload = z.infer<typeof UpdateSupplierRequest.shape.supplier>;

router.get('/suppliers', async (_req, res, next) => {
  try {
    const data = await Suppliers.list();
    res.status(200).json(data);
  } catch (e) {
    next(e);
  }
});

router.post('/suppliers', requireKnownDevice, async (req, res, next) => {
  assertKnownDevice(req);
  const { success, data, error } = CreateSupplierRequest.safeParse(req.body);
  if (!success) {
    logger.error('Invalid supplier data provided:', error.message);
    return next(new HttpError(400, 'Invalid supplier data provided.'));
  }

  try {
    const doc = await Suppliers.create(data.supplier, req.deviceId);
    res.status(200).json(doc);
  } catch (e) {
    next(e);
  }
});

router.put('/suppliers', requireKnownDevice, async (req, res, next) => {
  assertKnownDevice(req);
  const { success, data, error } = UpdateSupplierRequest.safeParse(req.body);
  if (!success) {
    logger.error('Invalid supplier data provided:', error.message);
    return next(new HttpError(400, 'Invalid supplier data provided.'));
  }

  try {
    await Suppliers.update(data.supplier, req.deviceId);
    res.sendStatus(204);
  } catch (e) {
    next(e);
  }
});

export default router;
