import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import morgan from 'morgan';
import { documentDir, imageDir } from '../directories.js';
import * as logger from '../logger.js';
import {
  activeHttpRequests,
  buildRequestMetricLabels,
  httpRequestDuration,
  httpRequests,
  metricsRegistry,
  shouldTrackRequest,
} from '../metrics.js';
import api from './api/index.js';
import errorHandler from './middleware/errorHandler.js';
import trimRequestStrings from './middleware/trimRequestStrings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRootDir = path.resolve(__dirname, '../..');

const app: express.Application = express();

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', true);
}

const format = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
app.use(morgan(format, { stream: logger.stream }));
app.use((req, res, next) => {
  if (!shouldTrackRequest(req.path)) {
    next();
    return;
  }

  activeHttpRequests.inc();
  const endTimer = httpRequestDuration.startTimer();
  let completed = false;

  const finalizeRequestMetrics = () => {
    if (completed) {
      return;
    }

    completed = true;
    const labels = buildRequestMetricLabels(req, res);
    httpRequests.inc(labels);
    endTimer(labels);
    activeHttpRequests.dec();
  };

  res.once('finish', finalizeRequestMetrics);
  res.once('close', finalizeRequestMetrics);

  next();
});
app.use(express.json());

app.use((req, _res, next) => {
  if (req.ips.length) logger.default.info(req.ips.join(', '));
  next();
});

const wwwDir = path.join(serverRootDir, '../', 'www', 'dist');
const downloadsDir = path.join(serverRootDir, 'public', 'downloads');

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/metrics', async (_req, res, next) => {
  try {
    res.set('Content-Type', metricsRegistry.contentType);
    res.send(await metricsRegistry.metrics());
  } catch (error) {
    next(error);
  }
});

app.use('/api', trimRequestStrings, api);
app.use('/images', express.static(imageDir));
app.use('/documents', express.static(documentDir));
app.use('/downloads', express.static(downloadsDir));

if (process.env.NODE_ENV === 'production') {
  app.get('/', (_req, res, _next) => {
    res.sendFile(path.join(wwwDir, 'index.html'));
  });

  app.use(express.static(wwwDir));

  app.all('*path', (_req, res, _next) => {
    res.sendFile(path.join(wwwDir, 'index.html'));
  });
}

app.use(errorHandler);

export default app;
