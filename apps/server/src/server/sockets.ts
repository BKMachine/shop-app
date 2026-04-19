import type http from 'node:http';
import { Server } from 'socket.io';
import DeviceService from '../database/lib/device/device_service.js';
import logger from '../logger.js';

let io: Server;

export default function (server: http.Server) {
  io = new Server(server, {
    cors: {
      origin: [process.env.BASE_URL as string],
    },
  });

  io.on('connection', (socket) => {
    const ip = socket.handshake.address;
    let displayName = ip;
    DeviceService.findByIp(ip)
      .then((device) => {
        displayName = device ? device.displayName : ip;
      })
      .finally(() => {
        logger.info(`SOCKET CONNECTED: ${displayName}`);
        socket.on('disconnect', () => {
          logger.info(`SOCKET DISCONNECTED: ${displayName}`);
        });
      });
  });
}

export function emit(event: string, data?: unknown): void {
  if (io) io.emit(event, data);
}
