import * as database from './database/index.js';
import { migratePartRoutingFromCycleTimes } from './database/lib/part/part_service.js';
import logger from './logger.js';
import * as server from './server/index.js';
import initImageCleanupCron from './services/image_cleanup_service.js';

export async function start(): Promise<void> {
  initImageCleanupCron();
  await database.connect();
  const migratedRoutingCount = await migratePartRoutingFromCycleTimes();
  if (migratedRoutingCount) {
    logger.info(`Converted cycle times to routing for ${migratedRoutingCount} parts.`);
  }
  server.start();
}

export async function stop(): Promise<void> {
  await server.stop();
  await database.disconnect();
}
