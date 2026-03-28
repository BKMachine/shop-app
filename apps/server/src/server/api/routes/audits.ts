import { Router } from 'express';
import Audit from '../../../database/lib/audit/audit_service.js';
import HttpError from '../../middleware/httpError.js';

const router: Router = Router();

router.post('/audits/tools', async (req, res, next) => {
  const {
    from,
    to,
  }: {
    from: string | undefined;
    to: string | undefined;
  } = req.body;
  if (!from || !to) return next(new HttpError(400, 'from and to are required.'));
  try {
    const audits = await Audit.getAllToolAudits(from, to);
    res.status(200).json(audits);
  } catch (e) {
    next(e);
  }
});

router.post('/audits/tools/stock', async (req, res, next) => {
  const {
    id,
    from,
    to,
  }: {
    id: string | undefined;
    from: string | undefined;
    to: string | undefined;
  } = req.body;
  if (!id || !from || !to) return next(new HttpError(400, 'id, from, and to are required.'));
  try {
    const audits = await Audit.getToolAudits(id, from, to);
    res.status(200).json(audits);
  } catch (e) {
    next(e);
  }
});

router.post('/audits/parts', async (req, res, next) => {
  const {
    from,
    to,
  }: {
    from: string | undefined;
    to: string | undefined;
  } = req.body;
  if (!from || !to) return next(new HttpError(400, 'from and to are required.'));
  try {
    const audits = await Audit.getAllPartAudits(from, to);
    res.status(200).json(audits);
  } catch (e) {
    next(e);
  }
});

router.post('/audits/parts/stock', async (req, res, next) => {
  const {
    id,
    from,
    to,
  }: {
    id: string | undefined;
    from: string | undefined;
    to: string | undefined;
  } = req.body;
  if (!id || !from || !to) return next(new HttpError(400, 'id, from, and to are required.'));
  try {
    const audits = await Audit.getPartAudits(id, from, to);
    res.status(200).json(audits);
  } catch (e) {
    next(e);
  }
});

export default router;
