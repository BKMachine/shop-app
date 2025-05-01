import { Router } from 'express';
import Tools from '../../../database/lib/tool/tool_service.js';

const router: Router = Router();

router.get('/tools', async (req, res, next) => {
  try {
    const data = await Tools.list();
    res.status(200).json(data);
  } catch (e) {
    next(e);
  }
});

router.get('/tools/reorders', async (req, res, next) => {
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
    if (!tool) {
      res.sendStatus(404);
      return;
    }
    res.status(200).json(tool);
  } catch (e) {
    next(e);
  }
});

router.post('/tools', async (req, res, next) => {
  const { data }: { data: ToolDoc | undefined } = req.body;
  if (!data) {
    res.sendStatus(400);
    return;
  }
  try {
    const doc = await Tools.add(data);
    res.status(200).json(doc);
  } catch (e) {
    next(e);
  }
});

router.put('/tools', async (req, res, next) => {
  const { data }: { data: ToolDoc | undefined } = req.body;
  if (!data) {
    res.sendStatus(400);
    return;
  }
  try {
    const response = await Tools.update(data);
    res.status(200).json(response);
  } catch (e) {
    next(e);
  }
});

router.put('/tools/pick', async (req, res, next) => {
  const { scanCode }: { scanCode: string | undefined } = req.body;
  if (!scanCode) {
    res.sendStatus(400);
    return;
  }
  try {
    const { status, tool } = await Tools.pick(scanCode);
    res.status(status).json(tool);
  } catch (e) {
    next(e);
  }
});

router.put('/tools/stock', async (req, res, next) => {
  const { id, amount }: { id: string; amount: number } = req.body;
  if (!id || !amount) {
    res.sendStatus(400);
    return;
  }
  try {
    const { status, tool } = await Tools.stock(id, amount);
    res.status(status).json(tool);
  } catch (e) {
    next(e);
  }
});

router.get('/tools/info/:scanCode', async (req, res, next) => {
  const { scanCode } = req.params;
  try {
    const tool = await Tools.findByScanCode(scanCode);
    if (!tool) {
      res.sendStatus(404);
      return;
    }
    res.status(200).json(tool);
  } catch (e) {
    next(e);
  }
});

export default router;
