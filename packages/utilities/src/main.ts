import type { Logger } from 'winston';

/**
 * Main is the application's entry point
 * and handles the main startup and shutdown logic
 * from termination signals.
 *
 * Along with uncaught and unexpected error handling.
 */
export default function main(
  app: { start: () => Promise<void>; stop: () => Promise<void> },
  logger: Logger,
): void {
  async function startApp() {
    logger.info('Starting application...');

    try {
      await app.start();
      logger.info('Application started successfully.');
    } catch (error) {
      logger.error('Failed to start the application:', error);
      process.exit(1);
    }
  }

  async function stopApp() {
    logger.info('Shutting down application...');

    try {
      await app.stop();
      logger.info('Application shut down gracefully.');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  }

  // Handle termination signals
  const shutdownSignals = ['SIGINT', 'SIGTERM'];
  shutdownSignals.forEach((signal) => {
    process.on(signal, () => {
      logger.info(`Received ${signal}, shutting down...`);
      stopApp();
    });
  });

  // Handle unexpected errors
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Promise Rejection:', reason);
    process.exit(1);
  });

  startApp();
}
