import { SERVER_DEVICE_ID } from '@repo/utilities/constants';
import { CronJob } from 'cron';
import ImageService from '../database/lib/image/image_service.js';

function init() {
  // Image cleanup job - removes expired temporary images daily at 2 AM
  new CronJob(
    '0 0 2 * * *', // At 02:00 AM, every day
    () => {
      ImageService.cleanupExpired(SERVER_DEVICE_ID);
    },
    null,
    true,
    'America/Denver',
  );
}

export default init;
