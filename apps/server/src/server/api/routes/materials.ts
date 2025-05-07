import { Router } from 'express';
import Materials from '../../../database/lib/material/material_service.js';

const router: Router = Router();

router.get('/materials', async (req, res, next) => {
  try {
    const data = await Materials.list();
    res.status(200).json(data);
  } catch (e) {
    next(e);
  }
});

router.post('/materials', async (req, res, next) => {
  const { data }: { data: Material | undefined } = req.body;
  if (!data) {
    res.sendStatus(400);
    return;
  }
  try {
    const doc = await Materials.add(data);
    res.status(200).json(doc);
  } catch (e) {
    next(e);
  }
});

router.put('/materials', async (req, res, next) => {
  const { data }: { data: Material | undefined } = req.body;
  if (!data) {
    res.sendStatus(400);
    return;
  }
  try {
    const response = await Materials.update(data);
    if (!response) {
      res.sendStatus(404);
      return;
    }
    res.status(200).json(response);
  } catch (e) {
    next(e);
  }
});

export default router;
