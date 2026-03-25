import * as database from './database/index.js';
import * as server from './server/index.js';
import initImageCleanupCron from './services/image_cleanup_service.js';

export async function start(): Promise<void> {
  initImageCleanupCron();
  await database.connect();
  server.start();
}

export async function stop(): Promise<void> {
  await server.stop();
  await database.disconnect();
}
