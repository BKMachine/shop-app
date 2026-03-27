import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import axios from 'axios';
import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import multer from 'multer';
import ImageService from '../../../database/lib/image/image_service.js';
import PartService from '../../../database/lib/part/part_service.js';
import { imageDir, tempDir } from '../../../directories.js';
import HttpError from '../../middleware/httpError.js';
import requireKnownDevice from '../../middleware/requireKnownDevices.js';

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

function isValidId(value: unknown): value is string {
  return typeof value === 'string' && isValidObjectId(value);
}

async function getPartEntity(entityType: string, entityId: string) {
  if (entityType !== 'part') return null;
  return PartService.findById(entityId);
}

// Upload a temp image via file
router.post('/uploads/file', requireKnownDevice, upload.single('image'), async (req, res, next) => {
  if (!req.file) return next(new HttpError(400, 'No file uploaded'));

  try {
    const relPath = path.relative(imageDir, req.file.path).replace(/\\/g, '/');

    const image = await ImageService.add({
      filename: req.file.filename,
      relPath,
      mimeType: req.file.mimetype,
      status: 'temp',
      entityType: null,
      entityId: null,
    });

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

    const image = await ImageService.add({
      filename,
      relPath,
      mimeType: contentType,
      status: 'temp',
      entityType: null,
      entityId: null,
    });

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

// Get recent temp image uploads
router.get('/uploads/recent', async (_req, res, next) => {
  try {
    const images = await ImageService.listRecents();

    const response: MyImageData[] = images.map((image) => ({
      id: image._id.toString(),
      url: `/images/${image.relPath}`,
      createdAt: image.createdAt.toISOString(),
      isMain: false,
    }));

    res.status(200).json(response);
  } catch (err) {
    next(new HttpError(500, 'Failed to load recent images', { cause: err }));
  }
});

// Attach an image to an entity
router.post('/uploads/:id/attach', requireKnownDevice, async (req, res, next) => {
  const { id } = req.params;
  const { entityType, entityId, setAsMain } = req.body;

  if (!isValidId(id)) return next(new HttpError(400, 'Invalid image id'));
  if (!['tool', 'part'].includes(entityType)) return next(new HttpError(400, 'Invalid entityType'));
  if (!entityId) return next(new HttpError(400, 'entityId required'));
  if (!isValidId(entityId)) return next(new HttpError(400, 'Invalid entityId'));
  if (!req.device) return next(new HttpError(401, 'Missing device context'));

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
    await ImageService.update(image);

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

        await PartService.update(part, req.device._id.toString());
      }
    }

    const response: MyImageData = {
      id: image._id.toString(),
      url: `/images/${image.relPath}`,
      createdAt: image.createdAt.toISOString(),
      isMain: false,
    };

    res.status(200).json(response);
  } catch (err) {
    next(new HttpError(500, 'Failed to attach image', { cause: err }));
  }
});

// Promote an existing image to be the main image for an entity
router.post('/:id/promote-to-main', requireKnownDevice, async (req, res, next) => {
  const { id } = req.params;
  const { entityType, entityId } = req.body;

  if (!isValidId(id)) return next(new HttpError(400, 'Invalid image id'));
  if (!entityType) return next(new HttpError(400, 'entityType required'));
  if (!entityId) return next(new HttpError(400, 'entityId required'));
  if (!isValidId(entityId)) return next(new HttpError(400, 'Invalid entityId'));
  if (entityType !== 'part') return next(new HttpError(400, 'Promote to main is only for parts'));
  if (!req.device) return next(new HttpError(401, 'Missing device context'));

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

    await PartService.update(part, req.device._id.toString());

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
    const { entityType, entityId, imageId } = req.params;

    if (!entityType) return next(new HttpError(400, 'Invalid entityType'));
    if (!isValidId(entityId)) return next(new HttpError(400, 'Invalid entityId'));
    if (!isValidId(imageId)) return next(new HttpError(400, 'Invalid imageId'));
    if (entityType !== 'part') return next(new HttpError(400, 'Gallery add is only for parts'));
    if (!req.device) return next(new HttpError(401, 'Missing device context'));

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
      await PartService.update(part, req.device._id.toString());

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
  const { id } = req.params;

  if (!isValidId(id)) return next(new HttpError(400, 'Invalid image id'));

  try {
    const image = await ImageService.findById(id);
    if (!image) return next(new HttpError(404, 'Image not found'));
    if (image.status !== 'temp')
      return next(new HttpError(400, 'Only temporary images can be deleted'));

    const filePath = path.join(imageDir, image.relPath);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await ImageService.remove(id);

    res.status(200).json({ success: true, id });
  } catch (err) {
    next(new HttpError(500, 'Failed to delete image', { cause: err }));
  }
});

// Delete an image from an entity gallery
router.delete(
  '/entities/:entityType/:entityId/images/:imageId',
  requireKnownDevice,
  async (req, res, next) => {
    const { entityType, entityId, imageId } = req.params;

    if (!entityType) return next(new HttpError(400, 'Invalid entityType'));
    if (!isValidId(entityId)) return next(new HttpError(400, 'Invalid entityId'));
    if (!isValidId(imageId)) return next(new HttpError(400, 'Invalid imageId'));
    if (entityType !== 'part') return next(new HttpError(400, 'Image delete is only for parts'));
    if (!req.device) return next(new HttpError(401, 'Missing device context'));

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

      await PartService.update(part, req.device._id.toString());

      const filePath = path.join(imageDir, image.relPath);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

      await ImageService.remove(imageId);

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

export default router;
