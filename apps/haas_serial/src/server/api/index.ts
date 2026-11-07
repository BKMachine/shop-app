import { createHash, timingSafeEqual } from 'node:crypto';
import { type RequestHandler, Router } from 'express';
import { fetch } from '../../serial_service.js';

const router: Router = Router();

const sha256 = (text: string) => createHash('sha256').update(text).digest();

// This port is published, and it connects to whatever address a request gives it.
const requireApiKey: RequestHandler = (req, res, next) => {
  const expected = process.env.HAAS_SERIAL_API_KEY;
  const provided = req.get('x-api-key');
  // Hashing gives equal lengths, which timingSafeEqual requires.
  if (expected && provided && timingSafeEqual(sha256(provided), sha256(expected))) {
    next();
    return;
  }
  res.status(401).json({ error: 'Missing or invalid API key' });
};

router.get('/', (_req, res, _next) => {
  res.status(200).json({ message: 'Welcome to the API' });
});

router.use('/serial', requireApiKey);

router.post(['/serial/status/:name', '/serial/status'], async (req, res, next) => {
  const { url } = req.body;
  if (!url) {
    res.status(400).json({ error: 'Missing url in request body' });
    return;
  }
  try {
    const responses = await fetch(url);
    res.status(200).json({ data: responses });
  } catch (e) {
    if (e && (e as any).status) {
      res.status((e as any).status).json({ error: (e as any).message });
    } else {
      next(e);
    }
  }
});

export default router;
