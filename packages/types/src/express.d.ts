declare global {
  namespace Express {
    interface Request {
      device?: DeviceDoc;
      deviceContext?: {
        deviceId: string;
        clientIp: string | null;
        userAgent: string | null;
      };
    }
  }
}

export {};
