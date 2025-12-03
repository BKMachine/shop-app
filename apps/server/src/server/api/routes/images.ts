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

router.post('/upload/file', upload.single('image'), async (req, res) => {
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

router.post('/upload/url', async (req, res) => {
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

router.get('/recent', async (_req, res) => {
  try {
    const docs = await ImageService.listRecents();

    res.json(
      docs.map((img) => ({
        id: img._id,
        url: `/images/${img.relPath}`,
        createdAt: img.createdAt,
      })),
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load recent images' });
  }
});

export default router;
