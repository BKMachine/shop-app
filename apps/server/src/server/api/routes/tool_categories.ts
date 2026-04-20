import { Router } from 'express';
import * as z from 'zod';
import ToolCategorySettings from '../../../database/lib/tool_category_settings/tool_category_settings_service.js';
import logger from '../../../logger.js';
import HttpError from '../../middleware/httpError.js';
import { assertKnownDevice, requireKnownDevice } from '../../middleware/knownDevices.js';

const router: Router = Router();

const ToolCategoryGroupsSchema = z.strictObject({
  milling: z.array(z.string()),
  turning: z.array(z.string()),
  swiss: z.array(z.string()),
  other: z.array(z.string()),
});

const UpdateToolCategorySettingsRequest = z.strictObject({
  data: z.strictObject({
    _id: z.literal('tool-categories').optional(),
    groups: ToolCategoryGroupsSchema,
  }),
});

router.get('/tool-categories', async (_req, res, next) => {
  try {
    const data = await ToolCategorySettings.get();
    res.status(200).json(data);
  } catch (e) {
    next(e);
  }
});

router.put('/tool-categories', requireKnownDevice, async (req, res, next) => {
  assertKnownDevice(req);
  const { success, data, error } = UpdateToolCategorySettingsRequest.safeParse(req.body);
  if (!success) {
    logger.error('Invalid tool category settings provided:', error.message);
    return next(new HttpError(400, 'Invalid tool category settings provided.'));
  }

  try {
    const updated = await ToolCategorySettings.update(data.data);
    res.status(200).json(updated);
  } catch (e) {
    next(e);
  }
});

export default router;
