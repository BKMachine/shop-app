import '@mdi/font/css/materialdesignicons.css';
import 'vuetify/styles';

import { createVuetify } from 'vuetify';

const THEME_STORAGE_KEY = 'shop-app-theme';

function getDefaultTheme() {
  if (typeof window === 'undefined') return 'light';

  return window.localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
}

// https://vuetifyjs.com/en/introduction/why-vuetify/#feature-guides
export default createVuetify({
  theme: {
    defaultTheme: getDefaultTheme(),
    themes: {
      light: {
        colors: {
          background: '#fffdf8',
          surface: '#fffdf8',
          primary: '#1867c0',
          secondary: '#598392',
          rateLow: '#d44d4d',
          rateWarn: '#FB8C00',
          rateOk: '#4CAF50',
          rateGood: '#2196F3',
          rateTurbo: '#c084fc',
        },
      },
      dark: {
        colors: {
          background: '#11161b',
          surface: '#1a232b',
          primary: '#8ecae6',
          secondary: '#4f6d7a',
          rateLow: '#ef9a9a',
          rateWarn: '#ffb74d',
          rateOk: '#81c784',
          rateGood: '#64b5f6',
          rateTurbo: '#d8b4fe',
        },
      },
    },
  },
});
