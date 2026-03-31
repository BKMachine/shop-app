import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import PartService from '../../../database/lib/part/part_service.js';
import PartNoteService from '../../../database/lib/part_note/part_note_service.js';
import HttpError from '../../middleware/httpError.js';
import requireKnownDevice from '../../middleware/requireKnownDevices.js';

const router: Router = Router();

function isValidId(value: unknown): value is string {
  return typeof value === 'string' && isValidObjectId(value);
}

function toNoteResponse(note: PartNoteDoc): MyPartNoteData {
  return {
    id: note._id.toString(),
    text: note.text,
    priority: note.priority,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
    createdByDeviceId: note.createdByDeviceId,
    createdByDisplayName: note.createdByDisplayName,
    updatedByDeviceId: note.updatedByDeviceId,
    updatedByDisplayName: note.updatedByDisplayName,
  };
}

router.get('/parts/:partId/notes', async (req, res, next) => {
  const { partId } = req.params;
  if (!isValidId(partId)) return next(new HttpError(400, 'Invalid part id'));

  try {
    const notes = await PartNoteService.listByPart(partId);
    res.status(200).json(notes.map(toNoteResponse));
  } catch (err) {
    next(new HttpError(500, 'Failed to load notes', { cause: err }));
  }
});

router.post('/parts/:partId/notes', requireKnownDevice, async (req, res, next) => {
  const { partId } = req.params;
  const { text, priority } = req.body || {};

  if (!isValidId(partId)) return next(new HttpError(400, 'Invalid part id'));
  if (!req.device) return next(new HttpError(401, 'Missing device context'));
  if (typeof text !== 'string' || !text.trim()) return next(new HttpError(400, 'text is required'));
  if (!['critical', 'default'].includes(priority)) {
    return next(new HttpError(400, 'Invalid priority'));
  }

  try {
    const part = await PartService.findById(partId);
    if (!part) return next(new HttpError(404, 'Part not found'));

    const note = await PartNoteService.add({
      partId,
      text: text.trim(),
      priority,
      createdByDeviceId: req.device.deviceId,
      createdByDisplayName: req.device.displayName,
      updatedByDeviceId: req.device.deviceId,
      updatedByDisplayName: req.device.displayName,
    }, req.device._id.toString());

    res.status(200).json(toNoteResponse(note));
  } catch (err) {
    next(new HttpError(500, 'Failed to create note', { cause: err }));
  }
});

router.put('/parts/:partId/notes/:noteId', requireKnownDevice, async (req, res, next) => {
  const { partId, noteId } = req.params;
  const { text, priority } = req.body || {};

  if (!isValidId(partId)) return next(new HttpError(400, 'Invalid part id'));
  if (!isValidId(noteId)) return next(new HttpError(400, 'Invalid note id'));
  if (!req.device) return next(new HttpError(401, 'Missing device context'));
  if (typeof text !== 'string' || !text.trim()) return next(new HttpError(400, 'text is required'));
  if (!['critical', 'default'].includes(priority)) {
    return next(new HttpError(400, 'Invalid priority'));
  }

  try {
    const note = await PartNoteService.findById(noteId);
    if (!note || note.partId.toString() !== partId) return next(new HttpError(404, 'Note not found'));

    note.text = text.trim();
    note.priority = priority;
    note.updatedByDeviceId = req.device.deviceId;
    note.updatedByDisplayName = req.device.displayName;

    const updated = await PartNoteService.update(note, req.device._id.toString());
    if (!updated) return next(new HttpError(404, 'Note not found'));

    res.status(200).json(toNoteResponse(updated));
  } catch (err) {
    next(new HttpError(500, 'Failed to update note', { cause: err }));
  }
});

router.delete('/parts/:partId/notes/:noteId', requireKnownDevice, async (req, res, next) => {
  const { partId, noteId } = req.params;

  if (!isValidId(partId)) return next(new HttpError(400, 'Invalid part id'));
  if (!isValidId(noteId)) return next(new HttpError(400, 'Invalid note id'));
  if (!req.device) return next(new HttpError(401, 'Missing device context'));

  try {
    const note = await PartNoteService.findById(noteId);
    if (!note || note.partId.toString() !== partId) return next(new HttpError(404, 'Note not found'));

    await PartNoteService.remove(noteId, req.device._id.toString());
    res.sendStatus(204);
  } catch (err) {
    next(new HttpError(500, 'Failed to delete note', { cause: err }));
  }
});

export default router;
