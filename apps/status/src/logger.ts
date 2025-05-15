import path from 'path';
import { createLogger, format, transports } from 'winston';
import { logDir } from './directories.js';

const { combine, timestamp, colorize, printf } = format;

const logger = createLogger({
  level: 'http',
  format: combine(timestamp(), format.json()),
  transports: [
    new transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
    }),
    new transports.File({
      filename: path.join(logDir, 'combined.log'),
    }),
    new transports.Console({
      format: combine(
        colorize(),
        printf((info) => {
          return `${info.timestamp} [${info.level}]: ${info.message}`;
        }),
      ),
    }),
  ],
});

export default logger;
