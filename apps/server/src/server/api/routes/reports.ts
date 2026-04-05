import { Router } from 'express';
import Reports from '../../../database/lib/report/report_service.js';
import HttpError from '../../middleware/httpError.js';
import { assertKnownDevice, requireKnownDevice } from '../../middleware/knownDevices.js';

const router: Router = Router();

router.get('/reports', async (_req, res, next) => {
  try {
    const data = await Reports.list();
    res.status(200).json(data);
  } catch (e) {
    next(e);
  }
});

router.post('/reports', requireKnownDevice, async (req, res, next) => {
  assertKnownDevice(req);
  const data: EmailReportDoc = req.body?.data ?? req.body;
  if (!data) return next(new HttpError(400, 'No report data provided.'));

  try {
    const doc = await Reports.create(data, req.deviceId);
    res.status(200).json(doc);
  } catch (e) {
    next(e);
  }
});

router.put('/reports', requireKnownDevice, async (req, res, next) => {
  assertKnownDevice(req);
  const data: EmailReportDoc = req.body?.data ?? req.body;
  if (!data) return next(new HttpError(400, 'No report data provided.'));

  try {
    await Reports.update(data, req.deviceId);
    res.sendStatus(204);
  } catch (e) {
    next(e);
  }
});

export default router;
