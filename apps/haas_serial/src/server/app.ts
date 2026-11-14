import { honoLogger } from '@repo/utilities/logger';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import logger from '../logger.js';
import { SerialError } from '../serial_service.js';
import api from './api/index.js';

const app = new Hono();

app.use(honoLogger(logger));

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
