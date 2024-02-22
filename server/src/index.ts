import app from './app';
import logger from './logger';

logger.info('Application starting...');

app
  .start()
  .then(() => {
    logger.info('Startup complete');
  })
  .catch((e) => {
    logger.error(e.message);
  });

const signals: NodeJS.Signals[] = ['SIGHUP', 'SIGINT', 'SIGTERM'];

signals.forEach((signal) => {
  process.on(signal, () => {
    shutdown(signal);
  });
});

const shutdown = (signal: NodeJS.Signals) => {
  logger.info(`Received a ${signal} signal. Attempting graceful shutdown...`);
  app.stop().finally(() => {
    logger.info(`Shutdown completed. Exiting.`);
    process.exit(0);
  });
};

process.on('uncaughtException', (err) => {
  logException('uncaughtException', err);
});

process.on('unhandledRejection', (err: Error) => {
  logException('unhandledRejection', err);
});

function logException(type: string, err: Error) {
  // TODO: better logging
  if (err) {
    logger.error(err);
    if (err.stack) {
    } else if (err.message) {
    } else {
    }
  }
}
