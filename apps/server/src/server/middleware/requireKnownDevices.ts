import type { NextFunction, Request, Response } from 'express';
import DeviceService from '../../database/lib/device/device_service.js';

const LAST_SEEN_UPDATE_INTERVAL_MS = 5 * 60 * 1000;

export default async function requireKnownDevice(req: Request, res: Response, next: NextFunction) {
  try {
    const rawDeviceId = req.header('x-device-id')?.trim();

    if (!rawDeviceId) {
      return res.status(400).json({
        error: 'missing_device_id',
        message: 'Missing X-Device-Id header.',
      });
    }

    const clientIp = getClientIp(req);
    const userAgent =
      typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null;

    const device = await DeviceService.findDeviceById(rawDeviceId);

    if (!device) {
      return res.status(403).json({
        error: 'device_not_registered',
        message: 'This device is not registered.',
      });
    }

    if (device.blocked) {
      return res.status(403).json({
        error: 'device_blocked',
        message: 'This device is blocked.',
      });
    }

    if (!device.approved) {
      return res.status(403).json({
        error: 'device_not_approved',
        message: 'This device is not approved.',
      });
    }

    req.device = device;
    req.deviceId = device._id.toString();
    req.deviceContext = {
      clientIp,
      userAgent,
    };

    const now = Date.now();
    const lastSeenTime = device.lastSeenAt?.getTime() ?? 0;

    const shouldUpdateLastSeen = now - lastSeenTime >= LAST_SEEN_UPDATE_INTERVAL_MS;

    const shouldUpdateIp = (clientIp ?? null) !== (device.lastIp ?? null);
    const shouldUpdateUserAgent = (userAgent ?? null) !== (device.lastUserAgent ?? null);

    if (shouldUpdateLastSeen || shouldUpdateIp || shouldUpdateUserAgent) {
      const update: Record<string, unknown> = {};

      if (shouldUpdateLastSeen) {
        update.lastSeenAt = new Date(now);
      }

      if (shouldUpdateIp) {
        update.lastIp = clientIp;
      }

      if (shouldUpdateUserAgent) {
        update.lastUserAgent = userAgent;
      }

      DeviceService.updateDevice(device._id.toString(), update);
    }

    next();
  } catch (error) {
    next(error);
  }
}

export function getClientIp(req: Request): string | null {
  const ip = req.ip || req.socket.remoteAddress || null;
  if (!ip) return null;

  if (ip.startsWith('::ffff:')) return ip.slice(7);
  if (ip === '::1') return '127.0.0.1';

  return ip;
}
