import * as path from 'node:path';
import * as util from 'node:util';
import chalk, { type ChalkInstance } from 'chalk';
import type { Context, MiddlewareHandler } from 'hono';
import { createLogger, format, type Logger, transports } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

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
 * A log file that starts afresh each day, or sooner if the day's file gets large. Earlier files
 * are kept gzipped, such as `status-combined-2026-03-02.log.gz`, and deleted once they are 90
 * days old.
 */
function createRotatingFile(moduleName: string, kind: 'error' | 'combined') {
  return new DailyRotateFile({
    dirname: logsDir,
    filename: `${moduleName}-${kind}-%DATE%.log`,
    // Named after the log it tracks, as the default name is a hash that says nothing.
    auditFile: path.join(logsDir, `.${moduleName}-${kind}-audit.json`),
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '90d',
    format: format.combine(createBaseFormat(), format.json()),
    ...(kind === 'error' ? { level: 'error' } : {}),
  });
}

/**
 * Creates a Winston logger with the module name as a log prefix.
 */
export function create(moduleName: string): MyLogger {
  const logger = createLogger({
    level: 'http',
    transports: [
      createRotatingFile(moduleName, 'error'),
      createRotatingFile(moduleName, 'combined'),
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

/**
 * Creates an app's default logger plus a morgan/hono-compatible write stream
 * that forwards lines to it at `info` level.
 */
export function createAppLogger(moduleName: string, options: { debug?: boolean } = {}) {
  const logger = create(moduleName);
  if (options.debug) logger.level = 'debug';

  return {
    logger,
    stream: {
      write(text: string) {
        logger.info(text.trim());
      },
    },
  };
}

/**
 * Logs each request once it has been answered. `skip` leaves out the ones not worth a line, such
 * as health checks, and can go by the response as well as the request.
 */
export function honoLogger(
  logger: MyLogger,
  options: { skip?: (c: Context) => boolean } = {},
): MiddlewareHandler {
  return async (c, next) => {
    const start = Date.now();
    await next();
    if (options.skip?.(c)) return;
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
