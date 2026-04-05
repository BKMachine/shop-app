import Audit from '../audit/audit_service.js';
import PartNote from './part_note_model.js';

async function add(data: unknown, deviceId: string): Promise<PartNoteDoc> {
  const doc = new PartNote(data);
  await doc.save();
  await Audit.addPartNoteAudit(null, doc, deviceId);
  return doc;
}

async function findById(id: string): Promise<PartNoteDoc | null> {
  return PartNote.findById(id);
}

async function listByPart(partId: string): Promise<PartNoteDoc[]> {
  return PartNote.find({ partId }).sort({ updatedAt: -1, createdAt: -1 });
}

async function update(note: PartNoteDoc, deviceId: string): Promise<PartNoteDoc | null> {
  const oldNote = await PartNote.findById(note._id);
  if (!oldNote) throw new Error(`Missing part note document id: ${note._id}`);
  const updated = await PartNote.findByIdAndUpdate(
    note._id,
    { ...note, updatedAt: new Date() },
    { returnDocument: 'after' },
  );
  if (!updated) throw new Error(`Unable to update part note document id: ${note._id}`);
  await Audit.addPartNoteAudit(oldNote, updated, deviceId);
  return updated;
}

async function remove(id: string, deviceId: string): Promise<boolean> {
  const existing = await PartNote.findById(id);
  if (!existing) return false;
  const result = await PartNote.findByIdAndDelete(id);
  if (!result) return false;
  await Audit.addPartNoteAudit(existing, null, deviceId);
  return true;
}

export default {
  add,
  findById,
  listByPart,
  update,
  remove,
};
