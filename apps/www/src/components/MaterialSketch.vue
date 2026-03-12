<template>
  <svg
    v-if="sketchProps"
    aria-labelledby="sketchTitle"
    :height="svgSize"
    style="border:1px solid #ccc; background:#fafafa"
    viewBox="0 0 100 100"
    :width="svgSize"
  >
    <title id="sketchTitle">Material Sketch</title>
    <!-- Rectangle (Flat Solid) -->
    <g v-if="sketchProps.type === 'rect'">
      <rect
        fill="#b3d1ff"
        :height="sketchProps.h ?? 0"
        stroke="#333"
        stroke-width="2"
        :width="sketchProps.w ?? 0"
        :x="sketchProps.x ?? 0"
        :y="sketchProps.y ?? 0"
      />
      <!-- Pseudo-3D lines at +45 degrees (up and right), extending off the SVG -->
      <line
        stroke="#888"
        stroke-width="1"
        :x1="sketchProps.x ?? 0"
        :x2="(sketchProps.x ?? 0) + 120"
        :y1="sketchProps.y ?? 0"
        :y2="(sketchProps.y ?? 0) - 120"
      />
      <line
        stroke="#888"
        stroke-width="1"
        :x1="(sketchProps.x ?? 0) + (sketchProps.w ?? 0)"
        :x2="(sketchProps.x ?? 0) + (sketchProps.w ?? 0) + 120"
        :y1="sketchProps.y ?? 0"
        :y2="(sketchProps.y ?? 0) - 120"
      />
      <line
        stroke="#888"
        stroke-width="1"
        :x1="(sketchProps.x ?? 0) + (sketchProps.w ?? 0)"
        :x2="(sketchProps.x ?? 0) + (sketchProps.w ?? 0) + 120"
        :y1="(sketchProps.y ?? 0) + (sketchProps.h ?? 0)"
        :y2="(sketchProps.y ?? 0) + (sketchProps.h ?? 0) - 120"
      />
    </g>
    <!-- Round (Solid) -->
    <g v-else-if="sketchProps.type === 'circle'">
      <circle
        :cx="sketchProps.cx ?? 0"
        :cy="sketchProps.cy ?? 0"
        fill="#b3d1ff"
        :r="sketchProps.r ?? 0"
        stroke="#333"
        stroke-width="2"
      />
      <!-- Pseudo-3D lines for round bar (tangential, up and right) -->
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
    <!-- Rectangular Tube -->
    <g v-else-if="sketchProps.type === 'rect-tube'">
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
      <!-- Pseudo-3D lines -->
      <polyline
        fill="none"
        :points="`
          ${sketchProps.x ?? 0},${sketchProps.y ?? 0}
          ${(sketchProps.x ?? 0) - 8},${(sketchProps.y ?? 0) - 8}
          ${(sketchProps.x ?? 0) + (sketchProps.w ?? 0) - 8},${(sketchProps.y ?? 0) - 8}
          ${(sketchProps.x ?? 0) + (sketchProps.w ?? 0)},${sketchProps.y ?? 0}
        `"
        stroke="#888"
        stroke-width="1"
      />
      <line
        stroke="#888"
        stroke-width="1"
        :x1="(sketchProps.x ?? 0) + (sketchProps.w ?? 0)"
        :x2="(sketchProps.x ?? 0) + (sketchProps.w ?? 0) - 8"
        :y1="sketchProps.y ?? 0"
        :y2="(sketchProps.y ?? 0) - 8"
      />
      <line
        stroke="#888"
        stroke-width="1"
        :x1="(sketchProps.x ?? 0) + (sketchProps.w ?? 0)"
        :x2="(sketchProps.x ?? 0) + (sketchProps.w ?? 0) - 8"
        :y1="(sketchProps.y ?? 0) + (sketchProps.h ?? 0)"
        :y2="(sketchProps.y ?? 0) + (sketchProps.h ?? 0) - 8"
      />
      <line
        stroke="#888"
        stroke-width="1"
        :x1="sketchProps.x ?? 0"
        :x2="(sketchProps.x ?? 0) - 8"
        :y1="(sketchProps.y ?? 0) + (sketchProps.h ?? 0)"
        :y2="(sketchProps.y ?? 0) + (sketchProps.h ?? 0) - 8"
      />
      <line
        stroke="#888"
        stroke-width="1"
        :x1="(sketchProps.x ?? 0) - 8"
        :x2="(sketchProps.x ?? 0) - 8"
        :y1="(sketchProps.y ?? 0) - 8"
        :y2="(sketchProps.y ?? 0) + (sketchProps.h ?? 0) - 8"
      />
      <line
        stroke="#888"
        stroke-width="1"
        :x1="(sketchProps.x ?? 0) + (sketchProps.w ?? 0) - 8"
        :x2="(sketchProps.x ?? 0) + (sketchProps.w ?? 0) - 8"
        :y1="(sketchProps.y ?? 0) - 8"
        :y2="(sketchProps.y ?? 0) + (sketchProps.h ?? 0) - 8"
      />
    </g>
    <!-- Round Tube -->
    <g v-else-if="sketchProps.type === 'circle-tube'">
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
      <!-- Pseudo-3D lines for round tube bar (tangential, up and right) -->
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
    <!-- Fallback -->
    <text v-else fill="red" font-size="12" x="10" y="50">Invalid material</text>
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  material: Material;
}>();

// SVG size in px
const svgSize = 120;

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
      const scale = Math.min((100 - 2 * pad) / width, (100 - 2 * pad) / height);
      return {
        type: 'rect-tube',
        x: (100 - width * scale) / 2,
        y: (100 - height * scale) / 2,
        w: width * scale,
        h: height * scale,
        wall: wall * scale,
      };
    } else if (width > 0 && height > 0) {
      // Solid rectangle
      const scale = Math.min((100 - 2 * pad) / width, (100 - 2 * pad) / height);
      return {
        type: 'rect',
        x: (100 - width * scale) / 2,
        y: (100 - height * scale) / 2,
        w: width * scale,
        h: height * scale,
      };
    }
  } else if (m.type === 'Round') {
    if (wall > 0 && diameter > 0) {
      // Round tube
      const scale = (100 - 2 * pad) / diameter;
      return {
        type: 'circle-tube',
        cx: 50,
        cy: 50,
        r: (diameter * scale) / 2,
        wall: wall * scale,
      };
    } else if (diameter > 0) {
      // Solid round
      const scale = (100 - 2 * pad) / diameter;
      return {
        type: 'circle',
        cx: 50,
        cy: 50,
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
