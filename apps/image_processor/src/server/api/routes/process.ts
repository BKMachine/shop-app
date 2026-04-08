import { type Response, Router } from 'express';
import multer from 'multer';
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
const upload = multer({ storage: multer.memoryStorage() });

function getUploadedImage(file: Express.Multer.File | undefined): InputImage {
  if (!file) {
    throw new HttpError(400, 'image file is required');
  }

  return {
    buffer: file.buffer,
    filename: file.originalname,
    mimeType: file.mimetype,
  };
}

function isBackgroundRemovalModel(value: string | undefined): value is BackgroundRemovalModel {
  return value === 'small' || value === 'medium' || value === 'large';
}

function isBackgroundRemovalBackend(value: string | undefined): value is BackgroundRemovalBackend {
  return value === 'imgly' || value === 'rembg';
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
    const image = getUploadedImage(req.file);
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
    next(error);
  }
});

router.post('/auto-crop', upload.single('image'), async (req, res, next) => {
  try {
    sendProcessedImage(res, await autoCropImage(getUploadedImage(req.file)));
  } catch (error) {
    next(error);
  }
});

router.post('/auto-align', upload.single('image'), async (req, res, next) => {
  try {
    sendProcessedImage(res, await autoAlignImage(getUploadedImage(req.file)));
  } catch (error) {
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
    const image = getUploadedImage(req.file);
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
    next(error);
  }
});

router.post('/rotate', upload.single('image'), async (req, res, next) => {
  try {
    const direction = req.body?.direction;
    if (direction !== 'cw' && direction !== 'ccw') {
      throw new HttpError(400, 'direction must be cw or ccw');
    }

    const processed = await rotateImage(getUploadedImage(req.file), direction === 'cw' ? 90 : -90);
    sendProcessedImage(res, processed);
  } catch (error) {
    next(error);
  }
});

export default router;
