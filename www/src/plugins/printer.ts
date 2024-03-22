import axios from './axios';

function print(text: string) {
  return axios.post('/print', { text });
}

export default {
  print,
};
