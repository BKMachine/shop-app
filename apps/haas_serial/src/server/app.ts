import { honoLogger } from '@repo/utilities/logger';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import logger from '../logger.js';
import { SerialError } from '../serial_service.js';
import api from './api/index.js';

const app = new Hono();

/**
 * Requests that arrive constantly and say nothing new: the container's health check, and each
 * poll of a machine, which the serial service logs only when the machine stops or starts replying.
 */
function isRoutine(path: string, status: number): boolean {
  if (path === '/health') return true;
  return path.startsWith('/api/serial/status') && [200, 502, 503, 504].includes(status);
}

app.use(honoLogger(logger, { skip: (c) => isRoutine(c.req.path, c.res.status) }));

app.get('/health', (c) => c.json({ status: 'ok' }));

app.route('/api', api);

app.notFound((c) => c.json({ error: 'Not found' }, 404));

app.onError((error, c) => {
  if (error instanceof SerialError) return c.json({ error: error.message }, error.status);
  if (error instanceof HTTPException) return c.json({ error: error.message }, error.status);
  logger.error('Request failed:', error);
  return c.json({ error: 'Internal server error' }, 500);
});

export default app;
