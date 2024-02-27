import express from 'express';
import VendorService from '../../../database/lib/vendor';

const router = express.Router();

router.get('/vendors', async (req, res, next) => {
  try {
    const data = await VendorService.list();
    res.status(200).json(data);
  } catch (e) {
    next(e);
  }
});

router.post('/vendors', async (req, res, next) => {
  const { data }: { data: Vendor | undefined } = req.body;
  if (!data) {
    res.sendStatus(400);
    return;
  }
  try {
    const doc = await VendorService.create(data);
    res.status(200).json(doc);
  } catch (e) {
    next(e);
  }
});

router.put('/vendors', async (req, res, next) => {
  const { data }: { data: VendorDoc | undefined } = req.body;
  if (!data) {
    res.sendStatus(400);
    return;
  }
  try {
    await VendorService.update(data);
    res.sendStatus(204);
  } catch (e) {
    next(e);
  }
});

export default router;
