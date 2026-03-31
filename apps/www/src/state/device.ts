import { reactive } from 'vue';
import api from '@/plugins/axios';

type DeviceSummary = {
  id: string;
  deviceId: string;
  displayName: string;
  deviceType: Device['deviceType'];
  isAdmin: boolean;
  approved: boolean;
  blocked: boolean;
};

type DeviceState = {
  current: DeviceSummary | null;
  loaded: boolean;
};

export const deviceState = reactive<DeviceState>({
  current: null,
  loaded: false,
});

export async function fetchCurrentDevice() {
  try {
    const response = await api.get<{ device: DeviceSummary }>('/devices/me');
    deviceState.current = response.data.device;
  } catch {
    deviceState.current = null;
  } finally {
    deviceState.loaded = true;
  }
}

export function setCurrentDevice(device: DeviceSummary) {
  deviceState.current = device;
  deviceState.loaded = true;
}
