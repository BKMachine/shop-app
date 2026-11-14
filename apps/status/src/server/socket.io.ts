import type http from 'node:http';
import { type DefaultEventsMap, Server } from 'socket.io';
import { corsOrigin } from '../config.js';
import logger from '../logger.js';
import { machineEvents } from '../machines/events.js';

let io: Server<DefaultEventsMap, ServerToClientEvents> | undefined;

export default function (server: http.Server) {
  io = new Server(server, {
    cors: {
      origin: corsOrigin,
    },
  });

  io.on('connection', (socket) => {
    logger.info('SOCKET CONNECTED');
    socket.on('disconnect', () => {
      logger.info('SOCKET DISCONNECTED');
    });
  });

  machineEvents.on('change', (data) => emit('change', data));
  machineEvents.on('status', (data) => emit('status', data));
  machineEvents.on('refresh-data', () => emit('refresh-data'));
}

export function emit<Event extends EmitterEventNames>(
  event: Event,
  ...data: Parameters<ServerToClientEvents[Event]>
): void {
  io?.emit(event, ...data);
}
