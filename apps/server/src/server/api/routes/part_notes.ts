import { Router } from 'express';
import * as z from 'zod';
import { isValidId } from '../../../database/index.js';
import PartService from '../../../database/lib/part/part_service.js';
import PartNoteService from '../../../database/lib/part_note/part_note_service.js';
import logger from '../../../logger.js';
import HttpError from '../../middleware/httpError.js';
import { assertKnownDevice, requireKnownDevice } from '../../middleware/knownDevices.js';

const router: Router = Router();

const PartNoteRequest = z.strictObject({
  text: z.string().trim().min(1),
  priority: z.enum(['critical', 'default']),
});

router.get('/parts/:partId/notes', async (req, res, next) => {
  const { partId } = req.params;
  if (!isValidId(partId)) return next(new HttpError(400, 'Invalid part id'));

  try {
    const notes = await PartNoteService.listByPart(partId);
    res.status(200).json(notes);
  } catch (err) {
    next(new HttpError(500, 'Failed to load notes', { cause: err }));
  }
});

router.post('/parts/:partId/notes', requireKnownDevice, async (req, res, next) => {
  assertKnownDevice(req);
  const { partId } = req.params;
  if (!isValidId(partId)) return next(new HttpError(400, 'Invalid part id'));
  const { success, data, error } = PartNoteRequest.safeParse(req.body);
  if (!success) {
    logger.error('Invalid part note data provided:', error.message);
    return next(new HttpError(400, 'Invalid note data.'));
  }

  try {
    const part = await PartService.findById(partId);
    if (!part) return next(new HttpError(404, 'Part not found'));

    const note: PartNoteFields = {
      partId,
      text: data.text,
      priority: data.priority,
      createdByDeviceId: req.device.deviceId,
      createdByDisplayName: req.device.displayName,
      updatedByDeviceId: req.device.deviceId,
      updatedByDisplayName: req.device.displayName,
    };
    const partDoc = await PartNoteService.create(note, req.deviceId);

    res.status(200).json(partDoc);
  } catch (err) {
    next(new HttpError(500, 'Failed to create note', { cause: err }));
  }
});

router.put('/parts/:partId/notes/:noteId', requireKnownDevice, async (req, res, next) => {
  assertKnownDevice(req);
  const { partId, noteId } = req.params;
  if (!isValidId(partId)) return next(new HttpError(400, 'Invalid part id'));
  if (!isValidId(noteId)) return next(new HttpError(400, 'Invalid note id'));
  const { success, data, error } = PartNoteRequest.safeParse(req.body);
  if (!success) {
    logger.error('Invalid part note data provided:', error.message);
    return next(new HttpError(400, 'Invalid note data.'));
  }

  try {
    const note = await PartNoteService.findById(noteId);
    if (!note || note.partId.toString() !== partId)
      return next(new HttpError(404, 'Note not found'));

    const updated = await PartNoteService.update(
      noteId,
      {
        text: data.text,
        priority: data.priority,
        updatedByDeviceId: req.device.deviceId,
        updatedByDisplayName: req.device.displayName,
      },
      req.deviceId,
    );
    if (!updated) return next(new HttpError(404, 'Note not found'));

    res.status(200).json(updated);
  } catch (err) {
    next(new HttpError(500, 'Failed to update note', { cause: err }));
  }
});

router.delete('/parts/:partId/notes/:noteId', requireKnownDevice, async (req, res, next) => {
  assertKnownDevice(req);
  const { partId, noteId } = req.params;
  if (!isValidId(partId)) return next(new HttpError(400, 'Invalid part id'));
  if (!isValidId(noteId)) return next(new HttpError(400, 'Invalid note id'));

  try {
    const note = await PartNoteService.findById(noteId);
    if (!note || note.partId.toString() !== partId)
      return next(new HttpError(404, 'Note not found'));

    await PartNoteService.remove(noteId, req.deviceId);
    res.sendStatus(204);
  } catch (err) {
    next(new HttpError(500, 'Failed to delete note', { cause: err }));
  }
});

export default router;
