import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import * as z from 'zod';
import { getDepartmentPerformance, InvalidRangeError } from '../../timeseries/performance.js';

const stats = new Hono();

const RangeQuery = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

stats.get(
  '/department-performance',
  zValidator('query', RangeQuery, (result, c) => {
    if (!result.success) return c.json({ error: 'Invalid date.' }, 400);
  }),
  async (c) => {
    try {
      const performance = await getDepartmentPerformance(c.req.valid('query'));
      return c.json({ performance });
    } catch (error) {
      if (error instanceof InvalidRangeError) return c.json({ error: error.message }, 400);
      throw error;
    }
  },
);

export default stats;
