import { Router } from 'express';
import Reports from '../../../database/lib/report/report_service.js';

const router: Router = Router();

router.get('/reports', async (_req, res, next) => {
  try {
    const data = await Reports.list();
    res.status(200).json(data);
  } catch (e) {
    next(e);
  }
});

router.post('/reports', async (req, res, next) => {
  const { data }: { data: ReportDoc | undefined } = req.body;
  if (!data) {
    res.sendStatus(400);
    return;
  }
  try {
    const doc = await Reports.create(data);
    res.status(200).json(doc);
  } catch (e) {
    next(e);
  }
});

router.put('/reports', async (req, res, next) => {
  const { data }: { data: ReportDoc | undefined } = req.body;
  if (!data) {
    res.sendStatus(400);
    return;
  }
  try {
    await Reports.update(data);
    res.sendStatus(204);
  } catch (e) {
    next(e);
  }
});

export default router;
