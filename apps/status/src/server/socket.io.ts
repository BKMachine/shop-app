import type http from 'http';
import { Server } from 'socket.io';
import logger from '../logger.js';

let io: Server;

export default function (server: http.Server) {
  io = new Server<ServerToClientEvents>(server, {
    cors: {
      origin: [process.env.BASE_URL as string],
    },
    path: '/status-api/socket.io',
  });

  io.of('/status-api').on('connection', (socket) => {
    logger.info('SOCKET CONNECTED');
    socket.on('disconnect', () => {
      logger.info('SOCKET DISCONNECTED');
    });
  });
}

export function emit(event: EmitterEventNames, data?: any): void {
  if (io) io.of('/status-api').emit(event, data);
}
