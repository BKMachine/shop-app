import { Router } from 'express';
import { isValidId } from '../../../database/index.js';
import Parts from '../../../database/lib/part/part_service.js';
import HttpError from '../../middleware/httpError.js';
import { assertKnownDevice, requireKnownDevice } from '../../middleware/knownDevices.js';

const router: Router = Router();
const isAssemblyValidationError = (error: unknown): error is Error => {
  if (!(error instanceof Error)) return false;
  return (
    error.message === 'A part cannot include itself as a sub-component.' ||
    error.message === 'Sub-components cannot create recursive assembly relationships.'
  );
};

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
  if (!isValidId(id)) return next(new HttpError(400, 'Invalid part id'));

  try {
    const part = await Parts.findById(id);
    if (!part) return next(new HttpError(404, 'Part not found.'));
    res.status(200).json(part);
  } catch (e) {
    next(e);
  }
});

router.post('/parts', requireKnownDevice, async (req, res, next) => {
  assertKnownDevice(req);
  const { data }: { data?: PartDoc } = req.body;
  if (!data) return next(new HttpError(400, 'No part data provided.'));

  try {
    const doc = await Parts.add(data, req.deviceId);
    res.status(200).json(doc);
  } catch (e) {
    if (isAssemblyValidationError(e)) return next(new HttpError(400, e.message));
    next(e);
  }
});

router.put('/parts', requireKnownDevice, async (req, res, next) => {
  assertKnownDevice(req);
  const { data }: { data?: PartDoc } = req.body;
  if (!data) return next(new HttpError(400, 'No part data provided.'));

  try {
    const response = await Parts.update(data, req.deviceId, {
      preserveManagedMediaFields: true,
    });
    res.status(200).json(response);
  } catch (e) {
    if (isAssemblyValidationError(e)) return next(new HttpError(400, e.message));
    next(e);
  }
});

export default router;
