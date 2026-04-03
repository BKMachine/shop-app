import { reactive } from 'vue';
import api from '@/plugins/axios';

type DeviceState = {
  current: Device | null;
  loaded: boolean;
};

export const deviceState = reactive<DeviceState>({
  current: null,
  loaded: false,
});

export async function fetchCurrentDevice() {
  try {
    const response = await api.get<{ device: Device }>('/devices/me');
    deviceState.current = response.data.device;
    console.log('Current device:', deviceState.current);
  } catch {
    deviceState.current = null;
  } finally {
    deviceState.loaded = true;
  }
}

export function setCurrentDevice(device: Device) {
  deviceState.current = device;
  deviceState.loaded = true;
}
