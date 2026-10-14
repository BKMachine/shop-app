<template>
  <v-card class="calc">
    <v-card-title class="header my-2 d-flex align-center flex-wrap ga-3">
      Machining Calculator
      <v-tabs v-model="tab" class="calc-tabs" color="primary" density="compact">
        <v-tab value="turning">Turning</v-tab>
        <v-tab disabled value="milling">Milling</v-tab>
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
          <div class="calc-layout">
            <div class="calc-figure-wrap">
              <svg
                aria-label="Turning diagram showing diameter, spindle speed, surface speed and feed"
                class="calc-figure"
                :class="{ 'has-highlight': highlightKey }"
                role="img"
                :style="{ '--spin': `${spinSeconds}s`, '--spin-state': spinState }"
                viewBox="0 0 720 324"
              >
                <defs>
                  <linearGradient id="mc-metal" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0" style="stop-color: var(--metal-lo)" />
                    <stop offset="0.32" style="stop-color: var(--metal-hi)" />
                    <stop offset="1" style="stop-color: var(--metal-lo)" />
                  </linearGradient>
                  <radialGradient id="mc-face" cx="0.38" cy="0.35" r="0.75">
                    <stop offset="0" style="stop-color: var(--metal-hi)" />
                    <stop offset="1" style="stop-color: var(--metal-lo)" />
                  </radialGradient>
                  <clipPath id="mc-part-clip">
                    <rect height="128" width="170" x="80" y="96" />
                    <rect height="112" width="120" x="250" y="104" />
                  </clipPath>
                  <clipPath id="mc-finish-clip">
                    <rect height="112" width="120" x="250" y="104" />
                  </clipPath>
                </defs>

                <!-- Top view: spindle, chuck, stock, tool -->
                <rect class="fig-steel" height="100" rx="3" width="20" x="0" y="110" />
                <rect class="fig-steel" height="196" rx="8" width="62" x="18" y="62" />
                <rect class="fig-steel" height="20" rx="2" width="16" x="80" y="76" />
                <rect class="fig-steel" height="20" rx="2" width="16" x="80" y="224" />

                <rect fill="url(#mc-metal)" height="128" width="170" x="80" y="96" />
                <rect fill="url(#mc-metal)" height="112" width="120" x="250" y="104" />
                <g class="fig-bands" clip-path="url(#mc-part-clip)">
                  <line v-for="y in bandRows" :key="y" x1="80" x2="370" :y1="y" :y2="y" />
                </g>
                <line class="fig-center" x1="8" x2="384" y1="160" y2="160" />

                <path class="fig-chip" d="M246 224 q -12 6 -6 16 q 6 9 -7 15 q -10 4 -6 12" />
                <polygon
                  class="fig-steel fig-steel--holder"
                  points="260,233 290,233 290,300 260,300"
                />
                <polygon class="fig-insert" points="250,216 274,221 280,245 256,240" />

                <g class="fig-part fig-ipr" :class="partClass('ipr')">
                  <g class="fig-feed-marks" clip-path="url(#mc-finish-clip)">
                    <line
                      v-for="x in feedMarks.xs"
                      :key="x"
                      :x1="x + 10"
                      :x2="x"
                      y1="104"
                      y2="216"
                    />
                  </g>
                  <line :x1="feedMarks.x0" :x2="feedMarks.x0" y1="100" y2="78" />
                  <line :x1="feedMarks.x1" :x2="feedMarks.x1" y1="100" y2="78" />
                  <line :x1="feedMarks.x0 - 16" :x2="feedMarks.x1 + 16" y1="84" y2="84" />
                  <polygon :points="arrowHead(feedMarks.x0, 84, 1, 0, 6)" />
                  <polygon :points="arrowHead(feedMarks.x1, 84, -1, 0, 6)" />
                  <text
                    class="fig-label"
                    text-anchor="middle"
                    :x="(feedMarks.x0 + feedMarks.x1) / 2"
                    y="70"
                  >
                    {{ figureText.ipr }}
                  </text>
                </g>

                <g class="fig-part fig-ipm" :class="partClass('ipm')">
                  <polygon class="fig-ghost" points="130,216 154,221 160,245 136,240" />
                  <line x1="242" x2="142" y1="292" y2="292" />
                  <polygon :points="arrowHead(134, 292, -1, 0)" />
                  <text class="fig-label" text-anchor="middle" x="190" y="280">
                    {{ figureText.ipm }}
                  </text>
                </g>

                <g class="fig-part fig-rpm" :class="partClass('rpm')">
                  <path d="M140 88 A 14 72 0 0 1 140 232" />
                  <polygon :points="arrowHead(140, 234, -0.25, 1)" />
                  <text class="fig-label" text-anchor="middle" x="140" y="78">
                    {{ figureText.rpm }}
                  </text>
                </g>

                <g class="fig-part fig-dia" :class="partClass('dia')">
                  <line x1="372" x2="394" y1="104" y2="104" />
                  <line x1="372" x2="394" y1="216" y2="216" />
                  <line x1="388" x2="388" y1="112" y2="208" />
                  <polygon :points="arrowHead(388, 105, 0, -1)" />
                  <polygon :points="arrowHead(388, 215, 0, 1)" />
                  <text
                    class="fig-label"
                    text-anchor="middle"
                    transform="rotate(-90 404 160)"
                    x="404"
                    y="160"
                  >
                    {{ figureText.dia }}
                  </text>
                </g>

                <g class="fig-part fig-sfm" :class="partClass('sfm')">
                  <circle cx="250" cy="216" r="4" />
                </g>

                <text class="fig-caption" text-anchor="middle" x="200" y="318">TOP VIEW</text>

                <!-- End view from the tailstock: part spins CCW, front surface runs down onto the tool -->
                <line
                  class="fig-center"
                  :x1="end.cx - end.r - 12"
                  :x2="end.cx + end.r + 12"
                  :y1="end.cy"
                  :y2="end.cy"
                />
                <circle class="fig-stock" :cx="end.cx" :cy="end.cy" :r="end.r + 6" />
                <circle :cx="end.cx" :cy="end.cy" fill="url(#mc-face)" :r="end.r" />
                <g class="fig-spinner" :style="{ transformOrigin: `${end.cx}px ${end.cy}px` }">
                  <line
                    v-for="angle in [0, 120, 240]"
                    :key="angle"
                    class="fig-tick"
                    :x1="end.cx + end.r * 0.62 * Math.cos(rad(angle))"
                    :x2="end.cx + end.r * 0.9 * Math.cos(rad(angle))"
                    :y1="end.cy - end.r * 0.62 * Math.sin(rad(angle))"
                    :y2="end.cy - end.r * 0.9 * Math.sin(rad(angle))"
                  />
                </g>

                <polygon
                  class="fig-steel fig-steel--holder"
                  :points="`${end.cx - end.r - 70},${end.cy + 1} ${end.cx - end.r - 26},${end.cy + 1} ${end.cx - end.r - 26},${end.cy + 24} ${end.cx - end.r - 70},${end.cy + 24}`"
                />
                <polygon
                  class="fig-insert"
                  :points="`${end.cx - end.r},${end.cy} ${end.cx - end.r - 32},${end.cy} ${end.cx - end.r - 32},${end.cy + 16} ${end.cx - end.r - 6},${end.cy + 16}`"
                />

                <g class="fig-part fig-rpm" :class="partClass('rpm')">
                  <path :d="end.rpmArc" />
                  <polygon :points="end.rpmHead" />
                  <text
                    class="fig-label"
                    text-anchor="middle"
                    :x="end.rpmLabel[0]"
                    :y="end.rpmLabel[1]"
                  >
                    {{ figureText.rpm }}
                  </text>
                </g>

                <g class="fig-part fig-dia" :class="partClass('dia')">
                  <line
                    :x1="end.cx"
                    :x2="end.cx"
                    :y1="end.cy - end.r + 8"
                    :y2="end.cy + end.r - 8"
                  />
                  <polygon :points="arrowHead(end.cx, end.cy - end.r + 1, 0, -1)" />
                  <polygon :points="arrowHead(end.cx, end.cy + end.r - 1, 0, 1)" />
                  <text
                    class="fig-label fig-label--halo"
                    text-anchor="start"
                    :x="end.cx + 6"
                    :y="end.cy + 18"
                  >
                    {{ figureText.dia }}
                  </text>
                </g>

                <g class="fig-part fig-sfm" :class="partClass('sfm')">
                  <path class="fig-surface" :d="end.surfaceArc" />
                  <line
                    :x1="end.cx - end.r - 10"
                    :x2="end.cx - end.r - 10"
                    :y1="end.cy - 66"
                    :y2="end.cy - 14"
                  />
                  <polygon :points="arrowHead(end.cx - end.r - 10, end.cy - 6, 0, 1)" />
                  <text
                    class="fig-label"
                    text-anchor="end"
                    :x="end.cx - end.r - 18"
                    :y="end.cy - 36"
                  >
                    {{ figureText.sfm }}
                  </text>
                </g>

                <text class="fig-caption" text-anchor="middle" :x="end.cx" y="318">
                  END VIEW · FROM TAILSTOCK
                </text>
              </svg>
            </div>

            <div class="calc-rows">
              <section v-for="row in rows" :key="row.id" class="calc-row">
                <header class="calc-row__header">
                  <div class="calc-row__title" :title="row.subtitle">{{ row.title }}</div>
                  <div class="calc-formula">
                    <template v-for="(token, index) in row.formula" :key="index">
                      <span v-if="typeof token === 'string'">{{ token }}</span>
                      <span
                        v-else
                        class="calc-formula__term"
                        :class="{
                          'is-active': highlightKey === token.key,
                          'is-solved': row.solvedKey === token.key,
                        }"
                        :style="{ '--accent': ACCENTS[token.key] }"
                        >{{ token.text }}</span
                      >
                    </template>
                  </div>
                  <v-btn
                    :aria-label="`Clear ${row.title}`"
                    density="comfortable"
                    icon="mdi-eraser"
                    size="small"
                    title="Clear"
                    variant="text"
                    @click="row.clear()"
                  />
                </header>

                <div class="calc-fields">
                  <CalcField
                    v-for="field in row.fields"
                    :key="field.key"
                    :accent="ACCENTS[field.key]"
                    :active="isActive(row.id, field.key)"
                    :icon="field.icon"
                    :label="field.label"
                    :solved="row.solvedKey === field.key"
                    :step="field.step"
                    :text="row.text[field.key]"
                    :unit="field.unit"
                    @blur="focused = null"
                    @focus="focused = { row: row.id, key: field.key }"
                    @input="row.setInput(field.key, $event)"
                    @mouseenter="hovered = { row: row.id, key: field.key }"
                    @mouseleave="hovered = null"
                  >
                    <template v-if="row.id === 'feed' && field.key === 'rpm'" #action>
                      <v-btn
                        class="calc-copy"
                        density="comfortable"
                        :disabled="!speed.values.value.rpm || rpmMatchesSpeed"
                        :prepend-icon="rpmMatchesSpeed ? 'mdi-link-variant' : 'mdi-arrow-down-bold'"
                        size="x-small"
                        :title="
                          speed.values.value.rpm
                            ? 'Copy RPM from Spindle Speed'
                            : 'Enter a spindle speed first'
                        "
                        variant="tonal"
                        @click.prevent="copySpeedRpm"
                      >
                        {{ copyLabel }}
                      </v-btn>
                    </template>
                  </CalcField>
                </div>
              </section>

              <div class="calc-hint">↑ / ↓ to nudge · Shift ×10 · Alt ÷10</div>
            </div>
          </div>
        </v-window-item>
      </v-window>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import CalcField from '@/components/calculator/CalcField.vue';
import { formatNumber, useLinkedFields } from '@/lib/useLinkedFields';

type Units = 'in' | 'mm';
type CalcTab = 'turning' | 'milling';
type RowId = 'speed' | 'feed';
type SpeedKey = 'dia' | 'rpm' | 'sfm';
type FeedKey = 'rpm' | 'ipr' | 'ipm';
type FigureKey = SpeedKey | FeedKey;

interface FieldDef {
  key: FigureKey;
  label: string;
  unit: string;
  icon: string;
  step: number;
}

type FormulaToken = string | { key: FigureKey; text: string };

interface CalcRow {
  id: RowId;
  title: string;
  subtitle: string;
  fields: FieldDef[];
  formula: FormulaToken[];
  text: Record<string, string>;
  solvedKey: FigureKey | null;
  setInput: (key: FigureKey, value: string) => void;
  clear: () => void;
}

const UNITS_STORAGE_KEY = 'shop-app-calculator-units';
const TAB_STORAGE_KEY = 'shop-app-calculator-tab';
// Tabs that can be opened; add milling here once it's built.
const ENABLED_TABS: readonly CalcTab[] = ['turning'];
const MM_PER_INCH = 25.4;
const METERS_PER_FOOT = 0.3048;

const ACCENTS: Record<FigureKey, string> = {
  dia: 'var(--calc-dia)',
  rpm: 'var(--calc-rpm)',
  sfm: 'var(--calc-sfm)',
  ipr: 'var(--calc-ipr)',
  ipm: 'var(--calc-ipm)',
};

const route = useRoute();
const router = useRouter();

const tab = ref<CalcTab>(loadTab());
const units = ref<Units>(loadUnits());
const focused = ref<{ row: RowId; key: FigureKey } | null>(null);
const hovered = ref<{ row: RowId; key: FigureKey } | null>(null);
const highlight = computed(() => focused.value ?? hovered.value);
const highlightKey = computed(() => highlight.value?.key ?? null);

const inch = computed(() => units.value === 'in');
const lengthUnit = computed(() => (inch.value ? 'in' : 'mm'));

// Feet use D in inches / 12; meters use D in mm / 1000.
const surfaceFactor = computed(() => (inch.value ? 12 : 1000));

const speed = useLinkedFields<SpeedKey>({
  keys: ['dia', 'rpm', 'sfm'],
  // Diameter is what's on the part; speeds are solved around it.
  fixed: ['dia'],
  solve(key, { dia, rpm, sfm }) {
    const k = surfaceFactor.value;
    if (key === 'sfm') return (Math.PI * dia * rpm) / k;
    return (sfm * k) / (Math.PI * dia);
  },
  format(key, value) {
    if (key === 'rpm') return formatNumber(value, 0);
    if (key === 'sfm') return formatNumber(value, 1);
    return formatNumber(value, inch.value ? 4 : 3);
  },
});

const feed = useLinkedFields<FeedKey>({
  keys: ['rpm', 'ipr', 'ipm'],
  // RPM comes from the spindle; feed per rev and feed rate are solved around it.
  fixed: ['rpm'],
  solve(key, { rpm, ipr, ipm }) {
    if (key === 'ipm') return ipr * rpm;
    return ipm / rpm;
  },
  format(key, value) {
    if (key === 'rpm') return formatNumber(value, 0);
    // Feed rate carries two fewer places than feed per rev: 0.0080 in/rev → 9.17 in/min.
    if (key === 'ipr') return formatNumber(value, inch.value ? 4 : 3, true);
    return formatNumber(value, inch.value ? 2 : 1, true);
  },
});

const rpmField = computed<FieldDef>(() => ({
  key: 'rpm',
  label: 'Spindle Speed',
  unit: 'RPM',
  icon: 'mdi-rotate-left',
  step: 10,
}));

const rows = computed<CalcRow[]>(() => {
  const surfaceUnit = inch.value ? 'SFM' : 'm/min';
  const iprUnit = `${lengthUnit.value}/rev`;
  const ipmUnit = `${lengthUnit.value}/min`;

  return [
    {
      id: 'speed',
      title: 'Spindle Speed',
      subtitle: 'Enter a diameter plus RPM or surface speed and the other speed is calculated.',
      fields: [
        {
          key: 'dia',
          label: 'Diameter',
          unit: lengthUnit.value,
          icon: 'mdi-diameter-outline',
          step: inch.value ? 0.01 : 0.1,
        },
        rpmField.value,
        {
          key: 'sfm',
          label: 'Surface Speed',
          unit: surfaceUnit,
          icon: 'mdi-speedometer',
          step: 10,
        },
      ],
      formula: [
        { key: 'sfm', text: surfaceUnit },
        '=',
        'π',
        '×',
        { key: 'dia', text: 'D' },
        '×',
        { key: 'rpm', text: 'RPM' },
        '÷',
        String(surfaceFactor.value),
      ],
      text: speed.text,
      solvedKey: speed.solvedKey.value,
      setInput: (key, value) => speed.setInput(key as SpeedKey, value),
      clear: speed.clear,
    },
    {
      id: 'feed',
      title: 'Feed',
      subtitle: 'Enter RPM plus feed per rev or feed rate and the other feed is calculated.',
      fields: [
        rpmField.value,
        {
          key: 'ipr',
          label: 'Feed per Rev',
          unit: iprUnit,
          icon: 'mdi-format-line-spacing',
          step: inch.value ? 0.001 : 0.01,
        },
        {
          key: 'ipm',
          label: 'Feed Rate',
          unit: ipmUnit,
          icon: 'mdi-arrow-left-bold',
          step: inch.value ? 0.1 : 1,
        },
      ],
      formula: [
        { key: 'ipm', text: ipmUnit },
        '=',
        { key: 'ipr', text: iprUnit },
        '×',
        { key: 'rpm', text: 'RPM' },
      ],
      text: feed.text,
      solvedKey: feed.solvedKey.value,
      setInput: (key, value) => feed.setInput(key as FeedKey, value),
      clear: feed.clear,
    },
  ];
});

const rpmMatchesSpeed = computed(
  () => speed.values.value.rpm !== null && speed.text.rpm === feed.text.rpm,
);

const copyLabel = computed(() => {
  if (rpmMatchesSpeed.value) return 'Matches';
  return speed.values.value.rpm ? `Use ${speed.text.rpm}` : 'From speed';
});

function copySpeedRpm() {
  if (speed.values.value.rpm) feed.setInput('rpm', speed.text.rpm);
}

watch(units, (next) => {
  const toMetric = next === 'mm';
  const scale = (value: number, factor: number) => (toMetric ? value * factor : value / factor);
  speed.convert((key, value) => {
    if (key === 'rpm') return value;
    return scale(value, key === 'dia' ? MM_PER_INCH : METERS_PER_FOOT);
  });
  feed.convert((key, value) => (key === 'rpm' ? value : scale(value, MM_PER_INCH)));
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

function isActive(row: RowId, key: FigureKey) {
  return highlight.value?.row === row && highlight.value.key === key;
}

function partClass(key: FigureKey) {
  return { 'is-active': highlightKey.value === key };
}

// ---- Figure ----

const bandRows = Array.from({ length: 11 }, (_, i) => 80 + i * 16);

// Both rows have an RPM; show whichever row the user is working in, falling back to the other.
const figureRpm = computed(() => {
  const preferFeed = highlight.value?.row === 'feed';
  const [first, second] = preferFeed ? [feed, speed] : [speed, feed];
  if (first.values.value.rpm) return { value: first.values.value.rpm, text: first.text.rpm };
  if (second.values.value.rpm) return { value: second.values.value.rpm, text: second.text.rpm };
  return null;
});

const spinSeconds = computed(() => {
  const rpm = figureRpm.value?.value;
  return rpm ? Math.max(0.35, 4 - Math.log10(rpm)) : 4;
});
const spinState = computed(() => (figureRpm.value ? 'running' : 'paused'));

const figureText = computed(() => {
  const { dia, sfm } = speed.values.value;
  const { ipr, ipm } = feed.values.value;
  const surfaceUnit = inch.value ? 'SFM' : 'm/min';
  return {
    dia: dia ? `Ø ${speed.text.dia} ${lengthUnit.value}` : 'Ø D',
    rpm: figureRpm.value ? `${figureRpm.value.text} RPM` : 'RPM',
    sfm: sfm ? `${speed.text.sfm} ${surfaceUnit}` : surfaceUnit,
    ipr: ipr ? `${feed.text.ipr} ${lengthUnit.value}/rev` : `${lengthUnit.value}/rev`,
    ipm: ipm ? `${feed.text.ipm} ${lengthUnit.value}/min` : `${lengthUnit.value}/min`,
  };
});

function rad(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function arrowHead(x: number, y: number, dx: number, dy: number, size = 8) {
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const bx = x - ux * size;
  const by = y - uy * size;
  const w = size * 0.5;
  return `${x},${y} ${bx - uy * w},${by + ux * w} ${bx + uy * w},${by - ux * w}`;
}

// Log scale from a reading in inches to 0..1, so small and large values both draw sensibly.
function logScale(inches: number | null, min: number, max: number) {
  if (!inches) return 0.5;
  const t = (Math.log10(inches) - Math.log10(min)) / (Math.log10(max) - Math.log10(min));
  return Math.min(1, Math.max(0, t));
}

function toInches(value: number | null) {
  if (value === null) return null;
  return inch.value ? value : value / MM_PER_INCH;
}

// Helical feed marks left on the turned surface, one per revolution behind the tool.
const feedMarks = computed(() => {
  const pitch = 14 + logScale(toInches(feed.values.value.ipr), 0.001, 0.1) * 30;
  const xs: number[] = [];
  for (let x = 250; x <= 380; x += pitch) xs.push(x);
  return { xs, x0: 260, x1: 260 + pitch };
});

const end = computed(() => {
  const cx = 590;
  const cy = 160;
  const r = 34 + logScale(toInches(speed.values.value.dia), 0.1, 16) * 56;

  const point = (radius: number, degrees: number) =>
    [cx + radius * Math.cos(rad(degrees)), cy - radius * Math.sin(rad(degrees))] as const;

  const arcRadius = r + 16;
  const [ax1, ay1] = point(arcRadius, -40);
  const [ax2, ay2] = point(arcRadius, 40);
  // CCW tangent at the arrow tip (screen y is flipped).
  const rpmHead = arrowHead(ax2, ay2, -Math.sin(rad(40)), -Math.cos(rad(40)));

  const [sx1, sy1] = point(r, 140);
  const [sx2, sy2] = point(r, 178);

  return {
    cx,
    cy,
    r,
    rpmArc: `M${ax1} ${ay1} A${arcRadius} ${arcRadius} 0 0 0 ${ax2} ${ay2}`,
    rpmHead,
    rpmLabel: [ax2, ay2 - 12] as const,
    surfaceArc: `M${sx1} ${sy1} A${r} ${r} 0 0 0 ${sx2} ${sy2}`,
  };
});
</script>

<style scoped>
.calc {
  --calc-dia: #0284c7;
  --calc-rpm: #d97706;
  --calc-sfm: #059669;
  --calc-ipr: #7c3aed;
  --calc-ipm: #db2777;
  --metal-hi: #eef1f5;
  --metal-lo: #8d96a2;
  --steel: #4f5864;
  --steel-edge: #353c45;
  --insert: #c9a227;
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
  --metal-hi: #a9b3bf;
  --metal-lo: #3c4650;
  --steel: #2c343d;
  --steel-edge: #4a5561;
  --insert: #e0b84a;
  --tile-bg: rgba(var(--v-theme-on-surface), 0.04);
}

.calc-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(300px, 1fr);
  gap: 24px;
  align-items: start;
}

.calc-figure-wrap {
  position: sticky;
  top: 16px;
  padding: 16px;
  border: 1px solid var(--tile-border);
  border-radius: 14px;
  background:
    radial-gradient(ellipse at top left, rgba(var(--v-theme-primary), 0.06), transparent 60%),
    var(--tile-bg);
}

@media (max-width: 960px) {
  .calc-layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .calc-figure-wrap {
    position: static;
  }
}

.calc-rows {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.calc-row {
  border: 1px solid var(--tile-border);
  border-radius: 14px;
  padding: 10px 14px 14px;
  background: var(--tile-bg);
}

.calc-row__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.calc-row__title {
  white-space: nowrap;
  font-size: 1.1rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.calc-fields {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.calc-copy {
  letter-spacing: 0.04em;
}

.calc-tabs {
  flex: 0 0 auto;
}

.calc-formula {
  display: flex;
  align-items: center;
  gap: 3px;
  margin-left: auto;
  white-space: nowrap;
  padding: 4px 10px;
  border-radius: 8px;
  border: 1px dashed var(--tile-border);
  font-family: ui-monospace, "JetBrains Mono", "Cascadia Mono", Consolas, monospace;
  font-size: 0.8rem;
}

.calc-formula__term {
  padding: 1px 4px;
  border-radius: 6px;
  color: var(--accent);
  transition:
    background-color 0.2s,
    color 0.2s;
}

.calc-formula__term.is-solved {
  text-decoration: underline 2px;
  text-underline-offset: 4px;
}

.calc-formula__term.is-active {
  color: rgb(var(--v-theme-surface));
  background: var(--accent);
}

.calc-hint {
  text-align: center;
  font-size: 0.72rem;
  opacity: 0.5;
}

/* ---- Figure ---- */

.calc-figure {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}

.calc-figure text {
  font-family: ui-monospace, "JetBrains Mono", "Cascadia Mono", Consolas, monospace;
  font-size: 12px;
}

.fig-steel {
  fill: var(--steel);
  stroke: var(--steel-edge);
  stroke-width: 1;
}

.fig-steel--holder {
  opacity: 0.9;
}

.fig-insert {
  fill: var(--insert);
  stroke: var(--steel-edge);
  stroke-width: 1;
}

.fig-chip {
  fill: none;
  stroke: var(--calc-rpm);
  stroke-width: 2;
  stroke-linecap: round;
  opacity: 0.5;
}

.fig-center {
  stroke: var(--fig-ink);
  stroke-width: 1;
  stroke-dasharray: 14 4 3 4;
}

.fig-stock {
  fill: none;
  stroke: var(--fig-ink);
  stroke-width: 1;
  stroke-dasharray: 3 4;
}

.fig-tick {
  stroke: rgba(255, 255, 255, 0.55);
  stroke-width: 3;
  stroke-linecap: round;
}

.fig-bands line {
  stroke: rgba(255, 255, 255, 0.28);
  stroke-width: 2;
}

.fig-bands,
.fig-spinner {
  animation-duration: var(--spin);
  animation-iteration-count: infinite;
  animation-timing-function: linear;
  animation-play-state: var(--spin-state);
}

.fig-bands {
  animation-name: fig-bands;
  animation-duration: calc(var(--spin) / 4);
}

.fig-spinner {
  animation-name: fig-spin;
}

@keyframes fig-bands {
  to {
    transform: translateY(16px);
  }
}

@keyframes fig-spin {
  to {
    transform: rotate(-360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .fig-bands,
  .fig-spinner {
    animation: none;
  }
}

.fig-part {
  fill: currentColor;
  stroke: currentColor;
  stroke-width: 2;
  transition:
    opacity 0.25s,
    filter 0.25s;
}

.fig-part path,
.fig-part line {
  fill: none;
}

.fig-part polygon {
  stroke: none;
}

.fig-part .fig-feed-marks line {
  stroke-width: 1.5;
  opacity: 0.7;
}

.fig-part .fig-ghost {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-dasharray: 3 3;
}

.fig-part .fig-label {
  stroke: none;
  font-weight: 600;
}

.fig-part .fig-label--halo {
  paint-order: stroke;
  stroke: rgb(var(--v-theme-surface));
  stroke-width: 4px;
  stroke-linejoin: round;
}

.fig-surface {
  stroke-width: 4;
  stroke-linecap: round;
  opacity: 0;
  transition: opacity 0.25s;
}

.fig-dia {
  color: var(--calc-dia);
}

.fig-rpm {
  color: var(--calc-rpm);
}

.fig-sfm {
  color: var(--calc-sfm);
}

.fig-ipr {
  color: var(--calc-ipr);
}

.fig-ipm {
  color: var(--calc-ipm);
}

.calc-figure.has-highlight .fig-part:not(.is-active) {
  opacity: 0.22;
}

.fig-part.is-active {
  filter: drop-shadow(0 0 4px currentColor);
}

.fig-part.is-active .fig-surface {
  opacity: 1;
}

.calc-figure .fig-caption {
  fill: var(--fig-ink);
  letter-spacing: 0.15em;
  font-size: 10px;
}
</style>
