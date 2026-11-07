import type { MachineDoc } from '../../database/lib/machine/machine_model.js';

jest.mock('axios', () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock('../../logger.js', () => ({
  __esModule: true,
  default: { debug: jest.fn(), info: jest.fn(), error: jest.fn() },
}));
jest.mock('../../config.js', () => ({ baseUrl: 'http://test' }));
jest.mock('../../server/socket.io.js', () => ({ emit: jest.fn() }));
jest.mock('../index.js', () => ({ mtConnectMachines: new Map() }));

const POLL_MS = 5000;
const SECOND = 1000;

interface Events {
  availability?: string;
  estop?: string;
  mode?: string;
  execution?: string;
}

function response({
  availability = 'AVAILABLE',
  estop = 'ARMED',
  mode = 'AUTOMATIC',
  execution = 'READY',
}: Events = {}) {
  const event = (value: string) => [{ value }];
  return {
    data: {
      MTConnectStreams: {
        Streams: {
          DeviceStream: [
            { name: 'Agent', uuid: 'agent', ComponentStream: [{ Events: {} }] },
            {
              name: 'nhx',
              uuid: '000',
              ComponentStream: [
                {
                  Events: {
                    Availability: event(availability),
                    EmergencyStop: event(estop),
                    Mode: event(mode),
                    Execution: event(execution),
                  },
                },
              ],
            },
          ],
        },
      },
    },
  };
}

async function setup() {
  jest.resetModules();
  const { default: axios } = await import('axios');
  const { default: logger } = await import('../../logger.js');
  const { emit } = await import('../../server/socket.io.js');
  const { mtConnectMachines } = await import('../index.js');
  const { default: MTConnectMachine } = await import('./MTConnectMachine.js');
  const polling = await import('./mtconnect_polling.js');

  const doc = { _id: 'id-1', location: 'nhx', brand: 'mori' } as unknown as MachineDoc;
  const machine = new MTConnectMachine(doc);
  mtConnectMachines.set('nhx', machine);

  const get = axios.get as jest.Mock;
  const state = () => machine.getState() as MTConnectState;

  /** Runs one poll that gets this response. */
  async function poll(events?: Events) {
    get.mockResolvedValueOnce(response(events));
    await jest.advanceTimersByTimeAsync(POLL_MS);
  }

  /** Runs one poll that fails with this error. */
  async function pollFails(message = 'connect ECONNREFUSED') {
    get.mockRejectedValueOnce(new Error(message));
    await jest.advanceTimersByTimeAsync(POLL_MS);
  }

  /** Lets time pass, with every poll in that time getting this response. */
  async function hold(events: Events, ms: number) {
    get.mockResolvedValue(response(events));
    await jest.advanceTimersByTimeAsync(ms);
  }

  polling.start();
  return { get, logger, emit: emit as jest.Mock, machine, state, poll, pollFails, hold, polling };
}

describe('MTConnect polling', () => {
  let stopPolling: () => void;

  beforeEach(() => {
    jest.useFakeTimers();
    process.env.MTCONNECT_URL = 'http://mtconnect:5000';
  });

  afterEach(() => {
    stopPolling?.();
    jest.useRealTimers();
  });

  async function start() {
    const context = await setup();
    stopPolling = context.polling.stop;
    return context;
  }

  describe('when the agent is unreachable', () => {
    it('updates the status as well as the state', async () => {
      const { machine, state, poll, pollFails } = await start();
      await poll({ execution: 'ACTIVE' });
      expect(machine.getStatus()).toBe('green');

      await pollFails();

      expect(state().online).toBe(false);
      expect(machine.getStatus()).toBe('offline');
    });

    it('sends one change and logs once however long the outage lasts', async () => {
      const { emit, logger, poll, pollFails } = await start();
      await poll();
      emit.mockClear();

      await pollFails();
      await pollFails();
      await pollFails();

      const changes = emit.mock.calls.filter(([event]) => event === 'change');
      expect(changes).toHaveLength(1);
      expect(logger.error).toHaveBeenCalledTimes(1);
    });

    it('comes back online and logs the recovery', async () => {
      const { logger, machine, poll, pollFails } = await start();
      await pollFails();

      await poll({ execution: 'ACTIVE' });

      expect(machine.getStatus()).toBe('green');
      expect(logger.info).toHaveBeenCalledWith('MTConnect polling recovered');
    });
  });

  describe('when the response is unusable', () => {
    it('logs the error and marks machines offline instead of freezing them', async () => {
      const { get, logger, machine, poll } = await start();
      await poll({ execution: 'ACTIVE' });

      get.mockResolvedValueOnce({ data: { unexpected: true } });
      await jest.advanceTimersByTimeAsync(POLL_MS);

      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(machine.getStatus()).toBe('offline');
    });
  });

  describe('requests', () => {
    it('sets a timeout shorter than the poll interval', async () => {
      const { get, poll } = await start();
      await poll();

      const options = get.mock.calls[0]?.[1];
      expect(options.timeout).toBeGreaterThan(0);
      expect(options.timeout).toBeLessThan(POLL_MS);
    });

    it('does not start a new request while one is still running', async () => {
      const { get } = await start();
      get.mockReturnValue(new Promise(() => {}));

      await jest.advanceTimersByTimeAsync(POLL_MS * 3);

      expect(get).toHaveBeenCalledTimes(1);
    });
  });

  describe('cycle times', () => {
    it('records a normal cycle', async () => {
      const { state, poll, hold } = await start();
      await poll({ execution: 'ACTIVE' });

      await hold({ execution: 'ACTIVE' }, 60 * SECOND);
      await poll({ execution: 'READY' });

      expect(state().lastCycle).toEqual([60 * SECOND + POLL_MS]);
    });

    it('does not count a dropped adapter connection as a finished cycle', async () => {
      const { state, poll } = await start();
      await poll({ execution: 'ACTIVE' });

      await poll({ availability: 'UNAVAILABLE', execution: 'UNAVAILABLE' });

      expect(state().lastCycle).toEqual([]);
    });

    it('discards a cycle that continued through a connection drop', async () => {
      const { state, poll } = await start();
      await poll({ execution: 'ACTIVE' });
      await poll({ availability: 'UNAVAILABLE', execution: 'UNAVAILABLE' });
      await poll({ execution: 'ACTIVE' });

      await poll({ execution: 'READY' });

      expect(state().lastCycle).toEqual([]);
    });

    it('discards a cycle that continued through an agent outage', async () => {
      const { state, poll, pollFails } = await start();
      await poll({ execution: 'ACTIVE' });
      await pollFails();
      await poll({ execution: 'ACTIVE' });

      await poll({ execution: 'READY' });

      expect(state().lastCycle).toEqual([]);
    });

    it('records the next full cycle after a discarded one', async () => {
      const { state, poll } = await start();
      await poll({ execution: 'ACTIVE' });
      await poll({ availability: 'UNAVAILABLE', execution: 'UNAVAILABLE' });
      await poll({ execution: 'ACTIVE' });
      await poll({ execution: 'READY' });

      await poll({ execution: 'ACTIVE' });
      await poll({ execution: 'READY' });

      expect(state().lastCycle).toEqual([POLL_MS]);
    });
  });

  describe('operator time', () => {
    it('measures how long the machine waited in yellow', async () => {
      const { machine, state, poll, hold } = await start();
      await poll({ execution: 'READY' });
      expect(machine.getStatus()).toBe('yellow');

      await hold({ execution: 'READY' }, 60 * SECOND);
      await poll({ execution: 'ACTIVE' });

      expect(state().lastOperatorTime).toBe(60 * SECOND + POLL_MS);
    });

    it('is not recorded when the machine goes offline', async () => {
      const { machine, state, poll } = await start();
      await poll({ execution: 'READY' });
      expect(machine.getStatus()).toBe('yellow');

      await poll({ availability: 'UNAVAILABLE', execution: 'UNAVAILABLE' });

      expect(machine.getStatus()).toBe('offline');
      expect(state().lastOperatorTime).toBe(0);
    });
  });
});
