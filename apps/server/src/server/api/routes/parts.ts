import { Router } from 'express';
import Parts from '../../../database/lib/part/part_service.js';
import HttpError from '../../middleware/httpError.js';
import requireKnownDevice from '../../middleware/requireKnownDevices.js';

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
    if (!part) return next(new HttpError(404, 'Part not found.'));
    res.status(200).json(part);
  } catch (e) {
    next(e);
  }
});

router.post('/parts', requireKnownDevice, async (req, res, next) => {
  const { data }: { data: PartDoc | undefined } = req.body;
  if (!data) return next(new HttpError(400, 'No part data provided.'));
  if (!req.device) return next(new HttpError(401, 'Unauthorized: device not recognized.'));
  try {
    const doc = await Parts.add(data, req.device._id.toString());
    res.status(200).json(doc);
  } catch (e) {
    next(e);
  }
});

router.put('/parts', requireKnownDevice, async (req, res, next) => {
  const { data }: { data: PartDoc | undefined } = req.body;
  if (!data) return next(new HttpError(400, 'No part data provided.'));
  if (!req.device) return next(new HttpError(401, 'Unauthorized: device not recognized.'));
  try {
    const response = await Parts.update(data, req.device._id.toString());
    res.status(200).json(response);
  } catch (e) {
    next(e);
  }
});

export default router;
