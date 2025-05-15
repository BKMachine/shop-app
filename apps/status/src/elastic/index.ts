import { Client } from '@elastic/elasticsearch';
import logger from '../logger.js';
import { storeMachineStatus } from './machineStatus.js';
import { storePerformance } from './performance.js';

const client = new Client({
  node: process.env.ELASTIC_URL,
  auth: {
    username: 'elastic',
    password: process.env.ELASTIC_PASSWORD as string,
  },
});

export const prefix = process.env.NODE_ENV === 'development' ? 'dev-' : '';

let statusTimer: NodeJS.Timeout;
let performanceTimer: NodeJS.Timeout;

export function connect(): Promise<void> {
  return new Promise((resolve, reject) => {
    client
      .ping()
      .then(() => {
        logger.info('Connected to Elasticsearch');
        statusTimer = setInterval(storeMachineStatus, 1000 * 15);
        performanceTimer = setInterval(storePerformance, 1000 * 60);
        resolve();
      })
      .catch((e: Error) => {
        reject(e);
      });
  });
}

export function disconnect(): Promise<void> {
  if (statusTimer) clearInterval(statusTimer);
  if (performanceTimer) clearInterval(performanceTimer);
  return client.close();
}

export default client;
