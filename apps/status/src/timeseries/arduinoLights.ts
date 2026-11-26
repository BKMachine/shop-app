import { Point } from '@influxdata/influxdb3-client';
import { writePoints } from './influx.js';

const MEASUREMENT = 'arduino_lights';

/**
 * Records an Arduino's lights and counters when they change, or that the board stopped answering
 * (no reading). With the board's own green counters, every run, hold and stop can be rebuilt
 * afterwards with exact times, which the 5-second polls alone can't give.
 */
export function storeArduinoLights(
  machine: { id: string; name: string },
  reading: ArduinoResponse | null,
  timestamp: Date,
): void {
  writePoints([arduinoLightsPoint(machine, reading, timestamp)]);
}

export function arduinoLightsPoint(
  machine: { id: string; name: string },
  reading: ArduinoResponse | null,
  timestamp: Date,
): Point {
  const point = Point.measurement(MEASUREMENT)
    .setTag('dev', process.env.NODE_ENV !== 'production' ? 'dev' : 'prod')
    .setTag('name', machine.name)
    .setTag('id', machine.id)
    .setTimestamp(timestamp)
    .setBooleanField('reachable', reading !== null);
  if (!reading) return point;

  point
    .setBooleanField('green', reading.green)
    .setBooleanField('yellow', reading.yellow)
    .setBooleanField('red', reading.red);
  // Older firmware sends only the lights.
  if (isCount(reading.greenStarts)) point.setIntegerField('greenStarts', reading.greenStarts);
  if (isCount(reading.greenMs)) point.setIntegerField('greenMs', reading.greenMs);
  if (isCount(reading.uptimeMs)) point.setIntegerField('uptimeMs', reading.uptimeMs);
  return point;
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}
