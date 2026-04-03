import { Router } from 'express';
import DeviceService from '../../../database/lib/device/device_service.js';
import HttpError from '../../middleware/httpError.js';
import requireKnownDevice, { getClientIp } from '../../middleware/requireKnownDevices.js';

const router: Router = Router();

router.post('/devices/register', async (req, res, next) => {
  const deviceId = String(req.body.deviceId ?? '').trim();
  const displayName = String(req.body.displayName ?? '').trim();
  const deviceType = String(req.body.deviceType ?? 'unknown').trim() as
    | 'pc'
    | 'android'
    | 'unknown';
  if (!deviceId) return next(new HttpError(400, 'deviceId is required.'));
  if (!displayName) return next(new HttpError(400, 'displayName is required.'));

  try {
    const existing = await DeviceService.findDeviceById(deviceId);
    if (existing) return next(new HttpError(409, 'This device is already registered.'));

    const clientIp = getClientIp(req);
    const userAgent =
      typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null;

    const device = await DeviceService.addDevice({
      deviceId,
      displayName,
      deviceType,
      isAdmin: false,
      approved: true,
      blocked: false,
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      lastIp: clientIp,
      lastUserAgent: userAgent,
    });

    return res.status(201).json(device);
  } catch (error) {
    next(error);
  }
});

router.get('/devices/me', requireKnownDevice, async (req, res, next) => {
  if (!req.device) return next(new HttpError(401, 'Unauthorized: device not recognized.'));

  try {
    return res.status(200).json({ device: req.device });
  } catch (error) {
    next(error);
  }
});

export default router;
