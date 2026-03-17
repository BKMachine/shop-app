import axios from 'axios';
import { openDisplayNameDialog } from '@/state/displayNameDialog';

const api = axios.create({
  baseURL: '/api',
});

api.defaults.headers.common['X-Device-ID'] = getOrCreateDeviceId();

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 403) {
      openDisplayNameDialog();
    }
    return Promise.reject(error);
  },
);

const statusApi = axios.create({
  baseURL: `${import.meta.env.VITE_STATUS_API_URL}/api`,
});

export function getOrCreateDeviceId(): string {
  const key = 'shop-device-id';
  let value = localStorage.getItem(key);

  if (!value) {
    value = crypto.randomUUID();
    localStorage.setItem(key, value);
  }

  console.log(`Device ID: ${value}`);
  return value;
}

export default api;
export { statusApi };
