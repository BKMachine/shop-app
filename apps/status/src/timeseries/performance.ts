import { type InfluxDBClient, Point } from '@influxdata/influxdb3-client';
import machines from '../machines/index.js';

export function storePerformance(influx: InfluxDBClient, database: string): void {
  let running = 0;
  let notRunning = 0;
  for (const [, value] of machines) {
    const status = value.getStatus();
    if (status === 'green') running++;
    else if (status !== 'offline') notRunning++;
  }
  const total = running + notRunning;

  const point = Point.measurement('performance')
    .setTimestamp(new Date())
    .setIntegerField('running', running)
    .setIntegerField('notRunning', notRunning)
    .setFloatField('percent', Math.round(((running / total) * 100 + Number.EPSILON) * 100) / 100)
    .setFloatField(
      'totalPercent',
      Math.round(((running / machines.size) * 100 + Number.EPSILON) * 100) / 100,
    )
    .setIntegerField('machineCount', machines.size);

  influx.write(point, database);
}

export async function getHourlyRate() {
  return 0;
  // const running = await client.search({
  //   index: `${prefix}status-*`,
  //   size: 0,
  //   query: {
  //     bool: {
  //       must: [{ match: { status: 'green' } }],
  //       filter: [
  //         {
  //           range: {
  //             '@timestamp': {
  //               format: 'strict_date_optional_time',
  //               gte: 'now-1h',
  //             },
  //           },
  //         },
  //       ],
  //     },
  //   },
  // });

  // const runningCount = (running as StatsResponse).hits.total.value;

  // const online = await client.search({
  //   index: `${prefix}status-*`,
  //   size: 0,
  //   query: {
  //     bool: {
  //       must_not: [{ match: { status: 'offline' } }],
  //       filter: [
  //         {
  //           range: {
  //             '@timestamp': {
  //               format: 'strict_date_optional_time',
  //               gte: 'now-1h',
  //             },
  //           },
  //         },
  //       ],
  //     },
  //   },
  // });

  // const onlineCount = (online as StatsResponse).hits.total.value;

  // return Math.round(((runningCount / onlineCount) * 100 + Number.EPSILON) * 100) / 100;
}

export async function getHourlyPerformance(): Promise<unknown[]> {
  return [];
  // const performance = await client.search({
  //   index: `${prefix}performance`,
  //   size: 100,
  //   query: {
  //     bool: {
  //       filter: {
  //         range: {
  //           '@timestamp': {
  //             format: 'strict_date_optional_time',
  //             gte: 'now-1h',
  //           },
  //         },
  //       },
  //     },
  //   },
  // });

  // return performance.hits.hits;
}
