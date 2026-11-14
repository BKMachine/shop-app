// Stands in for @repo/utilities/logger under Jest. That package only ships ESM, and unit
// tests shouldn't write log output anyway. Mock ../logger.js in a test to assert on logging.
const noop = () => {};

export function createAppLogger() {
  return {
    logger: { debug: noop, info: noop, warn: noop, error: noop },
    stream: { write: noop },
  };
}

export function honoLogger() {
  return (_context: unknown, next: () => Promise<void>) => next();
}
