import { computed, ref } from 'vue';

type HelperReleaseManifest = {
  version: string;
  files?: {
    installer?: string | null;
  };
};

export type FolderHelperStatus = 'unknown' | 'likely-installed' | 'needs-install' | 'not-windows';

const PROTOCOL_NAME = 'shop-folder';
const STATUS_STORAGE_KEY = 'shop-folder-helper-status';

const installerHref = ref('/downloads/folder_helper/folder_helper-setup.exe');
const helperVersion = ref<string | null>(null);
const helperManifestLoaded = ref(false);
const helperStatus = ref<FolderHelperStatus>(getInitialStatus());
const helperCheckPending = ref(false);

const isWindowsClient = computed(() => {
  const platform = getNavigatorUserAgentDataPlatform() || navigator.platform || navigator.userAgent;
  return /win/i.test(platform);
});

const helperStatusLabel = computed(() => {
  switch (helperStatus.value) {
    case 'likely-installed':
      return 'Folder Helper is likely installed on this PC.';
    case 'needs-install':
      return 'Folder Helper was not detected. Install it on this PC.';
    case 'not-windows':
      return 'Folder Helper is only available on Windows PCs.';
    default:
      return 'Folder Helper status is unknown until you test or use it from this browser.';
  }
});

const helperStatusColor = computed(() => {
  switch (helperStatus.value) {
    case 'likely-installed':
      return 'success';
    case 'needs-install':
      return 'warning';
    case 'not-windows':
      return 'default';
    default:
      return 'info';
  }
});

export function useFolderHelperState() {
  return {
    helperCheckPending,
    helperStatus,
    helperStatusColor,
    helperStatusLabel,
    helperVersion,
    installerHref,
    isWindowsClient,
    loadFolderHelperManifest,
    normalizeFolderPath,
    openFolderWithHelper,
    runFolderHelperPing,
  };
}

async function loadFolderHelperManifest() {
  if (helperManifestLoaded.value) {
    return;
  }

  try {
    const response = await fetch('/downloads/folder_helper/latest.json', {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      return;
    }

    const manifest = (await response.json()) as HelperReleaseManifest;
    helperVersion.value = manifest.version;

    if (manifest.files?.installer) {
      installerHref.value = manifest.files.installer;
    }
  } finally {
    helperManifestLoaded.value = true;
  }
}

function normalizeFolderPath(value: string | null | undefined): string {
  if (!value) {
    return '';
  }

  const trimmed = value.trim().replace(/^['"]|['"]$/g, '');
  const normalized = trimmed.replace(/\//g, '\\');
  if (normalized.startsWith('\\')) {
    return normalized;
  }

  return /^[A-Za-z]:\\/.test(normalized) ? normalized : '';
}

async function openFolderWithHelper(rawPath: string) {
  const folderPath = normalizeFolderPath(rawPath);
  if (!folderPath) {
    return false;
  }

  return attemptProtocolLaunch(`${PROTOCOL_NAME}://open?path=${encodeURIComponent(folderPath)}`);
}

async function runFolderHelperPing() {
  return attemptProtocolLaunch(`${PROTOCOL_NAME}://ping`);
}

async function attemptProtocolLaunch(href: string) {
  if (!isWindowsClient.value) {
    setHelperStatus('not-windows');
    return false;
  }

  helperCheckPending.value = true;

  try {
    const didLaunch = await new Promise<boolean>((resolve) => {
      let resolved = false;
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';

      const cleanup = () => {
        window.clearTimeout(timeoutId);
        window.removeEventListener('blur', markSuccess);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        iframe.remove();
      };

      const finish = (value: boolean) => {
        if (resolved) return;
        resolved = true;
        cleanup();
        resolve(value);
      };

      const markSuccess = () => finish(true);
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'hidden') {
          markSuccess();
        }
      };

      const timeoutId = window.setTimeout(() => finish(false), 1500);

      window.addEventListener('blur', markSuccess);
      document.addEventListener('visibilitychange', handleVisibilityChange);
      document.body.append(iframe);
      iframe.src = href;
    });

    setHelperStatus(didLaunch ? 'likely-installed' : 'needs-install');
    return didLaunch;
  } finally {
    helperCheckPending.value = false;
  }
}

function getInitialStatus(): FolderHelperStatus {
  if (!isBrowser()) {
    return 'unknown';
  }

  const storedStatus = window.localStorage.getItem(STATUS_STORAGE_KEY);
  if (
    storedStatus === 'unknown' ||
    storedStatus === 'likely-installed' ||
    storedStatus === 'needs-install' ||
    storedStatus === 'not-windows'
  ) {
    return storedStatus;
  }

  return 'unknown';
}

function setHelperStatus(status: FolderHelperStatus) {
  helperStatus.value = status;
  if (isBrowser()) {
    window.localStorage.setItem(STATUS_STORAGE_KEY, status);
  }
}

function isBrowser() {
  return typeof window !== 'undefined';
}

function getNavigatorUserAgentDataPlatform() {
  const maybeNavigator = navigator as Navigator & {
    userAgentData?: {
      platform?: string;
    };
  };

  return maybeNavigator.userAgentData?.platform;
}
