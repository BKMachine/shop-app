import { Point, type WriteApi } from '@influxdata/influxdb-client';
import machines from '../machines/index.js';

export function storeMachineStatus(writeApi: WriteApi) {
  const timestamp = new Date();
  const points: Point[] = [];
  for (const [key, value] of machines) {
    const status = value.getStatus();

    const point = new Point('status')
      .timestamp(timestamp)
      .tag('name', value.getMachine().name)
      .tag('id', key)
      .stringField('state', status);
    points.push(point);
  }

  writeApi.writePoints(points);
  if (process.env.NODE_ENV !== 'production') writeApi.flush();
}
