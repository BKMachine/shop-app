import * as path from 'node:path';
import chalk, { type ChalkInstance } from 'chalk';
import type { MiddlewareHandler } from 'hono';
import { createLogger, format, type Logger, transports } from 'winston';

const logsDir = path.join(process.cwd(), '../../', 'logs');

export type MyLogger = Logger;

/**
 * Creates a Winston logger with the module name as a log prefix.
 */
export function create(moduleName: string): MyLogger {
  const logger = createLogger({
    level: 'http',
    format: format.combine(format.timestamp(), format.json()),
    transports: [
      new transports.File({
        filename: path.join(logsDir, `${moduleName}-error.log`),
        level: 'error',
      }),
      new transports.File({
        filename: path.join(logsDir, `${moduleName}-combined.log`),
      }),
      new transports.Console({
        format: format.combine(
          format.colorize(),
          format.printf((info) => {
            return `${info.timestamp} [${info.level}]: ${info.message}`;
          }),
        ),
      }),
    ],
  });

  return logger;
}

export function honoLogger(logger: MyLogger): MiddlewareHandler {
  return async (c, next) => {
    const start = Date.now();
    await next();
    const duration = Date.now() - start;

    const colorMap: Record<string, ChalkInstance> = {
      GET: chalk.cyan,
      POST: chalk.yellow,
      PUT: chalk.blue,
      DELETE: chalk.red,
    };

    const isConsole = logger.transports.some((t) => t instanceof transports.Console);

    // Apply colors to method and response time
    const methodColor = colorMap[c.req.method] || chalk.cyan;
    const method = isConsole ? methodColor(c.req.method) : c.req.method;
    const responseTime = isConsole ? chalk.green(`${duration}ms`) : `${duration}ms`;

    logger.http(`${method} ${c.req.path} - ${responseTime}`);
  };
}
