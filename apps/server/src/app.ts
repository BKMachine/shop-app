import * as database from './database/index.js';
import * as server from './server/index.js';

export async function start(): Promise<void> {
  await database.connect();
  server.start();
}

export async function stop(): Promise<void> {
  await server.stop();
  await database.disconnect();
}
