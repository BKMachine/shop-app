import { Router } from 'express';
import * as z from 'zod';
import DepartmentService from '../../../database/lib/department/department_service.js';
import logger from '../../../logger.js';
import mongoObjectId from '../../../utilities/mongoObjectId.js';
import HttpError from '../../middleware/httpError.js';
import { assertKnownDevice, requireKnownDevice } from '../../middleware/knownDevices.js';

const router: Router = Router();

const DepartmentFieldsSchema = z.strictObject({
  name: z.string().trim().min(1).max(40),
});

const CreateDepartmentRequest = z.strictObject({
  department: DepartmentFieldsSchema,
});

const UpdateDepartmentRequest = z.strictObject({
  department: DepartmentFieldsSchema.extend({
    _id: mongoObjectId,
    __v: z.number().optional(),
  }),
});

router.get('/departments', async (_req, res, next) => {
  try {
    const departments = await DepartmentService.list();
    res.status(200).json(departments);
  } catch (e) {
    next(e);
  }
});

router.post('/departments', requireKnownDevice, async (req, res, next) => {
  assertKnownDevice(req);
  const { success, data, error } = CreateDepartmentRequest.safeParse(req.body);
  if (!success) {
    logger.error('Invalid department data provided:', error.message);
    return next(new HttpError(400, 'Invalid department data provided.'));
  }

  try {
    const department = await DepartmentService.create(data.department);
    res.status(200).json(department);
  } catch (e) {
    next(e);
  }
});

router.put('/departments', requireKnownDevice, async (req, res, next) => {
  assertKnownDevice(req);
  const { success, data, error } = UpdateDepartmentRequest.safeParse(req.body);
  if (!success) {
    logger.error('Invalid department data provided:', error.message);
    return next(new HttpError(400, 'Invalid department data provided.'));
  }

  try {
    const department = await DepartmentService.update(data.department);
    res.status(200).json(department);
  } catch (e) {
    next(e);
  }
});

export default router;
