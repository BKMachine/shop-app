import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import * as z from 'zod';
import DocumentService from '../../../database/lib/document/document_service.js';
import PartService from '../../../database/lib/part/part_service.js';
import { documentDir } from '../../../directories.js';
import logger from '../../../logger.js';
import { getEntityId, normalizeIdArray, toPlainEntity } from '../../../utilities/entities.js';
import mongoObjectId from '../../../utilities/mongoObjectId.js';
import HttpError from '../../middleware/httpError.js';
import { assertKnownDevice, requireKnownDevice } from '../../middleware/knownDevices.js';

const router: Router = Router();
const upload = multer({ storage: multer.memoryStorage() });

const PartDocumentEntityParams = z.strictObject({
  entityId: mongoObjectId,
});

const PartDocumentParams = z.strictObject({
  entityId: mongoObjectId,
  documentId: mongoObjectId,
});

type PartDocumentUpdate = Omit<Part, 'customer' | 'material' | 'imageIds' | 'documentIds'> & {
  customer: string;
  material?: string | null;
  imageIds?: string[];
  documentIds?: string[];
};

function normalizePartDocumentUpdate(part: unknown): PartDocumentUpdate {
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

function mutateDocumentResponse(document: unknown): MyDocumentData {
  const plainDocument =
    document && typeof document === 'object' && 'toObject' in document
      ? ((document as { toObject(): unknown }).toObject() as Record<string, unknown>)
      : (document as Record<string, unknown>);
  const { _id, relPath, ...rest } = plainDocument;

  return {
    ...(rest as Omit<MyDocumentData, 'id' | 'url'>),
    id: String(_id),
    url: `/documents/${String(relPath)}`,
  };
}

router.get('/entities/part/:entityId/documents', async (req, res, next) => {
  const { success, data, error } = PartDocumentEntityParams.safeParse(req.params);
  if (!success) {
    logger.error('Invalid document params provided:', error.message);
    return next(new HttpError(400, 'Invalid part id'));
  }
  const { entityId } = data;

  try {
    const documents = await DocumentService.listByEntity('part', entityId);
    res.status(200).json(documents.map((document) => mutateDocumentResponse(document)));
  } catch (err) {
    next(new HttpError(500, 'Failed to load documents', { cause: err }));
  }
});

router.post(
  '/entities/part/:entityId/upload',
  requireKnownDevice,
  upload.single('document'),
  async (req, res, next) => {
    assertKnownDevice(req);
    const { success, data, error } = PartDocumentEntityParams.safeParse(req.params);
    if (!success) {
      logger.error('Invalid document params provided:', error.message);
      return next(new HttpError(400, 'Invalid part id'));
    }
    const { entityId } = data;
    if (!req.file) return next(new HttpError(400, 'No document uploaded'));

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
      const document = await DocumentService.create(
        {
          filename,
          originalName: req.file.originalname,
          relPath,
          mimeType: req.file.mimetype,
          extension: normalizedExt,
          size: req.file.size,
          entityType: 'part',
          entityId,
        },
        req.deviceId,
      );

      const documentId = document._id.toString();
      const partUpdate = normalizePartDocumentUpdate(part);
      partUpdate.documentIds = [
        documentId,
        ...(partUpdate.documentIds ?? []).filter((id) => id !== documentId),
      ];
      await PartService.update(partUpdate, req.deviceId);

      res.status(200).json(mutateDocumentResponse(document));
    } catch (err) {
      next(new HttpError(500, 'Failed to upload document', { cause: err }));
    }
  },
);

router.delete(
  '/entities/part/:entityId/documents/:documentId',
  requireKnownDevice,
  async (req, res, next) => {
    assertKnownDevice(req);
    const { success, data, error } = PartDocumentParams.safeParse(req.params);
    if (!success) {
      logger.error('Invalid document params provided:', error.message);
      return next(new HttpError(400, 'Invalid document request.'));
    }
    const { entityId, documentId } = data;

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

      await DocumentService.remove(documentId, req.deviceId);

      const partUpdate = normalizePartDocumentUpdate(part);
      partUpdate.documentIds = (partUpdate.documentIds ?? []).filter((id) => id !== documentId);
      await PartService.update(partUpdate, req.deviceId);

      res.sendStatus(204);
    } catch (err) {
      next(new HttpError(500, 'Failed to delete document', { cause: err }));
    }
  },
);

export default router;
