import * as serial from './serial.js';

test('parseLastCycle method', () => {
  expect(serial.parseLastCycle('000142')).toBe(102000);
  expect(serial.parseLastCycle('00000142')).toBe(102000);
});
