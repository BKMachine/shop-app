import type { App } from 'vue';
import router from '../router';
import pinia from './pinia';
import vuetify from './vuetify';

export function registerPlugins(app: App) {
  app.use(router);
  app.use(pinia);
  app.use(vuetify);
}
