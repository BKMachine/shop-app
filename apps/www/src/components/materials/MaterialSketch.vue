<template>
  <svg
    aria-labelledby="sketchTitle"
    :height="svgSize"
    style="border:1px solid #ccc; background:#fafafa"
    viewBox="0 0 100 100"
    :width="svgSize"
  >
    <title id="sketchTitle">Material Sketch</title>
    <!-- Material sketch shapes -->
    <g v-if="sketchProps && sketchProps.type === 'rect'">
      <rect
        fill="#b3d1ff"
        :height="sketchProps.h ?? 0"
        stroke="#333"
        stroke-width="2"
        :width="sketchProps.w ?? 0"
        :x="sketchProps.x ?? 0"
        :y="sketchProps.y ?? 0"
      />
      <line
        stroke="#888"
        stroke-width="1"
        :x1="sketchProps.x ?? 0"
        :x2="(sketchProps.x ?? 0) + svgSize"
        :y1="sketchProps.y ?? 0"
        :y2="(sketchProps.y ?? 0) - svgSize"
      />
      <line
        stroke="#888"
        stroke-width="1"
        :x1="(sketchProps.x ?? 0) + (sketchProps.w ?? 0)"
        :x2="(sketchProps.x ?? 0) + (sketchProps.w ?? 0) + svgSize"
        :y1="sketchProps.y ?? 0"
        :y2="(sketchProps.y ?? 0) - svgSize"
      />
      <line
        stroke="#888"
        stroke-width="1"
        :x1="(sketchProps.x ?? 0) + (sketchProps.w ?? 0)"
        :x2="(sketchProps.x ?? 0) + (sketchProps.w ?? 0) + svgSize"
        :y1="(sketchProps.y ?? 0) + (sketchProps.h ?? 0)"
        :y2="(sketchProps.y ?? 0) + (sketchProps.h ?? 0) - svgSize"
      />
    </g>
    <g v-else-if="sketchProps && sketchProps.type === 'circle'">
      <circle
        :cx="sketchProps.cx ?? 0"
        :cy="sketchProps.cy ?? 0"
        fill="#b3d1ff"
        :r="sketchProps.r ?? 0"
        stroke="#333"
        stroke-width="2"
      />
      <line
        stroke="#888"
        stroke-width="1"
        :x1="(sketchProps.cx ?? 0) + (sketchProps.r ?? 0) * Math.cos(225 * Math.PI / 180)"
        :x2="(sketchProps.cx ?? 0) + (sketchProps.r ?? 0) * Math.cos(225 * Math.PI / 180) + 120 * Math.cos(-Math.PI/4)"
        :y1="(sketchProps.cy ?? 0) + (sketchProps.r ?? 0) * Math.sin(225 * Math.PI / 180)"
        :y2="(sketchProps.cy ?? 0) + (sketchProps.r ?? 0) * Math.sin(225 * Math.PI / 180) + 120 * Math.sin(-Math.PI/4)"
      />
      <line
        stroke="#888"
        stroke-width="1"
        :x1="(sketchProps.cx ?? 0) + (sketchProps.r ?? 0) * Math.cos(45 * Math.PI / 180)"
        :x2="(sketchProps.cx ?? 0) + (sketchProps.r ?? 0) * Math.cos(45 * Math.PI / 180) + 120 * Math.cos(-Math.PI/4)"
        :y1="(sketchProps.cy ?? 0) + (sketchProps.r ?? 0) * Math.sin(45 * Math.PI / 180)"
        :y2="(sketchProps.cy ?? 0) + (sketchProps.r ?? 0) * Math.sin(45 * Math.PI / 180) + 120 * Math.sin(-Math.PI/4)"
      />
    </g>
    <g v-else-if="sketchProps && sketchProps.type === 'rect-tube'">
      <rect
        fill="#b3d1ff"
        :height="sketchProps.h ?? 0"
        stroke="#333"
        stroke-width="2"
        :width="sketchProps.w ?? 0"
        :x="sketchProps.x ?? 0"
        :y="sketchProps.y ?? 0"
      />
      <rect
        fill="#fafafa"
        :height="(sketchProps.h ?? 0) - 2 * (sketchProps.wall ?? 0)"
        stroke="#333"
        stroke-width="1"
        :width="(sketchProps.w ?? 0) - 2 * (sketchProps.wall ?? 0)"
        :x="(sketchProps.x ?? 0) + (sketchProps.wall ?? 0)"
        :y="(sketchProps.y ?? 0) + (sketchProps.wall ?? 0)"
      />
      <!-- Mimic normal rect 3D lines -->
      <line
        stroke="#888"
        stroke-width="1"
        :x1="sketchProps.x ?? 0"
        :x2="(sketchProps.x ?? 0) + svgSize"
        :y1="sketchProps.y ?? 0"
        :y2="(sketchProps.y ?? 0) - svgSize"
      />
      <line
        stroke="#888"
        stroke-width="1"
        :x1="(sketchProps.x ?? 0) + (sketchProps.w ?? 0)"
        :x2="(sketchProps.x ?? 0) + (sketchProps.w ?? 0) + svgSize"
        :y1="sketchProps.y ?? 0"
        :y2="(sketchProps.y ?? 0) - svgSize"
      />
      <line
        stroke="#888"
        stroke-width="1"
        :x1="(sketchProps.x ?? 0) + (sketchProps.w ?? 0)"
        :x2="(sketchProps.x ?? 0) + (sketchProps.w ?? 0) + svgSize"
        :y1="(sketchProps.y ?? 0) + (sketchProps.h ?? 0)"
        :y2="(sketchProps.y ?? 0) + (sketchProps.h ?? 0) - svgSize"
      />
      <!-- 4th 3D line for inner tube wall corner (bottom left, down and left) -->
      <line
        stroke="#888"
        stroke-width="1"
        :x1="(sketchProps.x ?? 0) + (sketchProps.wall ?? 0)"
        :x2="(sketchProps.x ?? 0) + (sketchProps.wall ?? 0) + ((sketchProps.h ?? 0) - 2 * (sketchProps.wall ?? 0))"
        :y1="(sketchProps.y ?? 0) + (sketchProps.h ?? 0) - (sketchProps.wall ?? 0)"
        :y2="(sketchProps.y ?? 0) + (sketchProps.h ?? 0) - (sketchProps.wall ?? 0) - ((sketchProps.h ?? 0) - 2 * (sketchProps.wall ?? 0))"
      />
    </g>
    <g v-else-if="sketchProps && sketchProps.type === 'circle-tube'">
      <circle
        :cx="sketchProps.cx ?? 0"
        :cy="sketchProps.cy ?? 0"
        fill="#b3d1ff"
        :r="sketchProps.r ?? 0"
        stroke="#333"
        stroke-width="2"
      />
      <circle
        :cx="sketchProps.cx ?? 0"
        :cy="sketchProps.cy ?? 0"
        fill="#fafafa"
        :r="(sketchProps.r ?? 0) - (sketchProps.wall ?? 0)"
        stroke="#333"
        stroke-width="1"
      />
      <line
        stroke="#888"
        stroke-width="1"
        :x1="(sketchProps.cx ?? 0) + (sketchProps.r ?? 0) * Math.cos(225 * Math.PI / 180)"
        :x2="(sketchProps.cx ?? 0) + (sketchProps.r ?? 0) * Math.cos(225 * Math.PI / 180) + 120 * Math.cos(-Math.PI/4)"
        :y1="(sketchProps.cy ?? 0) + (sketchProps.r ?? 0) * Math.sin(225 * Math.PI / 180)"
        :y2="(sketchProps.cy ?? 0) + (sketchProps.r ?? 0) * Math.sin(225 * Math.PI / 180) + 120 * Math.sin(-Math.PI/4)"
      />
      <line
        stroke="#888"
        stroke-width="1"
        :x1="(sketchProps.cx ?? 0) + (sketchProps.r ?? 0) * Math.cos(45 * Math.PI / 180)"
        :x2="(sketchProps.cx ?? 0) + (sketchProps.r ?? 0) * Math.cos(45 * Math.PI / 180) + 120 * Math.cos(-Math.PI/4)"
        :y1="(sketchProps.cy ?? 0) + (sketchProps.r ?? 0) * Math.sin(45 * Math.PI / 180)"
        :y2="(sketchProps.cy ?? 0) + (sketchProps.r ?? 0) * Math.sin(45 * Math.PI / 180) + 120 * Math.sin(-Math.PI/4)"
      />
    </g>
    <!-- Placeholder when no material is selected -->
    <g v-else>
      <rect fill="#fafafa" height="100" stroke="#ccc" stroke-width="0" width="100" x="0" y="0" />
      <text fill="#888" font-size="9" text-anchor="middle" x="50" y="55">No material selected</text>
    </g>
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  material: MaterialFields;
}>();

// SVG size in px
const svgSize = 100;
// ViewBox size in SVG units
const viewBoxSize = 100;

// Compute the sketch properties for SVG rendering
const sketchProps = computed(() => {
  const m = props.material;
  if (!m) return null;

  // Normalize dimensions (avoid null)
  const width = m.width ?? 0;
  const height = m.height ?? 0;
  const diameter = m.diameter ?? 0;
  const wall = m.wallThickness ?? 0;

  // Fit the shape into a 100x100 viewBox, keeping aspect ratio
  const pad = 8;
  if (m.type === 'Flat') {
    if (wall > 0 && width > 0 && height > 0) {
      // Rectangular tube
      // Outer: width x height, Inner: subtract wall thickness
      const scale = Math.min((viewBoxSize - 2 * pad) / width, (viewBoxSize - 2 * pad) / height);
      return {
        type: 'rect-tube',
        x: (viewBoxSize - width * scale) / 2,
        y: (viewBoxSize - height * scale) / 2,
        w: width * scale,
        h: height * scale,
        wall: wall * scale,
      };
    } else if (width > 0 && height > 0) {
      // Solid rectangle
      const scale = Math.min((viewBoxSize - 2 * pad) / width, (viewBoxSize - 2 * pad) / height);
      return {
        type: 'rect',
        x: (viewBoxSize - width * scale) / 2,
        y: (viewBoxSize - height * scale) / 2,
        w: width * scale,
        h: height * scale,
      };
    }
  } else if (m.type === 'Round') {
    if (wall > 0 && diameter > 0) {
      // Round tube
      const scale = (viewBoxSize - 2 * pad) / diameter;
      return {
        type: 'circle-tube',
        cx: viewBoxSize * 0.5,
        cy: viewBoxSize * 0.5,
        r: (diameter * scale) / 2,
        wall: wall * scale,
      };
    } else if (diameter > 0) {
      // Solid round
      const scale = (viewBoxSize - 2 * pad) / diameter;
      return {
        type: 'circle',
        cx: viewBoxSize * 0.5,
        cy: viewBoxSize * 0.5,
        r: (diameter * scale) / 2,
      };
    }
  }
  return null;
});
</script>
<style scoped>
svg {
  display: block;
  margin: 0 auto;
}
</style>
