import logger from '../logger.js';
import machines from '../machines/index.js';
import client, { prefix } from './index.js';

export function storeMachineStatus() {
  const timestamp = new Date().toISOString();
  const operations: string[] = [];
  for (const [key, value] of machines) {
    const status = value.getStatus();
    const meta = { create: { _index: `${prefix}status-${key}` } };
    const body = { status, '@timestamp': timestamp };
    operations.push(`${JSON.stringify(meta)}\n${JSON.stringify(body)}`);
  }
  client.bulk({ operations }).catch(() => {
    logger.error('Elastic Bulk write error');
  });
}
