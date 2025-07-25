import { Router } from 'express';
import Vendors from '../../../database/lib/vendor/vendor_service.js';

const router: Router = Router();

router.get('/vendors', async (_req, res, next) => {
  try {
    const data = await Vendors.list();
    res.status(200).json(data);
  } catch (e) {
    next(e);
  }
});

router.post('/vendors', async (req, res, next) => {
  const { data }: { data: VendorDoc | undefined } = req.body;
  if (!data) {
    res.sendStatus(400);
    return;
  }
  try {
    const doc = await Vendors.create(data);
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
    await Vendors.update(data);
    res.sendStatus(204);
  } catch (e) {
    next(e);
  }
});

export default router;
