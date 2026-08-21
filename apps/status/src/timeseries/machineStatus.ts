import { type InfluxDBClient, Point } from '@influxdata/influxdb3-client';
import machines from '../machines/index.js';

export function storeMachineStatus(influx: InfluxDBClient, database: string) {
  const timestamp = new Date();
  const points: Point[] = [];
  for (const [key, value] of machines) {
    const status = value.getStatus();
    const machine = value.getMachine();
    const department = machine.department.trim() || 'Unassigned';

    const point = Point.measurement('status')
      .setTag('dev', process.env.NODE_ENV !== 'production' ? 'dev' : 'prod')
      .setTimestamp(timestamp)
      .setTag('name', machine.name)
      .setTag('id', key)
      .setTag('department', department)
      .setStringField('state', status);
    points.push(point);
  }

  influx.write(points, database);
}
