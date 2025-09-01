import { type InfluxDBClient, Point } from '@influxdata/influxdb3-client';
import machines from '../machines/index.js';

export function storeMachineStatus(influx: InfluxDBClient, database: string) {
  const timestamp = new Date();
  const points: Point[] = [];
  for (const [key, value] of machines) {
    const status = value.getStatus();

    const point = Point.measurement('status')
      .setTimestamp(timestamp)
      .setTag('name', value.getMachine().name)
      .setTag('id', key)
      .setStringField('state', status);
    points.push(point);
  }

  influx.write(points, database);
}
