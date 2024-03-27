import axios from './axios';

function printLocation(data: { loc: string; pos: string }) {
  return axios.post('/print/location', { ...data });
}

export default {
  printLocation,
};
