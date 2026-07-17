import { computed, ref } from 'vue';

const isWindowFocused = ref(false);
const isDocumentVisible = ref(false);

let trackingInitialized = false;

function syncAppFocusState() {
  isWindowFocused.value = document.hasFocus();
  isDocumentVisible.value = document.visibilityState === 'visible';
}

export function startAppFocusTracking() {
  if (trackingInitialized || typeof window === 'undefined') return;

  trackingInitialized = true;
  syncAppFocusState();
  window.addEventListener('focus', syncAppFocusState);
  window.addEventListener('blur', syncAppFocusState);
  document.addEventListener('visibilitychange', syncAppFocusState);
}

export const isAppScanReady = computed(() => {
  return isWindowFocused.value && isDocumentVisible.value;
});
