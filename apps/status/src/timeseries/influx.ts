import { InfluxDBClient } from '@influxdata/influxdb3-client';
import logger from '../logger.js';
import { storeMachineStatus } from './machineStatus.js';
import { storePerformance } from './performance.js';

const url = process.env.INFLUX_HOST || 'http://localhost:8181';
const token = process.env.INFLUX_TOKEN || '';
const database = process.env.INFLUX_DATABASE || 'my-database';

let influx: InfluxDBClient;
let statusTimer: NodeJS.Timeout;
let performanceTimer: NodeJS.Timeout;

export async function connect(): Promise<void> {
  influx = new InfluxDBClient({ host: url, token, database });

  await preflightInflux({ influx });

  logger.info(`Connected to InfluxDB v3 at ${url} with database "${database}"`);

  statusTimer = setInterval(() => {
    storeMachineStatus(influx, database);
  }, 1000 * 15);

  performanceTimer = setInterval(() => {
    storePerformance(influx, database);
  }, 1000 * 60);
}

export async function disconnect(): Promise<void> {
  if (statusTimer) clearInterval(statusTimer);
  if (performanceTimer) clearInterval(performanceTimer);
  if (influx) influx.close();
}

export async function preflightInflux({ influx }: { influx: InfluxDBClient }) {
  try {
    const queryResult = influx.query('SELECT 1');
    for await (const _ of queryResult) {
      // just drain the iterator
    }
  } catch (err) {
    throw new Error(`InfluxDB v3 not reachable or unauthorized: ${(err as Error).message}`);
  }
}
