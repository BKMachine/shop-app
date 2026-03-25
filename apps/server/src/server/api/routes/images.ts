import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import axios from 'axios';
import { Router } from 'express';
import multer from 'multer';
import ImageService from '../../../database/lib/image/image_service.js';
import PartService from '../../../database/lib/part/part_service.js';
import { imageDir, tempDir } from '../../../directories.js';

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

router.post('/uploads/file', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const relPath = path.relative(imageDir, req.file.path).replace(/\\/g, '/');

    const image = await ImageService.add({
      filename: req.file.filename,
      relPath,
      mimeType: req.file.mimetype,
      status: 'temp',
      entityType: null,
      entityId: null,
    });

    res.json({
      id: image._id,
      url: `/images/${image.relPath}`,
      createdAt: image.createdAt,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

router.post('/uploads/url', async (req, res) => {
  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: 'url is required' });

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

    res.json({
      id: image._id,
      url: `/images/${image.relPath}`,
      createdAt: image.createdAt,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to download image' });
  }
});

router.get('/uploads/recent', async (_req, res) => {
  try {
    const docs = await ImageService.listRecents();

    res.json(
      docs.map((img) => {
        const recents: RecentImage = {
          id: img._id.toString(),
          url: `/images/${img.relPath}`,
          createdAt: img.createdAt.toISOString(),
        };
        return recents;
      }),
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load recent images' });
  }
});

router.post('/uploads/:id/attach', async (req, res) => {
  const { id } = req.params;
  const { entityType, entityId, setAsMain } = req.body;

  if (!['tool', 'part', 'setup'].includes(entityType)) {
    return res.status(400).json({ error: 'Invalid entityType' });
  }
  if (!entityId) {
    return res.status(400).json({ error: 'entityId required' });
  }

  try {
    const image = await ImageService.findById(id);
    if (!image) return res.status(404).json({ error: 'Image not found' });

    if (image.status !== 'temp') {
      return res.status(400).json({ error: 'Image is already attached' });
    }

    const oldPath = path.join(imageDir, image.relPath);
    if (!fs.existsSync(oldPath)) {
      return res.status(404).json({ error: 'File missing on disk' });
    }

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
        part.imageIds = part.imageIds.filter((imgId) => imgId !== imageStringId);

        if (setAsMain) {
          // Insert at beginning if setting as main
          part.imageIds.unshift(imageStringId);
          part.img = `/images/${image.relPath}`;
        } else {
          // Append to gallery
          part.imageIds.push(imageStringId);
        }

        await PartService.update(part);
      }
    }

    res.json({
      id: image._id,
      url: `/images/${image.relPath}`,
      entityType: image.entityType,
      entityId: image.entityId,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to attach image' });
  }
});

// Promote an existing image to be the main image for a part
router.post('/images/:id/promote-to-main', async (req, res) => {
  const { id } = req.params;
  const { partId } = req.body;

  if (!partId) {
    return res.status(400).json({ error: 'partId required' });
  }

  try {
    const image = await ImageService.findById(id);
    if (!image) return res.status(404).json({ error: 'Image not found' });

    const part = await PartService.findById(partId);
    if (!part) return res.status(404).json({ error: 'Part not found' });

    if (!part.imageIds) part.imageIds = [];
    const imageStringId = id;

    // Remove from array if it exists
    part.imageIds = part.imageIds.filter((imgId) => imgId !== imageStringId);

    // Add to beginning (main position)
    part.imageIds.unshift(imageStringId);

    // Update img field to point to this image's path
    part.img = `/images/${image.relPath}`;

    await PartService.update(part);

    res.json({
      id: image._id,
      url: `/images/${image.relPath}`,
      isMain: true,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to promote image' });
  }
});

// Delete a temporary image
router.delete('/uploads/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const image = await ImageService.findById(id);
    if (!image) return res.status(404).json({ error: 'Image not found' });

    // Only allow deletion of temp images
    if (image.status !== 'temp') {
      return res.status(400).json({ error: 'Only temporary images can be deleted' });
    }

    const filePath = path.join(imageDir, image.relPath);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete from database
    await ImageService.remove(id);

    res.json({ success: true, id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

// Get all images for a specific part
router.get('/parts/:partId/images', async (req, res) => {
  const { partId } = req.params;

  try {
    const part = await PartService.findById(partId);
    if (!part) return res.status(404).json({ error: 'Part not found' });

    if (!part.imageIds || part.imageIds.length === 0) {
      return res.json([]);
    }

    const images = await ImageService.listByIds(part.imageIds || []);

    const imageMap = new Map(images.map((img) => [img._id.toString(), img]));

    const result = (part.imageIds || [])
      .map((imageId) => imageMap.get(imageId))
      .filter((img): img is NonNullable<typeof img> => Boolean(img))
      .sort((left, right) => {
        if (left._id.toString() === (part.imageIds || [])[0]) return -1;
        if (right._id.toString() === (part.imageIds || [])[0]) return 1;

        return right.createdAt.getTime() - left.createdAt.getTime();
      })
      .map((img) => ({
        id: img._id.toString(),
        url: `/images/${img.relPath}`,
        filename: img.filename,
        createdAt: img.createdAt.toISOString(),
        isMain: part.img?.includes(img.relPath),
      }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load part images' });
  }
});

// Add an image to a part's gallery without setting as main
router.post('/parts/:partId/images/:imageId/add', async (req, res) => {
  const { partId, imageId } = req.params;

  try {
    const image = await ImageService.findById(imageId);
    if (!image) return res.status(404).json({ error: 'Image not found' });

    const part = await PartService.findById(partId);
    if (!part) return res.status(404).json({ error: 'Part not found' });

    if (!part.imageIds) part.imageIds = [];
    const imageStringId = imageId;

    // Check if already added
    if (part.imageIds.includes(imageStringId)) {
      return res.status(400).json({ error: 'Image already added to part' });
    }

    // Append to gallery (don't set as main)
    part.imageIds.push(imageStringId);
    await PartService.update(part);

    res.json({
      id: image._id,
      url: `/images/${image.relPath}`,
      added: true,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add image to part' });
  }
});

export default router;
