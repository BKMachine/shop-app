import { InfluxDBClient } from '@influxdata/influxdb3-client';
import logger from '../logger.js';
import { storeMachineStatus } from './machineStatus.js';

const url = process.env.INFLUX_HOST || 'http://localhost:8181';
const token = process.env.INFLUX_TOKEN || '';
const database = process.env.INFLUX_DATABASE || 'my-database';
const isWriteEnabled = process.env.NODE_ENV === 'production';

let influx: InfluxDBClient;
let statusTimer: NodeJS.Timeout;

export async function connect(): Promise<void> {
  influx = new InfluxDBClient({ host: url, token, database });

  await preflightInflux({ influx });

  logger.info(
    `Connected to InfluxDB v3 at ${url} with database "${database}" (${isWriteEnabled ? 'read/write' : 'read-only'})`,
  );

  if (!isWriteEnabled) {
    return;
  }

  statusTimer = setInterval(() => {
    storeMachineStatus(influx, database);
  }, 1000 * 15);
}

export async function disconnect(): Promise<void> {
  if (statusTimer) clearInterval(statusTimer);
  if (influx) influx.close();
}

export async function queryRows(sql: string): Promise<Record<string, unknown>[]> {
  if (!influx) {
    throw new Error('InfluxDB is not connected');
  }

  const rows: Record<string, unknown>[] = [];
  const queryResult = influx.query(sql, database);
  for await (const row of queryResult) {
    rows.push(row);
  }

  return rows;
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
