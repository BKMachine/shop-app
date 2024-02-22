import express from 'express';
import Manufacturer from '../../database/lib/tools/manufacturer';

const router = express.Router();

router.get('/manufacturers', async (req, res, next) => {
  try {
    const data = await Manufacturer.listAll();
    res.status(200).json(data);
  } catch (e) {
    next(e);
  }
});

export default router;
