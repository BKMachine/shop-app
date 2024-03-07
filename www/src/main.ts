import './assets/style.css';

import { createApp } from 'vue';
import App from './App.vue';
import { registerPlugins } from './plugins';
import axios from '@/plugins/axios';

const app = createApp(App);
registerPlugins(app);
app.mount('#app');

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
