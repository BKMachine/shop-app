import { isDayKey } from '@repo/utilities/schedule';
import { Router } from 'express';
import * as z from 'zod';
import { isValidId } from '../../../database/index.js';
import ScheduleService, {
  ScheduleNotFoundError,
} from '../../../database/lib/schedule/schedule_service.js';
import logger from '../../../logger.js';
import mongoObjectId from '../../../utilities/mongoObjectId.js';
import HttpError from '../../middleware/httpError.js';
import { narrowKnownDevice, requireKnownDevice } from '../../middleware/knownDevices.js';

const router: Router = Router();

/** The longest single booking, about a year. */
const MAX_SCHEDULE_DAYS = 366;
/** The most entries one move can shift; a full row on the busiest machine is well under this. */
const MAX_PLACEMENTS = 500;

const dayKey = z.string().refine(isDayKey, { message: 'Expected a YYYY-MM-DD date.' });

const placementFields = {
  machineId: mongoObjectId,
  start: dayKey,
  days: z.number().int().min(1).max(MAX_SCHEDULE_DAYS),
};

const PlacementSchema = z.strictObject({ _id: mongoObjectId, ...placementFields });

export const CreateScheduleEntryRequest = z.strictObject({
  entry: z.strictObject({
    job: mongoObjectId,
    op: z.number().int().positive().nullish(),
    operation: z.string().trim().max(200).nullish(),
    department: z.union([mongoObjectId, z.literal('other')]).nullish(),
    ...placementFields,
  }),
  /** Entries the new booking pushed later on its machine. */
  pushed: z.array(PlacementSchema).max(MAX_PLACEMENTS).optional(),
});

export const PlaceScheduleEntriesRequest = z.strictObject({
  entries: z.array(PlacementSchema).min(1).max(MAX_PLACEMENTS),
});

const percent = z.number().min(1).max(100);

export const UpdateScheduleSettingsRequest = z.strictObject({
  settings: z
    .strictObject({
      workdayStartHour: z.number().int().min(0).max(23),
      workdayEndHour: z.number().int().min(1).max(24),
      workdays: z.array(z.number().int().min(0).max(6)).max(7),
      defaultUtilization: percent,
      departmentUtilization: z.record(mongoObjectId, percent),
    })
    .refine((settings) => settings.workdayEndHour > settings.workdayStartHour, {
      path: ['workdayEndHour'],
      message: 'The working day must end after it starts.',
    })
    .refine((settings) => new Set(settings.workdays).size === settings.workdays.length, {
      path: ['workdays'],
      message: 'Each working day can only be listed once.',
    }),
});

const ListScheduleQuery = z.strictObject({
  from: dayKey,
  to: dayKey.optional(),
});

router.get('/schedule', async (req, res, next) => {
  const { success, data } = ListScheduleQuery.safeParse(req.query);
  if (!success) return next(new HttpError(400, 'Invalid schedule range.'));

  try {
    const entries = await ScheduleService.list(data);
    res.status(200).json(entries);
  } catch (e) {
    next(e);
  }
});

router.get('/schedule/settings', async (_req, res, next) => {
  try {
    const settings = await ScheduleService.getSettings();
    res.status(200).json(settings);
  } catch (e) {
    next(e);
  }
});

router.put('/schedule/settings', requireKnownDevice, async (req, res, next) => {
  narrowKnownDevice(req);
  const { success, data, error } = UpdateScheduleSettingsRequest.safeParse(req.body);
  if (!success) {
    logger.error('Invalid schedule settings provided:', error.message);
    return next(new HttpError(400, 'Invalid schedule settings.'));
  }

  try {
    const settings = await ScheduleService.updateSettings(data.settings, req.deviceId);
    res.status(200).json(settings);
  } catch (e) {
    next(e);
  }
});

router.post('/schedule', requireKnownDevice, async (req, res, next) => {
  narrowKnownDevice(req);
  const { success, data, error } = CreateScheduleEntryRequest.safeParse(req.body);
  if (!success) {
    logger.error('Invalid schedule entry provided:', error.message);
    return next(new HttpError(400, 'Invalid schedule entry.'));
  }

  try {
    const entry = await ScheduleService.create(data.entry, data.pushed ?? [], req.deviceId);
    res.status(201).json(entry);
  } catch (e) {
    if (e instanceof ScheduleNotFoundError) return next(new HttpError(404, e.message));
    next(e);
  }
});

router.put('/schedule', requireKnownDevice, async (req, res, next) => {
  narrowKnownDevice(req);
  const { success, data, error } = PlaceScheduleEntriesRequest.safeParse(req.body);
  if (!success) {
    logger.error('Invalid schedule placements provided:', error.message);
    return next(new HttpError(400, 'Invalid schedule placements.'));
  }

  try {
    await ScheduleService.place(data.entries, req.deviceId);
    res.sendStatus(204);
  } catch (e) {
    if (e instanceof ScheduleNotFoundError) return next(new HttpError(404, e.message));
    next(e);
  }
});

router.delete('/schedule/:id', requireKnownDevice, async (req, res, next) => {
  narrowKnownDevice(req);
  const { id } = req.params;
  if (!isValidId(id)) return next(new HttpError(400, 'Invalid schedule entry id.'));

  try {
    const removed = await ScheduleService.remove(id, req.deviceId);
    if (!removed) return next(new HttpError(404, 'Schedule entry not found.'));
    res.sendStatus(204);
  } catch (e) {
    next(e);
  }
});

export default router;
