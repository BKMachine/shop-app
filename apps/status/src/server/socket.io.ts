import type http from 'node:http';
import { Server } from 'socket.io';
import logger from '../logger.js';

let io: Server;

export default function (server: http.Server) {
  io = new Server<ServerToClientEvents>(server, {
    cors: {
      origin: '*',
    },
  });

  io.on('connection', (socket) => {
    logger.info('SOCKET CONNECTED');
    socket.on('disconnect', () => {
      logger.info('SOCKET DISCONNECTED');
    });
  });
}

export function emit(event: EmitterEventNames, data?: unknown): void {
  if (io) io.emit(event, data);
}
