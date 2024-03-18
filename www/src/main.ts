import './assets/style.css';

import { io } from 'socket.io-client';
import { createApp } from 'vue';
import App from './App.vue';
import { registerPlugins } from './plugins';
import axios from '@/plugins/axios';
import { useToolStore } from '@/stores/tool_store';

const app = createApp(App);
registerPlugins(app);
app.mount('#app');

const toolStore = useToolStore();
const socket = io();

socket.on('tool', (tool: ToolDoc) => {
  toolStore.SOCKET_tool(tool);
});

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
