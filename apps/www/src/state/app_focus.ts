import { computed, ref } from 'vue';

const isWindowFocused = ref(false);
const isDocumentVisible = ref(false);
const IDLE_HOME_REDIRECT_STORAGE_KEY = 'shop-app-idle-home-redirect-enabled';
const idleHomeRedirectEnabled = ref(false);

let trackingInitialized = false;

function syncAppFocusState() {
  isWindowFocused.value = document.hasFocus();
  isDocumentVisible.value = document.visibilityState === 'visible';
}

function syncIdleHomeRedirectSetting() {
  if (typeof window === 'undefined') return;

  idleHomeRedirectEnabled.value =
    window.localStorage.getItem(IDLE_HOME_REDIRECT_STORAGE_KEY) === 'true';
}

export function startAppFocusTracking() {
  if (trackingInitialized || typeof window === 'undefined') return;

  trackingInitialized = true;
  syncIdleHomeRedirectSetting();
  syncAppFocusState();
  window.addEventListener('focus', syncAppFocusState);
  window.addEventListener('blur', syncAppFocusState);
  document.addEventListener('visibilitychange', syncAppFocusState);
}

export const isAppScanReady = computed(() => {
  return isWindowFocused.value && isDocumentVisible.value;
});

export const useIdleHomeRedirectEnabled = computed({
  get: () => idleHomeRedirectEnabled.value,
  set: (value: boolean) => {
    idleHomeRedirectEnabled.value = value;
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(IDLE_HOME_REDIRECT_STORAGE_KEY, String(value));
  },
});
