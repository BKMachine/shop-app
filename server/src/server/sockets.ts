import http from 'http';
import { Server } from 'socket.io';
import logger from '../logger';

let io: Server;

export default function (server: http.Server) {
  io = new Server(server);

  io.on('connection', (socket) => {
    logger.info('SOCKET CONNECTED');
    socket.on('disconnect', () => {
      logger.info('SOCKET DISCONNECTED');
    });
  });
}

export function emit(event: string, data?: any): void {
  if (io) io.emit(event, data);
}
