/// <reference types="jest" />

import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { createScheduleAuditQueue, type QueuedScheduleChange } from '../schedule_audit_queue.js';

type Booking = { _id: string; job: string; start: string; days: number };

const QUIET_MS = 120_000;
const booking = (_id: string, job: string, start: string, days = 2): Booking => ({
  _id,
  job,
  start,
  days,
});

function setup() {
  const written: QueuedScheduleChange<Booking>[][] = [];
  const queue = createScheduleAuditQueue<Booking>({
    quietMs: QUIET_MS,
    idOf: (entry) => entry._id,
    groupOf: (entry) => entry.job,
    same: (before, after) => before.start === after.start && before.days === after.days,
    write: async (changes) => {
      written.push(changes);
    },
    onError: () => undefined,
  });
  return { queue, written };
}

describe('schedule audit queue', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('audits a booking once, from its first to its last placement, after the quiet time', async () => {
    const { queue, written } = setup();
    queue.queue([booking('a', 'j1', '2026-11-02')], [booking('a', 'j1', '2026-11-03')], 'd1');
    await jest.advanceTimersByTimeAsync(QUIET_MS - 1000);
    queue.queue([booking('a', 'j1', '2026-11-03')], [booking('a', 'j1', '2026-11-05')], 'd2');
    await jest.advanceTimersByTimeAsync(QUIET_MS - 1000);
    expect(written).toEqual([]);

    await jest.advanceTimersByTimeAsync(1000);
    expect(written).toHaveLength(1);
    expect(written[0]).toEqual([
      expect.objectContaining({
        before: booking('a', 'j1', '2026-11-02'),
        after: booking('a', 'j1', '2026-11-05'),
        deviceId: 'd2',
      }),
    ]);
    expect(queue.size()).toBe(0);
  });

  test('keeps a separate quiet time for each job', async () => {
    const { queue, written } = setup();
    queue.queue([booking('a', 'j1', '2026-11-02')], [booking('a', 'j1', '2026-11-03')], 'd1');
    await jest.advanceTimersByTimeAsync(QUIET_MS / 2);
    queue.queue([booking('b', 'j2', '2026-11-06')], [booking('b', 'j2', '2026-11-07')], 'd1');
    await jest.advanceTimersByTimeAsync(QUIET_MS / 2);

    expect(written.map((changes) => changes.map((change) => change.after?._id))).toEqual([['a']]);
    await jest.advanceTimersByTimeAsync(QUIET_MS / 2);
    expect(written).toHaveLength(2);
  });

  test('writes nothing for a booking that ends up back where it started', async () => {
    const { queue, written } = setup();
    queue.queue([booking('a', 'j1', '2026-11-02')], [booking('a', 'j1', '2026-11-04')], 'd1');
    queue.queue([booking('a', 'j1', '2026-11-04')], [booking('a', 'j1', '2026-11-02')], 'd1');
    await jest.advanceTimersByTimeAsync(QUIET_MS);
    expect(written).toEqual([]);
  });

  test('a booking created and removed in one run writes nothing; one created and moved is a create', async () => {
    const { queue, written } = setup();
    queue.queue([], [booking('a', 'j1', '2026-11-02')], 'd1');
    queue.queue([booking('a', 'j1', '2026-11-02')], [], 'd1');
    queue.queue([], [booking('b', 'j1', '2026-11-02')], 'd1');
    queue.queue([booking('b', 'j1', '2026-11-02')], [booking('b', 'j1', '2026-11-03')], 'd1');
    await jest.advanceTimersByTimeAsync(QUIET_MS);
    expect(written).toEqual([
      [expect.objectContaining({ before: null, after: booking('b', 'j1', '2026-11-03') })],
    ]);
  });

  test('flush writes everything still waiting without the quiet time', async () => {
    const { queue, written } = setup();
    queue.queue([booking('a', 'j1', '2026-11-02')], [booking('a', 'j1', '2026-11-03')], 'd1');
    queue.queue([booking('b', 'j2', '2026-11-06')], [], 'd1');
    await queue.flush();

    expect(written).toHaveLength(2);
    expect(queue.size()).toBe(0);
    await jest.advanceTimersByTimeAsync(QUIET_MS);
    expect(written).toHaveLength(2);
  });
});
