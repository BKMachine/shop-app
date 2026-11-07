import type { MachineDoc } from '../../database/lib/machine/machine_model.js';

jest.mock('axios', () => {
  const get = jest.fn();
  return { __esModule: true, default: { create: () => ({ get }), __get: get } };
});
jest.mock('../../logger.js', () => ({
  __esModule: true,
  default: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../../config.js', () => ({ baseUrl: 'http://test' }));
jest.mock('../../server/socket.io.js', () => ({ emit: jest.fn() }));
jest.mock('../index.js', () => ({ arduinoMachines: new Map() }));

const POLL = 5000;
const MINUTE = 60000;
const HOUR = 60 * MINUTE;

interface Lights {
  green?: boolean;
  yellow?: boolean;
  red?: boolean;
}

async function setup() {
  jest.resetModules();
  const { default: axios } = (await import('axios')) as unknown as {
    default: { __get: jest.Mock };
  };
  const { default: logger } = await import('../../logger.js');
  const { arduinoMachines } = await import('../index.js');
  const { default: ArduinoMachine } = await import('./ArduinoMachine.js');
  const polling = await import('./arduino_polling.js');

  const doc = { _id: 'id-1', location: 'http://me1', brand: 'x' } as unknown as MachineDoc;
  const machine = new ArduinoMachine(doc);
  arduinoMachines.set('http://me1', machine);

  const get = axios.__get;
  get.mockReset();
  const state = () => machine.getState() as ArduinoState;

  /** Every poll during this time sees these lights. */
  async function hold(lights: Lights, ms: number = POLL) {
    get.mockResolvedValue({ data: { green: false, yellow: false, red: false, ...lights } });
    await jest.advanceTimersByTimeAsync(ms);
  }

  /** Every poll during this time gets no response. */
  async function noResponse(ms: number = POLL, message = 'timeout of 2000ms exceeded') {
    get.mockRejectedValue(new Error(message));
    await jest.advanceTimersByTimeAsync(ms);
  }

  polling.start();
  return { get, hold, logger, machine, noResponse, polling, state };
}

describe('Arduino polling', () => {
  let stop: () => void;

  beforeEach(() => jest.useFakeTimers());

  afterEach(() => {
    stop?.();
    jest.useRealTimers();
  });

  /** Polling, with the board having answered once with no lights on. */
  async function start() {
    const context = await setup();
    stop = context.polling.stop;
    await context.hold({});
    return context;
  }

  describe('status', () => {
    it('shows the light that is on', async () => {
      const { hold, machine } = await start();
      await hold({ green: true });
      expect(machine.getStatus()).toBe('green');
      await hold({ yellow: true });
      expect(machine.getStatus()).toBe('yellow');
      await hold({ red: true });
      expect(machine.getStatus()).toBe('red');
      await hold({});
      expect(machine.getStatus()).toBe('idle');
    });
  });

  describe('when the board does not respond', () => {
    it('stays online through two missed polls', async () => {
      const { hold, machine, noResponse } = await start();
      await hold({ green: true });

      await noResponse(POLL * 2);

      expect(machine.getStatus()).toBe('green');
    });

    it('goes offline on the third miss in a row', async () => {
      const { hold, machine, noResponse } = await start();
      await hold({ green: true });

      await noResponse(POLL * 3);

      expect(machine.getStatus()).toBe('offline');
    });

    it('needs the misses to be in a row', async () => {
      const { hold, machine, noResponse } = await start();
      await noResponse();
      await hold({});
      await noResponse();

      expect(machine.getStatus()).toBe('idle');
    });

    it('logs once however long the outage lasts, and logs the recovery', async () => {
      const { hold, logger, noResponse } = await start();

      await noResponse(HOUR);
      expect(logger.warn).toHaveBeenCalledTimes(1);

      await hold({});
      expect(logger.info).toHaveBeenCalledWith('Arduino http://me1 is responding again');
    });

    it('does not log a single missed poll', async () => {
      const { logger, noResponse } = await start();
      await noResponse();
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  describe('when the response is unusable', () => {
    it.each([
      ['a web page', '<html>not an arduino</html>'],
      ['a cut-off reply', '{"green":true,"yel'],
      ['a missing light', { green: true, yellow: false }],
      ['a value that is not true or false', { green: 1, yellow: 0, red: 0 }],
      ['nothing', null],
    ])('treats %s as a missed poll', async (_name, data) => {
      const { get, machine } = await start();

      get.mockResolvedValue({ data });
      await jest.advanceTimersByTimeAsync(POLL * 3);

      expect(machine.getStatus()).toBe('offline');
    });

    it('does not let the board set other state', async () => {
      const { get, state } = await start();

      get.mockResolvedValue({
        data: { green: false, yellow: false, red: false, online: false, lastOperatorTime: 99 },
      });
      await jest.advanceTimersByTimeAsync(POLL);

      expect(state().online).toBe(true);
      expect(state().lastOperatorTime).toBe(0);
    });
  });

  describe('cycle times', () => {
    it('records a normal cycle', async () => {
      const { hold, state } = await start();
      await hold({ green: true }, MINUTE);
      await hold({});
      expect(state().lastCycle).toEqual([MINUTE]);
    });

    it('keeps the full time when one poll is missed', async () => {
      const { hold, noResponse, state } = await start();
      await hold({ green: true }, MINUTE);
      await noResponse();
      await hold({ green: true }, MINUTE);
      await hold({});
      expect(state().lastCycle).toEqual([2 * MINUTE + POLL]);
    });

    it('discards a cycle that continued through an outage', async () => {
      const { hold, noResponse, state } = await start();
      await hold({ green: true }, MINUTE);
      await noResponse(MINUTE);
      await hold({ green: true }, MINUTE);
      await hold({});
      expect(state().lastCycle).toEqual([]);
    });

    it('does not count power-off as a cycle when green was on at shutdown', async () => {
      const { hold, noResponse, state } = await start();
      await hold({ green: true }, MINUTE);
      await noResponse(14 * HOUR);
      await hold({});
      expect(state().lastCycle).toEqual([]);
    });

    it('records the next full cycle after an outage', async () => {
      const { hold, noResponse, state } = await start();
      await noResponse(HOUR);
      await hold({});
      await hold({ green: true }, MINUTE);
      await hold({});
      expect(state().lastCycle).toEqual([MINUTE]);
    });

    it('is not shortened by another light changing during the cycle', async () => {
      const { hold, state } = await start();
      await hold({ green: true }, MINUTE);
      await hold({ green: true, red: true });
      await hold({ green: true }, 10000);
      await hold({});
      expect(state().lastCycle).toEqual([MINUTE + POLL + 10000]);
    });
  });

  describe('operator time', () => {
    it('measures how long yellow was on', async () => {
      const { hold, state } = await start();
      await hold({ yellow: true }, MINUTE);
      await hold({ green: true });
      expect(state().lastOperatorTime).toBe(MINUTE);
    });

    it('does not count power-off as a wait when yellow was on at shutdown', async () => {
      const { hold, noResponse, state } = await start();
      await hold({ yellow: true }, MINUTE);
      await noResponse(14 * HOUR);
      await hold({});
      expect(state().lastOperatorTime).toBe(0);
    });

    it('measures a wait from the board returning, not from before the outage', async () => {
      const { hold, noResponse, state } = await start();
      await hold({ yellow: true }, MINUTE);
      await noResponse(14 * HOUR);
      await hold({ yellow: true }, MINUTE);
      await hold({});
      expect(state().lastOperatorTime).toBe(MINUTE);
    });
  });

  // ME1's firmware holds a flashing yellow on, so it can overlap the start of a cycle.
  describe('when a latched yellow overlaps green', () => {
    it('keeps the full wait and the full cycle', async () => {
      const { hold, state } = await start();
      await hold({ yellow: true }, MINUTE);
      await hold({ green: true, yellow: true });
      await hold({ green: true }, MINUTE - POLL);
      await hold({});

      expect(state().lastOperatorTime).toBe(MINUTE + POLL);
      expect(state().lastCycle).toEqual([MINUTE]);
    });
  });

  // Operators often turn off the panel but not the breaker, so the board keeps answering.
  describe('when no lights have been on for 4 hours', () => {
    it('stays idle until 4 hours have passed', async () => {
      const { hold, machine } = await start();
      await hold({}, 4 * HOUR - 2 * POLL);
      expect(machine.getStatus()).toBe('idle');
    });

    it('shows offline after 4 hours', async () => {
      const { hold, machine } = await start();
      await hold({}, 4 * HOUR);
      expect(machine.getStatus()).toBe('offline');
    });

    it('comes back when a light comes on, and records that cycle', async () => {
      const { hold, machine, state } = await start();
      await hold({}, 5 * HOUR);

      await hold({ green: true }, MINUTE);
      expect(machine.getStatus()).toBe('green');
      await hold({});

      expect(state().lastCycle).toEqual([MINUTE]);
    });

    it('counts 4 hours from when the last light went off', async () => {
      const { hold, machine } = await start();
      await hold({}, 3 * HOUR);
      await hold({ yellow: true });

      await hold({}, 3 * HOUR);

      expect(machine.getStatus()).toBe('idle');
    });

    it('starts counting again when the machine is powered back on', async () => {
      const { hold, machine, noResponse } = await start();
      await hold({}, 3 * HOUR);
      await noResponse(14 * HOUR);

      await hold({}, 2 * HOUR);

      expect(machine.getStatus()).toBe('idle');
    });

    it('is not treated as a failure', async () => {
      const { hold, logger } = await start();
      await hold({}, 5 * HOUR);
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });
});
