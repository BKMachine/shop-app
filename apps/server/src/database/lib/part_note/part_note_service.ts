import PartNote from './part_note_model.js';

async function add(data: unknown): Promise<PartNoteDoc> {
  const doc = new PartNote(data);
  await doc.save();
  return doc;
}

async function findById(id: string): Promise<PartNoteDoc | null> {
  return PartNote.findById(id);
}

async function listByPart(partId: string): Promise<PartNoteDoc[]> {
  return PartNote.find({ partId }).sort({ updatedAt: -1, createdAt: -1 });
}

async function update(note: PartNoteDoc): Promise<PartNoteDoc | null> {
  return PartNote.findByIdAndUpdate(
    note._id,
    { ...note, updatedAt: new Date() },
    { returnDocument: 'after' },
  );
}

async function remove(id: string): Promise<boolean> {
  const result = await PartNote.findByIdAndDelete(id);
  return result !== null;
}

export default {
  add,
  findById,
  listByPart,
  update,
  remove,
};
