import { Router } from 'express';
import LabelRoutes from './routes/labels.js';
import ProcessRoutes from './routes/process.js';

const router: Router = Router();

router.get('/', (_req, res) => {
  res.status(200).json({ message: 'Welcome to the image processor API' });
});

router.use('/labels', LabelRoutes);
router.use('/process', ProcessRoutes);

export default router;
