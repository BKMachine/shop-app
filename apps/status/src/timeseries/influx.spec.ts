jest.mock('../logger.js', () => ({
  __esModule: true,
  default: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('./machineStatus.js', () => ({ storeMachineStatus: jest.fn() }));
jest.mock('@influxdata/influxdb3-client', () => {
  const query = jest.fn();
  return {
    InfluxDBClient: jest.fn(() => ({ query, close: jest.fn() })),
    __query: query,
  };
});

const WRITE_MS = 15000;

async function setup({ reachable = true } = {}) {
  jest.resetModules();
  process.env.NODE_ENV = 'production';
  const { default: logger } = await import('../logger.js');
  const { storeMachineStatus } = (await import('./machineStatus.js')) as unknown as {
    storeMachineStatus: jest.Mock;
  };
  const { __query } = (await import('@influxdata/influxdb3-client')) as unknown as {
    __query: jest.Mock;
  };
  // A query's rows are read as they arrive, and an unreachable server fails on the first read.
  __query.mockImplementation(() => ({
    [Symbol.asyncIterator]: () => ({
      next: async () => {
        if (!reachable) throw new Error('connect ECONNREFUSED');
        return { done: true, value: undefined };
      },
    }),
  }));
  storeMachineStatus.mockResolvedValue(undefined);

  const influx = await import('./influx.js');
  return { influx, logger, storeMachineStatus };
}

describe('InfluxDB', () => {
  const nodeEnv = process.env.NODE_ENV;
  let disconnect: (() => Promise<void>) | undefined;

  beforeEach(() => jest.useFakeTimers());

  afterEach(async () => {
    await disconnect?.();
    process.env.NODE_ENV = nodeEnv;
    jest.useRealTimers();
  });

  it('writes the machine status on a timer', async () => {
    const { influx, storeMachineStatus } = await setup();
    disconnect = influx.disconnect;
    await influx.connect();

    await jest.advanceTimersByTimeAsync(WRITE_MS * 2);

    expect(storeMachineStatus).toHaveBeenCalledTimes(2);
  });

  it('logs a failing write once and carries on, then logs the recovery', async () => {
    const { influx, logger, storeMachineStatus } = await setup();
    disconnect = influx.disconnect;
    await influx.connect();

    storeMachineStatus.mockRejectedValue(new Error('write failed'));
    await jest.advanceTimersByTimeAsync(WRITE_MS * 3);
    expect(logger.error).toHaveBeenCalledTimes(1);

    storeMachineStatus.mockResolvedValue(undefined);
    await jest.advanceTimersByTimeAsync(WRITE_MS);
    expect(logger.info).toHaveBeenCalledWith('Writing machine status to InfluxDB recovered');
  });

  it('still starts writing when InfluxDB is down at startup', async () => {
    const { influx, storeMachineStatus } = await setup({ reachable: false });
    disconnect = influx.disconnect;
    await expect(influx.connect()).rejects.toThrow('not reachable');

    await jest.advanceTimersByTimeAsync(WRITE_MS);

    expect(storeMachineStatus).toHaveBeenCalledTimes(1);
  });
});
