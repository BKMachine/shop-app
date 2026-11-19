import {
  CreateScheduleEntryRequest,
  PlaceScheduleEntriesRequest,
  UpdateScheduleSettingsRequest,
} from '../schedule.js';

const machineId = '64b7f0c2a1b2c3d4e5f60718';
const job = '64b7f0c2a1b2c3d4e5f60719';
const placement = { _id: '64b7f0c2a1b2c3d4e5f6071a', machineId, start: '2026-11-17', days: 2 };

describe('CreateScheduleEntryRequest', () => {
  const accepts = (entry: Record<string, unknown>) =>
    CreateScheduleEntryRequest.safeParse({
      entry: { job, machineId, start: '2026-11-17', days: 3, ...entry },
    }).success;

  it('accepts a booking of whole days', () => {
    expect(accepts({})).toBe(true);
  });

  it('accepts a booking of one routing op', () => {
    expect(accepts({ op: 20, operation: 'Mill' })).toBe(true);
    expect(accepts({ routingId: '6a72c18abaa971f25ff86a2d', op: 20, operation: 'Mill' })).toBe(
      true,
    );
    expect(accepts({ routingId: null, op: null, operation: null })).toBe(true);
    expect(accepts({ routingId: 'op-20' })).toBe(false);
    expect(accepts({ op: 0 })).toBe(false);
    expect(accepts({ op: 10.5 })).toBe(false);
  });

  it('rejects partial, zero and huge lengths', () => {
    expect(accepts({ days: 1.5 })).toBe(false);
    expect(accepts({ days: 0 })).toBe(false);
    expect(accepts({ days: 400 })).toBe(false);
  });

  it('rejects starts that are not calendar days', () => {
    expect(accepts({ start: '2026-02-30' })).toBe(false);
    expect(accepts({ start: '2026-11-17T00:00:00Z' })).toBe(false);
  });

  it('rejects ids that are not object ids and unknown fields', () => {
    expect(accepts({ job: 'J1234' })).toBe(false);
    expect(accepts({ machineId: 'RD5' })).toBe(false);
    expect(accepts({ end: '2026-11-20' })).toBe(false);
  });

  it('accepts the entries a booking pushed', () => {
    const result = CreateScheduleEntryRequest.safeParse({
      entry: { job, machineId, start: '2026-11-17', days: 3 },
      pushed: [placement],
    });
    expect(result.success).toBe(true);
  });
});

describe('PlaceScheduleEntriesRequest', () => {
  it('needs at least one placement', () => {
    expect(PlaceScheduleEntriesRequest.safeParse({ entries: [] }).success).toBe(false);
    expect(PlaceScheduleEntriesRequest.safeParse({ entries: [placement] }).success).toBe(true);
  });

  it('rejects a placement without an id', () => {
    const { _id: _ignored, ...withoutId } = placement;
    expect(PlaceScheduleEntriesRequest.safeParse({ entries: [withoutId] }).success).toBe(false);
  });
});

describe('UpdateScheduleSettingsRequest', () => {
  const settings = {
    workdayStartHour: 8,
    workdayEndHour: 17,
    workdays: [1, 2, 3, 4, 5],
    defaultUtilization: 40,
    departmentUtilization: { [machineId]: 55 },
  };
  const accepts = (fields: Record<string, unknown>) =>
    UpdateScheduleSettingsRequest.safeParse({ settings: { ...settings, ...fields } }).success;

  it('accepts a working week', () => {
    expect(accepts({})).toBe(true);
  });

  it('rejects a day that ends before it starts', () => {
    expect(accepts({ workdayStartHour: 17, workdayEndHour: 8 })).toBe(false);
  });

  it('rejects repeated or impossible weekdays', () => {
    expect(accepts({ workdays: [1, 1] })).toBe(false);
    expect(accepts({ workdays: [7] })).toBe(false);
  });

  it('keeps utilization between 1 and 100 percent and keys it by department id', () => {
    expect(accepts({ defaultUtilization: 0 })).toBe(false);
    expect(accepts({ departmentUtilization: { [machineId]: 120 } })).toBe(false);
    expect(accepts({ departmentUtilization: { Mills: 40 } })).toBe(false);
  });
});
