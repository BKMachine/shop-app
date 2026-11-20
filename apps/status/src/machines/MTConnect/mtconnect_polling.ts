import http from 'node:http';
import axios from 'axios';
import _ from 'lodash';
import logger from '../../logger.js';
import { mtConnectMachines as machines } from '../index.js';
import type { StateChanges } from '../Machine.js';
import mappings from './mtconnect_mappings.js';

const POLL_INTERVAL_MS = 5000;
// Shorter than the poll interval so a hung request counts as a miss before the next poll.
const REQUEST_TIMEOUT_MS = 4000;
// One dropped request shouldn't flash both machines offline, so it takes this many misses in a row.
const MISSES_BEFORE_OFFLINE = 3;
// A new connection for each poll. Node's default agent closes an idle kept-alive connection after
// 5 s, the same as the poll interval, and when that lands as the next poll reuses the connection,
// axios reports it as its own timeout within milliseconds. In the container that failed 76 of 360
// polls; new connections failed none.
const httpAgent = new http.Agent({ keepAlive: false });

let interval: NodeJS.Timeout;
let requestInFlight = false;
let misses = 0;
let lastFailure: string | null = null;
// Machines whose running cycle crossed a connection drop, so its time can't be trusted.
const interruptedCycles = new Set<string>();

export function start() {
  if (!process.env.MTCONNECT_URL) throw new Error('Missing MTCONNECT_URL environment variable.');
  stop();
  interval = setInterval(() => {
    run();
  }, POLL_INTERVAL_MS);
  logger.info('Started MTConnect polling');
}

export function stop() {
  if (interval) {
    clearInterval(interval);
    logger.info('Stopped MTConnect polling');
  }
}

function run() {
  if (requestInFlight) return;
  requestInFlight = true;
  logger.debug('Polling MTConnect');
  const url = `${process.env.MTCONNECT_URL?.replace(/\/+$/, '')}/current?format=json`;
  axios
    .get<MTConnectResponse>(url, {
      headers: { Accept: 'application/json' },
      timeout: REQUEST_TIMEOUT_MS,
      httpAgent,
    })
    .then(({ data }) => {
      processJSON(data);
      misses = 0;
      if (lastFailure) {
        logger.info('MTConnect polling recovered');
        lastFailure = null;
      }
    })
    .catch((error: unknown) => {
      // Agent unreachable or its response is unusable - the machine data can't be trusted
      const message = error instanceof Error ? error.message : String(error);
      misses++;
      if (misses < MISSES_BEFORE_OFFLINE) {
        logger.debug(`MTConnect poll missed (${misses} in a row): ${message}`);
        return;
      }
      if (message !== lastFailure) {
        logger.error(`MTConnect polling failed: ${message}`);
        lastFailure = message;
      }
      setAllOffline();
    })
    .finally(() => {
      requestInFlight = false;
    });
}

function setAllOffline() {
  for (const [location, machine] of machines) {
    const state = machine.getState();
    if (state.execution === 'ACTIVE') interruptedCycles.add(location);
    if (state.online) machine.update({ online: false });
  }
}

function processJSON(data: MTConnectResponse) {
  const devices = data.MTConnectStreams.Streams.DeviceStream;

  devices.forEach((device) => {
    // find the matching machine
    const machine = machines.get(device.name);
    if (!machine) return;
    // The values come from the agent unchecked, so they can't be held to the state's types.
    const changes: Record<string, unknown> = {};
    const deviceEvents = device.ComponentStream[0].Events;
    if (!deviceEvents) return;

    const condition = device.ComponentStream[0].Condition;
    if (condition) {
      const state = machine.getState();
      const alarms = readAlarms(condition);
      if (!_.isEqual(state.alarms, alarms)) changes.alarms = alarms;
      const motion = conditionLevel(condition, 'MOTION');
      if (motion && motion !== state.motion) changes.motion = motion;
    }

    Object.keys(mappings).forEach((key) => {
      const deviceEvent = deviceEvents[key as keyof typeof deviceEvents];
      if (!deviceEvent) return;
      let value: string | boolean = deviceEvent[0].value;

      const prop = mappings[key] as keyof MTConnectState;
      const old = machine.getState()[prop];
      if (old === undefined) return;
      if (prop === 'online') value = value === 'AVAILABLE';

      if (!_.isEqual(old, value)) {
        // An optional stop is a pause within the cycle, so the machine stays as it was
        if (prop === 'execution' && value === 'OPTIONAL_STOP') return;
        changes[prop] = value;
        if (prop === 'execution') {
          changes.lastStateTs = new Date().toISOString();
          if (old === 'ACTIVE' && value === 'UNAVAILABLE') {
            // The connection dropped mid-cycle, which isn't the end of the cycle
            interruptedCycles.add(device.name);
          } else if (value !== 'ACTIVE') {
            const interrupted = interruptedCycles.delete(device.name);
            if (old === 'ACTIVE' && !interrupted) {
              const now = Date.now();
              const lastState = new Date(machine.getState().lastStateTs).valueOf();
              const time = now - lastState;
              changes.lastCycle = time;
            }
          }
        }
      }
    });

    if (Object.keys(changes).length) machine.update(changes as StateChanges<MTConnectState>);
  });
}

const ALARM_LEVELS = [
  ['Fault', 'FAULT'],
  ['Warning', 'WARNING'],
] as const;

/** Lists the active faults, then warnings, in the order the agent gives them. */
function readAlarms(condition: NonNullable<Component['Condition']>): MTConnectAlarm[] {
  return ALARM_LEVELS.flatMap(([key, level]) =>
    (condition[key] ?? []).map((entry) => ({
      type: entry.type,
      level,
      code: entry.nativeCode ?? '',
      message: (entry.value ?? '').trim(),
    })),
  );
}

/** The level of the first condition of this type, as the old motion event reported it. */
function conditionLevel(
  condition: NonNullable<Component['Condition']>,
  type: string,
): MTConnectState['motion'] | null {
  for (const key of ['Fault', 'Warning', 'Normal', 'Unavailable'] as const) {
    if (condition[key]?.some((entry) => entry.type === type)) {
      return key.toUpperCase() as MTConnectState['motion'];
    }
  }
  return null;
}
