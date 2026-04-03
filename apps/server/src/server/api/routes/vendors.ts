import { Router } from 'express';
import Vendors from '../../../database/lib/vendor/vendor_service.js';
import HttpError from '../../middleware/httpError.js';
import requireKnownDevice from '../../middleware/requireKnownDevices.js';

const router: Router = Router();

router.get('/vendors', async (_req, res, next) => {
  try {
    const data = await Vendors.list();
    res.status(200).json(data);
  } catch (e) {
    next(e);
  }
});

router.post('/vendors', requireKnownDevice, async (req, res, next) => {
  const { data }: { data: VendorDoc | undefined } = req.body;
  if (!data) return next(new HttpError(400, 'No vendor data provided.'));
  if (!req.deviceId) return next(new HttpError(401, 'Unauthorized: device not recognized.'));

  try {
    const doc = await Vendors.create(data, req.deviceId);
    res.status(200).json(doc);
  } catch (e) {
    next(e);
  }
});

router.put('/vendors', requireKnownDevice, async (req, res, next) => {
  const { data }: { data: VendorDoc | undefined } = req.body;
  if (!data) return next(new HttpError(400, 'No vendor data provided.'));
  if (!req.deviceId) return next(new HttpError(401, 'Unauthorized: device not recognized.'));

  try {
    await Vendors.update(data, req.deviceId);
    res.sendStatus(204);
  } catch (e) {
    next(e);
  }
});

export default router;
