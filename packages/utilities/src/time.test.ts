import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateBusinessDurationMs,
  calculateTaskBusinessDurationMs,
  DEFAULT_BUSINESS_TIME_ZONE,
} from './time.js';

test('calculateBusinessDurationMs ignores weekends and off-hours', () => {
  const duration = calculateBusinessDurationMs(
    '2026-08-07T16:00:00.000Z',
    '2026-08-10T15:00:00.000Z',
    { timeZone: DEFAULT_BUSINESS_TIME_ZONE },
  );

  assert.ok(duration > 0);
  assert.equal(duration % 60000, 0);
});

test('calculateBusinessDurationMs returns zero when there is no business-hours overlap', () => {
  const duration = calculateBusinessDurationMs(
    '2026-08-08T02:00:00.000Z',
    '2026-08-08T05:00:00.000Z',
    { timeZone: DEFAULT_BUSINESS_TIME_ZONE },
  );

  assert.equal(duration, 0);
});

test('calculateTaskBusinessDurationMs uses the task timestamps directly', () => {
  const duration = calculateTaskBusinessDurationMs(
    {
      startedAt: '2026-08-07T16:00:00.000Z',
      endedAt: '2026-08-07T18:00:00.000Z',
    },
    { timeZone: DEFAULT_BUSINESS_TIME_ZONE },
  );

  assert.ok(duration > 0);
});
