import { createServer } from 'node:http';
import { getRequestListener } from '@hono/node-server';
import { createHttpTerminator, type HttpTerminator } from 'http-terminator';
import logger from '../logger.js';
import app from './app.js';
import sockets from './socket.io.js';

let httpTerminator: HttpTerminator;

export function start(): void {
  const server = createServer(getRequestListener(app.fetch));
  sockets(server);
  const port = process.env.PORT || 3000;
  httpTerminator = createHttpTerminator({ server });
  server.listen(port, () => {
    logger.info(`Listening on port ${port}`);
  });
}

export async function stop(): Promise<void> {
  if (httpTerminator) await httpTerminator.terminate();
  logger.info('Server connections closed');
}
