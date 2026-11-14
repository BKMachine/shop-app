import type { MachineDoc } from '../../database/lib/machine/machine_model.js';
import * as serial from './serial.js';

jest.mock('axios', () => ({ __esModule: true, default: { post: jest.fn() } }));
jest.mock('../../logger.js', () => ({
  __esModule: true,
  default: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
// The parser doesn't need the machine registry, which would load the database.
jest.mock('../index.js', () => ({ haasMachines: new Map() }));

test('parseLastCycle method', () => {
  expect(serial.parseLastCycle('000142')).toBe(102000);
  expect(serial.parseLastCycle('00000142')).toBe(102000);
});

const POLL = 10000;
const CYCLE = '000812';
const CYCLE_MS = 492000;

type Reply = string[][];
const idle = (cycle = CYCLE, parts = '5', mode = 'MEM'): Reply => [
  ['MODE', mode],
  ['LASTCYCLE', cycle],
  ['PROGRAM', 'O00100', 'IDLE', 'PARTS', parts],
];
const busy = (cycle = CYCLE): Reply => [
  ['MODE', 'MEM'],
  ['LASTCYCLE', cycle],
  ['STATUS', 'BUSY'],
];

async function setup() {
  jest.resetModules();
  process.env.HAAS_SERIAL_URL = 'http://haas-serial:3000/api/serial/status';
  process.env.HAAS_SERIAL_API_KEY = 'test-key';
  const { default: axios } = await import('axios');
  const { default: logger } = await import('../../logger.js');
  const { machineEvents } = await import('../events.js');
  // Everything a machine reports, as (event, data) calls.
  const emit = jest.fn();
  machineEvents.on('change', (data) => emit('change', data));
  machineEvents.on('status', (data) => emit('status', data));
  const { haasMachines } = await import('../index.js');
  const { default: HaasMachine } = await import('./HaasMachine.js');
  const polling = await import('./serial.js');

  const doc = {
    _id: 'id-1',
    name: 'H 1',
    location: 'http://10.30.1.57:5000',
    brand: 'haas',
  } as unknown as MachineDoc;
  const machine = new HaasMachine(doc);
  haasMachines.set(doc.location, machine);

  const post = axios.post as unknown as jest.Mock;
  post.mockReset();
  const state = () => machine.getState();

  /** Every poll during this time gets this reply. */
  async function hold(reply: Reply, ms: number = POLL) {
    post.mockResolvedValue({ data: { data: reply } });
    await jest.advanceTimersByTimeAsync(ms);
  }

  /** Every poll during this time fails. */
  async function fails(status?: number, ms: number = POLL, error = 'Connection timeout') {
    const failure = Object.assign(new Error(`Request failed with status code ${status}`), {
      response: status ? { status, data: { error } } : undefined,
    });
    post.mockRejectedValue(failure);
    await jest.advanceTimersByTimeAsync(ms);
  }

  return {
    emit,
    fails,
    hold,
    logger,
    machine,
    polling,
    post,
    state,
  };
}

describe('Haas polling', () => {
  let stop: () => void;

  beforeEach(() => jest.useFakeTimers());

  afterEach(() => {
    stop?.();
    delete process.env.HAAS_SERIAL_URL;
    delete process.env.HAAS_SERIAL_API_KEY;
    jest.useRealTimers();
  });

  /** Polling, with one reply already read so later cycle times have something to compare with. */
  async function start(first: Reply = idle()) {
    const context = await setup();
    stop = context.polling.stop;
    context.polling.start();
    await context.hold(first);
    return context;
  }

  describe('requests', () => {
    it('asks the service for this machine, with a timeout shorter than the poll', async () => {
      const { post } = await start();
      const [url, body, options] = post.mock.calls[0] ?? [];

      expect(url).toBe('http://haas-serial:3000/api/serial/status/H%201');
      expect(body).toEqual({ url: 'http://10.30.1.57:5000' });
      expect(options.timeout).toBeGreaterThan(0);
      expect(options.timeout).toBeLessThan(POLL);
      expect(options.headers).toEqual({ 'x-api-key': 'test-key' });
    });

    it('logs a rejected key once, with the reason, and shows offline', async () => {
      const { fails, logger, machine } = await start();

      await fails(401, POLL * 3, 'Missing or invalid API key');

      expect(machine.getStatus()).toBe('offline');
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Missing or invalid API key'),
      );
    });

    it('does not start a new request while one is running', async () => {
      const { post } = await start();
      post.mockClear();
      post.mockReturnValue(new Promise(() => {}));

      await jest.advanceTimersByTimeAsync(POLL * 12);

      expect(post).toHaveBeenCalledTimes(1);
    });

    it('polls again once a request has finished', async () => {
      const { hold, post } = await start();
      post.mockClear();

      await hold(idle(), POLL * 3);

      expect(post).toHaveBeenCalledTimes(3);
    });

    it.each([['HAAS_SERIAL_URL'], ['HAAS_SERIAL_API_KEY']])(
      'reports a missing %s instead of failing silently',
      async (name) => {
        const { logger, polling, post } = await setup();
        stop = polling.stop;
        delete process.env[name];

        polling.start();
        await jest.advanceTimersByTimeAsync(POLL);

        expect(logger.error).toHaveBeenCalledTimes(1);
        expect(post).not.toHaveBeenCalled();
      },
    );
  });

  describe('status', () => {
    it.each([
      ['yellow', idle()],
      ['green', busy()],
      ['idle', idle(CYCLE, '5', 'EDIT')],
      [
        'idle',
        [
          ['MODE', 'MEM'],
          ['PROGRAM', 'O00100', 'FEEDHOLD', 'PARTS', '5'],
        ],
      ],
      [
        'red',
        [
          ['MODE', 'MEM'],
          ['PROGRAM', 'O00100', 'ALARMON', 'PARTS', '5'],
        ],
      ],
    ])('shows %s', async (status, reply) => {
      const { hold, machine } = await start();
      await hold(reply as Reply);
      expect(machine.getStatus()).toBe(status);
    });
  });

  describe('when a poll fails', () => {
    it.each([[503], [500], [undefined]])('shows offline for status %s', async (status) => {
      const { fails, machine } = await start();
      await fails(status);
      expect(machine.getStatus()).toBe('offline');
    });

    it('logs an unreachable module once, with the reason, however long it lasts', async () => {
      const { fails, logger } = await start();

      await fails(503, POLL * 6);

      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Connection timeout'));
    });

    it('logs a machine that has never answered', async () => {
      const { fails, logger, polling } = await setup();
      stop = polling.stop;
      polling.start();

      await fails(503);

      expect(logger.warn).toHaveBeenCalledTimes(1);
    });

    it('logs the recovery and comes back online', async () => {
      const { fails, hold, logger, machine } = await start();
      await fails(503);

      await hold(busy());

      expect(logger.info).toHaveBeenCalledWith(
        'Haas machine http://10.30.1.57:5000 is responding again',
      );
      expect(machine.getStatus()).toBe('green');
    });
  });

  describe('when the reply is incomplete', () => {
    it('does not show offline for a cycle time with no value', async () => {
      const { hold, machine } = await start();
      await hold([['MODE', 'MEM'], ['LASTCYCLE'], ['STATUS', 'BUSY']]);
      expect(machine.getStatus()).toBe('green');
    });

    it('ignores a cycle time that is not a number', async () => {
      const { hold, state } = await start();
      await hold(idle('garbage'));
      expect(state().lastCycle).toEqual([]);
    });

    it.each([
      ['empty values', [[''], [''], ['']]],
      ['no values', []],
      ['an unknown command', [['HELLO', 'WORLD']]],
    ])('treats %s as a failed poll', async (_name, reply) => {
      const { hold, machine } = await start();
      await hold(reply as Reply);
      expect(machine.getStatus()).toBe('offline');
    });

    it('treats a reply with no serial data as a failed poll', async () => {
      const { machine, post } = await start();
      post.mockResolvedValue({ data: {} });
      await jest.advanceTimersByTimeAsync(POLL);
      expect(machine.getStatus()).toBe('offline');
    });
  });

  describe('updates to browsers', () => {
    it('sends nothing when nothing changed', async () => {
      const { emit, hold } = await start();
      await hold(idle());
      emit.mockClear();

      await hold(idle(), POLL * 3);

      expect(emit).not.toHaveBeenCalled();
    });
  });

  describe('cycle times', () => {
    it('does not record the time already on the machine when first read', async () => {
      const { state } = await start();
      expect(state().lastCycle).toEqual([]);
    });

    it('records a new cycle time', async () => {
      const { hold, state } = await start();
      await hold(busy());
      await hold(idle('000900', '6'));
      expect(state().lastCycle).toEqual([540000]);
    });

    it('records parts with exactly the same time', async () => {
      const { hold, state } = await start(idle(CYCLE, '5'));

      await hold(busy());
      await hold(idle(CYCLE, '6'), POLL * 2);
      await hold(busy());
      await hold(idle(CYCLE, '7'), POLL * 2);

      expect(state().lastCycle).toEqual([CYCLE_MS, CYCLE_MS]);
    });

    it('records a repeat only once however long the machine then sits', async () => {
      const { hold, state } = await start(idle(CYCLE, '5'));
      await hold(idle(CYCLE, '6'), POLL * 10);
      expect(state().lastCycle).toEqual([CYCLE_MS]);
    });

    it('does not double count when both the time and the parts change together', async () => {
      const { hold, state } = await start(idle(CYCLE, '5'));
      await hold(busy());
      await hold(idle('000900', '6'), POLL * 3);
      expect(state().lastCycle).toEqual([540000]);
    });

    it('does not double count when the parts change a poll before the time', async () => {
      const { hold, state } = await start(idle(CYCLE, '5'));
      await hold(idle(CYCLE, '6'));
      await hold(idle('000900', '6'), POLL * 3);
      expect(state().lastCycle).toEqual([540000]);
    });

    it('does not double count when the time changes while the next part is running', async () => {
      const { hold, state } = await start(idle(CYCLE, '5'));
      await hold(busy('000900'));
      await hold(idle('000900', '6'), POLL * 3);
      expect(state().lastCycle).toEqual([540000]);
    });

    it('does not count one part as extra when it takes two cycle starts', async () => {
      const { hold, state } = await start(idle('000015', '5'));
      await hold(idle(CYCLE, '5'));
      await hold(idle('000015', '5'));
      await hold(idle(CYCLE, '6'), POLL * 3);
      expect(state().lastCycle).toEqual([CYCLE_MS, 15000, CYCLE_MS]);
    });

    it('does not record anything when the parts count is reset', async () => {
      const { hold, state } = await start(idle(CYCLE, '50'));
      await hold(idle(CYCLE, '0'), POLL * 3);
      expect(state().lastCycle).toEqual([]);
    });

    it('does not record parts made while the machine was unreachable', async () => {
      const { fails, hold, state } = await start(idle(CYCLE, '5'));
      await fails(503, POLL * 3);
      await hold(idle(CYCLE, '9'), POLL * 3);
      expect(state().lastCycle).toEqual([]);
    });

    it('does not treat a time of 0 after power-up as a cycle', async () => {
      const { emit, hold, state } = await start();
      emit.mockClear();

      await hold(idle('000000'));

      expect(emit).not.toHaveBeenCalled();

      await hold(idle(CYCLE));
      expect(state().lastCycle).toEqual([CYCLE_MS]);
    });

    it('does not treat a good time after a garbled one as a new cycle', async () => {
      const { hold, state } = await start();
      await hold(idle('garbage'));
      await hold(idle(CYCLE));
      expect(state().lastCycle).toEqual([]);
    });
  });

  describe('operator time', () => {
    it('measures how long the machine waited in yellow', async () => {
      const { hold, machine, state } = await start();
      await hold(idle(), 50000);
      expect(machine.getStatus()).toBe('yellow');

      await hold(busy());

      expect(state().lastOperatorTime).toBe(60000);
    });

    it('is not recorded when the machine goes offline', async () => {
      const { fails, hold, state } = await start();
      await hold(idle(), 50000);

      await fails(503);

      expect(state().lastOperatorTime).toBe(0);
    });

    it('does not include time spent offline in the next wait', async () => {
      const { fails, hold, state } = await start();
      await fails(503, 14 * 3600000);
      await hold(idle(), 30000);

      await hold(busy());

      expect(state().lastOperatorTime).toBe(30000);
    });
  });
});
