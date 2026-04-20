import { createApp } from 'vue';
import axios from '@/plugins/axios';
import App from './App.vue';
import { registerPlugins } from './plugins';
import './assets/style.css';

if (import.meta.env.DEV) {
  const baseTitle = document.title || 'BK Machine';
  document.title = `[DEV] ${baseTitle}`;
}

const app = createApp(App);
registerPlugins(app);
app.mount('#app');

// Poll the backend server for version UUID
// and refresh the page on new build
let version: string;
async function getVersion() {
  axios.get('/version').then(({ data }) => {
    if (!version) version = data;
    else if (data !== version) {
      location.reload();
    }
  });
}

getVersion();
setInterval(getVersion, 1000 * 60 * 5);
