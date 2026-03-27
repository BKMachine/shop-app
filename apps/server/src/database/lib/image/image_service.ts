import fs from 'node:fs';
import path from 'node:path';
import { imageDir } from '../../../directories.js';
import logger from '../../../logger.js';
import { emit } from '../../../server/sockets.js';
import Image from './image_model.js';

async function add(data: unknown): Promise<ImageDoc> {
  const doc = new Image(data);
  await doc.save();
  emit('imageUploaded');
  return doc;
}

async function update(image: ImageDoc): Promise<ImageDoc | null> {
  const updated = await Image.findByIdAndUpdate(
    image._id,
    { ...image, updatedAt: new Date() },
    { returnDocument: 'after' },
  );
  emit('imageUploaded');
  return updated;
}

async function listRecents(): Promise<ImageDoc[]> {
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

async function cleanupExpired(): Promise<{ deleted: number; errors: string[] }> {
  const result = { deleted: 0, errors: [] as string[] };
  try {
    const expiredImages = await Image.find({ expiresAt: { $lt: new Date() } });

    for (const img of expiredImages) {
      try {
        // Delete file from disk if it exists
        const filePath = path.join(imageDir, img.relPath);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

        // Delete document from database
        await remove(img._id.toString());
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

async function remove(id: string): Promise<boolean> {
  const result = await Image.findByIdAndDelete(id);
  emit('imageDeleted');
  return result !== null;
}

export default {
  add,
  update,
  listRecents,
  findById,
  listByIds,
  listByEntity,
  findLatestByEntity,
  cleanupExpired,
  remove,
};
