import { Router } from 'express';
import Suppliers from '../../../database/lib/supplier/supplier_service.js';
import HttpError from '../../middleware/httpError.js';
import { assertKnownDevice, requireKnownDevice } from '../../middleware/knownDevices.js';

const router: Router = Router();

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
  const { data }: { data?: Supplier } = req.body;
  if (!data) return next(new HttpError(400, 'No supplier data provided.'));

  try {
    const doc = await Suppliers.create(data, req.deviceId);
    res.status(200).json(doc);
  } catch (e) {
    next(e);
  }
});

router.put('/suppliers', requireKnownDevice, async (req, res, next) => {
  assertKnownDevice(req);
  const { data }: { data?: Supplier } = req.body;
  if (!data) return next(new HttpError(400, 'No supplier data provided.'));

  try {
    await Suppliers.update(data, req.deviceId);
    res.sendStatus(204);
  } catch (e) {
    next(e);
  }
});

export default router;
