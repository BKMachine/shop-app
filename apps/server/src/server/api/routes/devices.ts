import { Router } from 'express';
import DeviceService from '../../../database/lib/device/device_service.js';
import { getClientIp } from '../../middleware/requireKnownDevices.js';

const router: Router = Router();

router.post('/devices/register', async (req, res, next) => {
  try {
    const deviceId = String(req.body.deviceId ?? '').trim();
    const displayName = String(req.body.displayName ?? '').trim();
    const deviceType = String(req.body.deviceType ?? 'unknown').trim() as
      | 'pc'
      | 'android'
      | 'unknown';

    if (!deviceId) {
      return res.status(400).json({
        error: 'missing_device_id',
        message: 'deviceId is required.',
      });
    }

    if (!displayName) {
      return res.status(400).json({
        error: 'missing_display_name',
        message: 'displayName is required.',
      });
    }

    const existing = await DeviceService.findDeviceById(deviceId);

    if (existing) {
      return res.status(409).json({
        error: 'device_already_registered',
        message: 'This device is already registered.',
      });
    }

    const clientIp = getClientIp(req);
    const userAgent =
      typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null;

    const device = await DeviceService.addDevice({
      deviceId,
      displayName,
      deviceType,
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
        approved: device.approved,
        blocked: device.blocked,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
