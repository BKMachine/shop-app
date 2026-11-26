import { ref } from 'vue';

type AndroidAppManifest = {
  version: string;
  versionCode: number;
  builtAt?: string;
  files?: {
    apk?: string | null;
  };
};

/** QR code of the full APK link, made by the server from the address this page uses. */
export const androidAppQrSrc = '/api/downloads/android_app/qr.svg';

const apkHref = ref<string | null>(null);
const appVersion = ref<string | null>(null);
const builtAt = ref<string | null>(null);
const manifestLoaded = ref(false);

export function useAndroidAppState() {
  return {
    apkHref,
    appVersion,
    builtAt,
    manifestLoaded,
    loadAndroidAppManifest,
  };
}

/** Reads the manifest staged by `pnpm prepare:android_app`; no manifest means no APK published. */
async function loadAndroidAppManifest() {
  if (manifestLoaded.value) return;

  try {
    const response = await fetch('/downloads/android_app/latest.json', {
      headers: { Accept: 'application/json' },
      cache: 'no-cache',
    });
    if (!response.ok) return;

    const manifest = (await response.json()) as AndroidAppManifest;
    apkHref.value = manifest.files?.apk ?? null;
    appVersion.value = manifest.version;
    builtAt.value = manifest.builtAt ?? null;
  } finally {
    manifestLoaded.value = true;
  }
}
