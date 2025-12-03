import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import axios from 'axios';
import { Router } from 'express';
import multer from 'multer';
import ImageService from '../../../database/lib/image/image_service.js';
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
  const { entityType, entityId } = req.body;

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

export default router;
