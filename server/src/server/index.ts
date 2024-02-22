import { Server } from 'http';
import { HttpTerminator, createHttpTerminator } from 'http-terminator';
import logger from '../logger';
import app from './app';

let httpTerminator: HttpTerminator;

export function start(): void {
  const server = new Server(app);
  const port = process.env.PORT || 3000;
  httpTerminator = createHttpTerminator({ server });
  server.listen(port);
  logger.info(`Listening on port ${port}`);
}

export async function stop(): Promise<void> {
  if (httpTerminator) await httpTerminator.terminate();
  logger.info('Server connections closed');
}
