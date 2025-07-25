import { Router } from 'express';
import machines from '../../machines/index.js';
import { emit } from '../socket.io.js';
import MachineRoutes from './machine.js';
import StatsRoutes from './stats.js';

const router: Router = Router();

router.get('/', (_req, res, _next) => {
  res.status(200).json({ message: 'Welcome to the API' });
});

router.use('/machine', MachineRoutes);
router.use('/stats', StatsRoutes);

router.get('/machines', async (_req, res, next) => {
  try {
    const response = [];
    let id = 0;
    for (const [, value] of machines) {
      const machine = value.getMachine();
      response.push({ ...machine, index: id++ });
    }
    res.status(200).json(response);
  } catch (e) {
    next(e);
  }
});

router.post('/refresh', (req, res, _next) => {
  const { token } = req.body;
  if (!process.env.TOKEN || !token || token !== process.env.TOKEN) {
    res.sendStatus(401);
    return;
  }
  emit('refresh');
  res.sendStatus(204);
});

export default router;
