import express from 'express';
import Customers from '../../../database/lib/customer';

const router = express.Router();

router.get('/customers', async (req, res, next) => {
  try {
    const data = await Customers.list();
    res.status(200).json(data);
  } catch (e) {
    next(e);
  }
});

router.post('/customers', async (req, res, next) => {
  const { data }: { data: CustomerDoc | undefined } = req.body;
  if (!data) {
    res.sendStatus(400);
    return;
  }
  try {
    const doc = await Customers.create(data);
    res.status(200).json(doc);
  } catch (e) {
    next(e);
  }
});

router.put('/customers', async (req, res, next) => {
  const { data }: { data: CustomerDoc | undefined } = req.body;
  if (!data) {
    res.sendStatus(400);
    return;
  }
  try {
    await Customers.update(data);
    res.sendStatus(204);
  } catch (e) {
    next(e);
  }
});

export default router;
