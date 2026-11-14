import { type InfluxDBClient, Point } from '@influxdata/influxdb3-client';
import machines from '../machines/index.js';

export async function storeMachineStatus(influx: InfluxDBClient, database: string): Promise<void> {
  const timestamp = new Date();
  const points: Point[] = [];
  for (const [id, machine] of machines) {
    const { name, department } = machine.toJSON();

    const point = Point.measurement('status')
      .setTag('dev', process.env.NODE_ENV !== 'production' ? 'dev' : 'prod')
      .setTimestamp(timestamp)
      .setTag('name', name)
      .setTag('id', id)
      .setTag('department', department.trim() || 'Unassigned')
      .setStringField('state', machine.getStatus());
    points.push(point);
  }

  if (points.length) await influx.write(points, database);
}
