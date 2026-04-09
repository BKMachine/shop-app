import type { ErrorRequestHandler } from 'express';
import { MulterError } from 'multer';
import logger from '../../logger.js';
import HttpError from './httpError.js';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  if (typeof error === 'object' && error && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message) return message;
  }
  return 'Unknown error';
}

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const errorMessage = getErrorMessage(err);
  const stack = err instanceof Error ? err.stack : undefined;
  logger.error(stack ? `${errorMessage}\n${stack}` : errorMessage);

  const httpError =
    err instanceof HttpError
      ? err
      : err instanceof MulterError && err.code === 'LIMIT_FILE_SIZE'
        ? new HttpError(413, 'Image upload too large', { cause: err, expose: true })
        : new HttpError(500, 'Internal server error', { cause: err });
  const message = httpError.expose ? httpError.message : 'Internal server error';

  res.status(httpError.status).json({
    error: message,
    code: httpError.code ?? null,
  });
};

export default errorHandler;
