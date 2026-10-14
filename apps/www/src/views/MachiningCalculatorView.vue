<template>
  <v-card class="calc">
    <v-card-title class="header my-2 d-flex align-center flex-wrap ga-3">
      Machining Calculator
      <v-tabs v-model="tab" class="calc-tabs" color="primary" density="compact">
        <v-tab value="turning">Turning</v-tab>
        <v-tab value="milling">Milling</v-tab>
      </v-tabs>
      <v-spacer />
      <v-btn-toggle
        v-model="units"
        color="primary"
        density="compact"
        divided
        mandatory
        variant="outlined"
      >
        <v-btn value="in">Inch</v-btn>
        <v-btn value="mm">Metric</v-btn>
      </v-btn-toggle>
    </v-card-title>

    <v-card-text>
      <v-window v-model="tab">
        <v-window-item value="turning">
          <TurningCalculator :units="units" />
        </v-window-item>
        <v-window-item value="milling">
          <MillingCalculator :units="units" />
        </v-window-item>
      </v-window>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import MillingCalculator from '@/components/calculator/MillingCalculator.vue';
import TurningCalculator from '@/components/calculator/TurningCalculator.vue';
import type { Units } from '@/lib/calculatorFigure';

type CalcTab = 'turning' | 'milling';

const UNITS_STORAGE_KEY = 'shop-app-calculator-units';
const TAB_STORAGE_KEY = 'shop-app-calculator-tab';
const ENABLED_TABS: readonly CalcTab[] = ['turning', 'milling'];

const route = useRoute();
const router = useRouter();

const tab = ref<CalcTab>(loadTab());
const units = ref<Units>(loadUnits());

watch(units, (next) => {
  try {
    window.localStorage.setItem(UNITS_STORAGE_KEY, next);
  } catch {
    // Storage can be unavailable (private mode); the toggle still works for this visit.
  }
});

watch(tab, (next) => {
  try {
    window.localStorage.setItem(TAB_STORAGE_KEY, next);
  } catch {
    // Storage can be unavailable (private mode); the tab still switches for this visit.
  }
  if (route.query.tab !== next) void router.replace({ query: { ...route.query, tab: next } });
});

function isEnabledTab(value: unknown): value is CalcTab {
  return typeof value === 'string' && ENABLED_TABS.includes(value as CalcTab);
}

// A ?tab= link wins, then the last tab used on this device.
function loadTab(): CalcTab {
  if (isEnabledTab(route.query.tab)) return route.query.tab;
  try {
    const stored = window.localStorage.getItem(TAB_STORAGE_KEY);
    if (isEnabledTab(stored)) return stored;
  } catch {
    // Fall through to the default.
  }
  return 'turning';
}

function loadUnits(): Units {
  try {
    return window.localStorage.getItem(UNITS_STORAGE_KEY) === 'mm' ? 'mm' : 'in';
  } catch {
    return 'in';
  }
}
</script>

<style scoped>
/* Palette for the calculators; children read these through inherited custom properties. */
.calc {
  --calc-dia: #0284c7;
  --calc-rpm: #d97706;
  --calc-sfm: #059669;
  --calc-ipr: #7c3aed;
  --calc-ipm: #db2777;
  --calc-ipt: #dc2626;
  --calc-flutes: #65a30d;
  --calc-woc: #0d9488;
  --calc-chip: #b45309;
  --metal-hi: #eef1f5;
  --metal-lo: #8d96a2;
  --steel: #4f5864;
  --steel-edge: #353c45;
  --insert: #c9a227;
  --block: #d6dae0;
  --fig-ink: rgba(var(--v-theme-on-surface), 0.55);
  --tile-bg: rgba(var(--v-theme-on-surface), 0.03);
  --tile-border: rgba(var(--v-theme-on-surface), 0.12);
}

:global(.v-theme--dark) .calc {
  --calc-dia: #38bdf8;
  --calc-rpm: #fbbf24;
  --calc-sfm: #34d399;
  --calc-ipr: #c4b5fd;
  --calc-ipm: #f472b6;
  --calc-ipt: #f87171;
  --calc-flutes: #a3e635;
  --calc-woc: #2dd4bf;
  --calc-chip: #fdba74;
  --metal-hi: #a9b3bf;
  --metal-lo: #3c4650;
  --steel: #2c343d;
  --steel-edge: #4a5561;
  --insert: #e0b84a;
  --block: #333d47;
  --tile-bg: rgba(var(--v-theme-on-surface), 0.04);
}

.calc-tabs {
  flex: 0 0 auto;
}
</style>
