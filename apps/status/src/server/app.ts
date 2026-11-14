import { honoLogger } from '@repo/utilities/logger';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { secureHeaders } from 'hono/secure-headers';
import { corsOrigin } from '../config.js';
import logger from '../logger.js';
import api from './api/index.js';

const app = new Hono();

app.use(honoLogger(logger));
app.use(cors({ origin: corsOrigin }));
// The status board is served from another origin, so it has to be allowed to read responses.
app.use(secureHeaders({ crossOriginResourcePolicy: 'cross-origin' }));

app.get('/health', (c) => c.json({ status: 'ok' }));

app.route('/api', api);

app.notFound((c) => c.json({ error: 'Not found' }, 404));

app.onError((error, c) => {
  if (error instanceof HTTPException) return c.json({ error: error.message }, error.status);
  logger.error('Request failed:', error);
  return c.json({ error: 'Internal server error' }, 500);
});

export default app;
