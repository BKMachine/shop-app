import now from 'performance-now';
import { XMLParser } from 'fast-xml-parser';
import { data } from './__stubs__/mtconnect_example.js';

const count = 1000;

let start, end;

start = now();

const parser = new XMLParser();

for (let i = 0; i < count; i++) {
  parser.parse(data);
}
end = now();
const diff = end - start;
console.log(diff.toFixed(3));
console.log((diff / count).toFixed(4));
const perSecond = (1000 / diff) * count;
console.log(perSecond.toFixed(0), 'messages per second');
