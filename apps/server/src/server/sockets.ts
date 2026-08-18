import type http from 'node:http';
import { Server } from 'socket.io';
import DeviceService from '../database/lib/device/device_service.js';
import logger from '../logger.js';
import {
  activeWebSocketConnections,
  normalizeSocketDeviceDisplayName,
  webSocketConnectionsTotal,
} from '../metrics.js';

let io: Server;

function getHeaderValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0]?.trim() || undefined;
  }

  return value?.trim() || undefined;
}

function getClientIp(
  socket: Parameters<Server['on']>[1] extends (socket: infer T) => void ? T : never,
) {
  const forwardedFor = getHeaderValue(socket.handshake.headers['x-forwarded-for']);
  if (forwardedFor) {
    const forwardedIp = forwardedFor.split(',')[0]?.trim();
    if (forwardedIp) return forwardedIp;
  }

  const realIp = getHeaderValue(socket.handshake.headers['x-real-ip']);
  if (realIp) return realIp;

  return socket.handshake.address;
}

export default function (server: http.Server) {
  io = new Server(server, {
    cors: {
      origin: [process.env.BASE_URL as string],
    },
  });

  io.on('connection', (socket) => {
    activeWebSocketConnections.inc();
    const ip = getClientIp(socket);
    let displayName = ip;
    let finalized = false;

    const finalizeDisconnect = () => {
      if (finalized) {
        return;
      }

      finalized = true;
      activeWebSocketConnections.dec();
      logger.info(`SOCKET DISCONNECTED: ${displayName}`);
    };

    socket.once('disconnect', finalizeDisconnect);
    socket.once('disconnecting', finalizeDisconnect);

    DeviceService.findByIp(ip)
      .then((device) => {
        displayName = device ? device.displayName : ip;
      })
      .finally(() => {
        const metricDisplayName = normalizeSocketDeviceDisplayName(displayName);
        webSocketConnectionsTotal.inc({ device_display_name: metricDisplayName });
        logger.info(`SOCKET CONNECTED: ${displayName}`);
      });
  });
}

export function emit(event: string, data?: unknown): void {
  if (io) io.emit(event, data);
}
