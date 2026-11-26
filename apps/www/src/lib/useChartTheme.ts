import { Chart } from 'chart.js';
import { computed, watchEffect } from 'vue';
import { useTheme } from 'vuetify';

/**
 * Points Chart.js's default text (ticks, axis titles, legend) and grid colors at the current
 * Vuetify theme. Chart.js resolves those from global defaults, so returns the theme name for the
 * chart's `:key`, which remounts it with the new defaults when the theme is toggled.
 */
export function useChartTheme() {
  const theme = useTheme();

  watchEffect(() => {
    const dark = theme.current.value.dark;
    Chart.defaults.color = dark ? 'rgba(255, 255, 255, 0.7)' : '#666';
    Chart.defaults.borderColor = dark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.1)';
  });

  return computed(() => theme.global.name.value);
}
