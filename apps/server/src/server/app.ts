import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import morgan from 'morgan';
import { documentDir, imageDir } from '../directories.js';
import * as logger from '../logger.js';
import api from './api/index.js';
import errorHandler from './middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRootDir = path.resolve(__dirname, '../..');

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
app.use('/documents', express.static(documentDir));

const downloadsDir = path.join(serverRootDir, 'public', 'downloads');
app.use('/downloads', express.static(downloadsDir));
logger.default.info(`Serving download files from ${downloadsDir}`);

if (process.env.NODE_ENV === 'production') {
  const wwwDir = path.join(serverRootDir, '../', 'www', 'dist');

  app.get('/', (_req, res, _next) => {
    res.sendFile(path.join(wwwDir, 'index.html'));
  });

  app.use(express.static(wwwDir));
  logger.default.info(`Serving static files from ${wwwDir}`);

  app.all('*path', (_req, res, _next) => {
    res.sendFile(path.join(wwwDir, 'index.html'));
  });
}

app.use(errorHandler);

export default app;
