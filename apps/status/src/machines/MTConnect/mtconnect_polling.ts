import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import _ from 'lodash';
import logger from '../../logger.js';
import { mtConnectMachines as machines } from '../index.js';
import mappings from './mtconnect_mappings.js';

let interval: NodeJS.Timeout;
const parser = new XMLParser({ ignoreAttributes: false });

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
  axios
    .get(process.env.MTCONNECT_URL as string, { headers: { Accept: 'application/xml' } })
    .then(({ data }) => {
      // Parse XML string to json
      try {
        processJSON(parser.parse(data));
      } catch (_error) {
        // Do Nothing - Wait until next query
      }
    })
    .catch(() => {
      // MTConnect not responding - set all mtconnect machines to offline
      for (const [, value] of machines) {
        value.setState(new Map([['online', false]]));
      }
    });
}

function processJSON(data: MTConnectResponse) {
  const deviceStreams = data.MTConnectStreams.Streams.DeviceStream;

  deviceStreams.forEach((deviceStream) => {
    // find the matching machine
    const deviceName = deviceStream['@_name'];
    const machine = machines.get(deviceName);
    if (!machine) return;
    const changes: Changes = new Map();
    let componentStreams = deviceStream.ComponentStream;
    if (!Array.isArray(componentStreams)) {
      componentStreams = [componentStreams];
    }
    componentStreams.forEach((componentStream) => {
      Object.keys(mappings).forEach((location) => {
        let value: unknown;
        try {
          value = get(componentStream, location);
        } catch (error) {
          logger.error(`Error getting value for location ${location} in componentStream`, error);
          return;
        }
        const prop = mappings[location] as keyof MTConnectState;
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
  });
}

const get = (object: any, path: string, defaultValue?: any) =>
  path.split('.').reduce((o, p) => (o ? o[p] : defaultValue), object);
