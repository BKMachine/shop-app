import Audit from '../audit/audit_service.js';
import StoredDocument, { type StoredDocumentDoc } from './document_model.js';

async function create(data: StoredDocumentCreate, _deviceId: string): Promise<StoredDocumentDoc> {
  const doc = new StoredDocument(data);
  await doc.save();
  await Audit.addDocumentAudit(null, doc, _deviceId);
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
  if (result) {
    await Audit.addDocumentAudit(result, null, _deviceId);
  }
  return result !== null;
}

export default {
  create,
  findById,
  listByEntity,
  remove,
};
