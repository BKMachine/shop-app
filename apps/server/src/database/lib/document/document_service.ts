import StoredDocument from './document_model.js';

async function add(data: unknown, _deviceId: string): Promise<StoredDocumentDoc> {
  const doc = new StoredDocument(data);
  await doc.save();
  return doc;
}

async function findById(id: string): Promise<StoredDocumentDoc | null> {
  return StoredDocument.findById(id);
}

async function listByEntity(entityType: 'part', entityId: string): Promise<StoredDocumentDoc[]> {
  return StoredDocument.find({ entityType, entityId }).sort({ createdAt: -1 });
}

async function remove(id: string, _deviceId: string): Promise<boolean> {
  const result = await StoredDocument.findByIdAndDelete(id);
  return result !== null;
}

export default {
  add,
  findById,
  listByEntity,
  remove,
};
