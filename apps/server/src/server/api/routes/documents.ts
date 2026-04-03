import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import multer from 'multer';
import DocumentService from '../../../database/lib/document/document_service.js';
import PartService from '../../../database/lib/part/part_service.js';
import { documentDir } from '../../../directories.js';
import HttpError from '../../middleware/httpError.js';
import requireKnownDevice from '../../middleware/requireKnownDevices.js';

const router: Router = Router();
const upload = multer({ storage: multer.memoryStorage() });

function isValidId(value: unknown): value is string {
  return typeof value === 'string' && isValidObjectId(value);
}

function toDocumentResponse(document: StoredDocumentDoc): MyDocumentData {
  return {
    id: document._id.toString(),
    filename: document.filename,
    originalName: document.originalName,
    url: `/documents/${document.relPath}`,
    mimeType: document.mimeType,
    extension: document.extension,
    size: document.size,
    createdAt: document.createdAt.toISOString(),
  };
}

router.get('/entities/part/:entityId/documents', async (req, res, next) => {
  const { entityId } = req.params;
  if (!isValidId(entityId)) return next(new HttpError(400, 'Invalid part id'));

  try {
    const documents = await DocumentService.listByEntity('part', entityId);
    res.status(200).json(documents.map(toDocumentResponse));
  } catch (err) {
    next(new HttpError(500, 'Failed to load documents', { cause: err }));
  }
});

router.post(
  '/entities/part/:entityId/upload',
  requireKnownDevice,
  upload.single('document'),
  async (req, res, next) => {
    const { entityId } = req.params;
    if (!isValidId(entityId)) return next(new HttpError(400, 'Invalid part id'));
    if (!req.file) return next(new HttpError(400, 'No document uploaded'));
    if (!req.device) return next(new HttpError(401, 'Missing device context'));

    try {
      const part = await PartService.findById(entityId);
      if (!part) return next(new HttpError(404, 'Part not found'));

      const originalExt = path.extname(req.file.originalname);
      const normalizedExt = originalExt ? originalExt.toLowerCase() : '';
      const filename = `${randomUUID()}${normalizedExt}`;
      const destDir = path.join(documentDir, 'parts', entityId);

      if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

      const destPath = path.join(destDir, filename);
      fs.writeFileSync(destPath, req.file.buffer);

      const relPath = path.relative(documentDir, destPath).replace(/\\/g, '/');
      const document = await DocumentService.add({
        filename,
        originalName: req.file.originalname,
        relPath,
        mimeType: req.file.mimetype,
        extension: normalizedExt,
        size: req.file.size,
        entityType: 'part',
        entityId,
      });

      if (!part.documentIds) part.documentIds = [];
      const documentId = document._id.toString();
      part.documentIds = part.documentIds.filter((id) => id.toString() !== documentId);
      part.documentIds.unshift(documentId);
      await PartService.update(part, req.device._id.toString());

      res.status(200).json(toDocumentResponse(document));
    } catch (err) {
      next(new HttpError(500, 'Failed to upload document', { cause: err }));
    }
  },
);

router.delete(
  '/entities/part/:entityId/documents/:documentId',
  requireKnownDevice,
  async (req, res, next) => {
    const { entityId, documentId } = req.params;
    if (!isValidId(entityId)) return next(new HttpError(400, 'Invalid part id'));
    if (!isValidId(documentId)) return next(new HttpError(400, 'Invalid document id'));
    if (!req.device) return next(new HttpError(401, 'Missing device context'));

    try {
      const document = await DocumentService.findById(documentId);
      if (
        !document ||
        document.entityType !== 'part' ||
        document.entityId?.toString() !== entityId
      ) {
        return next(new HttpError(404, 'Document not found'));
      }

      const part = await PartService.findById(entityId);
      if (!part) return next(new HttpError(404, 'Part not found'));

      const filePath = path.join(documentDir, document.relPath);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

      await DocumentService.remove(documentId);

      if (part.documentIds) {
        part.documentIds = part.documentIds.filter((id) => id.toString() !== documentId);
        await PartService.update(part, req.device._id.toString());
      }

      res.sendStatus(204);
    } catch (err) {
      next(new HttpError(500, 'Failed to delete document', { cause: err }));
    }
  },
);

export default router;
