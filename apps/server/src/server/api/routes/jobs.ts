import { Router } from 'express';
import * as z from 'zod';
import { isValidId } from '../../../database/index.js';
import Jobs, {
  JobNotFoundError,
  JobValidationError,
} from '../../../database/lib/job/job_service.js';
import logger from '../../../logger.js';
import mongoObjectId from '../../../utilities/mongoObjectId.js';
import { normalizeQueryValue } from '../../../utilities/normalizeQueryValue.js';
import HttpError from '../../middleware/httpError.js';
import { assertKnownDevice, requireKnownDevice } from '../../middleware/knownDevices.js';

const router: Router = Router();

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function coerceJobDate(value: unknown) {
  if (value == null || value === '') return value;
  if (value instanceof Date) return value;
  if (typeof value !== 'string') return value;

  const trimmedValue = value.trim();
  if (!trimmedValue) return undefined;

  if (DATE_ONLY_PATTERN.test(trimmedValue)) {
    return new Date(`${trimmedValue}T12:00:00.000Z`);
  }

  return trimmedValue;
}

const jobDateSchema = z.preprocess(coerceJobDate, z.coerce.date()).nullish();
const productionTaskSchema = z.strictObject({
  id: z.string().trim().min(1),
  machineId: z.string().trim().min(1),
  machineName: z.string().trim().min(1),
  machineType: z.enum(['lathe', 'mill', 'swiss']),
  startedAt: z.coerce.date(),
  endedAt: z.coerce.date().nullish(),
});

const JobFieldsSchema = z.strictObject({
  customer: mongoObjectId,
  part: mongoObjectId,
  qty: z.coerce.number().int().positive(),
  status: z.enum(['open', 'in_process', 'closed']),
  dueDate: jobDateSchema,
  startedOn: jobDateSchema,
  completedOn: jobDateSchema,
  materialOrderedOn: jobDateSchema,
  materialOnHandOn: jobDateSchema,
  customerPo: z.string().optional(),
  priority: z.enum(['low', 'normal', 'rush']).optional(),
  notes: z.string().optional(),
  customerName: z.string().optional(),
  partNumber: z.string().optional(),
  partDescription: z.string().optional(),
  partRevision: z.string().optional(),
  productionTasks: z.array(productionTaskSchema).optional(),
});

const CreateJobRequest = z.strictObject({
  job: JobFieldsSchema,
});

const UpdateJobRequest = z.strictObject({
  job: JobFieldsSchema.extend({
    _id: mongoObjectId,
    jobNumber: z.coerce.number().int().positive(),
    __v: z.number().optional(),
  }),
});

function toJobHttpError(error: unknown): HttpError | null {
  if (error instanceof JobValidationError) return new HttpError(400, error.message);
  if (error instanceof JobNotFoundError) return new HttpError(404, error.message);
  return null;
}

router.get('/jobs', async (req, res, next) => {
  try {
    const data = await Jobs.list({
      search: normalizeQueryValue(req.query.search),
      customer: normalizeQueryValue(req.query.customer),
      part: normalizeQueryValue(req.query.part),
      status:
        normalizeQueryValue(req.query.status) === 'closed'
          ? 'closed'
          : normalizeQueryValue(req.query.status) === 'not_closed'
            ? 'not_closed'
            : normalizeQueryValue(req.query.status) === 'in_process'
              ? 'in_process'
              : normalizeQueryValue(req.query.status) === 'open'
                ? 'open'
                : undefined,
      dueBefore: normalizeQueryValue(req.query.dueBefore),
      dueAfter: normalizeQueryValue(req.query.dueAfter),
      limit: Number(normalizeQueryValue(req.query.limit)),
      offset: Number(normalizeQueryValue(req.query.offset)),
    });
    res.status(200).json(data);
  } catch (e) {
    next(e);
  }
});

router.get('/jobs/:id', async (req, res, next) => {
  const { id } = req.params;
  if (!isValidId(id)) return next(new HttpError(400, 'Invalid job id'));

  try {
    const job = await Jobs.findById(id);
    if (!job) return next(new HttpError(404, 'Job not found.'));
    res.status(200).json(job);
  } catch (e) {
    next(e);
  }
});

router.post('/jobs', requireKnownDevice, async (req, res, next) => {
  assertKnownDevice(req);
  const { success, data, error } = CreateJobRequest.safeParse(req.body);
  if (!success) {
    logger.error('Invalid job data provided:', error.message);
    return next(new HttpError(400, 'Invalid job data.'));
  }

  try {
    const job = await Jobs.create(data.job, req.deviceId);
    res.status(200).json(job);
  } catch (e) {
    const httpError = toJobHttpError(e);
    if (httpError) return next(httpError);
    next(e);
  }
});

router.put('/jobs', requireKnownDevice, async (req, res, next) => {
  assertKnownDevice(req);
  const { success, data, error } = UpdateJobRequest.safeParse(req.body);
  if (!success) {
    logger.error('Invalid job data provided:', error.message);
    return next(new HttpError(400, 'Invalid job data.'));
  }

  try {
    const job = await Jobs.update(data.job, req.deviceId);
    res.status(200).json(job);
  } catch (e) {
    const httpError = toJobHttpError(e);
    if (httpError) return next(httpError);
    next(e);
  }
});

router.delete('/jobs/:id', requireKnownDevice, async (req, res, next) => {
  assertKnownDevice(req);
  if (!req.device.isAdmin) {
    return next(new HttpError(403, 'Forbidden: admin access required.'));
  }

  const { id } = req.params;
  if (!isValidId(id)) return next(new HttpError(400, 'Invalid job id'));

  try {
    const removed = await Jobs.remove(id, req.deviceId);
    if (!removed) return next(new HttpError(404, 'Job not found.'));
    res.status(200).json({ success: true, id });
  } catch (e) {
    const httpError = toJobHttpError(e);
    if (httpError) return next(httpError);
    next(e);
  }
});

export default router;
