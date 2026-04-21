import { Router } from 'express';
import * as z from 'zod';
import Customers from '../../../database/lib/customer/customer_service.js';
import logger from '../../../logger.js';
import mongoObjectId from '../../../utilities/mongoObjectId.js';
import HttpError from '../../middleware/httpError.js';
import { assertKnownDevice, requireKnownDevice } from '../../middleware/knownDevices.js';

const router: Router = Router();

const CustomerFieldsSchema = z.strictObject({
  name: z.string().trim().min(1).max(20),
  homepage: z.httpUrl().optional(),
  logo: z.string().optional(),
});

const CreateCustomerRequest = z.strictObject({
  customer: CustomerFieldsSchema,
});

const UpdateCustomerRequest = z.strictObject({
  customer: CustomerFieldsSchema.extend({
    _id: mongoObjectId,
    __v: z.number().optional(),
  }),
});

router.get('/customers', async (_req, res, next) => {
  try {
    const data = await Customers.list();
    res.status(200).json(data);
  } catch (e) {
    next(e);
  }
});

router.post('/customers', requireKnownDevice, async (req, res, next) => {
  assertKnownDevice(req);
  const { success, data, error } = CreateCustomerRequest.safeParse(req.body);
  if (!success) {
    logger.error('Invalid customer data provided:', error.message);
    return next(new HttpError(400, 'Invalid customer data provided.'));
  }

  try {
    const doc = await Customers.create(data.customer, req.deviceId);
    res.status(200).json(doc);
  } catch (e) {
    next(e);
  }
});

router.put('/customers', requireKnownDevice, async (req, res, next) => {
  assertKnownDevice(req);
  const { success, data, error } = UpdateCustomerRequest.safeParse(req.body);
  if (!success) {
    logger.error('Invalid customer data provided:', error.message);
    return next(new HttpError(400, 'Invalid customer data provided.'));
  }

  try {
    const doc = await Customers.update(data.customer, req.deviceId);
    res.status(200).json(doc);
  } catch (e) {
    next(e);
  }
});

export default router;
