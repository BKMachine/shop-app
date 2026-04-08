import express from 'express';
import morgan from 'morgan';
import * as logger from '../logger.js';
import api from './api/index.js';
import errorHandler from './middleware/errorHandler.js';

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
app.use(errorHandler);

export default app;
