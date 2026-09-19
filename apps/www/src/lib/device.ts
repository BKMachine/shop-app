type AuditDevice = Audit['device'];

export function getDeviceName(device: AuditDevice | string | null | undefined) {
  if (!device || typeof device === 'string') return 'Unknown device';
  return device.displayName || 'Unknown device';
}

export function getDeviceIcon(device: AuditDevice | string | null | undefined) {
  if (!device || typeof device === 'string') return undefined;
  if (device.deviceType === 'pc') {
    return device.displayName?.toLowerCase().includes('kiosk') ? 'mdi-kiosk' : 'mdi-monitor';
  }
  if (device.deviceType === 'android') return 'mdi-android';
  return undefined;
}

export function getDeviceType(device: AuditDevice | string | null | undefined) {
  if (!device || typeof device === 'string') return 'unknown';
  return device.deviceType;
}
