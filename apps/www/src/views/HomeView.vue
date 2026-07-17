<template>
  <div class="home-view">
    <img alt="BK Machine logo" class="home-view__logo" :src="logo" />

    <div
      :aria-label="isScanReady ? 'Ready to scan' : 'Not ready to scan'"
      class="scan-stage"
      :class="isScanReady ? 'scan-stage--ready' : 'scan-stage--not-ready'"
    >
      <span class="scan-stage__corner scan-stage__corner--top-left" />
      <span class="scan-stage__corner scan-stage__corner--top-right" />
      <span class="scan-stage__corner scan-stage__corner--bottom-left" />
      <span class="scan-stage__corner scan-stage__corner--bottom-right" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import logo from '@/assets/img/bk_logo.png';

const isWindowFocused = ref(false);
const isDocumentVisible = ref(false);

const isScanReady = computed(() => isWindowFocused.value && isDocumentVisible.value);

function syncFocusState() {
  isWindowFocused.value = document.hasFocus();
  isDocumentVisible.value = document.visibilityState === 'visible';
}

onMounted(() => {
  syncFocusState();
  window.addEventListener('focus', syncFocusState);
  window.addEventListener('blur', syncFocusState);
  document.addEventListener('visibilitychange', syncFocusState);
});

onBeforeUnmount(() => {
  window.removeEventListener('focus', syncFocusState);
  window.removeEventListener('blur', syncFocusState);
  document.removeEventListener('visibilitychange', syncFocusState);
});
</script>

<style scoped>
.home-view {
  position: relative;
  min-height: calc(100dvh - 64px);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: radial-gradient(
    circle at center,
    rgba(255, 255, 255, 0.94) 0%,
    rgba(248, 245, 238, 0.98) 62%,
    rgba(240, 236, 228, 1) 100%
  );
}

.home-view__logo {
  position: absolute;
  inset: 50% auto auto 50%;
  width: min(52vw, 640px);
  transform: translate(-50%, -50%);
  opacity: 0.08;
  filter: grayscale(1);
  pointer-events: none;
  user-select: none;
}

.scan-stage {
  position: relative;
  z-index: 1;
  width: min(72vw, 860px);
  height: min(46vh, 420px);
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.72);
  box-shadow:
    0 18px 48px rgba(0, 0, 0, 0.08),
    inset 0 0 0 1px rgba(255, 255, 255, 0.45);
  backdrop-filter: blur(4px);
}

.scan-stage__corner {
  position: absolute;
  width: 15%;
  min-width: 72px;
  height: 15%;
  min-height: 56px;
  border-color: inherit;
  border-style: solid;
  border-width: 0;
  pointer-events: none;
}

.scan-stage__corner--top-left {
  top: 0;
  left: 0;
  border-top-width: 8px;
  border-left-width: 8px;
  border-top-left-radius: 28px;
}

.scan-stage__corner--top-right {
  top: 0;
  right: 0;
  border-top-width: 8px;
  border-right-width: 8px;
  border-top-right-radius: 28px;
}

.scan-stage__corner--bottom-left {
  bottom: 0;
  left: 0;
  border-bottom-width: 8px;
  border-left-width: 8px;
  border-bottom-left-radius: 28px;
}

.scan-stage__corner--bottom-right {
  right: 0;
  bottom: 0;
  border-right-width: 8px;
  border-bottom-width: 8px;
  border-bottom-right-radius: 28px;
}

.scan-stage--ready {
  color: rgb(46, 160, 67);
  box-shadow:
    0 0 0 6px rgba(46, 160, 67, 0.16),
    0 18px 48px rgba(0, 0, 0, 0.08),
    inset 0 0 0 1px rgba(255, 255, 255, 0.45);
}

.scan-stage--not-ready {
  color: rgb(198, 40, 40);
  box-shadow:
    0 0 0 6px rgba(198, 40, 40, 0.14),
    0 18px 48px rgba(0, 0, 0, 0.08),
    inset 0 0 0 1px rgba(255, 255, 255, 0.45);
}

@media (max-width: 900px) {
  .scan-stage {
    width: calc(100vw - 72px);
    height: min(42vh, 340px);
    border-radius: 24px;
  }

  .scan-stage__corner {
    min-width: 56px;
    min-height: 44px;
  }

  .scan-stage__corner--top-left,
  .scan-stage__corner--top-right {
    border-top-width: 6px;
  }

  .scan-stage__corner--bottom-left,
  .scan-stage__corner--bottom-right {
    border-bottom-width: 6px;
  }

  .scan-stage__corner--top-left,
  .scan-stage__corner--bottom-left {
    border-left-width: 6px;
  }

  .scan-stage__corner--top-right,
  .scan-stage__corner--bottom-right {
    border-right-width: 6px;
  }

  .home-view__logo {
    width: min(76vw, 520px);
  }
}
</style>
