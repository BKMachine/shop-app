import { Router } from 'express';
import Customers from '../../../database/lib/customer/customer_service.js';
import HttpError from '../../middleware/httpError.js';
import { assertKnownDevice, requireKnownDevice } from '../../middleware/knownDevices.js';

const router: Router = Router();

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
  const { data }: { data?: Customer } = req.body;
  if (!data) return next(new HttpError(400, 'No customer data provided.'));

  try {
    const doc = await Customers.create(data, req.deviceId);
    res.status(200).json(doc);
  } catch (e) {
    next(e);
  }
});

router.put('/customers', requireKnownDevice, async (req, res, next) => {
  assertKnownDevice(req);
  const { data }: { data?: Customer } = req.body;
  if (!data) return next(new HttpError(400, 'No customer data provided.'));

  try {
    await Customers.update(data, req.deviceId);
    res.sendStatus(204);
  } catch (e) {
    next(e);
  }
});

export default router;
