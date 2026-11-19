import { computed, reactive } from 'vue';
import api from '@/plugins/axios';

type DeviceState = {
  current: Device | null;
  loaded: boolean;
};

export const deviceState = reactive<DeviceState>({
  current: null,
  loaded: false,
});

export const isAdmin = computed(() => Boolean(deviceState.current?.isAdmin));

/** The device is flagged as on the shop LAN; LAN-only pages (the schedule) need it. */
export const isLan = computed(() => Boolean(deviceState.current?.isLan));

let currentDeviceRequest: Promise<void> | null = null;

export function fetchCurrentDevice(): Promise<void> {
  currentDeviceRequest = (async () => {
    try {
      const response = await api.get<{ device: Device }>('/devices/me');
      deviceState.current = response.data.device;
      console.log('Current device:', deviceState.current);
    } catch {
      deviceState.current = null;
    } finally {
      deviceState.loaded = true;
    }
  })();
  return currentDeviceRequest;
}

/** Resolves once the current device has loaded, fetching it if nothing has yet. */
export function currentDeviceReady(): Promise<void> {
  return currentDeviceRequest ?? fetchCurrentDevice();
}

export function setCurrentDevice(device: Device) {
  deviceState.current = device;
  deviceState.loaded = true;
}
