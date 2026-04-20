import type { NextFunction, Request, Response } from 'express';
import type { HydratedDocument } from 'mongoose';
import DeviceService from '../../database/lib/device/device_service.js';
import HttpError from './httpError.js';

const LAST_SEEN_UPDATE_INTERVAL_MS = 5 * 60 * 1000;

type DeviceDoc = HydratedDocument<DeviceFields>;

export type KnownDeviceContext = NonNullable<Express.Request['deviceContext']>;

type KnownDeviceFields = {
  device: DeviceDoc;
  deviceId: string;
  deviceContext: KnownDeviceContext;
};

export type KnownDeviceRequest = Request & KnownDeviceFields;

/**
 * Validates the `X-Device-Id` header, loads the corresponding device, and
 * attaches authenticated device context to the Express request.
 *
 * On success this populates `req.device`, `req.deviceId`, and
 * `req.deviceContext` before calling `next()`. On failure it sends the
 * appropriate client-facing response for missing, unknown, blocked, or
 * unapproved devices.
 */
export async function requireKnownDevice(req: Request, res: Response, next: NextFunction) {
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
      deviceId: rawDeviceId,
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

/**
 * Narrows a request to the authenticated known-device shape after
 * `requireKnownDevice` has already run.
 *
 * This is an internal invariant check, not a client auth response path. If the
 * expected device context is missing, it throws a 500 `HttpError` because the
 * route or middleware chain is misconfigured.
 */
export function assertKnownDevice<T extends Request>(req: T): asserts req is T & KnownDeviceFields {
  if (!req.device || !req.deviceId || !req.deviceContext) {
    throw new HttpError(500, 'Known device context was expected but is missing.');
  }
}

export function getClientIp(req: Request): string | null {
  const ip = req.ip || req.socket.remoteAddress || null;
  if (!ip) return null;

  if (ip.startsWith('::ffff:')) return ip.slice(7);
  if (ip === '::1') return '127.0.0.1';

  return ip;
}
