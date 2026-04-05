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
import { removeImageBackground } from '../../../services/background_removal_service.js';
import { autoCropImage } from '../../../services/image_auto_crop_service.js';
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
  return 'Failed to remove background';
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

    const contentType = resp.headers['content-type'] || '';
    let ext = '.bin';
    if (contentType.includes('jpeg')) ext = '.jpg';
    else if (contentType.includes('png')) ext = '.png';
    else if (contentType.includes('webp')) ext = '.webp';

    const fileUuid = randomUUID();
    const filename = fileUuid + ext;
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
  if (!isValidId(id)) return next(new HttpError(400, 'Invalid image id'));

  try {
    const image = await ImageService.findById(id);
    if (!image) return next(new HttpError(404, 'Image not found'));
    if (image.status !== 'temp')
      return next(new HttpError(400, 'Only temporary images can be background-processed'));

    const sourcePath = path.join(imageDir, image.relPath);
    if (!fs.existsSync(sourcePath)) return next(new HttpError(404, 'File missing on disk'));

    const processed = await removeImageBackground(sourcePath);
    const newImage = await ImageService.create(
      {
        filename: processed.filename,
        relPath: processed.relPath,
        mimeType: processed.mimeType,
        status: 'temp',
        entityType: null,
        entityId: null,
      },
      req.deviceId,
    );

    const response: MyImageData = {
      id: newImage._id.toString(),
      url: `/images/${newImage.relPath}`,
      createdAt: newImage.createdAt.toISOString(),
      isMain: false,
    };

    res.status(200).json(response);
  } catch (err) {
    const message = getErrorMessage(err);
    const statusCode = message.includes('not configured') ? 503 : 500;
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
    const newImage = await ImageService.create(
      {
        filename: processed.filename,
        relPath: processed.relPath,
        mimeType: processed.mimeType,
        status: 'temp',
        entityType: null,
        entityId: null,
      },
      req.deviceId,
    );

    const response: MyImageData = {
      id: newImage._id.toString(),
      url: `/images/${newImage.relPath}`,
      createdAt: newImage.createdAt.toISOString(),
      isMain: false,
    };

    res.status(200).json(response);
  } catch (err) {
    const message = getErrorMessage(err);
    next(new HttpError(500, message, { cause: err, expose: true }));
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
  if (entityType !== 'part') return next(new HttpError(400, 'Image listing is only for parts'));

  try {
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

    const response: MyImageData[] = orderedImageIds
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

    res.status(200).json(response);
  } catch (err) {
    next(new HttpError(500, 'Failed to load entity images', { cause: err }));
  }
});

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
