import * as database from './database/index.js';
import {
  ensureRoutingOperationIds,
  migratePartRoutingFromCycleTimes,
} from './database/lib/part/part_service.js';
import PrinterService from './database/lib/printer/printer_service.js';
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
  const printersAdded = await PrinterService.seedDefaults();
  if (printersAdded) logger.info(`Added ${printersAdded} default printers.`);
  server.start();
}

export async function stop(): Promise<void> {
  await server.stop();
  // After the server stops taking requests, so nothing is queued behind the flush.
  const flushedAudits = await ScheduleService.flushAudits();
  if (flushedAudits) logger.info(`Flushed queued schedule audits for ${flushedAudits} bookings.`);
  await database.disconnect();
}
