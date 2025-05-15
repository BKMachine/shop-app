import now from 'performance-now';
import { processMessage } from '../machines/Focas/mqtt.js';

const message: Buffer = getMessage();
const count = 100000;

let start, end;

start = now();
for (let i = 0; i < count; i++) {
  processMessage('fanuc/rd1/production/1', message);
}
end = now();
const diff = end - start;
console.log(diff.toFixed(3));
console.log((diff / count).toFixed(4));
const perSecond = (1000 / diff) * count;
console.log(perSecond.toFixed(0), 'messages per second');

function getMessage(): Buffer {
  const data = getData();
  return Buffer.from(JSON.stringify(data), 'utf-8');
}

function getData() {
  return {
    observation: {
      time: 1673290190173,
      machine: 'rd1',
      name: 'production',
      marker: [
        {
          type: 'path',
          number: 1,
        },
      ],
    },
    state: {
      time: 2215.4447,
      data: {
        program: {
          running: {
            name: 'O1021',
            number: 1021,
            size_b: 106000,
            comment: '(HK45C_T COMP OP1)',
            modified: 1672996440000,
          },
          main: {
            name: '',
            number: 1021,
            size_b: 106000,
            comment: '(HK45C_T COMP OP1)',
            modified: 1672996440000,
          },
        },
        pieces: {
          produced: 507,
          produced_life: 1179,
          remaining: 800,
        },
        timers: {
          cycle_time_ms: 0,
        },
      },
    },
  };
}
