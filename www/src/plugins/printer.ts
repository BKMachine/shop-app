import axios from './axios';

async function printLocation(data: PrintLocationBody) {
  if (!data.loc || !data.pos) return;
  return axios.post('/print/location', data);
}

export default {
  printLocation,
};
