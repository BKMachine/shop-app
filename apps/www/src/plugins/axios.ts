import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

const statusApi = axios.create({
  baseURL: import.meta.env.VITE_STATUS_API_URL || '/status-api',
});

export default api;
export { statusApi };
