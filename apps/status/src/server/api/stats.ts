import express, { type Router } from 'express';
import {
  type DepartmentPerformanceRange,
  getDepartmentPerformance,
} from '../../timeseries/performance.js';

const router: Router = express.Router();

function parseDate(value: unknown): Date | undefined {
  if (typeof value !== 'string' || value.trim() === '') {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }

  return parsed;
}

function getRange(query: Record<string, unknown>): DepartmentPerformanceRange {
  return {
    from: parseDate(query.from),
    to: parseDate(query.to),
  };
}

router.get('/department-performance', async (req, res, next) => {
  try {
    const performance = await getDepartmentPerformance(
      getRange(req.query as Record<string, unknown>),
    );
    res.status(200).json({ performance });
  } catch (e) {
    next(e);
  }
});

export default router;
