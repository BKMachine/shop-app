import _axios from 'axios';
import logger from '../../logger.js';
import { arduinoMachines as machines } from '../index.js';
import type ArduinoMachine from './ArduinoMachine.js';

const POLL_INTERVAL_MS = 5000;
// One dropped packet shouldn't end a running cycle, so it takes this many misses in a row.
const MISSES_BEFORE_OFFLINE = 3;
// The board runs from the machine's 24V supply, so it keeps answering with no lights on when an
// operator turns off the panel but leaves the breaker on.
const IDLE_OFFLINE_MS = 4 * 60 * 60 * 1000;
const LIGHTS = ['green', 'yellow', 'red'] as const;

const axios = _axios.create({
  timeout: 2000,
});

interface Tracker {
  misses: number;
  reachable: boolean;
  lastFailure: string | null;
  // When the current cycle or wait started, or null if that isn't known.
  greenSince: number | null;
  yellowSince: number | null;
  lightsOffSince: number | null;
}

const trackers = new Map<string, Tracker>();
let interval: NodeJS.Timeout;

export function start() {
  stop();
  interval = setInterval(run, POLL_INTERVAL_MS);
  logger.info('Started Arduino polling');
}

export function stop() {
  if (interval) {
    clearInterval(interval);
    logger.info('Stopped Arduino polling');
  }
}

function run() {
  machines.forEach((machine, location) => {
    poll(machine, location).catch((error: unknown) => {
      logger.error(`Failed to process Arduino ${location}: ${errorMessage(error)}`);
    });
  });
}

async function poll(machine: ArduinoMachine, location: string) {
  let lights: ArduinoResponse;
  try {
    const { data } = await axios.get(location);
    if (!isLights(data)) throw new Error('response is missing light states');
    lights = data;
  } catch (error) {
    recordFailure(machine, location, errorMessage(error));
    return;
  }
  recordLights(machine, location, lights);
}

function recordFailure(machine: ArduinoMachine, location: string, message: string) {
  const tracker = getTracker(location);
  tracker.misses++;
  if (tracker.misses < MISSES_BEFORE_OFFLINE) return;

  if (message !== tracker.lastFailure) {
    logger.warn(`Arduino ${location} is not responding: ${message}`);
    tracker.lastFailure = message;
  }

  tracker.reachable = false;
  tracker.lightsOffSince = null;

  if ((machine.getState() as ArduinoState).online) {
    machine.setState(new Map([['online', false]]));
    machine.updateStatus();
  }
}

function recordLights(machine: ArduinoMachine, location: string, lights: ArduinoResponse) {
  const tracker = getTracker(location);
  const state = machine.getState() as ArduinoState;
  const now = Date.now();
  const timestamp = new Date(now).toISOString();
  const changes: Changes = new Map();

  tracker.misses = 0;
  if (tracker.lastFailure) {
    logger.info(`Arduino ${location} is responding again`);
    tracker.lastFailure = null;
  }

  if (tracker.reachable) {
    if (lights.green !== state.green) {
      if (lights.green) {
        tracker.greenSince = now;
      } else if (tracker.greenSince !== null) {
        changes.set('lastCycle', now - tracker.greenSince);
        tracker.greenSince = null;
      }
    }
    if (lights.yellow !== state.yellow) {
      if (lights.yellow) {
        tracker.yellowSince = now;
      } else if (tracker.yellowSince !== null) {
        changes.set('lastOperatorTime', now - tracker.yellowSince);
        tracker.yellowSince = null;
      }
    }
  } else {
    // What happened while unreachable is unknown. A green light may be a cycle that started before
    // the outage, so its time can't be trusted, and time spent offline isn't an operator wait.
    tracker.reachable = true;
    tracker.greenSince = null;
    tracker.yellowSince = lights.yellow ? now : null;
  }

  for (const light of LIGHTS) {
    if (lights[light] !== state[light]) {
      changes.set(light, lights[light]);
      changes.set('lastStateTs', timestamp);
    }
  }

  if (LIGHTS.some((light) => lights[light])) tracker.lightsOffSince = null;
  else tracker.lightsOffSince ??= now;

  const online = tracker.lightsOffSince === null || now - tracker.lightsOffSince < IDLE_OFFLINE_MS;
  if (online !== state.online) {
    changes.set('online', online);
    changes.set('lastStateTs', timestamp);
    if (!online)
      logger.info(`Arduino ${location} has had no lights on for 4 hours, showing offline`);
  }

  if (changes.size) {
    machine.setState(changes);
    machine.updateStatus();
  }
}

function getTracker(location: string): Tracker {
  let tracker = trackers.get(location);
  if (!tracker) {
    tracker = {
      misses: 0,
      reachable: false,
      lastFailure: null,
      greenSince: null,
      yellowSince: null,
      lightsOffSince: null,
    };
    trackers.set(location, tracker);
  }
  return tracker;
}

function isLights(data: unknown): data is ArduinoResponse {
  return LIGHTS.every(
    (light) => typeof (data as Partial<ArduinoResponse> | null)?.[light] === 'boolean',
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
