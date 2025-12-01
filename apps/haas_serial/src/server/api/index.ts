import { Router } from 'express';
import { fetch } from '../../serial_service.js';

const router: Router = Router();

router.get('/', (_req, res, _next) => {
  res.status(200).json({ message: 'Welcome to the API' });
});

router.post(['/serial/status/:name', '/serial/status'], async (req, res, next) => {
  const { url } = req.body;
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
