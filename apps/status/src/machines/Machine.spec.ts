import type { MachineDoc } from '../database/lib/machine/machine_model.js';
import { machineEvents } from './events.js';
import FocasMachine from './Focas/FocasMachine.js';
import HaasMachine from './Haas/HaasMachine.js';
import MTConnectMachine from './MTConnect/MTConnectMachine.js';

jest.mock('../logger.js', () => ({
  __esModule: true,
  default: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const HOUR = 60 * 60 * 1000;
const doc = {
  _id: 'id-1',
  name: 'NHX',
  location: 'nhx',
  department: null,
} as unknown as MachineDoc;

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * HOUR).toISOString();
}

/** A machine that can be reached and was last seen changing state that many hours ago. */
function idleMachine(hours: number) {
  return new MTConnectMachine(doc, { online: true, lastStateTs: hoursAgo(hours) });
}

describe('a machine left idle', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    machineEvents.removeAllListeners();
  });

  it('stays idle for under 4 hours', () => {
    expect(idleMachine(3.99).getStatus()).toBe('idle');
  });

  it('shows offline once 4 hours have passed since its last state change', () => {
    const machine = idleMachine(3);
    jest.advanceTimersByTime(HOUR);
    machine.checkIdle();
    expect(machine.getStatus()).toBe('offline');
  });

  // The state saved on shutdown carries the time of the last change into the new process.
  it('keeps counting across a restart', () => {
    expect(idleMachine(5).getStatus()).toBe('offline');
  });

  it('is shown to clients as offline while its source still reaches it', () => {
    const machine = idleMachine(5);
    expect(machine.toJSON().state.online).toBe(false);
    expect(machine.toJSON().state.idleOffline).toBe(true);
    expect(machine.getState().online).toBe(true);
  });

  it('tells clients when it goes offline and when it comes back', () => {
    const machine = idleMachine(3);
    const changes = jest.fn();
    const statuses = jest.fn();
    machineEvents.on('change', changes);
    machineEvents.on('status', statuses);

    jest.advanceTimersByTime(HOUR);
    machine.checkIdle();
    machine.update({ execution: 'ACTIVE', lastStateTs: new Date().toISOString() });

    expect(changes.mock.calls.map(([{ changes }]) => changes.online)).toEqual([false, true]);
    expect(changes.mock.calls.map(([{ changes }]) => changes.idleOffline)).toEqual([true, false]);
    expect(statuses.mock.calls.map(([{ status }]) => status)).toEqual(['offline', 'green']);
  });

  it('only tells clients it is no longer idle when it goes unreachable while shown offline', () => {
    const machine = idleMachine(5);
    const changes = jest.fn();
    machineEvents.on('change', changes);

    machine.update({ online: false });

    expect(machine.getStatus()).toBe('offline');
    expect(changes).toHaveBeenCalledTimes(1);
    expect(changes.mock.calls[0][0].changes).toEqual({ idleOffline: false });
  });

  it('starts counting again once it can be reached again', () => {
    const machine = idleMachine(5);
    machine.update({ online: false });

    machine.update({ online: true });

    expect(machine.getStatus()).toBe('idle');
    expect(machine.toJSON().state.online).toBe(true);
  });

  it('counts from when it went idle, however it got there', () => {
    const machine = new MTConnectMachine(doc, {
      online: true,
      eStop: 'TRIGGERED',
      lastStateTs: hoursAgo(5),
    });
    expect(machine.getStatus()).toBe('red');

    machine.update({ eStop: 'ARMED' });

    expect(machine.getStatus()).toBe('idle');
    expect(machine.getState().lastStateTs).toBe(new Date().toISOString());
  });

  it('keeps the time a source gives for going idle', () => {
    const machine = new MTConnectMachine(doc, { online: true, execution: 'ACTIVE' });
    const lastStateTs = hoursAgo(1);

    machine.update({ execution: 'STOPPED', lastStateTs });

    expect(machine.getState().lastStateTs).toBe(lastStateTs);
  });

  it('keeps its time when it was already idle', () => {
    const lastStateTs = hoursAgo(1);
    const machine = new MTConnectMachine(doc, { online: true, lastStateTs });

    machine.update({ mode: 'MANUAL' });

    expect(machine.getState().lastStateTs).toBe(lastStateTs);
  });

  it('only applies to an idle machine', () => {
    const waiting = new MTConnectMachine(doc, {
      online: true,
      mode: 'AUTOMATIC',
      execution: 'READY',
      lastStateTs: hoursAgo(5),
    });
    expect(waiting.getStatus()).toBe('yellow');
  });

  it('applies to every kind of machine', () => {
    const focas = new FocasMachine(doc, { online: true, lastStateTs: hoursAgo(5) });
    const haas = new HaasMachine(doc, { online: true, lastStateTs: hoursAgo(5) });
    expect(focas.getStatus()).toBe('offline');
    expect(haas.getStatus()).toBe('offline');
  });
});
