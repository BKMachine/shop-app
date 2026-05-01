import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import axios from 'axios';
import { Router } from 'express';
import multer from 'multer';
import * as z from 'zod';
import { isValidId } from '../../../database/index.js';
import CustomerService from '../../../database/lib/customer/customer_service.js';
import type { ImageDoc } from '../../../database/lib/image/image_model.js';
import ImageService from '../../../database/lib/image/image_service.js';
import PartService from '../../../database/lib/part/part_service.js';
import ShipmentService from '../../../database/lib/shipment/shipment_service.js';
import ShipperService from '../../../database/lib/shipper/shipper_service.js';
import SupplierService from '../../../database/lib/supplier/supplier_service.js';
import ToolService from '../../../database/lib/tool/tool_service.js';
import VendorService from '../../../database/lib/vendor/vendor_service.js';
import { imageDir, tempDir } from '../../../directories.js';
import logger from '../../../logger.js';
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
import mongoObjectId from '../../../utilities/mongoObjectId.js';
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

const singleImageEntityTypes = ['tool', 'customer', 'supplier', 'shipper', 'vendor'] as const;
type SingleImageEntityType = (typeof singleImageEntityTypes)[number];

const backgroundRemovalModelSchema = z.enum(['small', 'medium', 'large']);
const backgroundRemovalBackendSchema = z.enum(['birefnet', 'imgly', 'rembg']);

const UploadUrlRequest = z.strictObject({
  url: z.url(),
});

const RemoveBackgroundRequest = z.strictObject({
  model: backgroundRemovalModelSchema.optional(),
  backend: backgroundRemovalBackendSchema.optional(),
});

const ProcessStackRequest = z.strictObject({
  stage: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  backend: backgroundRemovalBackendSchema.optional(),
  model: backgroundRemovalModelSchema.optional(),
});

const RotateImageRequest = z.strictObject({
  direction: z.enum(['cw', 'ccw']),
});

const AttachImageRequest = z.strictObject({
  entityType: z.enum(['tool', 'part', 'customer', 'supplier', 'shipper', 'vendor', 'shipment']),
  entityId: mongoObjectId,
  setAsMain: z.boolean().optional(),
});

const PromoteImageRequest = z.strictObject({
  entityType: z.literal('part'),
  entityId: mongoObjectId,
});

function toPlainEntity(entity: unknown): Record<string, unknown> {
  if (entity && typeof entity === 'object' && 'toObject' in entity) {
    const maybeDoc = entity as { toObject?: () => unknown };
    if (typeof maybeDoc.toObject === 'function') {
      return maybeDoc.toObject() as Record<string, unknown>;
    }
  }

  return entity as Record<string, unknown>;
}

function getEntityId(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null && '_id' in value) {
    return String((value as { _id: unknown })._id);
  }
  if (typeof value === 'object' && value !== null && 'toString' in value) {
    return String(value);
  }

  return undefined;
}

type RouteImage = {
  _id: { toString(): string } | string;
  relPath: string;
  createdAt: Date;
};

type PartMediaUpdate = Omit<Part, 'customer' | 'material' | 'imageIds' | 'documentIds'> & {
  customer: string;
  material?: string | null;
  imageIds?: string[];
  documentIds?: string[];
};

type MultiImageEntityType = 'part' | 'shipment';

function normalizeIdArray(values: unknown): string[] | undefined {
  if (!Array.isArray(values)) return undefined;

  return values
    .map((value) => getEntityId(value))
    .filter((value): value is string => Boolean(value));
}

function serializeImage(image: unknown, isMain = false): MyImageData {
  const routeImage = image as RouteImage;

  return {
    id: routeImage._id.toString(),
    url: `/images/${routeImage.relPath}`,
    createdAt: routeImage.createdAt.toISOString(),
    isMain,
  };
}

function normalizePartMediaUpdate(part: unknown): PartMediaUpdate {
  const plainPart = toPlainEntity(part);

  return {
    ...(plainPart as unknown as Part),
    _id: String(plainPart._id ?? ''),
    customer: getEntityId(plainPart.customer) ?? '',
    material: getEntityId(plainPart.material) ?? null,
    imageIds: normalizeIdArray(plainPart.imageIds),
    documentIds: normalizeIdArray(plainPart.documentIds),
  };
}

function normalizeImageUpdate(image: ImageDoc): ImageUpdate {
  const plainImage = toPlainEntity(image);

  return {
    ...(plainImage as unknown as ImageUpdate),
    _id: String(plainImage._id ?? ''),
    entityId: getEntityId(plainImage.entityId) ?? null,
  };
}

async function getSingleImageEntity(entityType: SingleImageEntityType, entityId: string) {
  if (entityType === 'tool') return ToolService.findById(entityId);
  if (entityType === 'customer') return CustomerService.findById(entityId);
  if (entityType === 'supplier') return SupplierService.findById(entityId);
  if (entityType === 'shipper') return ShipperService.findById(entityId);
  return VendorService.findById(entityId);
}

async function getMultiImageEntity(entityType: MultiImageEntityType, entityId: string) {
  if (entityType === 'part') return getPartEntity(entityType, entityId);
  return ShipmentService.findById(entityId);
}

async function updateSingleImageEntity(
  entityType: SingleImageEntityType,
  entity: unknown,
  imageUrl: string,
  deviceId: string,
) {
  const plainEntity = toPlainEntity(entity);

  if (entityType === 'tool') {
    const toolUpdate = {
      ...plainEntity,
      _id: String(plainEntity._id ?? ''),
      vendor: getEntityId(plainEntity.vendor),
      supplier: getEntityId(plainEntity.supplier),
      img: imageUrl,
    } as ToolUpdate;
    await ToolService.update(toolUpdate, deviceId);
    return;
  }

  if (entityType === 'customer') {
    const customerUpdate = {
      ...plainEntity,
      _id: String(plainEntity._id ?? ''),
      logo: imageUrl,
    } as CustomerUpdate;
    await CustomerService.update(customerUpdate, deviceId);
    return;
  }

  if (entityType === 'supplier') {
    const supplierUpdate = {
      ...plainEntity,
      _id: String(plainEntity._id ?? ''),
      logo: imageUrl,
    } as SupplierUpdate;
    await SupplierService.update(supplierUpdate, deviceId);
    return;
  }

  if (entityType === 'shipper') {
    const shipperUpdate = {
      ...plainEntity,
      _id: String(plainEntity._id ?? ''),
      logo: imageUrl,
    } as ShipperUpdate;
    await ShipperService.update(shipperUpdate, deviceId);
    return;
  }

  if (entityType === 'vendor') {
    const vendorUpdate = {
      ...plainEntity,
      _id: String(plainEntity._id ?? ''),
      logo: imageUrl,
    } as VendorUpdate;
    await VendorService.update(vendorUpdate, deviceId);
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

  return serializeImage(image);
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

    const response = serializeImage(image);

    res.status(200).json(response);
  } catch (err) {
    next(new HttpError(500, 'Upload failed', { cause: err }));
  }
});

// Upload a temp image via URL
router.post('/uploads/url', requireKnownDevice, async (req, res, next) => {
  assertKnownDevice(req);
  const { success, data, error } = UploadUrlRequest.safeParse(req.body);
  if (!success) {
    logger.error('Invalid image URL upload request:', error.message);
    return next(new HttpError(400, 'Invalid image URL upload request'));
  }

  try {
    const resp = await axios.get(data.url, { responseType: 'arraybuffer' });
    const rawContentType = resp.headers['content-type'];
    const contentType =
      typeof rawContentType === 'string'
        ? rawContentType
        : Array.isArray(rawContentType)
          ? (rawContentType[0] ?? 'application/octet-stream')
          : 'application/octet-stream';

    const fileUuid = randomUUID();
    const filename = fileUuid + getExtensionForDownload(contentType, data.url);
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

    const response = serializeImage(image);

    res.status(200).json(response);
  } catch (err) {
    next(new HttpError(500, 'Failed to download image', { cause: err }));
  }
});

// Get temporary images
router.get('/uploads/temps', async (_req, res, next) => {
  try {
    const images = await ImageService.listTemps();

    const response: MyImageData[] = images.map((image) => serializeImage(image));

    res.status(200).json(response);
  } catch (err) {
    next(new HttpError(500, 'Failed to load temp images', { cause: err }));
  }
});

router.post('/uploads/:id/remove-background', requireKnownDevice, async (req, res, next) => {
  assertKnownDevice(req);
  const { id } = req.params;
  if (!isValidId(id)) return next(new HttpError(400, 'Invalid image id'));
  const { success, data, error } = RemoveBackgroundRequest.safeParse(req.body ?? {});
  if (!success) {
    logger.error('Invalid remove-background request:', error.message);
    return next(new HttpError(400, 'Invalid remove background request.'));
  }

  try {
    const image = await ImageService.findById(id);
    if (!image) return next(new HttpError(404, 'Image not found'));
    if (image.status !== 'temp')
      return next(new HttpError(400, 'Only temporary images can be background-processed'));

    const sourcePath = path.join(imageDir, image.relPath);
    if (!fs.existsSync(sourcePath)) return next(new HttpError(404, 'File missing on disk'));

    const processed = await removeImageBackground(sourcePath, {
      backend: data.backend as BackgroundRemovalBackend | undefined,
      model: data.model as BackgroundRemovalModel | undefined,
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

      const response = serializeImage(image);

      return res.status(200).json(response);
    }

    const message = getErrorMessage(err);
    next(new HttpError(getErrorStatusCode(err, 500), message, { cause: err, expose: true }));
  }
});

router.post('/uploads/:id/process-stack', requireKnownDevice, async (req, res, next) => {
  assertKnownDevice(req);
  const { id } = req.params;
  if (!isValidId(id)) return next(new HttpError(400, 'Invalid image id'));
  const { success, data, error } = ProcessStackRequest.safeParse(req.body ?? {});
  if (!success) {
    logger.error('Invalid process-stack request:', error.message);
    return next(new HttpError(400, 'Invalid image processing request.'));
  }

  try {
    const image = await ImageService.findById(id);
    if (!image) return next(new HttpError(404, 'Image not found'));
    if (image.status !== 'temp') {
      return next(new HttpError(400, 'Only temporary images can be processed'));
    }

    const sourcePath = path.join(imageDir, image.relPath);
    if (!fs.existsSync(sourcePath)) return next(new HttpError(404, 'File missing on disk'));

    const processed = await processImageStack(sourcePath, data.stage, {
      backend: data.backend ?? null,
      model: data.model ?? null,
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
  if (!isValidId(id)) return next(new HttpError(400, 'Invalid image id'));
  const { success, data, error } = RotateImageRequest.safeParse(req.body ?? {});
  if (!success) {
    logger.error('Invalid rotate request:', error.message);
    return next(new HttpError(400, 'Invalid image rotation request.'));
  }

  try {
    const image = await ImageService.findById(id);
    if (!image) return next(new HttpError(404, 'Image not found'));
    if (image.status !== 'temp') {
      return next(new HttpError(400, 'Only temporary images can be rotated'));
    }

    const sourcePath = path.join(imageDir, image.relPath);
    if (!fs.existsSync(sourcePath)) return next(new HttpError(404, 'File missing on disk'));

    const processed = await rotateImage(sourcePath, data.direction === 'cw' ? 90 : -90);
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
  if (!isValidId(id)) return next(new HttpError(400, 'Invalid image id'));
  const { success, data, error } = AttachImageRequest.safeParse(req.body ?? {});
  if (!success) {
    logger.error('Invalid attach-image request:', error.message);
    return next(new HttpError(400, 'Invalid image attachment request.'));
  }

  try {
    const image = await ImageService.findById(id);
    if (!image) return next(new HttpError(404, 'Image not found'));
    if (image.status !== 'temp') return next(new HttpError(400, 'Image is already attached'));

    const oldPath = path.join(imageDir, image.relPath);
    if (!fs.existsSync(oldPath)) return next(new HttpError(404, 'File missing on disk'));

    const destDir = path.join(imageDir, `${data.entityType}s`, data.entityId);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

    const destPath = path.join(destDir, image.filename);
    fs.renameSync(oldPath, destPath);

    const newRelPath = path.relative(imageDir, destPath).replace(/\\/g, '/');

    const imageUpdate: ImageUpdate = {
      ...normalizeImageUpdate(image),
      relPath: newRelPath,
      status: 'attached',
      entityType: data.entityType,
      entityId: data.entityId,
    };
    const updatedImage = await ImageService.update(imageUpdate, req.deviceId);
    if (!updatedImage) return next(new HttpError(500, 'Failed to persist attached image'));

    // Update part's imageIds array if entity is a part
    if (data.entityType === 'part') {
      const part = await PartService.findById(data.entityId);
      if (part) {
        const partUpdate = normalizePartMediaUpdate(part);
        if (!partUpdate.imageIds) partUpdate.imageIds = [];
        const imageStringId = id;

        // Remove if already exists (in case of re-attachment)
        partUpdate.imageIds = partUpdate.imageIds.filter((imgId) => imgId !== imageStringId);

        if (data.setAsMain) {
          // Insert at beginning if setting as main
          partUpdate.imageIds.unshift(imageStringId);
          partUpdate.img = `/images/${newRelPath}`;
        } else {
          // Append to gallery
          partUpdate.imageIds.push(imageStringId);
        }

        await PartService.update(partUpdate, req.deviceId);
      }
    }

    if (data.entityType === 'shipment') {
      await ShipmentService.addImage(data.entityId, id, req.deviceId);
    }

    if (singleImageEntityTypes.includes(data.entityType as SingleImageEntityType)) {
      const singleImageEntity = await getSingleImageEntity(
        data.entityType as SingleImageEntityType,
        data.entityId,
      );

      if (singleImageEntity) {
        const priorImages = await ImageService.listByEntity(
          data.entityType as SingleImageEntityType,
          data.entityId,
        );

        for (const priorImage of priorImages) {
          if (priorImage._id.toString() === updatedImage._id.toString()) continue;
          await deleteImageFileIfPresent(priorImage.relPath);
          await ImageService.remove(priorImage._id.toString(), req.deviceId);
        }

        await updateSingleImageEntity(
          data.entityType as SingleImageEntityType,
          singleImageEntity,
          `/images/${newRelPath}`,
          req.deviceId,
        );
      }
    }

    const response = serializeImage(
      updatedImage,
      singleImageEntityTypes.includes(data.entityType as SingleImageEntityType) ||
        Boolean(data.setAsMain),
    );

    res.status(200).json(response);
  } catch (err) {
    next(new HttpError(500, 'Failed to attach image', { cause: err }));
  }
});

// Promote an existing image to be the main image for an entity
router.post('/:id/promote-to-main', requireKnownDevice, async (req, res, next) => {
  assertKnownDevice(req);
  const { id } = req.params;
  if (!isValidId(id)) return next(new HttpError(400, 'Invalid image id'));
  const { success, data, error } = PromoteImageRequest.safeParse(req.body ?? {});
  if (!success) {
    logger.error('Invalid promote-image request:', error.message);
    return next(new HttpError(400, 'Invalid image promotion request.'));
  }

  try {
    const image = await ImageService.findById(id);
    if (!image) return next(new HttpError(404, 'Image not found'));

    const part = await getPartEntity(data.entityType, data.entityId);
    if (!part) return next(new HttpError(404, 'Part not found'));

    const partUpdate = normalizePartMediaUpdate(part);
    if (!partUpdate.imageIds) partUpdate.imageIds = [];
    const imageStringId = id;

    // Remove from array if it exists
    partUpdate.imageIds = partUpdate.imageIds.filter((imgId) => imgId !== imageStringId);

    // Add to beginning (main position)
    partUpdate.imageIds.unshift(imageStringId);

    // Update img field to point to this image's path
    partUpdate.img = `/images/${image.relPath}`;

    await PartService.update(partUpdate, req.deviceId);

    const response = serializeImage(image, true);

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
  if (entityType !== 'part' && entityType !== 'tool' && entityType !== 'shipment') {
    return next(new HttpError(400, 'Image listing is only for parts, tools, and shipments'));
  }

  try {
    let response: MyImageData[] = [];

    if (entityType === 'part' || entityType === 'shipment') {
      const entity = await getMultiImageEntity(entityType, entityId);
      if (!entity) return next(new HttpError(404, `${entityType} not found`));

      if (!entity.imageIds || entity.imageIds.length === 0) {
        res.status(200).json([]);
        return;
      }

      const orderedImageIds = entity.imageIds.map((imageId: unknown) => String(imageId));
      const mainImageId = orderedImageIds[0] || '';
      const images = await ImageService.listByIds(orderedImageIds);

      const imageMap = new Map(images.map((img) => [img._id.toString(), img]));
      const orderedImages = orderedImageIds
        .map((imageId: string) => imageMap.get(imageId))
        .filter((img): img is ImageDoc => Boolean(img));

      response = orderedImages
        .sort((left, right) => {
          if (left._id.toString() === mainImageId) return -1;
          if (right._id.toString() === mainImageId) return 1;

          return left.createdAt.getTime() - right.createdAt.getTime();
        })
        .map((img) => serializeImage(img, img._id.toString() === mainImageId));
    } else {
      const tool = await getSingleImageEntity('tool', entityId);
      if (!tool) return next(new HttpError(404, 'Tool not found'));

      const images = await ImageService.listByEntity('tool', entityId);
      response = images.map((img, index) => serializeImage(img, index === 0));
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
    if (entityType !== 'part' && entityType !== 'tool' && entityType !== 'shipment') {
      return next(
        new HttpError(400, 'Copy to temp is only supported for parts, tools, and shipments'),
      );
    }

    try {
      if (entityType === 'part' || entityType === 'shipment') {
        const entity = await getMultiImageEntity(entityType, entityId);
        if (!entity) return next(new HttpError(404, `${entityType} not found`));
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

      const response = serializeImage(tempImage);

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

      const partUpdate = normalizePartMediaUpdate(part);
      if (!partUpdate.imageIds) partUpdate.imageIds = [];
      const imageStringId = imageId;

      // Check if already added
      if (partUpdate.imageIds.some((imgId) => imgId === imageStringId))
        return next(new HttpError(400, 'Image already added to part'));

      // Append to gallery (don't set as main)
      partUpdate.imageIds.push(imageStringId);
      await PartService.update(partUpdate, req.deviceId);

      const response = serializeImage(image);

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
    if (entityType !== 'part' && entityType !== 'shipment') {
      return next(new HttpError(400, 'Image delete is only for parts and shipments'));
    }

    try {
      const entity = await getMultiImageEntity(entityType, entityId);
      if (!entity) return next(new HttpError(404, `${entityType} not found`));

      const imageIds = normalizeIdArray(entity.imageIds) ?? [];

      const image = await ImageService.findById(imageId);
      if (!image) return next(new HttpError(404, 'Image not found'));

      const imageIdSet = new Set(imageIds);
      if (!imageIdSet.has(imageId))
        return next(new HttpError(404, `Image is not attached to this ${entityType}`));

      let nextMainImageId = '';
      let nextMainImageUrl = '';

      if (entityType === 'part') {
        const partUpdate = normalizePartMediaUpdate(entity);
        const remainingImageIds = imageIds.filter((id) => id !== imageId);
        partUpdate.imageIds = remainingImageIds;

        nextMainImageId = remainingImageIds[0] ?? '';
        if (nextMainImageId) {
          const nextMainImage = await ImageService.findById(nextMainImageId);
          nextMainImageUrl = nextMainImage ? `/images/${nextMainImage.relPath}` : '';
          partUpdate.img = nextMainImageUrl;
        } else {
          partUpdate.img = '';
        }

        await PartService.update(partUpdate, req.deviceId);
      } else {
        const updatedShipment = await ShipmentService.removeImage(entityId, imageId, req.deviceId);
        nextMainImageId = normalizeIdArray(updatedShipment.imageIds)?.[0] ?? '';
      }

      const filePath = path.join(imageDir, image.relPath);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

      await ImageService.remove(imageId, req.deviceId);

      res.status(200).json({
        success: true,
        id: imageId,
        entityType,
        entityId,
        nextMainImageId,
        nextMainImageUrl,
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
