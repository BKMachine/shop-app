import { Router } from 'express';
import Tools from '../../../database/lib/tool/tool_service.js';
import HttpError from '../../middleware/httpError.js';
import requireKnownDevice from '../../middleware/requireKnownDevices.js';

const router: Router = Router();

router.get('/tools', async (_req, res, next) => {
  try {
    const data = await Tools.list();
    res.status(200).json(data);
  } catch (e) {
    next(e);
  }
});

router.get('/tools/reorders', async (_req, res, next) => {
  try {
    const reorders = await Tools.getAutoReorders();
    res.status(200).json(reorders);
  } catch (e) {
    next(e);
  }
});

router.get('/tools/:id', async (req, res, next) => {
  const { id } = req.params;
  try {
    const tool = await Tools.findById(id);
    if (!tool) return next(new HttpError(404, 'Tool not found.'));
    res.status(200).json(tool);
  } catch (e) {
    next(e);
  }
});

router.post('/tools', requireKnownDevice, async (req, res, next) => {
  const { data }: { data: ToolDoc | undefined } = req.body;
  if (!data) return next(new HttpError(400, 'No tool data provided.'));
  if (!req.device) return next(new HttpError(401, 'Unauthorized: device not recognized.'));
  try {
    const doc = await Tools.add(data, req.device._id.toString());
    res.status(200).json(doc);
  } catch (e) {
    next(e);
  }
});

router.put('/tools', requireKnownDevice, async (req, res, next) => {
  const { data }: { data: ToolDoc | undefined } = req.body;
  if (!data) return next(new HttpError(400, 'No tool data provided.'));
  if (!req.device) return next(new HttpError(401, 'Unauthorized: device not recognized.'));
  try {
    const response = await Tools.update(data, req.device._id.toString());
    res.status(200).json(response);
  } catch (e) {
    next(e);
  }
});

router.put('/tools/pick', requireKnownDevice, async (req, res, next) => {
  const { scanCode }: { scanCode: string | undefined } = req.body;
  if (!scanCode) return next(new HttpError(400, 'scanCode is required.'));
  if (!req.device) return next(new HttpError(401, 'Unauthorized: device not recognized.'));
  try {
    const { status, tool } = await Tools.pick(scanCode, req.device._id.toString());
    res.status(status).json(tool);
  } catch (e) {
    next(e);
  }
});

router.put('/tools/stock', requireKnownDevice, async (req, res, next) => {
  const { id, amount }: { id: string; amount: number } = req.body;
  if (!id || amount === undefined || amount === null) {
    return next(new HttpError(400, 'id and amount are required.'));
  }
  if (!req.device) return next(new HttpError(401, 'Unauthorized: device not recognized.'));
  try {
    const { status, tool } = await Tools.stock(id, amount, req.device._id.toString());
    res.status(status).json(tool);
  } catch (e) {
    next(e);
  }
});

router.get('/tools/info/:scanCode', async (req, res, next) => {
  const { scanCode } = req.params;
  try {
    const tool = await Tools.findByScanCode(scanCode);
    if (!tool) return next(new HttpError(404, 'Tool not found.'));
    res.status(200).json(tool);
  } catch (e) {
    next(e);
  }
});

export default router;
