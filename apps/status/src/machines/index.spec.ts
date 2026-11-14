import type { MachineDoc } from '../database/lib/machine/machine_model.js';

jest.mock('../logger.js', () => ({
  __esModule: true,
  default: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../database/lib/machine/index.js', () => ({
  __esModule: true,
  default: { list: jest.fn() },
}));

const SYNC_MS = 10000;

function doc(fields: Partial<Record<keyof MachineDoc, unknown>> = {}) {
  return {
    _id: 'id-1',
    name: 'RD5',
    source: 'arduino',
    location: 'http://rd5',
    department: null,
    ...fields,
  } as unknown as MachineDoc;
}

async function setup(docs: MachineDoc[] = [doc()]) {
  jest.resetModules();
  const { default: logger } = await import('../logger.js');
  const { default: MachineService } = await import('../database/lib/machine/index.js');
  const { machineEvents } = await import('./events.js');
  const registry = await import('./index.js');

  const list = MachineService.list as jest.Mock;
  list.mockResolvedValue(docs);
  const refreshed = jest.fn();
  machineEvents.on('refresh-data', refreshed);

  await registry.loadMachines();
  refreshed.mockClear();

  const machine = () => registry.arduinoMachines.get('http://rd5');
  return { list, logger, machine, refreshed, registry };
}

describe('machine registry', () => {
  it('loads each machine under its source', async () => {
    const { registry } = await setup([
      doc(),
      doc({ _id: 'id-2', name: 'NHX', source: 'mtconnect', location: 'nhx' }),
    ]);

    expect(registry.listMachineData().map((machine) => machine.name)).toEqual(['RD5', 'NHX']);
    expect(registry.arduinoMachines.has('http://rd5')).toBe(true);
    expect(registry.mtConnectMachines.has('nhx')).toBe(true);
  });

  it('starts a machine from the state saved for it', async () => {
    const { list, registry } = await setup([]);
    list.mockResolvedValue([doc()]);

    await registry.loadMachines(new Map([['id-1', { online: true, green: true } as ArduinoState]]));

    expect(registry.default.get('id-1')?.getStatus()).toBe('green');
  });

  it('leaves out a machine with a source it does not know, warning once', async () => {
    const { logger, refreshed, registry } = await setup([doc({ source: 'telepathy' })]);

    expect(await registry.loadMachines()).toBe(false);

    expect(registry.listMachineData()).toEqual([]);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(refreshed).not.toHaveBeenCalled();
  });

  describe('reloading', () => {
    it('does nothing when the machines have not changed', async () => {
      const { machine, refreshed, registry } = await setup();
      const before = machine();

      expect(await registry.loadMachines()).toBe(false);

      expect(machine()).toBe(before);
      expect(refreshed).not.toHaveBeenCalled();
    });

    it('keeps the state of a machine whose details changed', async () => {
      const { list, machine, refreshed, registry } = await setup();
      machine()?.update({ online: true, green: true, lastCycle: 60000 });

      list.mockResolvedValue([doc({ name: 'RD5-B' })]);
      expect(await registry.loadMachines()).toBe(true);

      expect(machine()?.toJSON().name).toBe('RD5-B');
      expect(machine()?.getState().lastCycle).toEqual([60000]);
      expect(machine()?.getStatus()).toBe('green');
      expect(refreshed).toHaveBeenCalledTimes(1);
    });

    it('leaves the other machines untouched when one changes', async () => {
      const other = doc({ _id: 'id-2', name: 'ME1', location: 'http://me1' });
      const { list, registry } = await setup([doc(), other]);
      const before = registry.arduinoMachines.get('http://me1');

      list.mockResolvedValue([doc({ name: 'RD5-B' }), other]);
      await registry.loadMachines();

      expect(registry.arduinoMachines.get('http://me1')).toBe(before);
    });

    it('starts a machine afresh when it is read from somewhere else', async () => {
      const { list, machine, registry } = await setup();
      machine()?.update({ online: true, green: true });

      list.mockResolvedValue([doc({ location: 'http://rd5-new' })]);
      await registry.loadMachines();

      expect(machine()).toBeUndefined();
      expect(registry.arduinoMachines.get('http://rd5-new')?.getStatus()).toBe('offline');
    });

    it('drops a machine that was removed', async () => {
      const { list, refreshed, registry } = await setup();

      list.mockResolvedValue([]);
      expect(await registry.loadMachines()).toBe(true);

      expect(registry.listMachineData()).toEqual([]);
      expect(registry.arduinoMachines.size).toBe(0);
      expect(refreshed).toHaveBeenCalledTimes(1);
    });
  });

  describe('syncing with the database', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('picks up a change made to the database', async () => {
      const { list, machine, registry } = await setup();
      registry.startSync();

      list.mockResolvedValue([doc({ name: 'RD5-B' })]);
      await jest.advanceTimersByTimeAsync(SYNC_MS);
      registry.stopSync();

      expect(machine()?.toJSON().name).toBe('RD5-B');
    });

    it('keeps the machines it has while the database cannot be read, logging once', async () => {
      const { list, logger, machine, registry } = await setup();
      registry.startSync();

      list.mockRejectedValue(new Error('connection lost'));
      await jest.advanceTimersByTimeAsync(SYNC_MS * 3);
      registry.stopSync();

      expect(machine()).toBeDefined();
      expect(logger.error).toHaveBeenCalledTimes(1);
    });
  });
});
