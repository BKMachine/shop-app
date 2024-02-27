import express from 'express';
import ToolService from '../../../database/lib/tool';

const router = express.Router();

router.get('/tools', async (req, res, next) => {
  try {
    const data = await ToolService.list();
    res.status(200).json(data);
  } catch (e) {
    next(e);
  }
});

router.get('/tools/:id', async (req, res, next) => {
  const { id } = req.params;
  try {
    const result = await ToolService.findById(id);
    res.status(200).json(result);
  } catch (e) {
    next(e);
  }
});

router.post('/tools', async (req, res, next) => {
  const { data }: { data: Tool | undefined } = req.body;
  if (!data) {
    res.sendStatus(400);
    return;
  }
  try {
    const doc = await ToolService.add(data);
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
    await ToolService.update(data);
    res.sendStatus(204);
  } catch (e) {
    next(e);
  }
});

export default router;
