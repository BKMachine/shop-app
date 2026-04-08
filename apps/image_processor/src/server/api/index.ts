import { Router } from 'express';
import ProcessRoutes from './routes/process.js';

const router: Router = Router();

router.get('/', (_req, res) => {
  res.status(200).json({ message: 'Welcome to the image processor API' });
});

router.use('/process', ProcessRoutes);

export default router;
