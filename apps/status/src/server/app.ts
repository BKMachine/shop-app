// import path from 'path';
import cors from 'cors';
import express, { Application } from 'express';
// import morgan from 'morgan';
// import * as logger from '../logger.js';
import api from './api/index.js';

const app: Application = express();

// const format = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
// app.use(morgan(format, { stream: logger.stream }));
app.use(cors());
app.use(express.json());

app.use('/api', api);

// if (process.env.NODE_ENV === 'production') {
//   const wwwDir = path.join(__dirname, '../../../frontend/dist');

//   app.get('/', (req, res, next) => {
//     res.sendFile(path.join(wwwDir, 'index.html'));
//   });

//   app.use(express.static(wwwDir));

//   app.all('*', (req, res, next) => {
//     res.sendFile(path.join(wwwDir, 'index.html'));
//   });
// }

export default app;
