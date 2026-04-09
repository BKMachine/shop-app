import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import axios from 'axios';
import { Router } from 'express';
import multer from 'multer';
import { isValidId } from '../../../database/index.js';
import CustomerService from '../../../database/lib/customer/customer_service.js';
import ImageService from '../../../database/lib/image/image_service.js';
import PartService from '../../../database/lib/part/part_service.js';
import SupplierService from '../../../database/lib/supplier/supplier_service.js';
import ToolService from '../../../database/lib/tool/tool_service.js';
import VendorService from '../../../database/lib/vendor/vendor_service.js';
import { imageDir, tempDir } from '../../../directories.js';
import {
  autoAlignImage,
  autoCropImage,
  type BackgroundRemovalBackend,
  type BackgroundRemovalModel,
  ImageProcessorClientError,
  isSkippableAutoAlignError,
  processImageStack,
  removeImageBackground,
  rotateImage,
} from '../../../services/image_processor_client.js';
import HttpError from '../../middleware/httpError.js';
import { assertKnownDevice, requireKnownDevice } from '../../middleware/knownDevices.js';

const router: Router = Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, tempDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.bin';
    const id = randomUUID();
    cb(null, id + ext.toLowerCase());
  },
});

const upload = multer({ storage });

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  if (typeof error === 'object' && error && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message) return message;
  }
  return 'Image processing failed';
}

function getErrorStatusCode(error: unknown, fallback: number): number {
  if (error instanceof ImageProcessorClientError) {
    return error.statusCode;
  }

  return fallback;
}

function getExtensionForMimeType(mimeType: string): string {
  const normalizedMimeType = mimeType.trim().toLowerCase().split(';')[0] ?? '';
  if (normalizedMimeType === 'image/jpeg') return '.jpg';
  if (normalizedMimeType === 'image/png') return '.png';
  if (normalizedMimeType === 'image/webp') return '.webp';
  if (normalizedMimeType === 'image/gif') return '.gif';
  return '.bin';
}

function getExtensionForDownload(mimeType: string, sourceUrl: string): string {
  const normalizedMimeType = mimeType.trim().toLowerCase().split(';')[0] ?? '';
  const mimeTypeExtension = getExtensionForMimeType(normalizedMimeType);
  if (mimeTypeExtension !== '.bin') return mimeTypeExtension;

  try {
    const urlPath = new URL(sourceUrl).pathname;
    const extension = path.extname(urlPath).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(extension)) {
      return extension;
    }
  } catch {
    return '.bin';
  }

  return '.bin';
}

async function getPartEntity(entityType: string, entityId: string) {
  if (entityType !== 'part') return null;
  return PartService.findById(entityId);
}

const singleImageEntityTypes = ['tool', 'customer', 'supplier', 'vendor'] as const;

type SingleImageEntityType = (typeof singleImageEntityTypes)[number];

async function getSingleImageEntity(entityType: SingleImageEntityType, entityId: string) {
  if (entityType === 'tool') return ToolService.findById(entityId);
  if (entityType === 'customer') return CustomerService.findById(entityId);
  if (entityType === 'supplier') return SupplierService.findById(entityId);
  return VendorService.findById(entityId);
}

async function updateSingleImageEntity(
  entityType: SingleImageEntityType,
  entity: ToolDoc | CustomerDoc | SupplierDoc | VendorDoc,
  imageUrl: string,
  deviceId: string,
) {
  if (entityType === 'tool') {
    const tool = entity as ToolDoc;
    tool.img = imageUrl;
    await ToolService.update(tool, deviceId);
    return;
  }

  if (entityType === 'customer') {
    const customer = entity as CustomerDoc;
    customer.logo = imageUrl;
    await CustomerService.update(customer, deviceId);
    return;
  }

  if (entityType === 'supplier') {
    const supplier = entity as SupplierDoc;
    supplier.logo = imageUrl;
    await SupplierService.update(supplier, deviceId);
    return;
  }

  if (entityType === 'vendor') {
    const vendor = entity as VendorDoc;
    vendor.logo = imageUrl;
    await VendorService.update(vendor, deviceId);
  }
}

async function deleteImageFileIfPresent(relPath: string) {
  const filePath = path.join(imageDir, relPath);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

function copyFileWithFallback(sourcePath: string, destPath: string) {
  try {
    fs.copyFileSync(sourcePath, destPath);
    return;
  } catch (error) {
    const code =
      typeof error === 'object' && error && 'code' in error
        ? String((error as { code?: unknown }).code ?? '')
        : '';

    if (!['EPERM', 'ENOSYS', 'EXDEV'].includes(code)) {
      throw error;
    }
  }

  const sourceBuffer = fs.readFileSync(sourcePath);
  const sourceMode = fs.statSync(sourcePath).mode;
  fs.writeFileSync(destPath, sourceBuffer, { mode: sourceMode });
}

async function createTempImageFromProcessed(
  processed: { filename: string; mimeType: string; relPath: string },
  deviceId: string,
) {
  const image = await ImageService.create(
    {
      filename: processed.filename,
      relPath: processed.relPath,
      mimeType: processed.mimeType,
      status: 'temp',
      entityType: null,
      entityId: null,
    },
    deviceId,
  );

  return {
    id: image._id.toString(),
    url: `/images/${image.relPath}`,
    createdAt: image.createdAt.toISOString(),
    isMain: false,
  } satisfies MyImageData;
}

function writeProcessedTempImage(processed: {
  buffer: Buffer;
  mimeType: string;
  extension?: string;
}) {
  const extension = processed.extension || getExtensionForMimeType(processed.mimeType);
  const filename = `${randomUUID()}${extension}`;
  const outputPath = path.join(tempDir, filename);
  fs.writeFileSync(outputPath, processed.buffer);

  return {
    filename,
    mimeType: processed.mimeType,
    relPath: path.relative(imageDir, outputPath).replace(/\\/g, '/'),
  };
}

async function createTempImageFromBuffer(
  processed: { buffer: Buffer; mimeType: string; extension?: string },
  deviceId: string,
) {
  return createTempImageFromProcessed(writeProcessedTempImage(processed), deviceId);
}

// Upload a temp image via file
router.post('/uploads/file', requireKnownDevice, upload.single('image'), async (req, res, next) => {
  assertKnownDevice(req);
  if (!req.file) return next(new HttpError(400, 'No file uploaded'));

  try {
    const relPath = path.relative(imageDir, req.file.path).replace(/\\/g, '/');

    const image = await ImageService.create(
      {
        filename: req.file.filename,
        relPath,
        mimeType: req.file.mimetype,
        status: 'temp',
        entityType: null,
        entityId: null,
      },
      req.deviceId,
    );

    const response: MyImageData = {
      id: image._id.toString(),
      url: `/images/${image.relPath}`,
      createdAt: image.createdAt.toISOString(),
      isMain: false,
    };

    res.status(200).json(response);
  } catch (err) {
    next(new HttpError(500, 'Upload failed', { cause: err }));
  }
});

// Upload a temp image via URL
router.post('/uploads/url', requireKnownDevice, async (req, res, next) => {
  assertKnownDevice(req);
  const { url } = req.body || {};
  if (!url) return next(new HttpError(400, 'url is required'));

  try {
    const resp = await axios.get(url, { responseType: 'arraybuffer' });
    const contentType = resp.headers['content-type'] || 'application/octet-stream';

    const fileUuid = randomUUID();
    const filename = fileUuid + getExtensionForDownload(contentType, url);
    const filePath = path.join(tempDir, filename);

    fs.writeFileSync(filePath, resp.data);

    const relPath = path.relative(imageDir, filePath).replace(/\\/g, '/');

    const image = await ImageService.create(
      {
        filename,
        relPath,
        mimeType: contentType,
        status: 'temp',
        entityType: null,
        entityId: null,
      },
      req.deviceId,
    );

    const response: MyImageData = {
      id: image._id.toString(),
      url: `/images/${image.relPath}`,
      createdAt: image.createdAt.toISOString(),
      isMain: false,
    };

    res.status(200).json(response);
  } catch (err) {
    next(new HttpError(500, 'Failed to download image', { cause: err }));
  }
});

// Get temporary images
router.get('/uploads/temps', async (_req, res, next) => {
  try {
    const images = await ImageService.listTemps();

    const response: MyImageData[] = images.map((image) => ({
      id: image._id.toString(),
      url: `/images/${image.relPath}`,
      createdAt: image.createdAt.toISOString(),
      isMain: false,
    }));

    res.status(200).json(response);
  } catch (err) {
    next(new HttpError(500, 'Failed to load temp images', { cause: err }));
  }
});

router.post('/uploads/:id/remove-background', requireKnownDevice, async (req, res, next) => {
  assertKnownDevice(req);
  const { id } = req.params;
  const requestedModel: BackgroundRemovalModel | undefined =
    req.body?.model === 'small' || req.body?.model === 'medium' || req.body?.model === 'large'
      ? req.body.model
      : undefined;
  const requestedBackend: BackgroundRemovalBackend | undefined =
    req.body?.backend === 'birefnet' ||
    req.body?.backend === 'imgly' ||
    req.body?.backend === 'rembg'
      ? req.body.backend
      : undefined;
  if (!isValidId(id)) return next(new HttpError(400, 'Invalid image id'));

  try {
    const image = await ImageService.findById(id);
    if (!image) return next(new HttpError(404, 'Image not found'));
    if (image.status !== 'temp')
      return next(new HttpError(400, 'Only temporary images can be background-processed'));

    const sourcePath = path.join(imageDir, image.relPath);
    if (!fs.existsSync(sourcePath)) return next(new HttpError(404, 'File missing on disk'));

    const processed = await removeImageBackground(sourcePath, {
      backend: requestedBackend,
      model: requestedModel,
    });
    const response = await createTempImageFromBuffer(processed, req.deviceId);

    res.status(200).json(response);
  } catch (err) {
    const message = getErrorMessage(err);
    const statusCode = getErrorStatusCode(err, message.includes('not configured') ? 503 : 500);
    next(new HttpError(statusCode, message, { cause: err, expose: true }));
  }
});

router.post('/uploads/:id/auto-crop', requireKnownDevice, async (req, res, next) => {
  assertKnownDevice(req);
  const { id } = req.params;
  if (!isValidId(id)) return next(new HttpError(400, 'Invalid image id'));

  try {
    const image = await ImageService.findById(id);
    if (!image) return next(new HttpError(404, 'Image not found'));
    if (image.status !== 'temp')
      return next(new HttpError(400, 'Only temporary images can be auto-cropped'));

    const sourcePath = path.join(imageDir, image.relPath);
    if (!fs.existsSync(sourcePath)) return next(new HttpError(404, 'File missing on disk'));

    const processed = await autoCropImage(sourcePath);
    const response = await createTempImageFromBuffer(processed, req.deviceId);

    res.status(200).json(response);
  } catch (err) {
    const message = getErrorMessage(err);
    next(new HttpError(getErrorStatusCode(err, 500), message, { cause: err, expose: true }));
  }
});

router.post('/uploads/:id/auto-align', requireKnownDevice, async (req, res, next) => {
  assertKnownDevice(req);
  const { id } = req.params;
  if (!isValidId(id)) return next(new HttpError(400, 'Invalid image id'));

  try {
    const image = await ImageService.findById(id);
    if (!image) return next(new HttpError(404, 'Image not found'));
    if (image.status !== 'temp') {
      return next(new HttpError(400, 'Only temporary images can be auto-aligned'));
    }

    const sourcePath = path.join(imageDir, image.relPath);
    if (!fs.existsSync(sourcePath)) return next(new HttpError(404, 'File missing on disk'));

    const processed = await autoAlignImage(sourcePath);
    const response = await createTempImageFromBuffer(processed, req.deviceId);

    res.status(200).json(response);
  } catch (err) {
    if (isSkippableAutoAlignError(err)) {
      const originalImageId = req.params.id;
      if (typeof originalImageId !== 'string') {
        return next(new HttpError(400, 'Invalid image id'));
      }

      const image = await ImageService.findById(originalImageId);
      if (!image) return next(new HttpError(404, 'Image not found'));

      const response: MyImageData = {
        id: image._id.toString(),
        url: `/images/${image.relPath}`,
        createdAt: image.createdAt.toISOString(),
        isMain: false,
      };

      return res.status(200).json(response);
    }

    const message = getErrorMessage(err);
    next(new HttpError(getErrorStatusCode(err, 500), message, { cause: err, expose: true }));
  }
});

router.post('/uploads/:id/process-stack', requireKnownDevice, async (req, res, next) => {
  assertKnownDevice(req);
  const { id } = req.params;
  const requestedStage = Number(req.body?.stage ?? 0);
  if (!isValidId(id)) return next(new HttpError(400, 'Invalid image id'));
  if (![1, 2, 3].includes(requestedStage)) {
    return next(new HttpError(400, 'stage must be 1, 2, or 3'));
  }

  try {
    const image = await ImageService.findById(id);
    if (!image) return next(new HttpError(404, 'Image not found'));
    if (image.status !== 'temp') {
      return next(new HttpError(400, 'Only temporary images can be processed'));
    }

    const sourcePath = path.join(imageDir, image.relPath);
    if (!fs.existsSync(sourcePath)) return next(new HttpError(404, 'File missing on disk'));

    const processed = await processImageStack(sourcePath, requestedStage as 1 | 2 | 3, {
      backend:
        req.body?.backend === 'birefnet' ||
        req.body?.backend === 'imgly' ||
        req.body?.backend === 'rembg'
          ? req.body.backend
          : null,
      model:
        req.body?.model === 'small' || req.body?.model === 'medium' || req.body?.model === 'large'
          ? req.body.model
          : null,
    });
    const response = await createTempImageFromBuffer(processed, req.deviceId);

    res.status(200).json(response);
  } catch (err) {
    const message = getErrorMessage(err);
    const statusCode = getErrorStatusCode(err, message.includes('not configured') ? 503 : 500);
    next(new HttpError(statusCode, message, { cause: err, expose: true }));
  }
});

router.post('/uploads/:id/rotate', requireKnownDevice, async (req, res, next) => {
  assertKnownDevice(req);
  const { id } = req.params;
  const { direction } = req.body ?? {};
  if (!isValidId(id)) return next(new HttpError(400, 'Invalid image id'));
  if (direction !== 'cw' && direction !== 'ccw') {
    return next(new HttpError(400, 'direction must be cw or ccw'));
  }

  try {
    const image = await ImageService.findById(id);
    if (!image) return next(new HttpError(404, 'Image not found'));
    if (image.status !== 'temp') {
      return next(new HttpError(400, 'Only temporary images can be rotated'));
    }

    const sourcePath = path.join(imageDir, image.relPath);
    if (!fs.existsSync(sourcePath)) return next(new HttpError(404, 'File missing on disk'));

    const processed = await rotateImage(sourcePath, direction === 'cw' ? 90 : -90);
    const response = await createTempImageFromBuffer(processed, req.deviceId);

    res.status(200).json(response);
  } catch (err) {
    const message = getErrorMessage(err);
    next(new HttpError(getErrorStatusCode(err, 500), message, { cause: err, expose: true }));
  }
});

// Attach an image to an entity
router.post('/uploads/:id/attach', requireKnownDevice, async (req, res, next) => {
  assertKnownDevice(req);
  const { id } = req.params;
  const { entityType, entityId, setAsMain } = req.body;
  if (!isValidId(id)) return next(new HttpError(400, 'Invalid image id'));
  if (!['tool', 'part', 'customer', 'supplier', 'vendor'].includes(entityType))
    return next(new HttpError(400, 'Invalid entityType'));
  if (!entityId) return next(new HttpError(400, 'entityId required'));
  if (!isValidId(entityId)) return next(new HttpError(400, 'Invalid entityId'));

  try {
    const image = await ImageService.findById(id);
    if (!image) return next(new HttpError(404, 'Image not found'));
    if (image.status !== 'temp') return next(new HttpError(400, 'Image is already attached'));

    const oldPath = path.join(imageDir, image.relPath);
    if (!fs.existsSync(oldPath)) return next(new HttpError(404, 'File missing on disk'));

    const destDir = path.join(imageDir, `${entityType}s`, String(entityId));
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

    const destPath = path.join(destDir, image.filename);
    fs.renameSync(oldPath, destPath);

    const newRelPath = path.relative(imageDir, destPath).replace(/\\/g, '/');

    image.relPath = newRelPath;
    image.status = 'attached';
    image.entityType = entityType;
    image.entityId = String(entityId);
    await ImageService.update(image, req.deviceId);

    // Update part's imageIds array if entity is a part
    if (entityType === 'part') {
      const part = await PartService.findById(entityId);
      if (part) {
        if (!part.imageIds) part.imageIds = [];
        const imageStringId = id;

        // Remove if already exists (in case of re-attachment)
        part.imageIds = part.imageIds.filter((imgId) => imgId.toString() !== imageStringId);

        if (setAsMain) {
          // Insert at beginning if setting as main
          part.imageIds.unshift(imageStringId);
          part.img = `/images/${image.relPath}`;
        } else {
          // Append to gallery
          part.imageIds.push(imageStringId);
        }

        await PartService.update(part, req.deviceId);
      }
    }

    if (singleImageEntityTypes.includes(entityType as SingleImageEntityType)) {
      const singleImageEntity = await getSingleImageEntity(
        entityType as SingleImageEntityType,
        entityId,
      );

      if (singleImageEntity) {
        const priorImages = await ImageService.listByEntity(
          entityType as SingleImageEntityType,
          entityId,
        );

        for (const priorImage of priorImages) {
          if (priorImage._id.toString() === image._id.toString()) continue;
          await deleteImageFileIfPresent(priorImage.relPath);
          await ImageService.remove(priorImage._id.toString(), req.deviceId);
        }

        await updateSingleImageEntity(
          entityType as SingleImageEntityType,
          singleImageEntity,
          `/images/${image.relPath}`,
          req.deviceId,
        );
      }
    }

    const response: MyImageData = {
      id: image._id.toString(),
      url: `/images/${image.relPath}`,
      createdAt: image.createdAt.toISOString(),
      isMain:
        singleImageEntityTypes.includes(entityType as SingleImageEntityType) || Boolean(setAsMain),
    };

    res.status(200).json(response);
  } catch (err) {
    next(new HttpError(500, 'Failed to attach image', { cause: err }));
  }
});

// Promote an existing image to be the main image for an entity
router.post('/:id/promote-to-main', requireKnownDevice, async (req, res, next) => {
  assertKnownDevice(req);
  const { id } = req.params;
  const { entityType, entityId } = req.body;
  if (!isValidId(id)) return next(new HttpError(400, 'Invalid image id'));
  if (!entityType) return next(new HttpError(400, 'entityType required'));
  if (!entityId) return next(new HttpError(400, 'entityId required'));
  if (!isValidId(entityId)) return next(new HttpError(400, 'Invalid entityId'));
  if (entityType !== 'part') return next(new HttpError(400, 'Promote to main is only for parts'));

  try {
    const image = await ImageService.findById(id);
    if (!image) return next(new HttpError(404, 'Image not found'));

    const part = await getPartEntity(entityType, entityId);
    if (!part) return next(new HttpError(404, 'Part not found'));

    if (!part.imageIds) part.imageIds = [];
    const imageStringId = id;

    // Remove from array if it exists
    part.imageIds = part.imageIds.filter((imgId) => imgId.toString() !== imageStringId);

    // Add to beginning (main position)
    part.imageIds.unshift(imageStringId);

    // Update img field to point to this image's path
    part.img = `/images/${image.relPath}`;

    await PartService.update(part, req.deviceId);

    const response: MyImageData = {
      id: image._id.toString(),
      url: `/images/${image.relPath}`,
      createdAt: image.createdAt.toISOString(),
      isMain: true,
    };

    res.status(200).json(response);
  } catch (err) {
    next(new HttpError(500, 'Failed to promote image', { cause: err }));
  }
});

// Get all images for a specific entity
router.get('/entities/:entityType/:entityId/images', async (req, res, next) => {
  const { entityType, entityId } = req.params;
  if (!entityType) return next(new HttpError(400, 'Invalid entityType'));
  if (!isValidId(entityId)) return next(new HttpError(400, 'Invalid entityId'));
  if (entityType !== 'part' && entityType !== 'tool') {
    return next(new HttpError(400, 'Image listing is only for parts and tools'));
  }

  try {
    let response: MyImageData[] = [];

    if (entityType === 'part') {
      const part = await getPartEntity(entityType, entityId);
      if (!part) return next(new HttpError(404, 'Part not found'));

      if (!part.imageIds || part.imageIds.length === 0) {
        res.status(200).json([]);
        return;
      }

      const orderedImageIds = part.imageIds.map((imageId) => imageId.toString());
      const mainImageId = orderedImageIds[0] || '';
      const images = await ImageService.listByIds(orderedImageIds);

      const imageMap = new Map(images.map((img) => [img._id.toString(), img]));

      response = orderedImageIds
        .map((imageId) => imageMap.get(imageId))
        .filter((img): img is NonNullable<typeof img> => Boolean(img))
        .sort((left, right) => {
          if (left._id.toString() === mainImageId) return -1;
          if (right._id.toString() === mainImageId) return 1;

          return left.createdAt.getTime() - right.createdAt.getTime();
        })
        .map((img) => {
          return {
            id: img._id.toString(),
            url: `/images/${img.relPath}`,
            createdAt: img.createdAt.toISOString(),
            isMain: img._id.toString() === mainImageId,
          };
        });
    } else {
      const tool = await getSingleImageEntity('tool', entityId);
      if (!tool) return next(new HttpError(404, 'Tool not found'));

      const images = await ImageService.listByEntity('tool', entityId);
      response = images.map((img, index) => ({
        id: img._id.toString(),
        url: `/images/${img.relPath}`,
        createdAt: img.createdAt.toISOString(),
        isMain: index === 0,
      }));
    }

    res.status(200).json(response);
  } catch (err) {
    next(new HttpError(500, 'Failed to load entity images', { cause: err }));
  }
});

router.post(
  '/entities/:entityType/:entityId/images/:imageId/copy-to-temp',
  requireKnownDevice,
  async (req, res, next) => {
    assertKnownDevice(req);
    const { entityType, entityId, imageId } = req.params;
    if (!entityType) return next(new HttpError(400, 'Invalid entityType'));
    if (!isValidId(entityId)) return next(new HttpError(400, 'Invalid entityId'));
    if (!isValidId(imageId)) return next(new HttpError(400, 'Invalid imageId'));
    if (entityType !== 'part' && entityType !== 'tool') {
      return next(new HttpError(400, 'Copy to temp is only supported for parts and tools'));
    }

    try {
      if (entityType === 'part') {
        const part = await getPartEntity(entityType, entityId);
        if (!part) return next(new HttpError(404, 'Part not found'));
      }

      const image = await ImageService.findById(imageId);
      if (!image) return next(new HttpError(404, 'Image not found'));
      if (image.status !== 'attached') {
        return next(new HttpError(400, 'Only attached images can be copied to temp'));
      }
      if (image.entityType !== entityType || image.entityId?.toString() !== entityId) {
        return next(new HttpError(404, `Image is not attached to this ${entityType}`));
      }

      const sourcePath = path.join(imageDir, image.relPath);
      if (!fs.existsSync(sourcePath)) return next(new HttpError(404, 'File missing on disk'));

      const ext = path.extname(image.filename || image.relPath) || '.png';
      const tempFilename = `${randomUUID()}${ext.toLowerCase()}`;
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
      const destPath = path.join(tempDir, tempFilename);
      copyFileWithFallback(sourcePath, destPath);

      const relPath = path.relative(imageDir, destPath).replace(/\\/g, '/');
      const tempImage = await ImageService.create(
        {
          filename: tempFilename,
          relPath,
          mimeType: image.mimeType,
          status: 'temp',
          entityType: null,
          entityId: null,
        },
        req.deviceId,
      );

      const response: MyImageData = {
        id: tempImage._id.toString(),
        url: `/images/${tempImage.relPath}`,
        createdAt: tempImage.createdAt.toISOString(),
        isMain: false,
      };

      res.status(200).json(response);
    } catch (err) {
      const message = getErrorMessage(err);
      next(new HttpError(500, message, { cause: err, expose: true }));
    }
  },
);

// Add an image to an entity gallery without setting as main
router.post(
  '/entities/:entityType/:entityId/images/:imageId/add',
  requireKnownDevice,
  async (req, res, next) => {
    assertKnownDevice(req);
    const { entityType, entityId, imageId } = req.params;
    if (!entityType) return next(new HttpError(400, 'Invalid entityType'));
    if (!isValidId(entityId)) return next(new HttpError(400, 'Invalid entityId'));
    if (!isValidId(imageId)) return next(new HttpError(400, 'Invalid imageId'));
    if (entityType !== 'part') return next(new HttpError(400, 'Gallery add is only for parts'));

    try {
      const image = await ImageService.findById(imageId);
      if (!image) return next(new HttpError(404, 'Image not found'));

      const part = await getPartEntity(entityType, entityId);
      if (!part) return next(new HttpError(404, 'Part not found'));

      if (!part.imageIds) part.imageIds = [];
      const imageStringId = imageId;

      // Check if already added
      if (part.imageIds.some((imgId) => imgId.toString() === imageStringId))
        return next(new HttpError(400, 'Image already added to part'));

      // Append to gallery (don't set as main)
      part.imageIds.push(imageStringId);
      await PartService.update(part, req.deviceId);

      const response: MyImageData = {
        id: image._id.toString(),
        url: `/images/${image.relPath}`,
        createdAt: image.createdAt.toISOString(),
        isMain: false,
      };

      res.status(200).json(response);
    } catch (err) {
      next(new HttpError(500, 'Failed to add image to entity', { cause: err }));
    }
  },
);

// Delete a temporary image
router.delete('/uploads/:id', requireKnownDevice, async (req, res, next) => {
  assertKnownDevice(req);
  const { id } = req.params;
  if (!isValidId(id)) return next(new HttpError(400, 'Invalid image id'));

  try {
    const image = await ImageService.findById(id);
    if (!image) return next(new HttpError(404, 'Image not found'));
    if (image.status !== 'temp')
      return next(new HttpError(400, 'Only temporary images can be deleted'));

    const filePath = path.join(imageDir, image.relPath);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await ImageService.remove(id, req.deviceId);

    res.status(200).json({ success: true, id });
  } catch (err) {
    next(new HttpError(500, 'Failed to delete image', { cause: err }));
  }
});

// Delete all temporary images
router.delete('/uploads', requireKnownDevice, async (req, res, next) => {
  assertKnownDevice(req);

  try {
    const tempImages = await ImageService.listTemps();
    const imageIds: string[] = [];

    for (const image of tempImages) {
      const filePath = path.join(imageDir, image.relPath);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      imageIds.push(image._id.toString());
    }

    const deletedCount = await ImageService.removeAllTemps(imageIds, req.deviceId);

    res.status(200).json({
      success: true,
      count: deletedCount,
      ids: imageIds,
    });
  } catch (err) {
    next(new HttpError(500, 'Failed to delete temp images', { cause: err }));
  }
});

// Delete an image from an entity gallery
router.delete(
  '/entities/:entityType/:entityId/images/:imageId',
  requireKnownDevice,
  async (req, res, next) => {
    assertKnownDevice(req);
    const { entityType, entityId, imageId } = req.params;
    if (!entityType) return next(new HttpError(400, 'Invalid entityType'));
    if (!isValidId(entityId)) return next(new HttpError(400, 'Invalid entityId'));
    if (!isValidId(imageId)) return next(new HttpError(400, 'Invalid imageId'));
    if (entityType !== 'part') return next(new HttpError(400, 'Image delete is only for parts'));

    try {
      const part = await getPartEntity(entityType, entityId);
      if (!part) return next(new HttpError(404, 'Part not found'));

      if (!part.imageIds) part.imageIds = [];

      const image = await ImageService.findById(imageId);
      if (!image) return next(new HttpError(404, 'Image not found'));

      const imageIdSet = new Set(part.imageIds.map((imgId) => imgId.toString()));
      if (!imageIdSet.has(imageId))
        return next(new HttpError(404, 'Image is not attached to this part'));

      const remainingImageIds = part.imageIds
        .map((id) => id.toString())
        .filter((id) => id !== imageId);

      part.imageIds = remainingImageIds;

      const nextMainImageId = remainingImageIds[0];
      if (nextMainImageId) {
        const nextMainImage = await ImageService.findById(nextMainImageId);
        part.img = nextMainImage ? `/images/${nextMainImage.relPath}` : '';
      } else {
        part.img = '';
      }

      await PartService.update(part, req.deviceId);

      const filePath = path.join(imageDir, image.relPath);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

      await ImageService.remove(imageId, req.deviceId);

      res.status(200).json({
        success: true,
        id: imageId,
        entityType,
        entityId,
        nextMainImageId: nextMainImageId || '',
        nextMainImageUrl: part.img || '',
      });
    } catch (err) {
      next(new HttpError(500, 'Failed to delete entity image', { cause: err }));
    }
  },
);

router.delete(
  '/entities/:entityType/:entityId/image',
  requireKnownDevice,
  async (req, res, next) => {
    assertKnownDevice(req);
    const { entityType, entityId } = req.params;
    if (!entityType) return next(new HttpError(400, 'Invalid entityType'));
    if (!isValidId(entityId)) return next(new HttpError(400, 'Invalid entityId'));
    if (!singleImageEntityTypes.includes(entityType as SingleImageEntityType)) {
      return next(new HttpError(400, 'Single image delete is only for single-image entities'));
    }

    try {
      const singleImageEntity = await getSingleImageEntity(
        entityType as SingleImageEntityType,
        entityId,
      );
      if (!singleImageEntity) return next(new HttpError(404, 'Entity not found'));

      const image = await ImageService.findLatestByEntity(
        entityType as SingleImageEntityType,
        entityId,
      );
      if (image) {
        await deleteImageFileIfPresent(image.relPath);
        await ImageService.remove(image._id.toString(), req.deviceId);
      }

      await updateSingleImageEntity(
        entityType as SingleImageEntityType,
        singleImageEntity,
        '',
        req.deviceId,
      );

      res.status(200).json({
        success: true,
        id: image?._id.toString() || '',
        entityType,
        entityId,
        url: '',
      });
    } catch (err) {
      next(new HttpError(500, 'Failed to delete entity image', { cause: err }));
    }
  },
);

export default router;
