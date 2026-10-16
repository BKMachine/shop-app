<template>
  <div class="calc-layout">
    <div class="calc-figure-wrap">
      <svg
        aria-label="Milling diagram showing an end mill's diameter, flutes, speed, feed and radial engagement"
        class="calc-figure"
        :class="{ 'has-highlight': highlightKey }"
        role="img"
        :style="{
          '--spin': `${spin}s`,
          '--flute-spin': `${fluteSpin}s`,
          '--flute-pitch': `${side.pitch}px`,
          '--spin-state': spinState,
        }"
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
        <!-- 4 grooves 90° apart around the band; the front two sit at ±45°: 170 ± 28·sin 45° -->
        <g class="fig-groove">
          <line v-for="x in [150.2, 189.8]" :key="x" :x1="x" :x2="x" y1="170" y2="176" />
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
              <template v-for="x in side.bandXs" :key="x">
                <polygon
                  :points="`${x},212 ${x + side.band},212 ${x + side.band - 46},292 ${x - 46},292`"
                />
                <line :x1="x + side.band" :x2="x + side.band - 46" y1="212" y2="292" />
              </template>
            </g>
          </g>
        </g>
        <!-- Climb milling feeding left: chips are thrown off behind the cutter, to the right. -->
        <path class="fig-chip" d="M188 270 q 12 -2 16 -10 q 4 -8 14 -6 M190 284 q 14 4 16 12" />

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
          <line x1="140" x2="44" y1="274" y2="274" />
          <polygon :points="arrowHead(36, 274, -1, 0)" />
          <text class="fig-label fig-label--halo" text-anchor="middle" x="86" y="266">
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
          <path v-for="(d, index) in top.lands" :key="`l${index}`" class="fig-land" :d="d" />
          <path
            v-for="(d, index) in top.gullets"
            :key="`g${index}`"
            class="fig-gullet"
            :d="d"
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

        <!-- Diameter called out with a leader from the cutter's lower left -->
        <g class="fig-part fig-dia" :class="partClass('dia')">
          <path :d="top.diaLeader.line" />
          <polygon :points="top.diaLeader.head" />
          <text
            class="fig-label fig-label--halo"
            text-anchor="end"
            :x="top.diaLeader.label[0]"
            :y="top.diaLeader.label[1]"
          >
            {{ figureText.dia }}
          </text>
        </g>

        <g class="fig-part fig-sfm" :class="partClass('sfm')">
          <line
            :x1="top.cx - top.r - 10"
            :x2="top.cx - top.r - 10"
            :y1="top.cy + 24"
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

        <text class="fig-caption" text-anchor="middle" x="535" y="318">
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
        <template v-if="row.id === 'feed'" #action-flutes>
          <div class="calc-presets">
            <v-btn
              v-for="count in FLUTE_PRESETS"
              :key="count"
              :active="feed.values.value.flutes === count"
              :aria-label="`${count} flutes`"
              class="calc-preset"
              density="compact"
              :disabled="!speed.values.value.dia"
              size="x-small"
              variant="tonal"
              @click.prevent="feed.setInput('flutes', String(count))"
            >
              {{ count }}
            </v-btn>
          </div>
        </template>
        <template v-if="row.id === 'feed'" #action-woc>
          <v-btn
            class="calc-copy"
            density="comfortable"
            :disabled="!wocFlip"
            prepend-icon="mdi-swap-horizontal"
            size="x-small"
            :title="
              wocFlip
                ? `Switch WOC to ${wocFlip.text}`
                : 'Enter a WOC and cutter diameter to switch between length and %'
            "
            variant="tonal"
            @click.prevent="flipWoc"
          >
            {{ wocPercent ? lengthUnit : '%' }}
          </v-btn>
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
  lockUntilDiameter,
  logScale,
  METERS_PER_FOOT,
  MM_PER_INCH,
  rad,
  spinSeconds,
  toInches,
  type Units,
} from '@/lib/calculatorFigure';
import { formatNumber, parsePositive, useLinkedFields } from '@/lib/useLinkedFields';
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

// One-tap flute counts for the common end mills.
const FLUTE_PRESETS = [2, 3, 4, 5];

// True while the WOC text is what the user just typed, before it's committed on blur.
const wocTyped = ref(false);

// Ratio of actual chip thickness to feed per tooth for the current cutter and WOC.
const thinningRatio = computed((): number =>
  chipThinningRatio(speed.values.value.dia, feed.values.value.woc),
);

const feed = useLinkedFields<FeedKey>({
  keys: ['rpm', 'flutes', 'woc', 'chip', 'ipt', 'ipr', 'ipm'],
  // RPM mirrors the Spindle Speed row rather than having a field here.
  fixed: ['rpm', 'flutes'],
  // Without a WOC the cut is treated as full engagement (no chip thinning).
  optional: ['woc'],
  // WOC can be typed as a length or as a percent of the cutter diameter ("25%").
  parse(key, text) {
    if (key !== 'woc' || !isPercent(text)) return parsePositive(text);
    const percent = parsePositive(text);
    const dia = speed.values.value.dia;
    return percent && dia ? (percent / 100) * dia : null;
  },
  solve(key, values, anchor): number {
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
    // Inch lengths keep their decimals so they never read as a whole-number percent.
    if (key === 'woc') return formatNumber(value, inch.value ? 4 : 3, inch.value);
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

  return lockUntilDiameter(
    [
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
          'Uses the RPM from Spindle Speed. Enter flutes and any one feed; the rest are calculated. Add a radial width of cut (WOC, as a length or a percent like 25%; in inches a whole number is a percent, 0.25 a length) under half the cutter diameter and chip thinning raises the feed per tooth needed to hit the chip load.',
        fields: [
          { key: 'flutes', label: 'Flutes', unit: 'FL', icon: 'mdi-fan', step: 1, stacked: true },
          {
            key: 'woc',
            label: 'WOC',
            unit: wocPercent.value ? '% D' : unit,
            percent: wocPercent.value,
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
        setInput: (key, value) => {
          if (key === 'woc') wocTyped.value = true;
          feed.setInput(key as FeedKey, value);
        },
        commit: (key) => {
          if (key === 'woc') commitWoc();
        },
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
  wocTyped.value = false;
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
    feed.convert((key, value) => {
      if (key === 'rpm' || key === 'flutes') return value;
      // A percent WOC is relative to the cutter, so it holds across units.
      if (key === 'woc' && isPercent(feed.text.woc)) return null;
      return scale(value, MM_PER_INCH);
    });
  },
);

// WOC is a percent of the cutter diameter when it ends in %. In inches, a whole number as typed
// ("25") is taken as a percent too, and anything with a decimal ("0.25", "1.0") as a length.
function isPercent(text: string) {
  const trimmed = text.trim();
  if (trimmed.endsWith('%')) return true;
  return wocTyped.value && inch.value && /^\d+$/.test(trimmed);
}

// Once the user leaves the field, spell out a typed percent so it reads the same everywhere after.
function commitWoc() {
  const text = feed.text.woc.trim();
  const bare = isPercent(text) && !text.endsWith('%');
  wocTyped.value = false;
  if (bare) feed.setInput('woc', `${text}%`);
}

const wocPercent = computed(() => isPercent(feed.text.woc));

// WOC written the other way from how it was typed: a length for a percent, a percent for a length.
const wocFlip = computed(() => {
  const { dia } = speed.values.value;
  const { woc } = feed.values.value;
  if (!dia || !woc) return null;
  if (isPercent(feed.text.woc)) return { text: formatNumber(woc, inch.value ? 4 : 3, inch.value) };
  return { text: `${formatNumber((woc / dia) * 100, 1)}%` };
});

function flipWoc() {
  if (!wocFlip.value) return;
  wocTyped.value = false;
  feed.setInput('woc', wocFlip.value.text);
}

function partClass(key: string) {
  return { 'is-active': highlightKey.value === key };
}

// ---- Figure ----

const figureRpm = computed(() =>
  speed.values.value.rpm ? { value: speed.values.value.rpm, text: speed.text.rpm } : null,
);

// Multi-flute cutters strobe at high speed, so milling runs on a slower curve than turning.
const spin = computed(() => spinSeconds(figureRpm.value?.value, 5.5, 1.2));

const toothCount = computed(() =>
  Math.min(8, Math.max(1, Math.round(feed.values.value.flutes ?? 4))),
);

// Side-view flute bands: one band per flute around the 32px cutter's circumference. The bands
// scroll one pitch per flute pass, so `toothCount` pitches of travel equal one top-view turn.
const side = computed(() => {
  const pitch = (Math.PI * 32) / toothCount.value;
  // Cover the 154-186 clip, the 46px helix slant, and one pitch of scroll travel.
  const count = Math.ceil((186 + 46 + pitch - 150) / pitch) + 1;
  return {
    pitch,
    band: pitch * 0.4,
    bandXs: Array.from({ length: count }, (_, i) => 150 + i * pitch),
  };
});
const fluteSpin = computed(() => spin.value / toothCount.value);
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
  const cx = 525;
  const cy = 170;
  const { dia } = speed.values.value;
  const { woc, ipt } = feed.values.value;
  const r = 26 + logScale(toInches(dia, props.units), 0.0625, 2) * 30;
  const teeth = toothCount.value;

  const point = (radius: number, degrees: number) =>
    [cx + radius * Math.cos(rad(degrees)), cy - radius * Math.sin(rad(degrees))] as const;

  // Radial engagement band on the climb side; full slot when WOC reaches the diameter.
  const engagement = dia && woc ? Math.min(2 * r, (2 * r * woc) / dia) : r * 0.6;
  const wallY = cy + r;
  const stripTop = wallY - engagement;
  const exitAngle = Math.min(89, (Math.asin(Math.max(-1, (engagement - r) / r)) * 180) / Math.PI);
  const [ex1, ey1] = point(r, -90);
  const [ex2, ey2] = point(r, exitAngle);

  // End view of a center-cutting end mill. Each end cutting edge runs in from the rim; the first
  // reaches the center (so it can plunge) and the rest stop just shy, leaving a small web. Ahead of
  // each edge (the cutter turns CW, toward lower angles) the gash is ground into the end: its rake
  // face is the edge itself, and it sweeps forward out to the rim at the next tooth's clearance.
  const pitch = 360 / teeth;
  const gashWidth = Math.min(55, pitch * 0.38);
  const landWidth = Math.min(14, pitch * 0.1);
  const innerRadius = (i: number) => (i === 0 ? 0 : r * 0.2);
  const edges = Array.from({ length: teeth }, (_, i) => {
    const angle = 90 + i * pitch;
    return [...point(innerRadius(i), angle), ...point(r, angle)];
  });
  const gullets = Array.from({ length: teeth }, (_, i) => {
    const angle = 90 + i * pitch;
    const [ix, iy] = point(Math.max(innerRadius(i), r * 0.08), angle);
    const [ox, oy] = point(r, angle);
    const [hx, hy] = point(r, angle - gashWidth);
    // Concave back so the gash hugs the edge near the center and opens up toward the rim.
    const [qx, qy] = point(r * 0.7, angle - gashWidth * 0.3);
    return `M${ix} ${iy} L${ox} ${oy} A${r} ${r} 0 0 1 ${hx} ${hy} Q${qx} ${qy} ${ix} ${iy} Z`;
  });
  // Primary clearance land: a narrow bright facet trailing each edge.
  const lands = Array.from({ length: teeth }, (_, i) => {
    const angle = 90 + i * pitch;
    const [ix, iy] = point(Math.max(innerRadius(i), r * 0.08), angle);
    const [ox, oy] = point(r, angle);
    const [bx, by] = point(r, angle + landWidth);
    const [qx, qy] = point(r * 0.6, angle + landWidth * 0.6);
    return `M${ix} ${iy} L${ox} ${oy} A${r} ${r} 0 0 0 ${bx} ${by} Q${qx} ${qy} ${ix} ${iy} Z`;
  });

  // Feed per tooth and per rev are far too small to draw to scale, so exaggerate them.
  const dt = 3 + logScale(toInches(ipt, props.units), 0.0002, 0.02) * 9;
  const dr = Math.min(dt * teeth, 75);

  const arcRadius = r + 12;
  const [ax1, ay1] = point(arcRadius, 160);
  const [ax2, ay2] = point(arcRadius, 110);
  // Clockwise tangent at the arrow tip (screen y is flipped).
  const rpmHead = arrowHead(ax2, ay2, Math.sin(rad(110)), Math.cos(rad(110)));
  const [lx, ly] = point(r + 18, 150);

  // Diameter leader: arrow on the rim below-left, out along the radius, then a short shoulder left.
  const leaderAngle = 240;
  const [tx, ty] = point(r, leaderAngle);
  const [sx, sy] = point(r + 6, leaderAngle);
  const [kx, ky] = point(r + 34, leaderAngle);
  const diaLeader = {
    line: `M${sx} ${sy} L${kx} ${ky} L${kx - 12} ${ky}`,
    // Points in toward the center.
    head: arrowHead(tx, ty, -Math.cos(rad(leaderAngle)), Math.sin(rad(leaderAngle))),
    label: [kx - 16, ky + 4] as const,
  };

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
    lands,
    dt,
    dr,
    yIpt: cy - r - 12,
    yIpr: cy - r - 28,
    yIpm: cy - r - 48,
    diaLeader,
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
