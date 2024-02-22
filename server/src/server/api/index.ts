import { Router } from 'express';
import ToolRoutes from './tools';

const router = Router();

router.get('/', (req, res, next) => {
  res.status(200).json({ message: 'Welcome to the API' });
});

router.use('/tools', ToolRoutes);

export default router;
