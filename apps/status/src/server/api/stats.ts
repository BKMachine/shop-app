import express, { Router } from 'express';
import { getHourlyPerformance, getHourlyRate } from '../../elastic/performance.js';

const router: Router = express.Router();

router.get('/hourly', async (req, res, next) => {
  try {
    const rate = await getHourlyRate();
    const performance = await getHourlyPerformance();
    res.status(200).json({ rate, performance });
  } catch (e) {
    next(e);
  }
});

export default router;
