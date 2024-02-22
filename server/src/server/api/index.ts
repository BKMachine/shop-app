import { Router } from 'express';
import ToolService from '../../database/lib/tools/tool';
import ToolRoutes from './tools';

const router = Router();

router.get('/', (req, res, next) => {
  res.status(200).json({ message: 'Welcome to the API' });
});

router.post('/scan', async (req, res, next) => {
  const { query } = req.body;
  if (!query) {
    res.sendStatus(400);
    return;
  }
  try {
    const tools = await ToolService.search(query as string);
    const response = {
      tools,
    };
    res.status(200).json(response);
  } catch (e) {
    next(e);
  }
});
router.use('/tools', ToolRoutes);

export default router;
