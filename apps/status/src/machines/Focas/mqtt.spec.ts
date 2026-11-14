import { EventEmitter } from 'node:events';
import type { MachineDoc } from '../../database/lib/machine/machine_model.js';

jest.mock('mqtt', () => ({ connect: jest.fn() }));
jest.mock('../../logger.js', () => ({
  __esModule: true,
  default: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../index.js', () => ({ focasMachines: new Map() }));

const SECOND = 1000;
const SWEEP_MS = 5 * SECOND;
const TIMEOUT_MS = 30 * SECOND;

class FakeClient extends EventEmitter {
  subscribe = jest.fn((_topic: string, callback?: (err: Error | null) => void) => callback?.(null));
  end = jest.fn();
}

async function setup(seedState?: Partial<FocasState>) {
  jest.resetModules();
  const mqtt = await import('mqtt');
  const { default: logger } = await import('../../logger.js');
  const { focasMachines } = await import('../index.js');
  const { default: FocasMachine } = await import('./FocasMachine.js');
  const focas = await import('./mqtt.js');

  const client = new FakeClient();
  (mqtt.connect as unknown as jest.Mock).mockReturnValue(client);

  const doc = { _id: 'id-1', location: 'rd5', brand: 'fanuc' } as unknown as MachineDoc;
  const machine = new FocasMachine(doc, seedState);
  focasMachines.set('rd5', machine);

  const state = () => machine.getState();

  function send(subtopic: string, data: unknown, retain = false) {
    client.emit('message', `fanuc/rd5/${subtopic}`, Buffer.from(JSON.stringify(data)), { retain });
  }
  const sweep = (online: boolean, retain = false) =>
    send('sweep', { state: { data: { online, healthy: false, uptime_ms: Date.now() } } }, retain);
  const execution = (mode: string, value: string) =>
    send('state/1', { state: { data: { mode, execution: value, override: { rapid: 0 } } } });

  /** Lets time pass with the driver sending live sweeps as normal. */
  async function runFor(ms: number) {
    for (let elapsed = 0; elapsed < ms; elapsed += SWEEP_MS) {
      await jest.advanceTimersByTimeAsync(SWEEP_MS);
      sweep(state().online);
    }
  }

  const connected = focas.connect() as unknown;
  return { client, connected, focas, logger, machine, runFor, state, sweep, execution };
}

describe('Focas MQTT', () => {
  let stop: () => void;

  beforeEach(() => {
    jest.useFakeTimers();
    process.env.MQTT_URL = 'mqtt://test';
  });

  afterEach(() => {
    stop?.();
    jest.useRealTimers();
  });

  async function start(seedState?: Partial<FocasState>) {
    const context = await setup(seedState);
    stop = context.focas.disconnect;
    return context;
  }

  /** Connected, with a live sweep showing the machine online. */
  async function startOnline() {
    const context = await start();
    context.client.emit('connect');
    context.sweep(true);
    return context;
  }

  describe('connecting', () => {
    it('does not wait for the broker', async () => {
      const { client, connected } = await start();
      expect(connected).toBeUndefined();
      expect(client.subscribe).not.toHaveBeenCalled();
    });

    it('subscribes once the broker connects', async () => {
      const { client } = await start();
      client.emit('connect');
      expect(client.subscribe).toHaveBeenCalledWith('fanuc/#', expect.any(Function));
    });

    it('logs a repeated connection error once, and again after recovering', async () => {
      const { client, logger } = await start();
      client.emit('error', new Error('connect ECONNREFUSED'));
      client.emit('error', new Error('connect ECONNREFUSED'));
      expect(logger.error).toHaveBeenCalledTimes(1);

      client.emit('connect');
      client.emit('error', new Error('connect ECONNREFUSED'));
      expect(logger.error).toHaveBeenCalledTimes(2);
    });
  });

  describe('when the broker connection is lost', () => {
    it('marks machines offline and logs it once however many reconnects fail', async () => {
      const { client, logger, machine } = await startOnline();
      expect(machine.getStatus()).not.toBe('offline');

      client.emit('close');
      client.emit('close');
      client.emit('close');

      expect(machine.getStatus()).toBe('offline');
      expect(logger.warn).toHaveBeenCalledTimes(1);
    });

    it('comes back online from the sweep after reconnecting', async () => {
      const { client, machine, sweep } = await startOnline();
      client.emit('close');

      client.emit('connect');
      sweep(true, true);

      expect(machine.getStatus()).not.toBe('offline');
    });

    it('does not treat shutting down as an outage', async () => {
      const { client, focas, logger, state } = await startOnline();

      focas.disconnect();
      client.emit('close');

      expect(state().online).toBe(true);
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  describe('when sweeps stop', () => {
    it('stays online while live sweeps keep arriving', async () => {
      const { machine, runFor } = await startOnline();

      await runFor(TIMEOUT_MS * 3);

      expect(machine.getStatus()).not.toBe('offline');
    });

    it('marks the machine offline after the timeout', async () => {
      const { logger, machine } = await startOnline();

      await jest.advanceTimersByTimeAsync(TIMEOUT_MS + SWEEP_MS);

      expect(machine.getStatus()).toBe('offline');
      expect(logger.warn).toHaveBeenCalledTimes(1);
    });

    it('does not mark a machine offline before the timeout', async () => {
      const { machine } = await startOnline();

      await jest.advanceTimersByTimeAsync(TIMEOUT_MS - SWEEP_MS);

      expect(machine.getStatus()).not.toBe('offline');
    });

    it('does not stay online on a retained sweep alone', async () => {
      const { client, machine, sweep } = await start();
      client.emit('connect');
      sweep(true, true);
      expect(machine.getStatus()).not.toBe('offline');

      await jest.advanceTimersByTimeAsync(TIMEOUT_MS + SWEEP_MS);

      expect(machine.getStatus()).toBe('offline');
    });

    it('expires an online state restored from the snapshot if nothing arrives', async () => {
      const { state } = await start({ online: true });
      expect(state().online).toBe(true);

      await jest.advanceTimersByTimeAsync(TIMEOUT_MS + SWEEP_MS);

      expect(state().online).toBe(false);
    });

    it('gives the driver a full timeout again after a reconnect', async () => {
      const { client, machine, sweep } = await startOnline();
      await jest.advanceTimersByTimeAsync(TIMEOUT_MS - SWEEP_MS);
      client.emit('close');

      client.emit('connect');
      sweep(true, true);
      await jest.advanceTimersByTimeAsync(SWEEP_MS * 2);

      expect(machine.getStatus()).not.toBe('offline');
    });

    it('does not log a timeout for a machine the driver reports as off', async () => {
      const { logger, runFor, sweep } = await startOnline();
      sweep(false);

      await runFor(TIMEOUT_MS * 2);

      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  describe('operator time', () => {
    it('measures how long the machine waited in yellow', async () => {
      const { execution, machine, runFor, state } = await startOnline();
      execution('AUTOMATIC', 'READY');
      expect(machine.getStatus()).toBe('yellow');

      await runFor(60 * SECOND);
      execution('AUTOMATIC', 'ACTIVE');

      expect(state().lastOperatorTime).toBe(60 * SECOND);
    });

    it('is not recorded when the driver reports the machine off', async () => {
      const { execution, machine, runFor, state, sweep } = await startOnline();
      execution('AUTOMATIC', 'READY');
      await runFor(60 * SECOND);

      sweep(false);

      expect(machine.getStatus()).toBe('offline');
      expect(state().lastOperatorTime).toBe(0);
    });

    it('is not recorded when the broker connection is lost', async () => {
      const { client, execution, runFor, state } = await startOnline();
      execution('AUTOMATIC', 'READY');
      await runFor(60 * SECOND);

      client.emit('close');

      expect(state().lastOperatorTime).toBe(0);
    });

    it('does not include time spent offline in the next wait', async () => {
      const { execution, machine, runFor, state, sweep } = await startOnline();
      execution('AUTOMATIC', 'READY');
      sweep(false);
      await runFor(60 * 60 * SECOND);

      sweep(true);
      expect(machine.getStatus()).toBe('yellow');
      await runFor(10 * SECOND);
      execution('AUTOMATIC', 'ACTIVE');

      expect(state().lastOperatorTime).toBe(10 * SECOND);
    });
  });

  describe('cycle times without a production timer', () => {
    it('records a normal cycle', async () => {
      const { execution, runFor, state } = await startOnline();
      execution('AUTOMATIC', 'ACTIVE');

      await runFor(60 * SECOND);
      execution('AUTOMATIC', 'READY');

      expect(state().lastCycle).toEqual([60 * SECOND]);
    });

    it('times a cycle with an optional stop in it as one cycle', async () => {
      const { execution, machine, runFor, state } = await startOnline();
      execution('AUTOMATIC', 'ACTIVE');

      await runFor(30 * SECOND);
      execution('AUTOMATIC', 'OPTIONAL_STOP');
      await runFor(10 * SECOND);
      expect(machine.getStatus()).toBe('green');
      execution('AUTOMATIC', 'ACTIVE');
      await runFor(20 * SECOND);
      execution('AUTOMATIC', 'READY');

      expect(state().lastCycle).toEqual([60 * SECOND]);
    });

    it('does not count going offline as a finished cycle', async () => {
      const { execution, runFor, state, sweep } = await startOnline();
      execution('AUTOMATIC', 'ACTIVE');
      await runFor(60 * SECOND);

      sweep(false);

      expect(state().lastCycle).toEqual([]);
    });

    it('discards a cycle that continued through an outage', async () => {
      const { client, execution, runFor, state, sweep } = await startOnline();
      execution('AUTOMATIC', 'ACTIVE');
      await runFor(60 * SECOND);
      client.emit('close');

      client.emit('connect');
      sweep(true);
      await runFor(60 * SECOND);
      execution('AUTOMATIC', 'READY');

      expect(state().lastCycle).toEqual([]);
    });

    it('records the next full cycle after a discarded one', async () => {
      const { execution, runFor, state, sweep } = await startOnline();
      execution('AUTOMATIC', 'ACTIVE');
      sweep(false);
      sweep(true);
      execution('AUTOMATIC', 'READY');

      execution('AUTOMATIC', 'ACTIVE');
      await runFor(30 * SECOND);
      execution('AUTOMATIC', 'READY');

      expect(state().lastCycle).toEqual([30 * SECOND]);
    });

    it('forgets the interrupted cycle if the machine returns stopped', async () => {
      const { execution, runFor, state, sweep } = await startOnline();
      execution('AUTOMATIC', 'ACTIVE');
      sweep(false);
      execution('AUTOMATIC', 'READY');
      sweep(true);

      execution('AUTOMATIC', 'ACTIVE');
      await runFor(30 * SECOND);
      execution('AUTOMATIC', 'READY');

      expect(state().lastCycle).toEqual([30 * SECOND]);
    });
  });
});
