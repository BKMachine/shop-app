import { Router } from 'express';
import multer from 'multer';
import * as z from 'zod';
import { isValidId } from '../../../database/index.js';
import PrinterService from '../../../database/lib/printer/printer_service.js';
import logger from '../../../logger.js';
import { IppError, printPdf } from '../../../services/ipp_service.js';
import {
  buildPhotoPdf,
  MAX_CAPTION_LENGTH,
  MAX_TIMESTAMP_LENGTH,
  UnsupportedImageError,
} from '../../../services/photo_print_service.js';
import mongoObjectId from '../../../utilities/mongoObjectId.js';
import HttpError from '../../middleware/httpError.js';
import { narrowKnownDevice, requireKnownDevice } from '../../middleware/knownDevices.js';

const router: Router = Router();

const MAX_PRINT_IMAGE_BYTES = 25 * 1024 * 1024;

// Photos are printed straight from memory and never stored.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PRINT_IMAGE_BYTES, files: 1 },
});

const hostnamePattern =
  /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/;

const PrinterFieldsSchema = z.strictObject({
  name: z.string().trim().min(1).max(40),
  hostname: z.string().trim().toLowerCase().regex(hostnamePattern, 'Invalid hostname'),
  showInAndroid: z.boolean(),
});

const CreatePrinterRequest = z.strictObject({
  printer: PrinterFieldsSchema,
});

const UpdatePrinterRequest = z.strictObject({
  printer: PrinterFieldsSchema.extend({
    _id: mongoObjectId,
    __v: z.number().optional(),
  }),
});

const PrintPhotoRequest = z.object({
  caption: z.string().trim().max(MAX_CAPTION_LENGTH).optional(),
  timestamp: z.string().trim().min(1).max(MAX_TIMESTAMP_LENGTH),
});

function isDuplicateKeyError(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
}

router.get('/printers', async (_req, res, next) => {
  try {
    const printers = await PrinterService.list();
    res.status(200).json(printers);
  } catch (e) {
    next(e);
  }
});

router.post('/printers', requireKnownDevice, async (req, res, next) => {
  narrowKnownDevice(req);
  const { success, data, error } = CreatePrinterRequest.safeParse(req.body);
  if (!success) {
    logger.error('Invalid printer data provided:', error.message);
    return next(new HttpError(400, 'Invalid printer data provided.'));
  }

  try {
    const printer = await PrinterService.create(data.printer);
    res.status(200).json(printer);
  } catch (e) {
    if (isDuplicateKeyError(e)) {
      return next(new HttpError(409, 'A printer with that name or hostname already exists.'));
    }
    next(e);
  }
});

router.put('/printers', requireKnownDevice, async (req, res, next) => {
  narrowKnownDevice(req);
  const { success, data, error } = UpdatePrinterRequest.safeParse(req.body);
  if (!success) {
    logger.error('Invalid printer data provided:', error.message);
    return next(new HttpError(400, 'Invalid printer data provided.'));
  }

  try {
    const printer = await PrinterService.update(data.printer);
    res.status(200).json(printer);
  } catch (e) {
    if (isDuplicateKeyError(e)) {
      return next(new HttpError(409, 'A printer with that name or hostname already exists.'));
    }
    next(e);
  }
});

// Print a photo from the Android app: multipart with `image` (JPEG or PNG),
// `timestamp` (the capture time in the device's local time) and optional `caption`.
router.post(
  '/printers/:id/print',
  requireKnownDevice,
  upload.single('image'),
  async (req, res, next) => {
    narrowKnownDevice(req);

    const { id } = req.params;
    if (!isValidId(id)) return next(new HttpError(400, 'Invalid printer id.'));
    if (!req.file) return next(new HttpError(400, 'No image uploaded.'));

    const { success, data, error } = PrintPhotoRequest.safeParse(req.body ?? {});
    if (!success) {
      logger.error('Invalid photo print request:', error.message);
      return next(new HttpError(400, 'Invalid photo print request.'));
    }

    try {
      const printer = await PrinterService.findById(id);
      if (!printer) return next(new HttpError(404, 'Printer not found.'));

      const pdf = await buildPhotoPdf({
        image: req.file.buffer,
        caption: data.caption,
        timestamp: data.timestamp,
      });

      const deviceName = req.device.displayName || req.deviceId;
      const result = await printPdf(printer.hostname, pdf, {
        jobName: data.caption ? `Photo - ${data.caption}` : 'Photo',
        userName: deviceName,
      });

      logger.info(
        `Photo printed on ${printer.name} (${printer.hostname}) for device ${deviceName}`,
      );
      res.status(200).json({ printer: printer.name, jobId: result.jobId });
    } catch (e) {
      if (e instanceof UnsupportedImageError) return next(new HttpError(415, e.message));
      if (e instanceof IppError) {
        logger.warn(`Photo print failed: ${e.message}`);
        return next(new HttpError(502, e.message, { expose: true }));
      }
      next(e);
    }
  },
);

export default router;
