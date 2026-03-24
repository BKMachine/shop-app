import '@mdi/font/css/materialdesignicons.css';
import 'vuetify/styles';

import { createVuetify } from 'vuetify';

// https://vuetifyjs.com/en/introduction/why-vuetify/#feature-guides
export default createVuetify({
  theme: {
    defaultTheme: 'light',
    themes: {
      light: {
        colors: {
          rateLow: '#d44d4d',
          rateWarn: '#FB8C00',
          rateOk: '#4CAF50',
          rateGood: '#2196F3',
          rateTurbo: '#c084fc',
        },
      },
    },
  },
});
