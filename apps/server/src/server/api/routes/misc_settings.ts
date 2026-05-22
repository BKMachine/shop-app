import { Router } from 'express';
import * as z from 'zod';
import MiscSettings from '../../../database/lib/misc_settings/misc_settings_service.js';
import logger from '../../../logger.js';
import HttpError from '../../middleware/httpError.js';
import { assertKnownDevice, requireKnownDevice } from '../../middleware/knownDevices.js';

const router: Router = Router();

const UpdateMiscSettingsRequest = z.strictObject({
  data: z.strictObject({
    _id: z.literal('misc-settings').optional(),
    itemLabelOffset: z.strictObject({
      x: z.number(),
      y: z.number(),
    }),
  }),
});

router.get('/misc-settings', async (_req, res, next) => {
  try {
    const data = await MiscSettings.get();
    res.status(200).json(data);
  } catch (e) {
    next(e);
  }
});

router.put('/misc-settings', requireKnownDevice, async (req, res, next) => {
  assertKnownDevice(req);
  const { success, data, error } = UpdateMiscSettingsRequest.safeParse(req.body);
  if (!success) {
    logger.error('Invalid misc settings provided:', error.message);
    return next(new HttpError(400, 'Invalid misc settings provided.'));
  }

  try {
    const updated = await MiscSettings.update(data.data);
    res.status(200).json(updated);
  } catch (e) {
    next(e);
  }
});

export default router;
