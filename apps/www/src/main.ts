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

// Socket connection to backend for app updates
const toolStore = useToolStore();
const socket = io();

// Tool updated or added
socket.on('tool', (tool: Tool) => {
  toolStore.SOCKET_tool(tool);
});

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
