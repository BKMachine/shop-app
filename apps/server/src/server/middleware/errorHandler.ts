import type { ErrorRequestHandler } from 'express';
import logger from '../../logger.js';
import HttpError from './httpError.js';

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  logger.error(err);

  const httpError =
    err instanceof HttpError ? err : new HttpError(500, 'Internal server error', { cause: err });
  const message = httpError.expose ? httpError.message : 'Internal server error';

  res.status(httpError.status).json({ error: message });
};

export default errorHandler;
