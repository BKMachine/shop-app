import * as server from './server/index.js';

export async function start(): Promise<void> {
  server.start();
}

export async function stop(): Promise<void> {
  await server.stop();
}
