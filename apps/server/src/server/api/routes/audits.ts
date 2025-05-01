import { Router } from 'express';
import Audit from '../../../database/lib/audit/audit_service.js';

const router: Router = Router();

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
  if (!id || !from || !to) {
    res.sendStatus(400);
    return;
  }
  try {
    const audits = await Audit.getToolAudits(id, from, to);
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
  if (!id || !from || !to) {
    res.sendStatus(400);
    return;
  }
  try {
    const audits = await Audit.getPartAudits(id, from, to);
    res.status(200).json(audits);
  } catch (e) {
    next(e);
  }
});

export default router;
