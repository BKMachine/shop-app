import { Router } from 'express';
import Audit from '../../../database/lib/audit/audit_service.js';
import HttpError from '../../middleware/httpError.js';
import { assertKnownDevice, requireKnownDevice } from '../../middleware/knownDevices.js';

const router: Router = Router();

router.post('/audits/tools', async (req, res, next) => {
  const { from, to }: { from?: string; to?: string } = req.body;
  if (!from || !to) return next(new HttpError(400, 'from and to are required.'));
  try {
    const audits = await Audit.getAllToolAudits(from, to);
    res.status(200).json(audits);
  } catch (e) {
    next(e);
  }
});

router.post('/audits/tools/stock', async (req, res, next) => {
  const { id, from, to }: { id?: string; from?: string; to?: string } = req.body;
  if (!id || !from || !to) return next(new HttpError(400, 'id, from, and to are required.'));

  try {
    const audits = await Audit.getToolAudits(id, from, to);
    res.status(200).json(audits);
  } catch (e) {
    next(e);
  }
});

router.post('/audits/parts', async (req, res, next) => {
  const { from, to }: { from?: string; to?: string } = req.body;
  if (!from || !to) return next(new HttpError(400, 'from and to are required.'));

  try {
    const audits = await Audit.getAllPartAudits(from, to);
    res.status(200).json(audits);
  } catch (e) {
    next(e);
  }
});

router.post('/audits/parts/stock', async (req, res, next) => {
  const { id, from, to }: { id?: string; from?: string; to?: string } = req.body;
  if (!id || !from || !to) return next(new HttpError(400, 'id, from, and to are required.'));

  try {
    const audits = await Audit.getPartAudits(id, from, to);
    res.status(200).json(audits);
  } catch (e) {
    next(e);
  }
});

router.post('/audits', requireKnownDevice, async (req, res, next) => {
  assertKnownDevice(req);
  if (!req.device.isAdmin) return next(new HttpError(403, 'Forbidden: admin access required.'));
  const { types, limit, offset }: { types?: Audit['type'][]; limit?: number; offset?: number } =
    req.body;

  try {
    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const safeOffset = Math.max(Number(offset) || 0, 0);
    const audits = await Audit.getAllAudits(types, safeLimit, safeOffset);
    res.status(200).json({
      items: audits,
      hasMore: audits.length === safeLimit,
    });
  } catch (e) {
    next(e);
  }
});

export default router;
