import axios from './axios';

async function printLocation(data: PrintLocationBody) {
  return axios.post('/print/location', data);
}

export default {
  printLocation,
};
