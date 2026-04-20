import { Router } from 'express';
import * as z from 'zod';
import Customers from '../../../database/lib/customer/customer_service.js';
import logger from '../../../logger.js';
import mongoObjectId from '../../../utilities/mongoObjectId.js';
import HttpError from '../../middleware/httpError.js';
import { assertKnownDevice, requireKnownDevice } from '../../middleware/knownDevices.js';

const router: Router = Router();

const CreateCustomerRequest = z.strictObject({
  customer: z.strictObject({
    name: z.string(),
    homepage: z.httpUrl().optional(),
    logo: z.string().optional(),
  }),
});
export type CreateCustomerPayload = z.infer<typeof CreateCustomerRequest.shape.customer>;

const UpdateCustomerRequest = z.strictObject({
  customer: CreateCustomerRequest.shape.customer.extend({
    _id: mongoObjectId,
    __v: z.number().optional(),
  }),
});
export type UpdateCustomerPayload = z.infer<typeof UpdateCustomerRequest.shape.customer>;

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
    await Customers.update(data.customer, req.deviceId);
    res.sendStatus(204);
  } catch (e) {
    next(e);
  }
});

export default router;
