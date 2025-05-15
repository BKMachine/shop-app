import { SearchResponse } from '@elastic/elasticsearch/lib/api/types.js';
import machines from '../machines/index.js';
import client, { prefix } from './index.js';

export function storePerformance() {
  let running = 0;
  let notRunning = 0;
  for (const [, value] of machines) {
    const status = value.getStatus();
    if (status === 'green') running++;
    else if (status !== 'offline') notRunning++;
  }
  const total = running + notRunning;
  client
    .index({
      index: `${prefix}performance`,
      document: {
        '@timestamp': new Date().toISOString(),
        running,
        notRunning,
        percent: Math.round(((running / total) * 100 + Number.EPSILON) * 100) / 100,
        machineCount: machines.size,
      },
    })
    .catch(() => {});
}

export async function getHourlyRate() {
  const running = await client.search({
    index: `${prefix}status-*`,
    size: 0,
    query: {
      bool: {
        must: [{ match: { status: 'green' } }],
        filter: [
          {
            range: {
              '@timestamp': {
                format: 'strict_date_optional_time',
                gte: 'now-1h',
              },
            },
          },
        ],
      },
    },
  });

  const runningCount = (running as StatsResponse).hits.total.value;

  const online = await client.search({
    index: `${prefix}status-*`,
    size: 0,
    query: {
      bool: {
        must_not: [{ match: { status: 'offline' } }],
        filter: [
          {
            range: {
              '@timestamp': {
                format: 'strict_date_optional_time',
                gte: 'now-1h',
              },
            },
          },
        ],
      },
    },
  });

  const onlineCount = (online as StatsResponse).hits.total.value;

  return Math.round(((runningCount / onlineCount) * 100 + Number.EPSILON) * 100) / 100;
}

export async function getHourlyPerformance() {
  const performance = await client.search({
    index: `${prefix}performance`,
    size: 100,
    query: {
      bool: {
        filter: {
          range: {
            '@timestamp': {
              format: 'strict_date_optional_time',
              gte: 'now-1h',
            },
          },
        },
      },
    },
  });

  return performance.hits.hits;
}
