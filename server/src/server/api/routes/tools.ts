import express from 'express';
import Tools from '../../../database/lib/tool';

const router = express.Router();

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
    const result = await Tools.findById(id);
    res.status(200).json(result);
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

export default router;
