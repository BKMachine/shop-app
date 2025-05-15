import * as database from './database/index.js';
import * as elastic from './elastic/index.js';
import * as machines from './machines/index.js';
import * as arduino from './machines/Arduino/arduino_polling.js';
import * as mqtt from './machines/Focas/mqtt.js';
import * as serial from './machines/Haas/serial.js';
import * as mtconnect from './machines/MTConnect/mtconnect_polling.js';
import * as server from './server/index.js';

export async function start(): Promise<void> {
  await database.connect();
  await machines.initMachines();
  await elastic.connect();
  await mqtt.connect();
  arduino.start();
  mtconnect.start();
  serial.start();
  server.start();
}

export async function stop(): Promise<void> {
  await server.stop();
  serial.stop();
  mtconnect.stop();
  arduino.stop();
  mqtt.disconnect();
  await elastic.disconnect();
  await database.disconnect();
}
