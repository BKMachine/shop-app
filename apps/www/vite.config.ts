import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';
import vueDevTools from 'vite-plugin-vue-devtools';
import vuetify, { transformAssetUrls } from 'vite-plugin-vuetify';

function getManualChunk(moduleId: string) {
  if (
    moduleId.includes('/node_modules/vue/') ||
    moduleId.includes('/node_modules/vue-router/') ||
    moduleId.includes('/node_modules/pinia/')
  ) {
    return 'vue-core';
  }

  if (moduleId.includes('/node_modules/vuetify/')) {
    return 'vuetify';
  }

  if (
    moduleId.includes('/node_modules/chart.js/') ||
    moduleId.includes('/node_modules/vue-chartjs/') ||
    moduleId.includes('/node_modules/chartjs-adapter-luxon/') ||
    moduleId.includes('/node_modules/chartjs-plugin-annotation/')
  ) {
    return 'charts';
  }

  if (moduleId.includes('/node_modules/socket.io-client/')) {
    return 'socket';
  }

  return undefined;
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    vue({
      template: { transformAssetUrls },
    }),
    vuetify(),
    mode !== 'production' && vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: getManualChunk,
      },
    },
    assetsInlineLimit: 0,
  },
  server: {
    port: 8080,
    strictPort: true,
    proxy: {
      '^/status-api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        ws: false,
        rewrite: (path) => path.replace(/^\/status-api/, '/api'),
      },
      '^/(api|socket.io)': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        ws: true,
      },
      '^/downloads': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        rewrite: (path) => path,
      },
      '^/images': {
        // target: 'http://127.0.0.1:3000',
        target: 'https://app.bkmachine.net',
        changeOrigin: true,
        rewrite: (path) => path,
      },
      '^/documents': {
        target: 'https://app.bkmachine.net',
        changeOrigin: true,
        rewrite: (path) => path,
      },
    },
  },
}));
