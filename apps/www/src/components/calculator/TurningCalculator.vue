<template>
  <div class="calc-layout">
    <div class="calc-figure-wrap">
      <svg
        aria-label="Turning diagram showing diameter, spindle speed, surface speed and feed"
        class="calc-figure"
        :class="{ 'has-highlight': highlightKey }"
        role="img"
        :style="{ '--spin': `${spin}s`, '--spin-state': spinState }"
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
        <g clip-path="url(#mc-part-clip)">
          <g class="fig-bands">
            <line v-for="y in bandRows" :key="y" x1="80" x2="370" :y1="y" :y2="y" />
          </g>
        </g>
        <line class="fig-center" x1="8" x2="384" y1="160" y2="160" />

        <path class="fig-chip" d="M246 224 q -12 6 -6 16 q 6 9 -7 15 q -10 4 -6 12" />
        <!-- Square-shank 95° holder (MWLNR-style); the insert overhangs its front corner. -->
        <polygon
          class="fig-steel fig-steel--holder"
          points="256,240 262,226 292,226 292,300 256,300"
        />
        <!-- WNMG trigon: three 80° tips and three 160° corners, 17px edges. Cutting tip at the
             finish surface with the leading edge at 95° to the feed and the trailing edge 5° off
             the finished surface. -->
        <polygon
          class="fig-insert"
          points="250,216 266.9,217.5 282.3,224.7 272.6,238.6 258.7,248.3 251.5,232.9"
        />

        <g class="fig-part fig-ipr" :class="partClass('ipr')">
          <g class="fig-feed-marks" clip-path="url(#mc-finish-clip)">
            <line v-for="x in feedMarks.xs" :key="x" :x1="x + 10" :x2="x" y1="104" y2="216" />
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
          <polygon
            class="fig-ghost"
            points="145,216 161.9,217.5 177.3,224.7 167.6,238.6 153.7,248.3 146.5,232.9"
          />
          <line x1="242" x2="157" y1="292" y2="292" />
          <polygon :points="arrowHead(149, 292, -1, 0)" />
          <text class="fig-label" text-anchor="middle" x="197" y="280">
            {{ figureText.ipm }}
          </text>
        </g>

        <g class="fig-part fig-rpm" :class="partClass('rpm')">
          <!-- CCW: wraps over the stock down its left side and stops on the front face, clear of
               the edge and the tool; the head sits 40° past the left on the same ellipse,
               pointing along its tangent. -->
          <path d="M125 88 A 14 72 0 0 0 113.53 201.3" />
          <polygon :points="arrowHead(114.28, 206.28, 9, 55.16)" />
          <text class="fig-label" text-anchor="middle" x="125" y="78">
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
          <text class="fig-label" text-anchor="middle" :x="end.rpmLabel[0]" :y="end.rpmLabel[1]">
            {{ figureText.rpm }}
          </text>
        </g>

        <g class="fig-part fig-dia" :class="partClass('dia')">
          <line :x1="end.cx" :x2="end.cx" :y1="end.cy - end.r + 8" :y2="end.cy + end.r - 8" />
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
          <text class="fig-label" text-anchor="end" :x="end.cx - end.r - 18" :y="end.cy - 36">
            {{ figureText.sfm }}
          </text>
        </g>

        <text class="fig-caption" text-anchor="middle" :x="end.cx" y="318">
          END VIEW · FROM TAILSTOCK
        </text>
      </svg>
    </div>

    <div class="calc-rows">
      <CalcRow
        v-for="row in rows"
        :key="row.id"
        :active-key="highlight?.row === row.id ? highlight.key : null"
        :highlight-key="highlightKey"
        :row="row"
        @highlight="(source, key) => setHighlight(source, row.id, key)"
      />

      <div class="calc-hint">↑ / ↓ to nudge · Shift ×10 · Alt ÷10</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  arrowHead,
  type CalcRowModel,
  type Highlight,
  lockUntilDiameter,
  logScale,
  METERS_PER_FOOT,
  MM_PER_INCH,
  rad,
  spinSeconds,
  toInches,
  type Units,
} from '@/lib/calculatorFigure';
import { formatNumber, useLinkedFields } from '@/lib/useLinkedFields';
import CalcRow from './CalcRow.vue';

type SpeedKey = 'dia' | 'rpm' | 'sfm';
type FeedKey = 'rpm' | 'ipr' | 'ipm';

const props = defineProps<{ units: Units }>();

const focused = ref<Highlight | null>(null);
const hovered = ref<Highlight | null>(null);
const highlight = computed(() => focused.value ?? hovered.value);
const highlightKey = computed(() => highlight.value?.key ?? null);

function setHighlight(source: 'focus' | 'hover', row: string, key: string | null) {
  const target = source === 'focus' ? focused : hovered;
  target.value = key ? { row, key } : null;
}

const inch = computed(() => props.units === 'in');
const lengthUnit = computed(() => (inch.value ? 'in' : 'mm'));

// Feet use D in inches / 12; meters use D in mm / 1000.
const surfaceFactor = computed(() => (inch.value ? 12 : 1000));

const speed = useLinkedFields<SpeedKey>({
  keys: ['dia', 'rpm', 'sfm'],
  // Diameter is what's on the part; speeds are solved around it.
  fixed: ['dia'],
  solve(key, { dia, rpm, sfm }) {
    const k = surfaceFactor.value;
    if (key === 'sfm') return (Math.PI * (dia ?? 0) * (rpm ?? 0)) / k;
    return ((sfm ?? 0) * k) / (Math.PI * (dia ?? 0));
  },
  format(key, value) {
    if (key === 'rpm') return formatNumber(value, 0);
    if (key === 'sfm') return formatNumber(value, 1);
    return formatNumber(value, inch.value ? 4 : 3);
  },
});

const feed = useLinkedFields<FeedKey>({
  keys: ['rpm', 'ipr', 'ipm'],
  // RPM mirrors the Spindle Speed row; feed per rev and feed rate are solved around it.
  fixed: ['rpm'],
  solve(key, { rpm, ipr, ipm }) {
    if (key === 'ipm') return (ipr ?? 0) * (rpm ?? 0);
    return (ipm ?? 0) / (rpm ?? 0);
  },
  format(key, value) {
    if (key === 'rpm') return formatNumber(value, 0);
    // Feed rate carries two fewer places than feed per rev: 0.0080 in/rev → 9.17 in/min.
    if (key === 'ipr') return formatNumber(value, inch.value ? 4 : 3, true);
    return formatNumber(value, inch.value ? 2 : 1, true);
  },
});

const rows = computed<CalcRowModel[]>(() => {
  const surfaceUnit = inch.value ? 'SFM' : 'm/min';
  const iprUnit = `${lengthUnit.value}/rev`;
  const ipmUnit = `${lengthUnit.value}/min`;

  return lockUntilDiameter(
    [
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
          {
            key: 'rpm',
            label: 'Spindle Speed',
            unit: 'RPM',
            icon: 'mdi-rotate-left',
            step: 10,
          },
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
        solvedKeys: speed.solvedKeys.value,
        setInput: (key, value) => speed.setInput(key as SpeedKey, value),
        clear: speed.clear,
      },
      {
        id: 'feed',
        title: 'Feed',
        subtitle:
          'Uses the RPM from Spindle Speed. Enter feed per rev or feed rate and the other is calculated.',
        fields: [
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
        solvedKeys: feed.solvedKeys.value,
        setInput: (key, value) => feed.setInput(key as FeedKey, value),
        clear: clearFeed,
      },
    ],
    speed.values.value.dia,
  );
});

// The feed row has no RPM field of its own; it follows Spindle Speed, typed or solved.
watch(
  () => speed.text.rpm,
  (rpm) => feed.setInput('rpm', rpm),
);

function clearFeed() {
  feed.clear();
  feed.setInput('rpm', speed.text.rpm);
}

watch(
  () => props.units,
  (next) => {
    const toMetric = next === 'mm';
    const scale = (value: number, factor: number) => (toMetric ? value * factor : value / factor);
    speed.convert((key, value) => {
      if (key === 'rpm') return value;
      return scale(value, key === 'dia' ? MM_PER_INCH : METERS_PER_FOOT);
    });
    feed.convert((key, value) => (key === 'rpm' ? value : scale(value, MM_PER_INCH)));
  },
);

function partClass(key: string) {
  return { 'is-active': highlightKey.value === key };
}

// ---- Figure ----

const bandRows = Array.from({ length: 11 }, (_, i) => 80 + i * 16);

const figureRpm = computed(() =>
  speed.values.value.rpm ? { value: speed.values.value.rpm, text: speed.text.rpm } : null,
);

const spin = computed(() => spinSeconds(figureRpm.value?.value));
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

// Helical feed marks left on the turned surface, one per revolution behind the tool.
const feedMarks = computed(() => {
  const pitch = 14 + logScale(toInches(feed.values.value.ipr, props.units), 0.001, 0.1) * 30;
  const xs: number[] = [];
  for (let x = 250; x <= 380; x += pitch) xs.push(x);
  return { xs, x0: 260, x1: 260 + pitch };
});

const end = computed(() => {
  const cx = 590;
  const cy = 160;
  const r = 34 + logScale(toInches(speed.values.value.dia, props.units), 0.1, 16) * 56;

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

<style scoped src="./calculator.css"></style>
