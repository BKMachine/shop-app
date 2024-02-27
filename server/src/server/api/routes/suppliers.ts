import express from 'express';
import SupplierService from '../../../database/lib/supplier';

const router = express.Router();

router.get('/suppliers', async (req, res, next) => {
  try {
    const data = await SupplierService.list();
    res.status(200).json(data);
  } catch (e) {
    next(e);
  }
});

router.post('/suppliers', async (req, res, next) => {
  const { data }: { data: Supplier | undefined } = req.body;
  if (!data) {
    res.sendStatus(400);
    return;
  }
  try {
    const doc = await SupplierService.create(data);
    res.status(200).json(doc);
  } catch (e) {
    next(e);
  }
});

router.put('/suppliers', async (req, res, next) => {
  const { data }: { data: SupplierDoc | undefined } = req.body;
  if (!data) {
    res.sendStatus(400);
    return;
  }
  try {
    await SupplierService.update(data);
    res.sendStatus(204);
  } catch (e) {
    next(e);
  }
});

export default router;
