import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { machineStateCacheFile } from '../directories.js';
import logger from '../logger.js';

const MACHINE_STATE_CACHE_MAX_AGE_MS = 5 * 60 * 1000;

interface MachineStateSnapshot {
  savedAt: string;
  machines: Record<string, MachineState>;
}

function isRecentSnapshot(savedAt: string): boolean {
  const savedAtMs = Date.parse(savedAt);

  if (Number.isNaN(savedAtMs)) {
    return false;
  }

  return Date.now() - savedAtMs < MACHINE_STATE_CACHE_MAX_AGE_MS;
}

export async function loadRecentMachineStateSnapshot(): Promise<Map<string, MachineState>> {
  try {
    const rawSnapshot = await readFile(machineStateCacheFile, 'utf8');
    const snapshot = JSON.parse(rawSnapshot) as Partial<MachineStateSnapshot>;

    if (typeof snapshot.savedAt !== 'string' || !isRecentSnapshot(snapshot.savedAt)) {
      return new Map();
    }

    if (!snapshot.machines || typeof snapshot.machines !== 'object') {
      return new Map();
    }

    logger.info(`Loaded recent machine state snapshot from '${machineStateCacheFile}'.`);
    return new Map(Object.entries(snapshot.machines) as [string, MachineState][]);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      logger.warn('Failed to load machine state snapshot.', error);
    }

    return new Map();
  }
}

export async function saveMachineStateSnapshot(
  machineStates: ReadonlyArray<readonly [string, MachineState]>,
): Promise<void> {
  if (machineStates.length === 0) {
    logger.warn('Skipping machine state snapshot save because no machine states were loaded.');
    return;
  }

  const snapshot: MachineStateSnapshot = {
    savedAt: new Date().toISOString(),
    machines: Object.fromEntries(machineStates),
  };

  try {
    await mkdir(path.dirname(machineStateCacheFile), { recursive: true });
    await writeFile(machineStateCacheFile, JSON.stringify(snapshot), 'utf8');
    logger.info(
      `Saved machine state snapshot for ${machineStates.length} machines to '${machineStateCacheFile}'.`,
    );
  } catch (error) {
    logger.warn('Failed to save machine state snapshot.', error);
  }
}
