<template>
  <div class="calc-layout">
    <div class="calc-figure-wrap">
      <svg
        aria-label="Milling diagram showing an end mill's diameter, flutes, speed, feed and radial engagement"
        class="calc-figure"
        :class="{ 'has-highlight': highlightKey }"
        role="img"
        :style="{ '--spin': `${spin}s`, '--spin-state': spinState }"
        viewBox="0 0 720 324"
      >
        <defs>
          <linearGradient id="mm-metal-x" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" style="stop-color: var(--metal-lo)" />
            <stop offset="0.35" style="stop-color: var(--metal-hi)" />
            <stop offset="1" style="stop-color: var(--metal-lo)" />
          </linearGradient>
          <radialGradient id="mm-face" cx="0.38" cy="0.35" r="0.75">
            <stop offset="0" style="stop-color: var(--metal-hi)" />
            <stop offset="1" style="stop-color: var(--metal-lo)" />
          </radialGradient>
          <clipPath id="mm-flute-clip">
            <rect height="80" rx="2" width="32" x="154" y="212" />
          </clipPath>
        </defs>

        <!-- Side view, drawn to scale: a 1/2" x 1-1/4" LOC 3-flute end mill in a powRgrip PG25 holder -->
        <rect class="fig-block" height="50" width="300" x="20" y="250" />

        <polygon class="fig-holder" fill="url(#mm-metal-x)" points="152,4 188,4 204,50 136,50" />
        <polygon
          class="fig-holder"
          fill="url(#mm-metal-x)"
          points="112,50 228,50 228,58 220,64 228,70 228,78 112,78 112,70 120,64 112,58"
        />
        <rect class="fig-steel" height="12" width="18" x="161" y="50" />
        <rect class="fig-holder" fill="url(#mm-metal-x)" height="8" width="92" x="124" y="78" />
        <rect
          class="fig-holder"
          fill="url(#mm-metal-x)"
          height="66"
          rx="2"
          width="88"
          x="126"
          y="86"
        />
        <g class="fig-groove">
          <line x1="126" x2="214" y1="96" y2="96" />
          <line x1="126" x2="214" y1="100" y2="100" />
          <line x1="126" x2="214" y1="142" y2="142" />
        </g>
        <rect class="fig-steel" height="5" width="76" x="132" y="152" />
        <polygon
          class="fig-holder"
          fill="url(#mm-metal-x)"
          points="128,157 212,157 204,170 136,170"
        />
        <rect class="fig-steel" height="6" width="56" x="142" y="170" />
        <g class="fig-groove">
          <line v-for="x in [152, 164, 176, 188]" :key="x" :x1="x" :x2="x" y1="170" y2="176" />
        </g>

        <rect class="fig-holder" fill="url(#mm-metal-x)" height="36" width="32" x="154" y="176" />
        <rect
          class="fig-holder"
          fill="url(#mm-metal-x)"
          height="80"
          rx="2"
          width="32"
          x="154"
          y="212"
        />
        <path class="fig-runout" d="M154 212 Q 172 232 186 212 Z" />
        <g class="fig-part fig-flutes" :class="partClass('flutes')">
          <g clip-path="url(#mm-flute-clip)">
            <g class="fig-flute-lines">
              <template v-for="x in fluteBandXs" :key="x">
                <polygon :points="`${x},212 ${x + 11},212 ${x - 35},292 ${x - 46},292`" />
                <line :x1="x + 11" :x2="x - 35" y1="212" y2="292" />
              </template>
            </g>
          </g>
        </g>
        <path
          class="fig-chip"
          d="M152 270 q -12 -2 -16 -10 q -4 -8 -14 -6 M150 284 q -14 4 -16 12"
        />

        <g class="fig-part fig-rpm" :class="partClass('rpm')">
          <path d="M218 118 A 48 9 0 0 1 122 118" />
          <polygon :points="arrowHead(119, 117, -1, -0.4)" />
          <text class="fig-label" text-anchor="start" x="226" y="112">{{ figureText.rpm }}</text>
        </g>

        <g class="fig-part fig-dia" :class="partClass('dia')">
          <line x1="160" x2="180" y1="232" y2="232" />
          <polygon :points="arrowHead(155, 232, -1, 0, 6)" />
          <polygon :points="arrowHead(185, 232, 1, 0, 6)" />
          <text class="fig-label fig-label--halo" text-anchor="end" x="146" y="236">
            {{ figureText.dia }}
          </text>
        </g>

        <g class="fig-part fig-ipm" :class="partClass('ipm')">
          <line x1="200" x2="296" y1="274" y2="274" />
          <polygon :points="arrowHead(304, 274, 1, 0)" />
          <text class="fig-label fig-label--halo" text-anchor="middle" x="254" y="266">
            {{ figureText.ipm }}
          </text>
        </g>

        <text class="fig-caption" text-anchor="middle" x="170" y="318">SIDE VIEW</text>

        <!-- Top view looking down the spindle: cutter runs clockwise, feeding to the right -->
        <rect class="fig-block" :height="300 - top.wallY" width="337" x="375" :y="top.wallY" />
        <rect
          class="fig-block"
          :height="top.engagement"
          :width="712 - top.cx"
          :x="top.cx"
          :y="top.stripTop"
        />
        <rect
          v-if="top.slot"
          class="fig-block"
          :height="top.cy - top.r - 40"
          width="337"
          x="375"
          y="40"
        />

        <g class="fig-part fig-ipr" :class="partClass('ipr')">
          <circle class="fig-ghost-circle" :cx="top.cx + top.dr" :cy="top.cy" :r="top.r" />
          <line :x1="top.cx" :x2="top.cx + top.dr" :y1="top.yIpr" :y2="top.yIpr" />
          <polygon :points="arrowHead(top.cx + top.dr, top.yIpr, 1, 0, 6)" />
          <text
            class="fig-label fig-label--halo"
            text-anchor="start"
            :x="top.cx + top.dr + 8"
            :y="top.yIpr + 4"
          >
            {{ figureText.ipr }}
          </text>
        </g>

        <g class="fig-part fig-ipt" :class="partClass('ipt')">
          <circle class="fig-ghost-circle" :cx="top.cx + top.dt" :cy="top.cy" :r="top.r" />
          <line :x1="top.cx - 14" :x2="top.cx + top.dt + 14" :y1="top.yIpt" :y2="top.yIpt" />
          <polygon :points="arrowHead(top.cx, top.yIpt, 1, 0, 6)" />
          <polygon :points="arrowHead(top.cx + top.dt, top.yIpt, -1, 0, 6)" />
          <text
            class="fig-label fig-label--halo"
            text-anchor="start"
            :x="top.cx + top.dt + 18"
            :y="top.yIpt + 4"
          >
            {{ figureText.ipt }}
          </text>
        </g>

        <circle :cx="top.cx" :cy="top.cy" fill="url(#mm-face)" :r="top.r" />
        <g
          class="fig-spinner fig-spinner--cw"
          :style="{ transformOrigin: `${top.cx}px ${top.cy}px` }"
        >
          <polygon
            v-for="(points, index) in top.gullets"
            :key="`g${index}`"
            class="fig-gullet"
            :points="points"
          />
          <g class="fig-part fig-flutes" :class="partClass('flutes')">
            <line
              v-for="(edge, index) in top.edges"
              :key="`e${index}`"
              class="fig-edge"
              :x1="edge[0]"
              :x2="edge[2]"
              :y1="edge[1]"
              :y2="edge[3]"
            />
          </g>
        </g>

        <g class="fig-part fig-chip-load" :class="partClass('chip')">
          <path class="fig-engagement" :d="top.engagementArc" />
        </g>

        <g class="fig-part fig-woc" :class="partClass('woc')">
          <line x1="700" x2="700" :y1="top.stripTop - 14" :y2="top.wallY + 14" />
          <polygon :points="arrowHead(700, top.stripTop, 0, 1, 6)" />
          <polygon :points="arrowHead(700, top.wallY, 0, -1, 6)" />
          <text
            class="fig-label fig-label--halo"
            text-anchor="end"
            x="692"
            :y="(top.stripTop + top.wallY) / 2 + 4"
          >
            {{ figureText.woc }}
          </text>
        </g>

        <g class="fig-part fig-ipm" :class="partClass('ipm')">
          <line :x1="top.cx" :x2="top.cx + 122" :y1="top.yIpm" :y2="top.yIpm" />
          <polygon :points="arrowHead(top.cx + 130, top.yIpm, 1, 0)" />
          <text
            class="fig-label fig-label--halo"
            text-anchor="middle"
            :x="top.cx + 65"
            :y="top.yIpm - 7"
          >
            {{ figureText.ipm }}
          </text>
        </g>

        <g class="fig-part fig-rpm" :class="partClass('rpm')">
          <path :d="top.rpmArc" />
          <polygon :points="top.rpmHead" />
          <text
            class="fig-label fig-label--halo"
            text-anchor="end"
            :x="top.rpmLabel[0]"
            :y="top.rpmLabel[1]"
          >
            {{ figureText.rpm }}
          </text>
        </g>

        <g class="fig-part fig-dia" :class="partClass('dia')">
          <line :x1="top.cx" :x2="top.cx" :y1="top.cy - top.r + 8" :y2="top.cy + top.r - 8" />
          <polygon :points="arrowHead(top.cx, top.cy - top.r + 1, 0, -1)" />
          <polygon :points="arrowHead(top.cx, top.cy + top.r - 1, 0, 1)" />
          <text
            class="fig-label fig-label--halo"
            text-anchor="start"
            :x="top.cx + 6"
            :y="top.cy + 4"
          >
            {{ figureText.dia }}
          </text>
        </g>

        <g class="fig-part fig-sfm" :class="partClass('sfm')">
          <line
            :x1="top.cx - top.r - 10"
            :x2="top.cx - top.r - 10"
            :y1="top.cy + 34"
            :y2="top.cy - 6"
          />
          <polygon :points="arrowHead(top.cx - top.r - 10, top.cy - 14, 0, -1)" />
          <text
            class="fig-label fig-label--halo"
            text-anchor="end"
            :x="top.cx - top.r - 16"
            :y="top.cy + 22"
          >
            {{ figureText.sfm }}
          </text>
        </g>

        <text class="fig-caption" text-anchor="middle" :x="top.cx + 30" y="318">
          TOP VIEW · LOOKING DOWN
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
      >
        <template v-if="row.id === 'feed'" #action-rpm>
          <v-btn
            :aria-label="copyTitle"
            density="comfortable"
            :disabled="!speed.values.value.rpm || rpmMatchesSpeed"
            :icon="rpmMatchesSpeed ? 'mdi-link-variant' : 'mdi-arrow-down-bold'"
            size="x-small"
            :title="copyTitle"
            variant="tonal"
            @click.prevent="copySpeedRpm"
          />
        </template>
        <template v-if="row.id === 'feed'" #action-chip>
          <span class="calc-thinning" :class="{ 'is-thinning': thinning.ratio < 1 }">
            {{ thinning.label }}
          </span>
        </template>
      </CalcRow>

      <div class="calc-hint">↑ / ↓ to nudge · Shift ×10 · Alt ÷10</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  arrowHead,
  type CalcRowModel,
  chipThinningRatio,
  type Highlight,
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
type FeedKey = 'rpm' | 'flutes' | 'woc' | 'chip' | 'ipt' | 'ipr' | 'ipm';

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
const surfaceFactor = computed(() => (inch.value ? 12 : 1000));

const speed = useLinkedFields<SpeedKey>({
  keys: ['dia', 'rpm', 'sfm'],
  // Cutter diameter is set by the tool; speeds are solved around it.
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

// Ratio of actual chip thickness to feed per tooth for the current cutter and WOC.
const thinningRatio = computed(() =>
  chipThinningRatio(speed.values.value.dia, feed.values.value.woc),
);

const feed = useLinkedFields<FeedKey>({
  keys: ['rpm', 'flutes', 'woc', 'chip', 'ipt', 'ipr', 'ipm'],
  fixed: ['rpm', 'flutes'],
  // Without a WOC the cut is treated as full engagement (no chip thinning).
  optional: ['woc'],
  solve(key, values, anchor) {
    const flutes = values.flutes ?? 0;
    const rpm = values.rpm ?? 0;
    const ratio = thinningRatio.value;
    // Everything runs through feed per tooth, worked out from whichever feed was typed last.
    const fromAnchor: Record<string, () => number> = {
      chip: () => (values.chip ?? 0) / ratio,
      ipt: () => values.ipt ?? 0,
      ipr: () => (values.ipr ?? 0) / flutes,
      ipm: () => (values.ipm ?? 0) / (flutes * rpm),
    };
    const ipt = fromAnchor[anchor]();
    if (key === 'chip') return ipt * ratio;
    if (key === 'ipt') return ipt;
    if (key === 'ipr') return ipt * flutes;
    return ipt * flutes * rpm;
  },
  format(key, value) {
    if (key === 'rpm' || key === 'flutes') return formatNumber(value, 0);
    if (key === 'woc') return formatNumber(value, inch.value ? 4 : 3);
    // Feed rate carries two fewer places than the per-tooth and per-rev feeds.
    if (key === 'ipm') return formatNumber(value, inch.value ? 2 : 1, true);
    return formatNumber(value, inch.value ? 4 : 3, true);
  },
});

// A new cutter diameter changes the chip thinning, so re-run the feeds around it.
watch(thinningRatio, () => feed.resolve());

const thinning = computed(() => {
  const { dia } = speed.values.value;
  const { woc } = feed.values.value;
  const ratio = thinningRatio.value;
  if (!dia || !woc) return { ratio, label: 'Full engagement' };
  const percent = Math.round((woc / dia) * 100);
  if (ratio >= 1) return { ratio, label: `${percent}% WOC · no thinning` };
  return { ratio, label: `${percent}% WOC · feed ×${(1 / ratio).toFixed(2)}` };
});

const rows = computed<CalcRowModel[]>(() => {
  const surfaceUnit = inch.value ? 'SFM' : 'm/min';
  const unit = lengthUnit.value;
  const fineStep = inch.value ? 0.0005 : 0.01;

  return [
    {
      id: 'speed',
      title: 'Spindle Speed',
      subtitle:
        'Enter a cutter diameter plus RPM or surface speed and the other speed is calculated.',
      fields: [
        {
          key: 'dia',
          label: 'Cutter Diameter',
          unit,
          icon: 'mdi-diameter-outline',
          step: inch.value ? 0.0625 : 1,
        },
        { key: 'rpm', label: 'Spindle Speed', unit: 'RPM', icon: 'mdi-rotate-right', step: 100 },
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
        'Enter RPM, flutes and any one feed; the rest are calculated. Add a radial width of cut (WOC) under half the cutter diameter and chip thinning raises the feed per tooth needed to hit the chip load.',
      fields: [
        {
          key: 'rpm',
          label: 'Spindle',
          unit: 'RPM',
          icon: 'mdi-rotate-right',
          step: 100,
          stacked: true,
        },
        { key: 'flutes', label: 'Flutes', unit: 'FL', icon: 'mdi-fan', step: 1, stacked: true },
        {
          key: 'woc',
          label: 'WOC',
          unit,
          icon: 'mdi-arrow-expand-vertical',
          step: inch.value ? 0.01 : 0.1,
          stacked: true,
        },
        {
          key: 'chip',
          label: 'Chip Load',
          unit: `${unit}`,
          icon: 'mdi-layers-outline',
          step: fineStep,
        },
        {
          key: 'ipt',
          label: 'Feed / Tooth',
          unit: `${unit}/th`,
          icon: 'mdi-tooth-outline',
          step: fineStep,
        },
        {
          key: 'ipr',
          label: 'Feed / Rev',
          unit: `${unit}/rev`,
          icon: 'mdi-rotate-right',
          step: inch.value ? 0.001 : 0.01,
        },
        {
          key: 'ipm',
          label: 'Feed Rate',
          unit: `${unit}/min`,
          icon: 'mdi-arrow-right-bold',
          step: inch.value ? 0.1 : 1,
        },
      ],
      formula: [
        { key: 'ipm', text: `${unit}/min` },
        '=',
        { key: 'ipt', text: `${unit}/th` },
        '×',
        { key: 'flutes', text: 'FL' },
        '×',
        { key: 'rpm', text: 'RPM' },
      ],
      text: feed.text,
      solvedKeys: feed.solvedKeys.value,
      setInput: (key, value) => feed.setInput(key as FeedKey, value),
      clear: feed.clear,
    },
  ];
});

const rpmMatchesSpeed = computed(
  () => speed.values.value.rpm !== null && speed.text.rpm === feed.text.rpm,
);

const copyTitle = computed(() => {
  if (rpmMatchesSpeed.value) return 'Matches Spindle Speed';
  return speed.values.value.rpm
    ? `Use ${speed.text.rpm} RPM from Spindle Speed`
    : 'Enter a spindle speed first';
});

function copySpeedRpm() {
  if (speed.values.value.rpm) feed.setInput('rpm', speed.text.rpm);
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
    feed.convert((key, value) =>
      key === 'rpm' || key === 'flutes' ? value : scale(value, MM_PER_INCH),
    );
  },
);

function partClass(key: string) {
  return { 'is-active': highlightKey.value === key };
}

// ---- Figure ----

// Flute gullets as seen from the side; one band per 28px so the scroll animation loops seamlessly.
const fluteBandXs = Array.from({ length: 5 }, (_, i) => 150 + i * 28);

// Both rows have an RPM; show whichever row the user is working in, falling back to the other.
const figureRpm = computed(() => {
  const preferFeed = highlight.value?.row === 'feed';
  const [first, second] = preferFeed ? [feed, speed] : [speed, feed];
  if (first.values.value.rpm) return { value: first.values.value.rpm, text: first.text.rpm };
  if (second.values.value.rpm) return { value: second.values.value.rpm, text: second.text.rpm };
  return null;
});

const spin = computed(() => spinSeconds(figureRpm.value?.value));
const spinState = computed(() => (figureRpm.value ? 'running' : 'paused'));

const figureText = computed(() => {
  const { dia, sfm } = speed.values.value;
  const { woc, ipt, ipr, ipm } = feed.values.value;
  const unit = lengthUnit.value;
  const surfaceUnit = inch.value ? 'SFM' : 'm/min';
  return {
    dia: dia ? `Ø ${speed.text.dia} ${unit}` : 'Ø D',
    rpm: figureRpm.value ? `${figureRpm.value.text} RPM` : 'RPM',
    sfm: sfm ? `${speed.text.sfm} ${surfaceUnit}` : surfaceUnit,
    woc: woc ? `WOC ${feed.text.woc}` : 'WOC',
    ipt: ipt ? `${feed.text.ipt} ${unit}/th` : `${unit}/th`,
    ipr: ipr ? `${feed.text.ipr} ${unit}/rev` : `${unit}/rev`,
    ipm: ipm ? `${feed.text.ipm} ${unit}/min` : `${unit}/min`,
  };
});

const top = computed(() => {
  const cx = 505;
  const cy = 170;
  const { dia } = speed.values.value;
  const { flutes, woc, ipt } = feed.values.value;
  const r = 26 + logScale(toInches(dia, props.units), 0.0625, 2) * 30;
  const teeth = Math.min(8, Math.max(1, Math.round(flutes ?? 4)));

  const point = (radius: number, degrees: number) =>
    [cx + radius * Math.cos(rad(degrees)), cy - radius * Math.sin(rad(degrees))] as const;

  // Radial engagement band on the climb side; full slot when WOC reaches the diameter.
  const engagement = dia && woc ? Math.min(2 * r, (2 * r * woc) / dia) : r * 0.6;
  const wallY = cy + r;
  const stripTop = wallY - engagement;
  const exitAngle = Math.min(89, (Math.asin(Math.max(-1, (engagement - r) / r)) * 180) / Math.PI);
  const [ex1, ey1] = point(r, -90);
  const [ex2, ey2] = point(r, exitAngle);

  const pitch = 360 / teeth;
  const edges = Array.from({ length: teeth }, (_, i) => {
    const angle = 90 + i * pitch;
    return [...point(r * 0.3, angle), ...point(r, angle)];
  });
  const gullets = Array.from({ length: teeth }, (_, i) => {
    const angle = 90 + i * pitch;
    const sweep = Math.min(50, pitch * 0.35);
    return [point(r * 0.3, angle), point(r, angle), point(r * 0.92, angle - sweep)]
      .map(([x, y]) => `${x},${y}`)
      .join(' ');
  });

  // Feed per tooth and per rev are far too small to draw to scale, so exaggerate them.
  const dt = 3 + logScale(toInches(ipt, props.units), 0.0002, 0.02) * 9;
  const dr = Math.min(dt * teeth, 95);

  const arcRadius = r + 12;
  const [ax1, ay1] = point(arcRadius, 160);
  const [ax2, ay2] = point(arcRadius, 110);
  // Clockwise tangent at the arrow tip (screen y is flipped).
  const rpmHead = arrowHead(ax2, ay2, Math.sin(rad(110)), Math.cos(rad(110)));
  const [lx, ly] = point(r + 18, 150);

  return {
    cx,
    cy,
    r,
    engagement,
    wallY,
    stripTop,
    slot: engagement >= 2 * r,
    engagementArc: `M${ex1} ${ey1} A${r} ${r} 0 0 0 ${ex2} ${ey2}`,
    edges,
    gullets,
    dt,
    dr,
    yIpt: cy - r - 12,
    yIpr: cy - r - 28,
    yIpm: cy - r - 48,
    rpmArc: `M${ax1} ${ay1} A${arcRadius} ${arcRadius} 0 0 1 ${ax2} ${ay2}`,
    rpmHead,
    rpmLabel: [lx - 4, ly] as const,
  };
});
</script>

<style scoped src="./calculator.css"></style>

<style scoped>
.calc-thinning {
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: none;
  opacity: 0.6;
}

.calc-thinning.is-thinning {
  opacity: 1;
}
</style>
