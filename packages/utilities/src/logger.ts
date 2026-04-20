import * as path from 'node:path';
import * as util from 'node:util';
import chalk, { type ChalkInstance } from 'chalk';
import type { MiddlewareHandler } from 'hono';
import { createLogger, format, type Logger, transports } from 'winston';

const logsDir = path.join(process.cwd(), '../../', 'logs');
const splatSymbol = Symbol.for('splat');
const inspectOptions = {
  colors: false,
  depth: null,
};

export type MyLogger = Logger;

function stringifyLogArgument(arg: unknown): unknown {
  if (arg instanceof Error) {
    return arg.stack ?? `${arg.name}: ${arg.message}`;
  }

  return arg;
}

function formatLogArguments(args: unknown[]): string {
  if (args.length === 0) {
    return '';
  }

  return util.formatWithOptions(inspectOptions, ...args.map(stringifyLogArgument));
}

function createConsoleLikeFormat() {
  return format((info) => {
    const splat = Array.isArray(info[splatSymbol]) ? [...info[splatSymbol]] : [];
    const args = [info.message, ...splat];
    const errorArg = args.find((arg) => arg instanceof Error);

    info.message = formatLogArguments(args);

    if (errorArg instanceof Error) {
      info.stack = errorArg.stack ?? `${errorArg.name}: ${errorArg.message}`;
    }

    return info;
  })();
}

function createBaseFormat() {
  return format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    createConsoleLikeFormat(),
  );
}

/**
 * Creates a Winston logger with the module name as a log prefix.
 */
export function create(moduleName: string): MyLogger {
  const logger = createLogger({
    level: 'http',
    transports: [
      new transports.File({
        filename: path.join(logsDir, `${moduleName}-error.log`),
        level: 'error',
        format: format.combine(createBaseFormat(), format.json()),
      }),
      new transports.File({
        filename: path.join(logsDir, `${moduleName}-combined.log`),
        format: format.combine(createBaseFormat(), format.json()),
      }),
      new transports.Console({
        format: format.combine(
          createBaseFormat(),
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
