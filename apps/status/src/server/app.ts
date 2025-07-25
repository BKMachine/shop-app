import cors from 'cors';
import express, { Application } from 'express';
import morgan from 'morgan';
import * as logger from '../logger.js';
import api from './api/index.js';

const app: Application = express();

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', true);
}

const format = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
app.use(
  cors({
    origin: '*',
  }),
);
app.use(morgan(format, { stream: logger.stream }));
app.use(express.json());

app.use('/api', api);

export default app;
