import * as database from './database/index.js';
import {
  ensureRoutingOperationIds,
  migratePartRoutingFromCycleTimes,
} from './database/lib/part/part_service.js';
import ScheduleService from './database/lib/schedule/schedule_service.js';
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
  const partsGivenOpIds = await ensureRoutingOperationIds();
  if (partsGivenOpIds) logger.info(`Gave routing ops ids on ${partsGivenOpIds} parts.`);
  const bookingsLinked = await ScheduleService.backfillRoutingIds();
  if (bookingsLinked) logger.info(`Linked ${bookingsLinked} schedule bookings to routing op ids.`);
  server.start();
}

export async function stop(): Promise<void> {
  await server.stop();
  await database.disconnect();
}
