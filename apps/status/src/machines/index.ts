import MachineService from '../database/lib/machine/index.js';
import type { MachineDoc } from '../database/lib/machine/machine_model.js';
import logger from '../logger.js';
import ArduinoMachine from './Arduino/ArduinoMachine.js';
import { machineEvents } from './events.js';
import FocasMachine from './Focas/FocasMachine.js';
import HaasMachine from './Haas/HaasMachine.js';
import MTConnectMachine from './MTConnect/MTConnectMachine.js';

// Machines are set up through the main server, which writes them straight to the database.
const SYNC_INTERVAL_MS = 10000;

type AnyMachine = FocasMachine | ArduinoMachine | MTConnectMachine | HaasMachine;

const machines = new Map<string, AnyMachine>();
export const focasMachines = new Map<string, FocasMachine>();
export const arduinoMachines = new Map<string, ArduinoMachine>();
export const mtConnectMachines = new Map<string, MTConnectMachine>();
export const haasMachines = new Map<string, HaasMachine>();

// A seed state is whatever was saved for the machine earlier, so it isn't checked against a type.
const sources: Record<
  MachineSource,
  { byLocation: Map<string, AnyMachine>; create(doc: MachineDoc, seed?: object): AnyMachine }
> = {
  focas: { byLocation: focasMachines, create: (doc, seed) => new FocasMachine(doc, seed) },
  arduino: { byLocation: arduinoMachines, create: (doc, seed) => new ArduinoMachine(doc, seed) },
  mtconnect: {
    byLocation: mtConnectMachines,
    create: (doc, seed) => new MTConnectMachine(doc, seed),
  },
  serial: { byLocation: haasMachines, create: (doc, seed) => new HaasMachine(doc, seed) },
};

// Machines already warned about, so each sync doesn't warn again.
const unknownSources = new Set<string>();
let syncTimer: NodeJS.Timeout | undefined;
let syncInFlight = false;
let lastSyncFailure: string | null = null;

/**
 * Loads the machines from the database. A machine whose details haven't changed is kept as it
 * is, so reloading doesn't disturb its state or anything part-way through reading it.
 */
export async function loadMachines(
  seedStates: ReadonlyMap<string, MachineState> = new Map(),
): Promise<boolean> {
  const docs = await MachineService.list();
  const next: AnyMachine[] = [];
  let changed = false;

  for (const doc of docs) {
    const id = doc._id.toString();
    const source = sources[doc.source];
    if (!source) {
      if (!unknownSources.has(id)) {
        logger.warn(`Machine '${doc.name}' has unknown source '${doc.source}', leaving it out`);
        unknownSources.add(id);
      }
      continue;
    }

    const current = machines.get(id);
    if (current && JSON.stringify(current.doc) === JSON.stringify(doc)) {
      next.push(current);
      continue;
    }

    // State read from one place says nothing about a machine now read from somewhere else.
    const sameConnection =
      current && current.doc.source === doc.source && current.doc.location === doc.location;
    next.push(source.create(doc, sameConnection ? current.getState() : seedStates.get(id)));
    changed = true;
  }

  // Fewer machines than before means one was removed.
  if (!changed && next.length === machines.size) return false;

  machines.clear();
  for (const { byLocation } of Object.values(sources)) byLocation.clear();
  for (const machine of next) {
    machines.set(machine.id, machine);
    sources[machine.doc.source].byLocation.set(machine.doc.location, machine);
  }
  machineEvents.emit('refresh-data');
  return true;
}

/** Keeps the machines up to date with the database. */
export function startSync(): void {
  stopSync();
  syncTimer = setInterval(sync, SYNC_INTERVAL_MS);
}

export function stopSync(): void {
  clearInterval(syncTimer);
}

function sync(): void {
  if (syncInFlight) return;
  syncInFlight = true;
  loadMachines()
    .then((changed) => {
      if (changed) logger.info('Machine settings changed, reloaded machines');
      if (lastSyncFailure) logger.info('Reading machine settings recovered');
      lastSyncFailure = null;
    })
    .catch((error: unknown) => {
      // The machines already loaded carry on as they are.
      const message = error instanceof Error ? error.message : String(error);
      if (message !== lastSyncFailure) logger.error(`Failed to read machine settings: ${message}`);
      lastSyncFailure = message;
    })
    .finally(() => {
      syncInFlight = false;
    });
}

export function listMachineData(): MachineData[] {
  return Array.from(machines.values(), (machine) => machine.toJSON());
}

export function listMachineStateEntries(): Array<[string, MachineState]> {
  return Array.from(machines, ([id, machine]) => [id, machine.getState()]);
}

export default machines;
