import type { HydratedDocument } from 'mongoose';

declare global {
  namespace Express {
    /**
     * Request metadata populated by server middleware during device authentication.
     */
    interface DeviceRequestContext {
      /**
       * Client-supplied device identifier from the `X-Device-Id` header.
       * This is the external registration identifier, not the Mongo document `_id`.
       */
      deviceId: string | null;

      /**
       * Best-effort client IP resolved from Express request networking information.
       */
      clientIp: string | null;

      /**
       * Raw user agent header captured when the request passed authentication.
       */
      userAgent: string | null;
    }

    /**
     * App-specific request extensions used by device-aware routes.
     *
     * These fields are optional on the base Express request because TypeScript
     * cannot infer middleware ordering. Routes protected by
     * `requireKnownDevice` can narrow them with `assertKnownDevice(...)`.
     */
    interface Request {
      /**
       * The approved device document resolved by `requireKnownDevice`.
       */
      device?: HydratedDocument<DeviceFields>;

      /**
       * Internal database id for the authenticated device.
       *
       * This is derived from `req.device._id`, not the raw header value.
       */
      deviceId?: string;

      /**
       * Additional request-scoped authentication metadata captured by
       * `requireKnownDevice`.
       */
      deviceContext?: DeviceRequestContext;
    }
  }
}

export {};
