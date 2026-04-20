import { Router } from 'express';
import * as z from 'zod';
import Reports from '../../../database/lib/report/report_service.js';
import logger from '../../../logger.js';
import mongoObjectId from '../../../utilities/mongoObjectId.js';
import HttpError from '../../middleware/httpError.js';
import { assertKnownDevice, requireKnownDevice } from '../../middleware/knownDevices.js';

const router: Router = Router();

const EmailSchema = z.strictObject({
  to: z.boolean(),
  cc: z.boolean(),
});

const ReportFieldsSchema = z.strictObject({
  email: z.string().trim().email(),
  tooling: EmailSchema,
});

const CreateReportRequest = z.strictObject({
  report: ReportFieldsSchema,
});

const UpdateReportRequest = z.strictObject({
  report: ReportFieldsSchema.extend({
    _id: mongoObjectId,
    __v: z.number().optional(),
  }),
});

router.get('/reports', async (_req, res, next) => {
  try {
    const data = await Reports.list();
    res.status(200).json(data);
  } catch (e) {
    next(e);
  }
});

router.post('/reports', requireKnownDevice, async (req, res, next) => {
  assertKnownDevice(req);
  const { success, data, error } = CreateReportRequest.safeParse(req.body);
  if (!success) {
    logger.error('Invalid report data provided:', error.message);
    return next(new HttpError(400, 'Invalid report data provided.'));
  }

  try {
    const doc = await Reports.create(data.report, req.deviceId);
    res.status(200).json(doc);
  } catch (e) {
    next(e);
  }
});

router.put('/reports', requireKnownDevice, async (req, res, next) => {
  assertKnownDevice(req);
  const { success, data, error } = UpdateReportRequest.safeParse(req.body);
  if (!success) {
    logger.error('Invalid report data provided:', error.message);
    return next(new HttpError(400, 'Invalid report data provided.'));
  }

  try {
    await Reports.update(data.report, req.deviceId);
    res.sendStatus(204);
  } catch (e) {
    next(e);
  }
});

router.delete('/reports/:id', requireKnownDevice, async (req, res, next) => {
  assertKnownDevice(req);
  const id = String(req.params.id ?? '').trim();
  if (!id) return next(new HttpError(400, 'No report id provided.'));

  try {
    const removed = await Reports.remove(id, req.deviceId);
    if (!removed) return next(new HttpError(404, 'Report recipient not found.'));
    res.sendStatus(204);
  } catch (e) {
    next(e);
  }
});

export default router;
