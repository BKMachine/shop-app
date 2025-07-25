import { Router } from 'express';
import Parts from '../../../database/lib/part/part_service.js';

const router: Router = Router();

router.get('/parts', async (_req, res, next) => {
  try {
    const data = await Parts.list();
    res.status(200).json(data);
  } catch (e) {
    next(e);
  }
});

router.get('/parts/:id', async (req, res, next) => {
  const { id } = req.params;
  try {
    const part = await Parts.findById(id);
    if (!part) {
      res.sendStatus(404);
      return;
    }
    res.status(200).json(part);
  } catch (e) {
    next(e);
  }
});

router.post('/parts', async (req, res, next) => {
  const { data }: { data: PartDoc | undefined } = req.body;
  if (!data) {
    res.sendStatus(400);
    return;
  }
  try {
    const doc = await Parts.add(data);
    res.status(200).json(doc);
  } catch (e) {
    next(e);
  }
});

router.put('/parts', async (req, res, next) => {
  const { data }: { data: PartDoc | undefined } = req.body;
  if (!data) {
    res.sendStatus(400);
    return;
  }
  try {
    const response = await Parts.update(data);
    res.status(200).json(response);
  } catch (e) {
    next(e);
  }
});

export default router;
