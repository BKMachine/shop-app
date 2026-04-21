import Device, { type DeviceDoc } from './device_model.js';

async function findDeviceById(deviceId: string): Promise<DeviceDoc | null> {
  return Device.findOne({ deviceId }).exec();
}

async function findByIp(ip: string): Promise<DeviceDoc | null> {
  return Device.findOne({ lastIp: normalizeIp(ip) }).exec();
}

function updateDevice(deviceId: string, update: Partial<DeviceFields>): void {
  void Device.updateOne({ deviceId }, { $set: update }).exec();
}

async function addDevice(data: DeviceCreate): Promise<DeviceDoc> {
  const device = new Device(data);
  await device.save();
  return device;
}

function normalizeIp(ip: string): string {
  if (ip.startsWith('::ffff:')) {
    return ip.substring(7);
  }
  return ip;
}

export default {
  findDeviceById,
  findByIp,
  updateDevice,
  addDevice,
};
