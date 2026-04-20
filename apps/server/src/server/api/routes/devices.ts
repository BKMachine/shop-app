import { Router } from 'express';
import * as z from 'zod';
import DeviceService from '../../../database/lib/device/device_service.js';
import logger from '../../../logger.js';
import HttpError from '../../middleware/httpError.js';
import {
  assertKnownDevice,
  getClientIp,
  requireKnownDevice,
} from '../../middleware/knownDevices.js';

const router: Router = Router();

const RegisterDeviceRequest = z.strictObject({
  deviceId: z.string().trim().min(1),
  displayName: z.string().trim().min(1).max(60),
  deviceType: z.enum(['pc', 'android', 'unknown']).default('unknown'),
});

router.post('/devices/register', async (req, res, next) => {
  const { success, data, error } = RegisterDeviceRequest.safeParse(req.body);
  if (!success) {
    logger.error('Invalid device registration data provided:', error.message);
    return next(new HttpError(400, 'Invalid device registration data provided.'));
  }

  try {
    const existing = await DeviceService.findDeviceById(data.deviceId);
    if (existing) return next(new HttpError(409, 'This device is already registered.'));

    const clientIp = getClientIp(req);
    const userAgent =
      typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null;

    const device = await DeviceService.addDevice({
      deviceId: data.deviceId,
      displayName: data.displayName,
      deviceType: data.deviceType,
      isAdmin: false,
      approved: true,
      blocked: false,
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      lastIp: clientIp,
      lastUserAgent: userAgent,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return res.status(201).json({ device });
  } catch (error) {
    next(error);
  }
});

router.get('/devices/me', requireKnownDevice, async (req, res, next) => {
  assertKnownDevice(req);

  try {
    return res.status(200).json({ device: req.device });
  } catch (error) {
    next(error);
  }
});

export default router;
