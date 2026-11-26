jest.mock('./influx.js', () => ({ writePoints: jest.fn() }));

import { arduinoLightsPoint, storeArduinoLights } from './arduinoLights.js';
import { writePoints } from './influx.js';

const MACHINE = { id: 'id-1', name: 'ML1' };
const AT = new Date('2026-11-20T15:00:00.000Z');

function line(reading: ArduinoResponse | null) {
  return arduinoLightsPoint(MACHINE, reading, AT).toLineProtocol() ?? '';
}

describe('Arduino lights in InfluxDB', () => {
  it('records the lights and counters, tagged with the machine', () => {
    const text = line({
      green: true,
      yellow: false,
      red: false,
      greenStarts: 12,
      greenMs: 492000,
      uptimeMs: 86400000,
    });

    expect(text).toMatch(/^arduino_lights,/);
    expect(text).toContain('name=ML1');
    expect(text).toContain('id=id-1');
    expect(text).toContain('reachable=T');
    expect(text).toContain('green=T');
    expect(text).toContain('yellow=F');
    expect(text).toContain('greenStarts=12i');
    expect(text).toContain('greenMs=492000i');
    expect(text).toContain('uptimeMs=86400000i');
  });

  it('records only the lights from older firmware', () => {
    const text = line({ green: false, yellow: true, red: false });

    expect(text).toContain('yellow=T');
    expect(text).not.toContain('greenStarts');
    expect(text).not.toContain('greenMs');
  });

  it('records a board that stopped answering', () => {
    const text = line(null);

    expect(text).toContain('reachable=F');
    expect(text).not.toContain('green=');
  });

  it('writes the point', () => {
    storeArduinoLights(MACHINE, { green: true, yellow: false, red: false }, AT);
    expect(writePoints).toHaveBeenCalledWith([expect.anything()]);
  });
});
