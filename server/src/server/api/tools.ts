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

router.post('/manufacturer', async (req, res, next) => {
  const { data }: { data: ToolManufacturer } = req.body;
  try {
    const doc = await Manufacturer.create(data);
    res.status(200).json(doc);
  } catch (e) {
    next(e);
  }
});

router.put('/manufacturer', async (req, res, next) => {
  const { data }: { data: ToolManufacturerDoc } = req.body;
  try {
    const doc = await Manufacturer.update(data);
    res.status(200).json(doc);
  } catch (e) {
    next(e);
  }
});

export default router;
