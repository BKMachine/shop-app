import { Router } from 'express';
import DeviceService from '../../../database/lib/device/device_service.js';
import HttpError from '../../middleware/httpError.js';
import requireKnownDevice, { getClientIp } from '../../middleware/requireKnownDevices.js';

const router: Router = Router();

router.post('/devices/register', async (req, res, next) => {
  try {
    const deviceId = String(req.body.deviceId ?? '').trim();
    const displayName = String(req.body.displayName ?? '').trim();
    const deviceType = String(req.body.deviceType ?? 'unknown').trim() as
      | 'pc'
      | 'android'
      | 'unknown';

    if (!deviceId) return next(new HttpError(400, 'deviceId is required.'));

    if (!displayName) return next(new HttpError(400, 'displayName is required.'));

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

    return res.status(201).json({
      device: {
        id: device._id,
        deviceId: device.deviceId,
        displayName: device.displayName,
        deviceType: device.deviceType,
        isAdmin: device.isAdmin,
        approved: device.approved,
        blocked: device.blocked,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/devices/me', requireKnownDevice, async (req, res, next) => {
  try {
    if (!req.device) {
      res.status(401).json({ error: 'Unauthorized: device not recognized.' });
      return;
    }

    return res.status(200).json({
      device: {
        id: req.device._id,
        deviceId: req.device.deviceId,
        displayName: req.device.displayName,
        deviceType: req.device.deviceType,
        isAdmin: req.device.isAdmin,
        approved: req.device.approved,
        blocked: req.device.blocked,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
