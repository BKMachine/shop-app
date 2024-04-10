import axios from './axios';

async function printLocation(data: PrintLocationBody) {
  if (!data.loc || !data.pos) return;
  return axios.post('/print/location', data);
}

async function printItem(data: PrintItemBody) {
  if (!data.item || !data.description || !data.brand) return;
  return axios.post('/print/item', data);
}

export default {
  printLocation,
  printItem,
};
