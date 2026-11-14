jest.mock('./influx.js', () => ({ queryRows: jest.fn() }));

const MINUTE = 60000;
const DAY = 24 * 60 * MINUTE;
const NOW = new Date('2026-03-02T12:00:30Z');

async function setup() {
  jest.resetModules();
  const { queryRows } = (await import('./influx.js')) as unknown as { queryRows: jest.Mock };
  const performance = await import('./performance.js');
  queryRows.mockResolvedValue([{ department: 'Mills', green_percent: 61.256 }]);
  return { queryRows, ...performance };
}

describe('department performance', () => {
  beforeEach(() => jest.useFakeTimers({ now: NOW }));
  afterEach(() => jest.useRealTimers());

  it('returns the share of time each department ran', async () => {
    const { getDepartmentPerformance } = await setup();
    expect(await getDepartmentPerformance()).toEqual([
      { department: 'Mills', greenPercent: 61.26 },
    ]);
  });

  it('follows a machine by its id, so renaming it keeps its history together', async () => {
    const { getDepartmentPerformance, queryRows } = await setup();
    await getDepartmentPerformance();

    const sql = queryRows.mock.calls[0][0] as string;
    expect(sql).toContain('PARTITION BY id');
    expect(sql).not.toMatch(/\bname\b/);
  });

  describe('range', () => {
    it('rejects a range that ends before it starts', async () => {
      const { getDepartmentPerformance, InvalidRangeError } = await setup();
      const range = { from: NOW, to: new Date(NOW.getTime() - DAY) };
      expect(() => getDepartmentPerformance(range)).toThrow(InvalidRangeError);
    });

    it('rejects a range longer than 31 days without querying', async () => {
      const { getDepartmentPerformance, InvalidRangeError, queryRows } = await setup();
      const range = { from: new Date(0), to: NOW };
      expect(() => getDepartmentPerformance(range)).toThrow(InvalidRangeError);
      expect(queryRows).not.toHaveBeenCalled();
    });

    it('allows a range of 31 days', async () => {
      const { getDepartmentPerformance } = await setup();
      const range = { from: new Date(NOW.getTime() - 31 * DAY), to: NOW };
      await expect(getDepartmentPerformance(range)).resolves.toHaveLength(1);
    });
  });

  describe('repeated requests', () => {
    it('answers requests made in the same minute with one query', async () => {
      const { getDepartmentPerformance, queryRows } = await setup();
      await getDepartmentPerformance({ to: NOW });
      await getDepartmentPerformance({ to: new Date(NOW.getTime() + 20000) });
      expect(queryRows).toHaveBeenCalledTimes(1);
    });

    it('queries again once the answer is a minute old', async () => {
      const { getDepartmentPerformance, queryRows } = await setup();
      await getDepartmentPerformance({ to: NOW });
      jest.advanceTimersByTime(MINUTE);
      await getDepartmentPerformance({ to: NOW });
      expect(queryRows).toHaveBeenCalledTimes(2);
    });

    it('tries again after a failed query', async () => {
      const { getDepartmentPerformance, queryRows } = await setup();
      queryRows.mockRejectedValueOnce(new Error('unreachable'));
      await expect(getDepartmentPerformance({ to: NOW })).rejects.toThrow('unreachable');

      await expect(getDepartmentPerformance({ to: NOW })).resolves.toHaveLength(1);
    });
  });
});
