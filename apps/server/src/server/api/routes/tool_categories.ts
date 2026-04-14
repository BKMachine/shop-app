import { Router } from 'express';
import ToolCategorySettings from '../../../database/lib/tool_category_settings/tool_category_settings_service.js';
import HttpError from '../../middleware/httpError.js';
import { assertKnownDevice, requireKnownDevice } from '../../middleware/knownDevices.js';

const router: Router = Router();

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
  const data: Partial<ToolCategorySettings> | undefined = req.body?.data ?? req.body;
  if (!data) return next(new HttpError(400, 'No tool category settings provided.'));

  try {
    const updated = await ToolCategorySettings.update(data);
    res.status(200).json(updated);
  } catch (e) {
    next(e);
  }
});

export default router;
