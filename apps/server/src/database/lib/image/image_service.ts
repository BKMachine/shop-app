import fs from 'node:fs';
import path from 'node:path';
import { imageDir } from '../../../directories.js';
import logger from '../../../logger.js';
import { emit } from '../../../server/sockets.js';
import Audit from '../audit/audit_service.js';
import Image from './image_model.js';

function isAuditableImage(image: Pick<ImageDoc, 'status' | 'entityType' | 'entityId'> | null) {
  return Boolean(image && image.status === 'attached' && image.entityType && image.entityId);
}

async function create(data: unknown, deviceId: string): Promise<ImageDoc> {
  const doc = new Image(data);
  await doc.save();
  emit('imageUploaded');
  if (isAuditableImage(doc)) await Audit.addImageAudit(null, doc, deviceId);
  return doc;
}

async function update(image: ImageDoc, deviceId: string): Promise<ImageDoc | null> {
  const oldImage = await Image.findById(image._id);
  if (!oldImage) throw new Error(`Missing image document id: ${image._id}`);

  const updatePayload = {
    ...image,
    updatedAt: new Date(),
    expiresAt: image.status === 'attached' ? null : image.expiresAt,
  };

  const updated = await Image.findByIdAndUpdate(image._id, updatePayload, {
    returnDocument: 'after',
  });
  emit('imageUploaded');

  if (updated) {
    const hadAuditableState = isAuditableImage(oldImage);
    const hasAuditableState = isAuditableImage(updated);

    if (!hadAuditableState && hasAuditableState) {
      await Audit.addImageAudit(null, updated, deviceId);
    } else if (hadAuditableState && hasAuditableState) {
      await Audit.addImageAudit(oldImage, updated, deviceId);
    } else if (hadAuditableState && !hasAuditableState) {
      await Audit.addImageAudit(oldImage, null, deviceId);
    }
  }

  return updated;
}

async function listTemps(): Promise<ImageDoc[]> {
  return Image.find({ status: 'temp' }).sort({ createdAt: -1 });
}

async function findById(id: string): Promise<ImageDoc | null> {
  return Image.findById(id);
}

async function listByIds(ids: string[]): Promise<ImageDoc[]> {
  return await Image.find({ _id: { $in: ids } });
}

async function listByEntity(
  entityType: 'tool' | 'part' | 'customer' | 'supplier' | 'vendor',
  entityId: string,
): Promise<ImageDoc[]> {
  return Image.find({ entityType, entityId, status: 'attached' }).sort({ createdAt: -1 });
}

async function findLatestByEntity(
  entityType: 'tool' | 'part' | 'customer' | 'supplier' | 'vendor',
  entityId: string,
): Promise<ImageDoc | null> {
  return Image.findOne({ entityType, entityId, status: 'attached' }).sort({ createdAt: -1 });
}

async function cleanupExpired(deviceId: string): Promise<{ deleted: number; errors: string[] }> {
  const result = { deleted: 0, errors: [] as string[] };
  try {
    const expiredImages = await Image.find({ status: 'temp', expiresAt: { $lt: new Date() } });

    for (const img of expiredImages) {
      try {
        // Delete file from disk if it exists
        const filePath = path.join(imageDir, img.relPath);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

        // Delete document from database
        await remove(img._id.toString(), deviceId);
        result.deleted++;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        result.errors.push(`Failed to delete image ${img._id}: ${errMsg}`);
        logger.error(`Image cleanup error for ${img._id}: ${errMsg}`);
      }
    }

    if (result.deleted > 0) {
      logger.info(`Image cleanup completed: ${result.deleted} images deleted`);
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    result.errors.push(`Cleanup process failed: ${errMsg}`);
    logger.error(`Image cleanup failed: ${errMsg}`);
  }

  return result;
}

async function remove(id: string, deviceId: string): Promise<boolean> {
  const result = await Image.findByIdAndDelete(id);
  if (isAuditableImage(result)) await Audit.addImageAudit(result, null, deviceId);
  emit('imageDeleted');
  return result !== null;
}

async function removeAllTemps(ids: string[], _deviceId: string): Promise<number> {
  if (!ids.length) return 0;

  const result = await Image.deleteMany({ _id: { $in: ids }, status: 'temp' });
  if (result.deletedCount) {
    emit('imageDeleted');
  }

  return result.deletedCount ?? 0;
}

export default {
  create,
  update,
  listTemps,
  findById,
  listByIds,
  listByEntity,
  findLatestByEntity,
  cleanupExpired,
  remove,
  removeAllTemps,
};
