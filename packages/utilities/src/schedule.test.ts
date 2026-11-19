import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addDays,
  changedSchedulePlacements,
  DEFAULT_SCHEDULE_SETTINGS,
  diffDays,
  estimateScheduleLength,
  isDayKey,
  isSchedulableOperation,
  placeScheduleEntry,
  scheduleDueTone,
} from './schedule.js';

const entry = (_id: string, start: string, days: number, machineId = 'm1') => ({
  _id,
  machineId,
  start,
  days,
});

test('day keys add and subtract across months and leap days', () => {
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(diffDays('2026-11-01', '2026-11-17'), 16);
  assert.equal(diffDays('2026-11-17', '2026-11-01'), -16);
});

test('isDayKey rejects impossible dates and other shapes', () => {
  assert.equal(isDayKey('2026-11-17'), true);
  assert.equal(isDayKey('2026-02-30'), false);
  assert.equal(isDayKey('2026-11-17T00:00:00Z'), false);
  assert.equal(isDayKey(20261117), false);
});

test('a drop into free space keeps its place and moves nothing else', () => {
  const entries = [entry('a', '2026-11-02', 2), entry('b', '2026-11-10', 3)];
  const result = placeScheduleEntry(entries, entry('b', '2026-11-05', 3));
  assert.deepEqual(result, [entry('a', '2026-11-02', 2), entry('b', '2026-11-05', 3)]);
});

test('dropping on the front half of a job goes ahead of it and pushes the rest', () => {
  const entries = [
    entry('a', '2026-11-02', 4), // 2nd..5th, midpoint at the 4th
    entry('b', '2026-11-06', 2),
    entry('c', '2026-11-20', 1),
    entry('x', '2026-11-25', 2),
  ];
  const result = placeScheduleEntry(entries, entry('x', '2026-11-03', 2));
  assert.deepEqual(result, [
    entry('a', '2026-11-05', 4),
    entry('b', '2026-11-09', 2),
    entry('c', '2026-11-20', 1),
    entry('x', '2026-11-03', 2),
  ]);
});

test('dropping on the back half of a job goes after it', () => {
  const entries = [entry('a', '2026-11-02', 4), entry('x', '2026-11-20', 2)];
  const result = placeScheduleEntry(entries, entry('x', '2026-11-05', 2));
  assert.deepEqual(result, [entry('a', '2026-11-02', 4), entry('x', '2026-11-06', 2)]);
});

test('lengthening a job pushes the jobs behind it', () => {
  const entries = [entry('a', '2026-11-02', 2), entry('b', '2026-11-04', 2)];
  const result = placeScheduleEntry(entries, entry('a', '2026-11-02', 4));
  assert.deepEqual(result, [entry('a', '2026-11-02', 4), entry('b', '2026-11-06', 2)]);
});

test('other machines are left alone and a new entry is appended', () => {
  const entries = [entry('a', '2026-11-02', 4, 'm2')];
  const result = placeScheduleEntry(entries, entry('new', '2026-11-03', 1));
  assert.deepEqual(result, [entry('a', '2026-11-02', 4, 'm2'), entry('new', '2026-11-03', 1)]);
});

test('changedSchedulePlacements lists only moved entries', () => {
  const before = [entry('a', '2026-11-02', 2), entry('b', '2026-11-04', 2)];
  const after = placeScheduleEntry(before, entry('a', '2026-11-02', 3));
  assert.deepEqual(changedSchedulePlacements(before, after), [
    entry('a', '2026-11-02', 3),
    entry('b', '2026-11-05', 2),
  ]);
});

test('scheduleDueTone compares the last booked day with the due date', () => {
  const booking = entry('a', '2026-11-02', 3); // last day the 4th
  assert.equal(scheduleDueTone(booking, null), 'none');
  assert.equal(scheduleDueTone(booking, '2026-11-03'), 'late');
  assert.equal(scheduleDueTone(booking, '2026-11-04'), 'tight');
  assert.equal(scheduleDueTone(booking, '2026-11-07'), 'tight');
  assert.equal(scheduleDueTone(booking, '2026-11-08'), 'ok');
});

const settings = {
  ...DEFAULT_SCHEDULE_SETTINGS,
  departmentUtilization: { mills: 50 },
};

test('estimateScheduleLength spreads qty × cycle over the cutting part of a working day', () => {
  // 9 h days at 40% = 216 cutting minutes; 100 × 6 min = 600 → 3 working days.
  const estimate = estimateScheduleLength({
    cycleMinutes: 6,
    qty: 100,
    departmentId: 'lathes',
    start: '2026-11-16', // Monday
    settings,
  });
  assert.equal(estimate?.runMinutes, 600);
  assert.equal(estimate?.utilization, 40);
  assert.equal(estimate?.workingDays, 3);
  assert.equal(estimate?.days, 3);
});

test("estimateScheduleLength uses the machine department's utilization", () => {
  // Mills at 50% = 270 min/day; 100 × 3 = 300 → 2 days.
  const estimate = estimateScheduleLength({
    cycleMinutes: 3,
    qty: 100,
    departmentId: 'mills',
    start: '2026-11-16',
    settings,
  });
  assert.equal(estimate?.utilization, 50);
  assert.equal(estimate?.workingDays, 2);
});

test('estimateScheduleLength stretches over days off', () => {
  // 4 working days from a Thursday run Thu, Fri, (Sat, Sun), Mon, Tue = 6 calendar days.
  const estimate = estimateScheduleLength({
    cycleMinutes: 8.64,
    qty: 100,
    departmentId: 'lathes',
    start: '2026-11-19',
    settings,
  });
  assert.equal(estimate?.workingDays, 4);
  assert.equal(estimate?.days, 6);
});

test('estimateScheduleLength gives nothing without cycle time or qty', () => {
  const base = { departmentId: 'mills', start: '2026-11-16', settings };
  assert.equal(estimateScheduleLength({ ...base, cycleMinutes: 0, qty: 10 }), null);
  assert.equal(estimateScheduleLength({ ...base, cycleMinutes: null, qty: 10 }), null);
  assert.equal(estimateScheduleLength({ ...base, cycleMinutes: 5, qty: 0 }), null);
});

test('isSchedulableOperation leaves out ops with no cycle time', () => {
  assert.equal(isSchedulableOperation({ noCycleTime: false }), true);
  assert.equal(isSchedulableOperation({}), true);
  assert.equal(isSchedulableOperation({ noCycleTime: true }), false);
});
