import { createHash, timingSafeEqual } from 'node:crypto';
import { zValidator } from '@hono/zod-validator';
import { Hono, type MiddlewareHandler } from 'hono';
import * as z from 'zod';
import { isAllowedHost } from '../../config.js';
import { type Address, readStatus } from '../../serial_service.js';

const api = new Hono();

const sha256 = (text: string) => createHash('sha256').update(text).digest();

// This port is published, and it connects to whatever address a request gives it.
const requireApiKey: MiddlewareHandler = async (c, next) => {
  const expected = process.env.HAAS_SERIAL_API_KEY;
  const provided = c.req.header('x-api-key');
  // Hashing gives equal lengths, which timingSafeEqual requires.
  if (expected && provided && timingSafeEqual(sha256(provided), sha256(expected))) {
    return next();
  }
  return c.json({ error: 'Missing or invalid API key' }, 401);
};

/** The machine's serial server as a URL, of which only the host and port are used. */
function parseAddress(url: string): Address | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  // An IPv6 host comes in brackets, which a socket doesn't take.
  const host = parsed.hostname.replace(/^\[|\]$/g, '');
  const port = Number(parsed.port);
  return host && port ? { host, port } : null;
}

const StatusRequest = z.object({
  url: z.string().transform((url, context) => {
    const address = parseAddress(url);
    if (address) return address;
    context.addIssue({ code: 'custom', message: 'Not a URL with a host and port' });
    return z.NEVER;
  }),
});

api.get('/', (c) => c.json({ message: 'Welcome to the API' }));

api.use('/serial/*', requireApiKey);

// The name isn't used here. It shows which machine a request was for in the access log.
api.post(
  '/serial/status/:name?',
  zValidator('json', StatusRequest, (result, c) => {
    if (!result.success) {
      return c.json({ error: 'Request body needs a url with a host and port' }, 400);
    }
  }),
  async (c) => {
    const { url: address } = c.req.valid('json');
    if (!isAllowedHost(address.host)) {
      return c.json({ error: `Host ${address.host} is not one this service may connect to` }, 403);
    }
    return c.json({ data: await readStatus(address) });
  },
);

export default api;
