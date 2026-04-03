declare global {
  namespace Express {
    interface Request {
      device?: DeviceDoc;
      deviceId?: string;
      deviceContext?: {
        clientIp: string | null;
        userAgent: string | null;
      };
    }
  }
}

export {};
