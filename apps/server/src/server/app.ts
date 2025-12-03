import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import morgan from 'morgan';
import { imageDir } from '../directories.js';
import * as logger from '../logger.js';
import api from './api/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: express.Application = express();

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', true);
}

const format = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
app.use(morgan(format, { stream: logger.stream }));
app.use(express.json());

app.use((req, _res, next) => {
  if (req.ips.length) logger.default.info(req.ips.join(', '));
  next();
});

app.use('/api', api);
app.use('/images', express.static(imageDir));

const wwwDir = path.join(__dirname, '../../../www/dist');
logger.default.info(`Serving static files from ${wwwDir}`);

if (process.env.NODE_ENV === 'production') {
  app.get('/', (_req, res, _next) => {
    res.sendFile(path.join(wwwDir, 'index.html'));
  });

  app.use(express.static(wwwDir));

  app.all('*path', (_req, res, _next) => {
    res.sendFile(path.join(wwwDir, 'index.html'));
  });
}

export default app;
