// Stands in for @repo/utilities/logger under Jest. That package only ships ESM, and unit
// tests shouldn't write log output anyway. Mock ../logger.js in a test to assert on logging.
const noop = () => {};

export function createAppLogger() {
  return {
    logger: { debug: noop, info: noop, warn: noop, error: noop },
    stream: { write: noop },
  };
}

interface Context {
  req: { method: string; path: string };
}

/** Logs the requests the app doesn't skip, so a test can see which those are. */
export function honoLogger(
  logger: { http?: (message: string) => void },
  options: { skip?: (c: Context) => boolean } = {},
) {
  return async (c: Context, next: () => Promise<void>) => {
    await next();
    if (!options.skip?.(c)) logger.http?.(`${c.req.method} ${c.req.path}`);
  };
}
