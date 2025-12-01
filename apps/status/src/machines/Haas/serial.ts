import axios from 'axios';
import logger from '../../logger.js';
import { haasMachines as machines } from '../index.js';

let interval: NodeJS.Timeout;

export function start() {
  stop();
  interval = setInterval(() => {
    try {
      run();
    } catch (_error) {
      // Do Nothing
    }
  }, 10000);
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
    const changes: Changes = new Map();
    const url = new URL(process.env.HAAS_SERIAL_URL as string);
    const name = machine.getMachine().name;
    const uri = url.pathname.endsWith('/')
      ? `${url.pathname}${encodeURIComponent(name)}`
      : `${url.pathname}/${encodeURIComponent(name)}`;
    url.pathname = uri;
    axios
      .post<string[][]>(url.toString(), { url: location })
      .then(async ({ data: responses }) => {
        const state = machine.getState() as HaasState;
        const online = state.online;
        if (!online) {
          changes.set('online', true);
          changes.set('lastStateTs', new Date().toISOString());
        }
        if (responses.join('').trim().length) changes.set('serial', JSON.stringify(responses));
        responses.forEach((response, i) => {
          const command = response.shift() as HaasCommand;
          switch (command) {
            case 'MODE': {
              const old = state.mode;
              const curr = response[0] as HaasMode;
              if (old !== curr) {
                changes.set('mode', curr);
                changes.set('lastStateTs', new Date().toISOString());
              }
              break;
            }
            case 'LASTCYCLE': {
              const old = state.lastCycle;
              const curr = parseLastCycle(response[0] as string);
              if (old !== curr) {
                changes.set('lastCycle', curr);
              }
              break;
            }
            case 'STATUS': {
              const old = state.execution;
              const curr = response[0] as HaasExecution;
              if (old !== curr) {
                changes.set('execution', curr);
                changes.set('lastStateTs', new Date().toISOString());
              }
              break;
            }
            case 'PROGRAM': {
              const old = state.execution;
              const curr = response[1] as HaasExecution;
              if (old !== curr) {
                changes.set('execution', curr);
                changes.set('lastStateTs', new Date().toISOString());
              }
              break;
            }
            default:
            // Do Nothing
          }
          /*if (changes.has('yellow')) {
            const isYellow = changes.get('yellow');
            if (!isYellow) {
              const now = new Date().valueOf();
              const lastState = new Date(machine.getState().lastStateTs).valueOf();
              const time = now - lastState;
              changes.set('lastOperatorTime', time);
            }
          }*/
        });
      })
      .catch(() => {
        if (machine.getState().online) changes.set('online', false);
      })
      .finally(() => {
        if (changes.size) {
          machine.setState(changes);
          machine.updateStatus();
        }
      });
  });
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
