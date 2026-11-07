import axios from 'axios';
import logger from '../../logger.js';
import { haasMachines as machines } from '../index.js';
import type HaasMachine from './HaasMachine.js';

const POLL_INTERVAL_MS = 10000;
// haas-serial takes about 4s at most: 1s to connect and 1s for each of its 3 commands.
const REQUEST_TIMEOUT_MS = 8000;
const REQUIRED_ENV = ['HAAS_SERIAL_URL', 'HAAS_SERIAL_API_KEY'];

interface Reading {
  mode?: HaasMode;
  execution?: HaasExecution;
  cycle?: number;
  parts?: number;
}

interface Tracker {
  requestInFlight: boolean;
  lastFailure: string | null;
  // The last values read from the machine, or null if there hasn't been one to compare with.
  cycle: number | null;
  parts: number | null;
  cyclesSinceParts: number;
  repeatPending: boolean;
}

const trackers = new Map<string, Tracker>();
let interval: NodeJS.Timeout;

export function start() {
  stop();
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
  if (missing.length) {
    logger.error(`Missing ${missing.join(', ')}, not polling Haas machines`);
    return;
  }
  interval = setInterval(run, POLL_INTERVAL_MS);
  logger.info('Started HaasSerial polling');
}

export function stop() {
  if (interval) {
    clearInterval(interval);
    logger.info('Stopped HaasSerial polling');
  }
}

function run() {
  logger.debug('Haas Serial Polling...');
  machines.forEach((machine, location) => {
    const tracker = getTracker(location);
    if (tracker.requestInFlight) return;
    tracker.requestInFlight = true;
    poll(machine, location, tracker)
      .catch((error: unknown) => {
        logger.error(`Failed to process Haas machine ${location}: ${failureMessage(error)}`);
      })
      .finally(() => {
        tracker.requestInFlight = false;
      });
  });
}

async function poll(machine: HaasMachine, location: string, tracker: Tracker) {
  let reading: Reading;
  try {
    const { data } = await axios.post<{ data: string[][] }>(
      statusUrl(machine),
      { url: location },
      {
        timeout: REQUEST_TIMEOUT_MS,
        headers: { 'x-api-key': process.env.HAAS_SERIAL_API_KEY },
      },
    );
    reading = parseReading(data.data);
  } catch (error) {
    recordFailure(machine, location, tracker, failureMessage(error));
    return;
  }
  recordReading(machine, location, tracker, reading);
}

function statusUrl(machine: HaasMachine) {
  const url = new URL(process.env.HAAS_SERIAL_URL as string);
  const name = encodeURIComponent(machine.getMachine().name);
  url.pathname = url.pathname.endsWith('/') ? `${url.pathname}${name}` : `${url.pathname}/${name}`;
  return url.toString();
}

function recordFailure(machine: HaasMachine, location: string, tracker: Tracker, message: string) {
  if (message !== tracker.lastFailure) {
    logger.warn(`Haas machine ${location} is not responding: ${message}`);
    tracker.lastFailure = message;
  }

  // Parts made while unreachable weren't seen, so they can't be matched to cycle times.
  tracker.parts = null;
  tracker.cyclesSinceParts = 0;
  tracker.repeatPending = false;

  if ((machine.getState() as HaasState).online) {
    machine.setState(new Map([['online', false]]));
    machine.updateStatus();
  }
}

function recordReading(machine: HaasMachine, location: string, tracker: Tracker, reading: Reading) {
  const state = machine.getState() as HaasState;
  const previousStatus = machine.getStatus();
  const previousStateTs = state.lastStateTs;
  const timestamp = new Date().toISOString();
  const changes: Changes = new Map();

  if (tracker.lastFailure) {
    logger.info(`Haas machine ${location} is responding again`);
    tracker.lastFailure = null;
  }

  if (!state.online) {
    changes.set('online', true);
    changes.set('lastStateTs', timestamp);
  }
  if (reading.mode !== undefined && reading.mode !== state.mode) {
    changes.set('mode', reading.mode);
    changes.set('lastStateTs', timestamp);
  }
  if (reading.execution !== undefined && reading.execution !== state.execution) {
    changes.set('execution', reading.execution);
    changes.set('lastStateTs', timestamp);
  }

  const cycle = finishedCycle(tracker, reading);
  if (cycle !== null) changes.set('lastCycle', cycle);

  if (changes.size) {
    machine.setState(changes);
    machine.updateStatus();
  }

  if (previousStatus === 'yellow' && machine.getStatus() !== 'yellow') {
    const waited = Date.now() - new Date(previousStateTs).valueOf();
    machine.setState(new Map([['lastOperatorTime', waited]]));
  }
}

/**
 * Returns the time of a cycle that just finished, if there was one.
 *
 * A change in the machine's last cycle time shows a cycle finished, but a part with exactly the
 * same time as the one before doesn't change it. The parts count catches those.
 */
function finishedCycle(tracker: Tracker, reading: Reading): number | null {
  const { cycle, parts } = reading;
  let finished: number | null = null;

  if (cycle !== undefined) {
    if (tracker.cycle !== null && cycle !== tracker.cycle) {
      // A machine can report 0 after power-up, which isn't a cycle.
      if (cycle > 0) {
        finished = cycle;
        tracker.cyclesSinceParts++;
      }
      tracker.repeatPending = false;
    } else if (tracker.repeatPending) {
      // A poll later the time still hasn't changed, so this part really did take the same time.
      finished = cycle;
      tracker.repeatPending = false;
    }
    tracker.cycle = cycle;
  }

  if (parts !== undefined && parts !== tracker.parts) {
    // The count can change between reading the cycle time and reading the parts, so wait a poll
    // to see whether a new time follows before treating this as a repeat.
    const made = tracker.parts === null ? 0 : parts - tracker.parts;
    if (made > tracker.cyclesSinceParts) tracker.repeatPending = true;
    tracker.parts = parts;
    tracker.cyclesSinceParts = 0;
  }

  return finished;
}

function parseReading(responses: unknown): Reading {
  if (!Array.isArray(responses)) throw new Error('response has no serial data');

  const reading: Reading = {};
  for (const [command, ...values] of responses as string[][]) {
    switch (command) {
      case 'MODE':
        if (values[0]) reading.mode = values[0] as HaasMode;
        break;
      case 'LASTCYCLE': {
        const cycle = parseLastCycle(values[0] ?? '');
        if (!Number.isNaN(cycle)) reading.cycle = cycle;
        break;
      }
      case 'STATUS':
        if (values[0]) reading.execution = values[0] as HaasExecution;
        break;
      case 'PROGRAM': {
        if (values[1]) reading.execution = values[1] as HaasExecution;
        const parts = Number.parseInt(values[3] ?? '', 10);
        if (values[2] === 'PARTS' && !Number.isNaN(parts)) reading.parts = parts;
        break;
      }
      default:
      // Do Nothing
    }
  }

  if (Object.keys(reading).length === 0) throw new Error('reply has no usable values');
  return reading;
}

function getTracker(location: string): Tracker {
  let tracker = trackers.get(location);
  if (!tracker) {
    tracker = {
      requestInFlight: false,
      lastFailure: null,
      cycle: null,
      parts: null,
      cyclesSinceParts: 0,
      repeatPending: false,
    };
    trackers.set(location, tracker);
  }
  return tracker;
}

function failureMessage(error: unknown) {
  const { message, response } = error as {
    message?: string;
    response?: { data?: { error?: string } };
  };
  return response?.data?.error ?? message ?? String(error);
}

export function parseLastCycle(text: string): number {
  // Extract seconds (last 2 digits)
  const seconds = parseInt(text.slice(-2), 10);

  // Extract minutes (2 digits before the last 2 digits)
  const minutes = parseInt(text.slice(-4, -2), 10);

  // Extract hours (everything before the minutes and seconds)
  const hours = parseInt(text.slice(0, -4), 10) || 0; // Default to 0 if empty
  return (hours * 3600 + minutes * 60 + seconds) * 1000;
}
