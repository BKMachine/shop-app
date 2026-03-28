import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';
import vueDevTools from 'vite-plugin-vue-devtools';
import vuetify, { transformAssetUrls } from 'vite-plugin-vuetify';

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
        manualChunks: {
          'vue-core': ['vue', 'vue-router', 'pinia'],
          vuetify: ['vuetify'],
          charts: ['chart.js', 'vue-chartjs', 'chartjs-adapter-luxon', 'chartjs-plugin-annotation'],
          socket: ['socket.io-client'],
        },
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
