import path from 'path';
import express from 'express';
import morgan from 'morgan';
import * as logger from '../logger';
import api from './api';

const app = express();

if (process.env.NODE_ENV === 'production') {
  app.enabled('trust proxy');
}

const format = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
app.use(morgan(format, { stream: logger.stream }));
app.use(express.json());

app.use('/api', api);

if (process.env.NODE_ENV === 'production') {
  const wwwDir = path.join(__dirname, '../../../www/dist');

  app.get('/', (req, res, next) => {
    res.sendFile(path.join(wwwDir, 'index.html'));
  });

  app.use(express.static(wwwDir));

  app.all('*', (req, res, next) => {
    res.sendFile(path.join(wwwDir, 'index.html'));
  });
}

export default app;
