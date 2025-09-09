import axios from 'axios';
import _ from 'lodash';
import logger from '../../logger.js';
import { mtConnectMachines as machines } from '../index.js';
import mappings from './mtconnect_mappings.js';

let interval: NodeJS.Timeout;

export function start() {
  if (!process.env.MTCONNECT_URL) throw new Error('Missing MTCONNECT_URL environment variable.');
  stop();
  interval = setInterval(() => {
    run();
  }, 5000);
  logger.info('Started MTConnect polling');
}

export function stop() {
  if (interval) {
    clearInterval(interval);
    logger.info('Stopped MTConnect polling');
  }
}

function run() {
  logger.debug('Polling MTConnect');
  const url = `${process.env.MTCONNECT_URL?.replace(/\/+$/, '')}/current?format=json`;
  axios
    .get<MTConnectResponse>(url, { headers: { Accept: 'application/json' } })
    .then(({ data }) => {
      try {
        processJSON(data);
      } catch (_error) {}
    })
    .catch(() => {
      // MTConnect not responding - set all mtconnect machines to offline
      for (const [, value] of machines) {
        value.setState(new Map([['online', false]]));
      }
    });
}

function processJSON(data: MTConnectResponse) {
  const devices = data.MTConnectStreams.Streams.DeviceStream;

  devices.forEach((device) => {
    // find the matching machine
    const machine = machines.get(device.name);
    if (!machine) return;
    const changes: Changes = new Map();
    const deviceEvents = device.ComponentStream[0].Events;
    if (!deviceEvents) return;

    Object.keys(mappings).forEach((key) => {
      const deviceEvent = deviceEvents[key as keyof typeof deviceEvents];
      if (!deviceEvent) return;
      let value: string | boolean = deviceEvent[0].value;

      const prop = mappings[key] as keyof MTConnectState;
      const state = machine.getState() as MTConnectState;
      const old = state[prop as keyof MTConnectState];
      if (old === undefined) return;
      if (prop === 'online') value = value === 'AVAILABLE';

      if (!_.isEqual(old, value)) {
        changes.set(prop, value);
        if (prop === 'execution') {
          if (value === 'OPTIONAL_STOP') return;
          const date = new Date().toISOString();
          changes.set('lastStateTs', date);
          if (value !== 'ACTIVE' && old === 'ACTIVE') {
            const now = Date.now();
            const lastState = new Date(machine.getState().lastStateTs).valueOf();
            const time = now - lastState;
            changes.set('lastCycle', time);
          }
        }
      }
    });

    const previousStatus = machine.getStatus();

    if (changes.size) {
      machine.setState(changes);
      machine.updateStatus();
    }

    const currentStatus = machine.getStatus();

    if (previousStatus === 'yellow' && currentStatus !== 'yellow') {
      const lastOperatorTime: Changes = new Map();
      lastOperatorTime.set(
        'lastOperatorTime',
        Date.now() - new Date(machine.getState().lastStateTs).valueOf(),
      );
      machine.setState(lastOperatorTime);
    }
  });
}
