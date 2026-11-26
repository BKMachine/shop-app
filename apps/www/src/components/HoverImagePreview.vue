<template>
  <teleport to="body">
    <div
      v-if="src"
      class="hover-image-preview hover-card"
      :class="{ 'hover-card--dark': isDarkTheme }"
      :style="frameStyle"
    >
      <div class="hover-image-preview__media" :style="mediaStyle">
        <img alt="" class="hover-image-preview__img" :src="src" @load="onLoad" />
      </div>
      <div v-if="hasCaption" class="hover-image-preview__caption">
        <div v-if="title" class="hover-image-preview__title">{{ title }}</div>
        <div v-if="subtitle" class="hover-image-preview__subtitle">{{ subtitle }}</div>
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useTheme } from 'vuetify';

// Fits the image inside MAX_WIDTH x MAX_HEIGHT (scaling up or down) so long, thin parts use
// the extra width instead of being pinned to a fixed width and rendering as a sliver.
const MAX_WIDTH = 600;
const MAX_HEIGHT = 300;
// Keeps narrow images wide enough for a readable caption.
const MIN_CAPTION_WIDTH = 280;
// Frame padding + border, plus the caption block, used to keep the card on screen.
const FRAME_CHROME = 14;
const CAPTION_HEIGHT = 46;
const VIEWPORT_GUTTER = 8;

const props = defineProps<{
  src: string | null;
  /** Viewport rect of the hovered thumbnail; the preview opens to its right. */
  anchor: DOMRect | null;
  /** Caption lines that repeat the row details the preview covers. */
  title?: string;
  subtitle?: string;
}>();

// Teleported to <body>, outside the .v-theme--dark wrapper, so the theme is applied as a class.
const theme = useTheme();
const isDarkTheme = computed(() => theme.global.current.value.dark);
const naturalSize = ref<{ width: number; height: number } | null>(null);
const hasCaption = computed(() => Boolean(props.title || props.subtitle));

watch(
  () => props.src,
  () => {
    naturalSize.value = null;
  },
);

function onLoad(event: Event) {
  const img = event.target as HTMLImageElement;
  if (!img.naturalWidth || !img.naturalHeight) return;
  naturalSize.value = { width: img.naturalWidth, height: img.naturalHeight };
}

const layout = computed(() => {
  const anchor = props.anchor;
  const left = anchor?.right ?? 0;
  const captionHeight = hasCaption.value ? CAPTION_HEIGHT : 0;
  const availableWidth = Math.max(160, window.innerWidth - left - VIEWPORT_GUTTER - FRAME_CHROME);
  const maxWidth = Math.min(MAX_WIDTH, availableWidth);
  const maxHeight = Math.min(
    MAX_HEIGHT,
    window.innerHeight - VIEWPORT_GUTTER * 2 - FRAME_CHROME - captionHeight,
  );

  let width = maxWidth;
  let height = maxHeight;
  if (naturalSize.value) {
    const scale = Math.min(
      maxWidth / naturalSize.value.width,
      maxHeight / naturalSize.value.height,
    );
    width = Math.round(naturalSize.value.width * scale);
    height = Math.round(naturalSize.value.height * scale);
  }

  const frameWidth = hasCaption.value
    ? Math.max(width, Math.min(MIN_CAPTION_WIDTH, maxWidth))
    : width;
  const frameHeight = height + captionHeight + FRAME_CHROME;
  const top = Math.min(
    Math.max(VIEWPORT_GUTTER, anchor?.top ?? 0),
    window.innerHeight - frameHeight - VIEWPORT_GUTTER,
  );

  return { top, left, height, frameWidth };
});

const frameStyle = computed(() => ({
  top: `${layout.value.top}px`,
  left: `${layout.value.left}px`,
  width: `${layout.value.frameWidth}px`,
  visibility: naturalSize.value ? ('visible' as const) : ('hidden' as const),
}));

const mediaStyle = computed(() => ({
  height: `${layout.value.height}px`,
}));
</script>

<style scoped>
.hover-image-preview {
  position: fixed;
  z-index: 2400;
  pointer-events: none;
  box-sizing: content-box;
  padding: 6px;
  border-radius: 8px;
}

.hover-image-preview__media {
  display: flex;
  justify-content: center;
  border-radius: 5px;
  background: #ffffff;
  overflow: hidden;
}

.hover-image-preview__img {
  display: block;
  max-width: 100%;
  height: 100%;
  object-fit: contain;
}

.hover-image-preview__caption {
  box-sizing: border-box;
  height: 46px;
  padding: 6px 4px 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
}

.hover-image-preview__title,
.hover-image-preview__subtitle {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.3;
}

.hover-image-preview__title {
  font-size: 0.9rem;
  font-weight: 700;
}

.hover-image-preview__subtitle {
  font-size: 0.8rem;
  color: var(--hover-card-ink-soft);
}
</style>
