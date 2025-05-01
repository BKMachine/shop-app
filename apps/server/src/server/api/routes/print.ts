import { Router } from 'express';
import DymoService from '../../../services/dymo_service.js';

const router: Router = Router();

router.post('/print/location', async (req, res, next) => {
  const { loc, pos }: PrintLocationBody = req.body;
  if (!loc || !pos) {
    res.sendStatus(400);
    return;
  }
  try {
    await DymoService.printLocationLabel({ loc, pos });
    res.sendStatus(204);
  } catch (e) {
    next(e);
  }
});

router.post('/print/item', async (req, res, next) => {
  const { item, description, brand }: PrintItemBody = req.body;
  if (!item || !description) {
    res.sendStatus(400);
    return;
  }
  try {
    await DymoService.printItemLabel({ item, description, brand });
    res.sendStatus(204);
  } catch (e) {
    next(e);
  }
});

export default router;
