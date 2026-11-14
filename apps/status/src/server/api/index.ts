import { createHash, timingSafeEqual } from 'node:crypto';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import machines, { listMachineData } from '../../machines/index.js';
import { emit } from '../socket.io.js';
import stats from './stats.js';

const api = new Hono();

api.get('/', (c) => c.json({ message: 'Welcome to the API' }));

api.get('/machines', (c) =>
  c.json(listMachineData().map((machine, index) => ({ ...machine, index }))),
);

api.get('/machine/:id', (c) => {
  const machine = machines.get(c.req.param('id'));
  if (!machine) return c.notFound();
  return c.json(machine.toJSON());
});

api.route('/stats', stats);

/** Tells every open status board to reload itself. */
api.post('/refresh', bodyLimit({ maxSize: 1024 }), async (c) => {
  const body: { token?: unknown } | null = await c.req.json().catch(() => null);
  if (!isRefreshToken(body?.token)) return c.body(null, 401);
  emit('refresh');
  return c.body(null, 204);
});

function isRefreshToken(token: unknown): boolean {
  const expected = process.env.TOKEN;
  if (!expected || typeof token !== 'string') return false;
  // Hashed so both sides are the same length, which timingSafeEqual needs.
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(token), digest(expected));
}

export default api;
