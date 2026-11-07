import * as serial from './serial.js';

// The parser doesn't need the machine registry, which would load the database and socket server.
jest.mock('../index.js', () => ({ haasMachines: new Map() }));

test('parseLastCycle method', () => {
  expect(serial.parseLastCycle('000142')).toBe(102000);
  expect(serial.parseLastCycle('00000142')).toBe(102000);
});
