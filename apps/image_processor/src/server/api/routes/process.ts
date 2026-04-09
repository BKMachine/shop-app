import path from 'node:path';
import { type Response, Router } from 'express';
import multer, { MulterError } from 'multer';
import sharp from 'sharp';
import { removeImageBackground } from '../../../services/background_removal_service.js';
import { autoAlignImage } from '../../../services/image_auto_align_service.js';
import { autoCropImage } from '../../../services/image_auto_crop_service.js';
import type {
  BackgroundRemovalBackend,
  BackgroundRemovalModel,
  InputImage,
  ProcessedImage,
} from '../../../services/image_processing_types.js';
import { rotateImage } from '../../../services/image_rotation_service.js';
import HttpError from '../../middleware/httpError.js';

const router: Router = Router();
const supportedUploadMimeTypes = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (!supportedUploadMimeTypes.has(file.mimetype)) {
      cb(new HttpError(415, 'Unsupported file type', { expose: true }));
      return;
    }

    cb(null, true);
  },
});

function getMimeTypeForSharpFormat(format: string | undefined): string | null {
  if (format === 'jpeg') return 'image/jpeg';
  if (format === 'png') return 'image/png';
  if (format === 'webp') return 'image/webp';
  if (format === 'gif') return 'image/gif';
  return null;
}

async function getUploadedImage(file: Express.Multer.File | undefined): Promise<InputImage> {
  if (!file) {
    throw new HttpError(400, 'image file is required');
  }

  const normalizedMimeType = file.mimetype.trim().toLowerCase().split(';')[0] ?? '';
  const filenameExtension = path.extname(file.originalname).toLowerCase();

  try {
    const metadata = await sharp(file.buffer, { animated: true, failOn: 'none' }).metadata();
    if (
      metadata.format === 'gif' ||
      normalizedMimeType === 'image/gif' ||
      filenameExtension === '.gif'
    ) {
      const parsedName = path.parse(file.originalname);

      return {
        buffer: await sharp(file.buffer, { animated: true, failOn: 'none', pages: 1 })
          .png()
          .toBuffer(),
        filename: `${parsedName.name || 'image'}.png`,
        mimeType: 'image/png',
      };
    }

    return {
      buffer: file.buffer,
      filename: file.originalname,
      mimeType: getMimeTypeForSharpFormat(metadata.format) || file.mimetype,
    };
  } catch {
    return {
      buffer: file.buffer,
      filename: file.originalname,
      mimeType: file.mimetype,
    };
  }
}

function isBackgroundRemovalModel(value: string | undefined): value is BackgroundRemovalModel {
  return value === 'small' || value === 'medium' || value === 'large';
}

function isBackgroundRemovalBackend(value: string | undefined): value is BackgroundRemovalBackend {
  return value === 'birefnet' || value === 'imgly' || value === 'rembg';
}

function isSkippableAutoAlignError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('already aligned closely enough');
}

function sendProcessedImage(res: Response, processed: ProcessedImage) {
  res.setHeader('Content-Type', processed.mimeType);
  res.status(200).send(processed.buffer);
}

router.get('/health', (_req, res) => {
  res.status(200).json({ ok: true });
});

router.post('/remove-background', upload.single('image'), async (req, res, next) => {
  try {
    const image = await getUploadedImage(req.file);
    const requestedModel = isBackgroundRemovalModel(req.body?.model) ? req.body.model : undefined;
    const requestedBackend = isBackgroundRemovalBackend(req.body?.backend)
      ? req.body.backend
      : undefined;
    const processed = await removeImageBackground(image, {
      backend: requestedBackend,
      model: requestedModel,
    });

    sendProcessedImage(res, processed);
  } catch (error) {
    if (error instanceof MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return next(new HttpError(413, 'Image upload too large', { cause: error, expose: true }));
    }

    next(error);
  }
});

router.post('/auto-crop', upload.single('image'), async (req, res, next) => {
  try {
    sendProcessedImage(res, await autoCropImage(await getUploadedImage(req.file)));
  } catch (error) {
    if (error instanceof MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return next(new HttpError(413, 'Image upload too large', { cause: error, expose: true }));
    }

    next(error);
  }
});

router.post('/auto-align', upload.single('image'), async (req, res, next) => {
  try {
    sendProcessedImage(res, await autoAlignImage(await getUploadedImage(req.file)));
  } catch (error) {
    if (error instanceof MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return next(new HttpError(413, 'Image upload too large', { cause: error, expose: true }));
    }

    if (isSkippableAutoAlignError(error)) {
      return next(
        new HttpError(409, 'Image is already aligned closely enough', {
          cause: error instanceof Error ? error : undefined,
          code: 'already_aligned',
          expose: true,
        }),
      );
    }

    next(error);
  }
});

router.post('/process-stack', upload.single('image'), async (req, res, next) => {
  try {
    const image = await getUploadedImage(req.file);
    const requestedStage = Number(req.body?.stage ?? 0);
    if (![1, 2, 3].includes(requestedStage)) {
      throw new HttpError(400, 'stage must be 1, 2, or 3');
    }

    const requestedModel = isBackgroundRemovalModel(req.body?.model) ? req.body.model : undefined;
    const requestedBackend = isBackgroundRemovalBackend(req.body?.backend)
      ? req.body.backend
      : undefined;

    let processed = await removeImageBackground(image, {
      backend: requestedBackend,
      model: requestedModel,
    });

    if (requestedStage >= 2) {
      try {
        processed = await autoAlignImage({
          buffer: processed.buffer,
          filename: image.filename,
          mimeType: processed.mimeType,
        });
      } catch (error) {
        if (!isSkippableAutoAlignError(error)) throw error;
      }
    }

    if (requestedStage >= 3) {
      processed = await autoCropImage({
        buffer: processed.buffer,
        filename: image.filename,
        mimeType: processed.mimeType,
      });
    }

    sendProcessedImage(res, processed);
  } catch (error) {
    if (error instanceof MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return next(new HttpError(413, 'Image upload too large', { cause: error, expose: true }));
    }

    next(error);
  }
});

router.post('/rotate', upload.single('image'), async (req, res, next) => {
  try {
    const direction = req.body?.direction;
    if (direction !== 'cw' && direction !== 'ccw') {
      throw new HttpError(400, 'direction must be cw or ccw');
    }

    const processed = await rotateImage(
      await getUploadedImage(req.file),
      direction === 'cw' ? 90 : -90,
    );
    sendProcessedImage(res, processed);
  } catch (error) {
    if (error instanceof MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return next(new HttpError(413, 'Image upload too large', { cause: error, expose: true }));
    }

    next(error);
  }
});

export default router;
