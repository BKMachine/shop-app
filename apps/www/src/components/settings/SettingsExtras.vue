<template>
  <div class="extras">
    <!-- Folder Helper -->
    <v-card class="extra-card" variant="outlined">
      <v-card-item>
        <template #prepend>
          <v-avatar color="primary" variant="tonal">
            <v-icon icon="mdi-folder-network-outline" />
          </v-avatar>
        </template>
        <v-card-title>Folder Helper</v-card-title>
        <v-card-subtitle>Windows PCs</v-card-subtitle>
      </v-card-item>

      <v-card-text class="extra-body">
        <p>Lets the app open stored UNC part folders in Explorer.</p>
        <v-chip
          class="align-self-start extra-chip"
          :color="helperStatusColor"
          size="small"
          variant="tonal"
        >
          {{ helperStatusLabel }}
        </v-chip>
        <p v-if="helperVersion" class="extra-meta">Version {{ helperVersion }}</p>
        <v-btn
          class="align-self-start"
          :disabled="!isWindowsClient"
          :loading="helperCheckPending"
          prepend-icon="mdi-lan-check"
          size="small"
          variant="text"
          @click="checkFolderHelper"
        >
          Check Helper
        </v-btn>
      </v-card-text>

      <v-card-actions class="extra-actions">
        <v-btn
          color="primary"
          :href="installerHref"
          prepend-icon="mdi-download"
          rel="noopener noreferrer"
          target="_blank"
          variant="flat"
        >
          Download Installer
        </v-btn>
      </v-card-actions>
    </v-card>

    <!-- Android app -->
    <v-card class="extra-card" variant="outlined">
      <v-card-item>
        <template #prepend>
          <v-avatar color="green" variant="tonal">
            <v-icon icon="mdi-android" />
          </v-avatar>
        </template>
        <v-card-title>Shop App</v-card-title>
        <v-card-subtitle>Android phones and barcode scanners</v-card-subtitle>
      </v-card-item>

      <v-card-text class="extra-body">
        <template v-if="androidApkHref">
          <p>
            Scan with the phone's camera, or open this page on the device and tap Download. The
            first time, Android asks to allow installs from the browser.
          </p>
          <p class="extra-meta">
            Version {{ androidAppVersion
            }}<span v-if="androidBuiltLabel"> · built {{ androidBuiltLabel }}</span>
          </p>
          <img
            alt="QR code for the Shop App APK download"
            class="extra-qr"
            :src="androidAppQrSrc"
          />
        </template>
        <p v-else-if="androidManifestLoaded" class="extra-meta">
          No Android build has been published yet. Run <code>pnpm build:android_app</code>, then
          rebuild the server.
        </p>
      </v-card-text>

      <v-card-actions v-if="androidApkHref" class="extra-actions">
        <v-btn
          color="primary"
          download="shop-app.apk"
          :href="androidApkHref"
          prepend-icon="mdi-download"
          variant="flat"
        >
          Download APK
        </v-btn>
      </v-card-actions>
    </v-card>

    <!-- Phone photo page -->
    <v-card class="extra-card" variant="outlined">
      <v-card-item>
        <template #prepend>
          <v-avatar color="blue" variant="tonal">
            <v-icon icon="mdi-cellphone-arrow-down" />
          </v-avatar>
        </template>
        <v-card-title>Photo Page</v-card-title>
        <v-card-subtitle>iPhone and Android, no install</v-card-subtitle>
      </v-card-item>

      <v-card-text class="extra-body">
        <p>
          Take a photo, then upload it or print it on a shop printer. Scan the code, then add it to
          the home screen so it opens like an app:
        </p>
        <ul class="extra-steps">
          <li><strong>iPhone (Safari):</strong> Share, then Add to Home Screen</li>
          <li><strong>Android (Chrome):</strong> ⋮ menu, then Add to Home screen</li>
        </ul>
        <img
          alt="QR code linking phones to the camera upload and print page"
          class="extra-qr"
          :src="photoQrSrc"
        />
      </v-card-text>

      <v-card-actions class="extra-actions">
        <v-btn
          color="primary"
          prepend-icon="mdi-open-in-new"
          :to="{ name: 'photo' }"
          variant="flat"
        >
          Open Photo Page
        </v-btn>
      </v-card-actions>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { toastError, toastSuccess } from '@/plugins/vue-toast-notification';
import { androidAppQrSrc, useAndroidAppState } from '@/state/androidApp';
import { useFolderHelperState } from '@/state/folderHelper';

/** QR code of the full /photo link, made by the server from the address this page uses. */
const photoQrSrc = '/api/downloads/photo/qr.svg';

const {
  helperCheckPending,
  helperStatusColor,
  helperStatusLabel,
  helperVersion,
  installerHref,
  isWindowsClient,
  loadFolderHelperManifest,
  runFolderHelperPing,
} = useFolderHelperState();

const {
  apkHref: androidApkHref,
  appVersion: androidAppVersion,
  builtAt: androidBuiltAt,
  manifestLoaded: androidManifestLoaded,
  loadAndroidAppManifest,
} = useAndroidAppState();

const androidBuiltLabel = computed(() => {
  if (!androidBuiltAt.value) return '';
  const date = new Date(androidBuiltAt.value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
});

onMounted(async () => {
  try {
    await loadFolderHelperManifest();
  } catch {
    toastError('Unable to load Folder Helper release info.');
  }
});

onMounted(async () => {
  try {
    await loadAndroidAppManifest();
  } catch {
    toastError('Unable to load Android app release info.');
  }
});

async function checkFolderHelper() {
  const didLaunch = await runFolderHelperPing();
  if (didLaunch) {
    toastSuccess('Folder Helper responded on this PC.');
    return;
  }

  toastError('Folder Helper was not detected. Install it on this PC.');
}
</script>

<style scoped>
.extras {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.extra-card {
  display: flex;
  flex-direction: column;
}

.extra-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12px;
}

.extra-body p {
  margin: 0;
}

.extra-meta {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

/* The helper status is a full sentence; let it wrap instead of being cut off. */
.extra-body .extra-chip {
  height: auto;
  padding-block: 4px;
  white-space: normal;
}

.extra-steps {
  margin: 0;
  padding-left: 20px;
}

/* Pushed to the bottom of the card body, so the codes line up across cards. */
.extra-qr {
  align-self: center;
  margin-top: auto;
  width: 160px;
  height: 160px;
  border-radius: 8px;
}

.extra-actions {
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 16px 16px;
}
</style>
