import * as server from './server/index.js';

export async function start(): Promise<void> {
  if (!process.env.HAAS_SERIAL_API_KEY) {
    throw new Error('Missing HAAS_SERIAL_API_KEY environment variable.');
  }
  server.start();
}

export async function stop(): Promise<void> {
  await server.stop();
}
